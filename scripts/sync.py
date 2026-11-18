#!/usr/bin/env python3
"""Daily data sync for The Bowdoin Bulletin (run by .github/workflows/sync.yml).

  1. Listings  – reads the brokerage listings page on bowdoinrealestate.com and
                 refreshes data/listings.json (keeps your manual 'featured'/'note' edits).
  2. Headlines – pulls the RSS feeds in data/config.json -> news_feeds into data/news.json.
  3. Rates     – weekly Freddie Mac 30- and 15-year averages (via FRED) into data/market.json.

Standard library only. Each step fails safely: if a source is down, the old data is kept.
Usage:  python scripts/sync.py [listings|news|rates ...]
"""
import csv, html, io, json, re, sys, time, urllib.request
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from urllib.parse import urljoin
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
UA = "Mozilla/5.0 (compatible; BowdoinBulletinBot/1.0; +https://github.com)"
NOW = datetime.now(timezone.utc).isoformat(timespec="seconds")


def fetch(url, timeout=30):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode(r.headers.get_content_charset() or "utf-8", "replace")


def load(name):
    return json.loads((DATA / name).read_text())


def save(name, obj, compare_keys_ignore=("updated",)):
    """Write only when the meaningful content changed (avoids noisy daily commits)."""
    path = DATA / name
    old = json.loads(path.read_text()) if path.exists() else {}
    strip = lambda o: {k: v for k, v in o.items() if k not in compare_keys_ignore}
    if strip(old) == strip(obj):
        print(f"  {name}: no changes")
        return False
    path.write_text(json.dumps(obj, indent=2, ensure_ascii=False) + "\n")
    print(f"  {name}: updated")
    return True


# ------------------------------------------------------------------ listings
NUM = lambda s: float(s.replace(",", "")) if s else None


def meta(page, prop):
    m = re.search(r'<meta[^>]+(?:property|name)=["\']%s["\'][^>]*content=["\']([^"\']*)' % re.escape(prop), page, re.I) \
        or re.search(r'<meta[^>]+content=["\']([^"\']*)["\'][^>]*(?:property|name)=["\']%s["\']' % re.escape(prop), page, re.I)
    return html.unescape(m.group(1)).strip() if m else ""


def title_from_slug(slug):
    words = slug.split("-")[:-1]
    if "unit" in words:
        i = words.index("unit")
        words = words[:i] + ["#" + words[i + 1].upper()] + words[i + 2:] if i + 1 < len(words) else words
    return " ".join(w if w.startswith("#") else w.capitalize() for w in words)


def parse_listing(page, url, mls, agents):
    text = re.sub(r"<[^>]+>", " ", page)
    text = html.unescape(re.sub(r"\s+", " ", text))
    title = meta(page, "og:title") or (re.search(r"<title>(.*?)</title>", page, re.S | re.I) or [None, ""])[1]
    desc = meta(page, "description") or meta(page, "og:description")
    blob = desc + " " + text[:6000]

    out = {"mls": mls, "url": url}
    # "105 State Street #102, Newburyport, MA 01950" (title can have " | Brand" suffix)
    t = html.unescape(title).split("|")[0].split(" - ")[0].strip()
    m = re.match(r"^(.+?),\s*([A-Za-z .'-]+,\s*MA\s*\d{5})", t)
    if m:
        out["address"], out["city"] = m.group(1).strip(), re.sub(r"\s+", " ", m.group(2)).strip()
    m = re.search(r"(?:Listed at|Price|List Price)[^$]{0,20}\$([\d,]{5,})", blob, re.I) or re.search(r"\$([\d,]{6,})", blob)
    if m: out["price"] = int(NUM(m.group(1)))
    m = re.search(r"(\d+(?:\.\d)?)\s*(?:beds?|bd|bedrooms?)\b", blob, re.I)
    if m: out["beds"] = int(float(m.group(1)))
    m = re.search(r"(\d+(?:\.\d)?)\s*(?:baths?|ba|bathrooms?)\b", blob, re.I)
    if m: out["baths"] = float(m.group(1)) if "." in m.group(1) else int(m.group(1))
    m = re.search(r"([\d,]{3,6})\s*(?:sq\.?\s*ft|sqft|square feet)", blob, re.I)
    if m: out["sqft"] = int(NUM(m.group(1)))
    m = re.search(r"\b(Active|Under Agreement|Pending|Contingent|Coming Soon|Sold|For Rent)\b", text)
    if m: out["status"] = m.group(1)
    m = re.search(r"\b(Single Family(?: Residence)?|Condominium|Condo|Multi[- ]Family|Townhouse|Land|Rental)\b", blob, re.I)
    if m: out["type"] = m.group(1).replace(" Residence", "").replace("Condominium", "Condo")
    for a in agents:
        for n in [a["name"]] + a.get("aliases", []):
            if n.lower() in text.lower():
                out["agent"] = a["name"]; break
        if "agent" in out: break
    img = meta(page, "og:image")
    out["image"] = img if "repliers" in img or "mls" in img.lower() else f"https://cdn.repliers.io/mlspin/IMG-{mls}_1.jpg?class=large"
    return out


def sync_listings(cfg):
    b = cfg["brokerage"]
    src = b["listings_page"]
    current = load("listings.json")
    old = {l["mls"]: l for l in current.get("listings", [])}
    try:
        page = fetch(src)
    except Exception as e:
        print("  listings: could not reach site –", e, "– keeping existing data"); return
    # property links look like /property/44-bowdoin-street-winthrop-73592852
    links = []
    for m in re.finditer(r'(?:https?://[^"\'\s]*?)?(/property/([a-z0-9-]+?-(\d{6,9})))(?=["\'?#\\])', page, re.I):
        if m.group(3) not in [x[1] for x in links]:
            links.append((urljoin(b["website"], m.group(1)), m.group(3), m.group(2)))
    if not links:
        print("  listings: no property links found (site layout may have changed) – keeping existing data"); return
    fresh = []
    for url, mls, slug in links[:24]:
        base = {"mls": mls, "url": url, "address": title_from_slug(slug), "city": "",
                "image": f"https://cdn.repliers.io/mlspin/IMG-{mls}_1.jpg?class=large", "status": "Active"}
        try:
            base.update({k: v for k, v in parse_listing(fetch(url), url, mls, b.get("agents", [])).items() if v})
        except Exception as e:
            print(f"    {mls}: detail page failed ({e}); using basics")
        prev = old.get(mls, {})
        merged = {**prev, **base}
        for k in ("featured", "note"):          # hand-edited fields survive syncs
            merged[k] = prev.get(k, False if k == "featured" else "")
        for k in ("price", "beds", "baths", "sqft", "agent", "type", "city"):  # don't lose data on a partial parse
            if not base.get(k) and prev.get(k): merged[k] = prev[k]
        fresh.append(merged)
        time.sleep(1)
    if fresh and not any(l.get("featured") for l in fresh):
        fresh[0]["featured"] = True
    save("listings.json", {"updated": NOW, "source": src, "listings": fresh})


# ------------------------------------------------------------------ news
def sync_news(cfg):
    news = load("news.json")
    per = int(cfg.get("news_per_category", 6))
    cats = {}
    for feed in cfg.get("news_feeds", []):
        try:
            root = ET.fromstring(fetch(feed["url"]).encode("utf-8"))
        except Exception as e:
            print(f"  news: {feed['category']} failed ({e}) – keeping old items")
            cats[feed["category"]] = news.get("categories", {}).get(feed["category"], [])
            continue
        items, seen = [], set()
        for it in root.iter("item"):
            title = (it.findtext("title") or "").strip()
            link = (it.findtext("link") or "").strip()
            src_el = it.find("source")
            source = (src_el.text or "").strip() if src_el is not None else ""
            if source and title.endswith(" - " + source):
                title = title[: -len(source) - 3]
            key = re.sub(r"\W+", "", title.lower())[:60]
            if not title or not link or key in seen:
                continue
            seen.add(key)
            pub = it.findtext("pubDate")
            try: pub = parsedate_to_datetime(pub).astimezone(timezone.utc).isoformat(timespec="seconds")
            except Exception: pub = None
            items.append({"title": html.unescape(title), "url": link, "source": source, "published": pub})
        items.sort(key=lambda x: x["published"] or "", reverse=True)
        cats[feed["category"]] = items[:per]
        print(f"  news: {feed['category']} – {len(cats[feed['category']])} items")
    news["categories"] = cats
    # Rolling 8-day pool of every headline seen, so editors can pick from the whole week (admin.html)
    pool = {p["url"]: p for p in news.get("pool", [])}
    for cat, items in cats.items():
        for it in items:
            if it["url"] not in pool:
                pool[it["url"]] = {**it, "category": cat, "first_seen": NOW}
    cutoff = datetime.now(timezone.utc).timestamp() - 8 * 86400
    keep = [p for p in pool.values() if datetime.fromisoformat(p.get("first_seen") or NOW).timestamp() >= cutoff]
    keep.sort(key=lambda x: x.get("published") or x.get("first_seen") or "", reverse=True)
    news["pool"] = keep[:200]
    news["updated"] = NOW
    save("news.json", news, compare_keys_ignore=())


# ------------------------------------------------------------------ rates
def fred(series):
    rows = [r for r in csv.reader(io.StringIO(fetch(f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={series}"))) if r]
    vals = [(d, float(v)) for d, v in rows[1:] if v not in (".", "")]
    (d0, v0), (d1, v1) = vals[-2], vals[-1]
    return {"rate": v1, "date": d1, "previous": v0, "change": round(v1 - v0, 2)}


def sync_rates(cfg):
    market = load("market.json")
    rates = market.get("rates", {})
    for key, series in (("30yr", "MORTGAGE30US"), ("15yr", "MORTGAGE15US")):
        try:
            rates[key] = fred(series)
        except Exception as e:
            print(f"  rates: {series} failed ({e}) – keeping old value")
    market["rates"] = rates
    market["updated"] = NOW
    save("market.json", market)


if __name__ == "__main__":
    cfg = load("config.json")
    steps = sys.argv[1:] or ["listings", "news", "rates"]
    for s in steps:
        print(f"→ {s}")
        {"listings": sync_listings, "news": sync_news, "rates": sync_rates}[s](cfg)
