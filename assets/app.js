/* The Bowdoin Bulletin – shared site script. No build step, no dependencies. */
(function () {
  'use strict';

  /* ---------------- helpers ---------------- */
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const bust = () => '?v=' + Math.floor(Date.now() / 60000); // refresh at most once a minute
  async function getJSON(path, fallback) {
    try { const r = await fetch(path + bust()); if (!r.ok) throw 0; return await r.json(); }
    catch (e) { console.warn('Could not load', path); return fallback; }
  }
  async function getText(path) { const r = await fetch(path + bust()); if (!r.ok) throw new Error(path); return r.text(); }
  const money = (n) => (n || n === 0) ? '$' + Number(n).toLocaleString('en-US') : '';
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const parseLocal = (s) => s ? new Date(s.length === 10 ? s + 'T00:00' : s) : null;
  const fmtDate = (d, opts) => d.toLocaleDateString('en-US', opts || { weekday: 'short', month: 'short', day: 'numeric' });
  const fmtTime = (d) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).replace(':00', '');
  const longDate = (s) => fmtDate(parseLocal(s), { month: 'long', day: 'numeric', year: 'numeric' });

  /* ---------------- data ---------------- */
  const D = {};
  async function loadAll() {
    const [config, listings, events, news, market, issues, trivia] = await Promise.all([
      getJSON('data/config.json', {}),
      getJSON('data/listings.json', { listings: [] }),
      getJSON('data/events.json', { events: [] }),
      getJSON('data/news.json', { categories: {}, editors_picks: [] }),
      getJSON('data/market.json', { rates: {}, local_stats: [] }),
      getJSON('data/issues.json', { issues: [] }),
      getJSON('data/trivia.json', { sets: [] }),
    ]);
    Object.assign(D, { config, listings: listings.listings || [], listingsMeta: listings, events: events.events || [], news, market, issues: issues.issues || [], trivia });
    return D;
  }

  /* ---------------- chrome ---------------- */
  function chrome(page) {
    const c = D.config, b = c.brokerage || {};
    const nav = [['index.html', 'Home', 'home'], ['events.html', 'Events', 'events'], ['spotlight.html', 'Community', 'spotlight'], ['qa.html', 'Ask the Attorney', 'qa'], ['issues.html', 'Past Issues', 'issues'], ['trivia.html', 'Trivia', 'trivia']];
    const header = `
      <div class="topbar"><div class="wrap">
        <span>Brought to you by <a href="${esc(b.website)}" target="_blank" rel="noopener">${esc(b.name)}</a></span>
        <span><a href="tel:${esc((b.phone || '').replace(/\D/g, ''))}">${esc(b.phone)}</a> · <a href="mailto:${esc(b.email)}">${esc(b.email)}</a></span>
      </div></div>
      <header class="masthead"><div class="wrap">
        <a class="brand" href="index.html"><img class="brand-logo" src="${esc(b.logo)}" alt="${esc(b.name)}"><div><div class="brand-name">${esc(c.newsletter_name)}</div><div class="brand-sub">Community newsletter</div></div></a>
        <button class="menu-btn" aria-label="Menu">☰ Menu</button>
        <nav class="main">${nav.map(([h, t, k]) => `<a href="${h}" class="${k === page ? 'active' : ''}">${t}</a>`).join('')}
          <a class="cta" href="index.html#subscribe">Subscribe</a></nav>
      </div></header>`;
    const links = Object.entries(b.links || {});
    const footer = `
      <footer class="site"><div class="wrap">
        <div class="foot-grid">
          <div>
            <a class="logo-chip" href="${esc(b.website)}" target="_blank" rel="noopener"><img src="${esc(b.logo)}" alt="${esc(b.name)}" onerror="this.parentNode.textContent='${esc(b.name)}'"></a>
            <p style="margin-top:14px">${esc(c.newsletter_name)} is a free community newsletter from ${esc(b.name)}: a Winthrop-based real estate team helping buyers, sellers and renters across Greater Boston, the North Shore and the South Shore.</p>
            <p>${esc(b.address)}<br><a href="tel:${esc((b.phone || '').replace(/\D/g, ''))}">${esc(b.phone)}</a> · <a href="mailto:${esc(b.email)}">${esc(b.email)}</a></p>
            ${b.instagram ? `<p><a href="${esc(b.instagram)}" target="_blank" rel="noopener">Instagram →</a></p>` : ''}
          </div>
          <div><h4>Real estate</h4><ul>${links.slice(0, 6).map(([t, u]) => `<li><a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)}</a></li>`).join('')}</ul></div>
          <div><h4>Our agents</h4><ul>${(b.agents || []).map((a) => `<li><a href="mailto:${esc(a.email)}">${esc(a.name)}</a><br><span class="small">${esc(a.phone)}</span></li>`).join('')}</ul></div>
        </div>
        <div class="legal">
          <span>© ${new Date().getFullYear()} ${esc(b.name)}. Equal Housing Opportunity. Listing data courtesy of MLS Property Information Network via ${esc((b.website || '').replace(/^https?:\/\/(www\.)?/, ''))}; deemed reliable but not guaranteed.</span>
          <span><a href="trivia.html#rules">Trivia contest rules</a> · <a href="${esc(b.website)}/policy/privacy-policy" target="_blank" rel="noopener">Privacy</a></span>
        </div>
      </div></footer>`;
    document.body.insertAdjacentHTML('afterbegin', header);
    document.body.insertAdjacentHTML('beforeend', footer);
    $('.menu-btn').addEventListener('click', () => $('nav.main').classList.toggle('open'));
    document.title = (document.title ? document.title + ' · ' : '') + c.newsletter_name;
  }

  /* ---------------- signup ---------------- */
  function signupForm(label) {
    const s = (D.config.signup || {});
    if (s.provider === 'mailchimp' && s.action_url) {
      return `<form class="signup" action="${esc(s.action_url)}" method="post" target="_blank">
        <input type="email" name="EMAIL" placeholder="you@email.com" required aria-label="Email address">
        <div style="position:absolute;left:-5000px" aria-hidden="true"><input type="text" name="b_hp" tabindex="-1" value=""></div>
        <button class="btn brass" type="submit">${esc(label || 'Subscribe free')}</button></form>`;
    }
    if (s.provider === 'link' && s.link_url) {
      return `<div class="signup"><a class="btn brass" href="${esc(s.link_url)}" target="_blank" rel="noopener">${esc(label || 'Subscribe free')} →</a></div>`;
    }
    const b = D.config.brokerage || {};
    return `<div class="signup"><a class="btn brass" href="mailto:${esc(b.email)}?subject=${encodeURIComponent('Please add me to ' + D.config.newsletter_name)}">${esc(label || 'Subscribe free')} →</a></div>`;
  }
  function signupBox() {
    return `<div class="signup-box" id="subscribe"><span class="eyebrow">Free · Community newsletter</span>
      <h3 style="margin-top:8px">Get ${esc(D.config.newsletter_name)} in your inbox</h3>
      <p>Local news, community events, a quick market update and the best things to do around town. Plus our Boston Trivia Challenge: top score wins a ${esc((D.config.giveaway || {}).prize || 'gift card')}.</p>
      ${signupForm()}<p class="small" style="margin:10px 0 0">No spam. Unsubscribe anytime.</p></div>`;
  }

  /* ---------------- listings ---------------- */
  function agentFor(name) { return ((D.config.brokerage || {}).agents || []).find((a) => a.name === name || (a.aliases || []).includes(name)); }
  function listingCard(l, wide) {
    if (!l) return '';
    const facts = [l.beds && `${l.beds} bd`, l.baths && `${l.baths} ba`, l.sqft && `${Number(l.sqft).toLocaleString()} sq ft`, l.type].filter(Boolean);
    const status = (l.status || 'Active');
    const badge = l.note ? `<span class="badge">${esc(l.note)}</span>` : status !== 'Active' ? `<span class="badge alt">${esc(status)}</span>` : (l.featured ? '<span class="badge">Featured</span>' : '');
    return `<a class="card listing ${wide ? 'wide' : ''}" href="${esc(l.url)}" target="_blank" rel="noopener">
      <div class="ph" style="background-image:url('${esc(l.image)}')">${badge}</div>
      <div class="body"><div class="price">${money(l.price)}</div><div class="addr">${esc(l.address)}</div><div class="muted small">${esc(l.city)}</div>
      <div class="facts">${facts.map((f) => `<span>${esc(f)}</span>`).join('')}</div>
      ${l.agent ? `<div class="agent">Listed by ${esc(l.agent)} · ${esc(D.config.brokerage.name)}</div>` : ''}</div></a>`;
  }
  const sortedListings = () => D.listings.slice().sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));

  /* ---------------- events ---------------- */
  function eventEnd(e) { return parseLocal(e.end) || new Date(parseLocal(e.start).getTime() + 2 * 3600e3); }
  function upcoming() { const now = new Date(); return D.events.filter((e) => e.start && eventEnd(e) >= now).sort((a, b) => parseLocal(a.start) - parseLocal(b.start)); }
  function eventCard(e, i) {
    const s = parseLocal(e.start), en = parseLocal(e.end);
    const multi = en && en.toDateString() !== s.toDateString();
    const when = multi ? `${fmtDate(s)} – ${fmtDate(en)}` : `${fmtTime(s)}${en ? ' – ' + fmtTime(en) : ''}`;
    return `<div class="card event" data-i="${i}">
      <div class="datebox"><div class="m">${MONTHS[s.getMonth()]}</div><div class="d">${s.getDate()}</div><div class="w">${DAYS[s.getDay()]}</div></div>
      <div><div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px">
          ${e.category ? `<span class="badge alt">${esc(e.category)}</span>` : ''}${e.kid_friendly ? '<span class="badge alt">Kid-friendly</span>' : ''}${e.sample ? '<span class="badge warn">Sample – replace</span>' : ''}</div>
        <h4>${esc(e.title)}</h4>
        <div class="meta">${esc(when)}${e.location ? ' · ' + esc(e.location) : ''}${e.town ? ', ' + esc(e.town) : ''}${e.cost ? ' · ' + esc(e.cost) : ''}</div>
        ${e.description ? `<div class="desc">${esc(e.description)}</div>` : ''}
        <div class="acts">${e.url ? `<a href="${esc(e.url)}" target="_blank" rel="noopener">Details →</a>` : ''}
          <a href="${gcal(e)}" target="_blank" rel="noopener">+ Google Calendar</a><button data-ics="${i}">+ Apple / Outlook</button></div></div></div>`;
  }
  const icsStamp = (d) => d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') + 'T' + String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0') + '00';
  function gcal(e) {
    const s = parseLocal(e.start), en = eventEnd(e);
    const p = new URLSearchParams({ action: 'TEMPLATE', text: e.title, dates: icsStamp(s) + '/' + icsStamp(en), ctz: 'America/New_York', details: (e.description || '') + (e.url ? '\n' + e.url : ''), location: [e.location, e.town].filter(Boolean).join(', ') });
    return 'https://calendar.google.com/calendar/render?' + p.toString();
  }
  function downloadICS(e) {
    const clean = (t) => String(t || '').replace(/[,;\\]/g, (m) => '\\' + m).replace(/\n/g, '\\n');
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Bowdoin Bulletin//EN', 'BEGIN:VEVENT',
      'UID:' + Date.now() + '@bowdoinbulletin', 'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z',
      'DTSTART;TZID=America/New_York:' + icsStamp(parseLocal(e.start)), 'DTEND;TZID=America/New_York:' + icsStamp(eventEnd(e)),
      'SUMMARY:' + clean(e.title), 'LOCATION:' + clean([e.location, e.town].filter(Boolean).join(', ')),
      'DESCRIPTION:' + clean((e.description || '') + (e.url ? ' ' + e.url : '')), 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
    a.download = e.title.replace(/[^\w]+/g, '-').slice(0, 50) + '.ics'; a.click();
  }
  function wireICS(root, list) {
    root.addEventListener('click', (ev) => { const b = ev.target.closest('[data-ics]'); if (b) downloadICS(list[+b.dataset.ics]); });
  }

  /* ---------------- market ---------------- */
  function marketCTA() {
    const m = D.market || {}, c = m.cta || {}, b = D.config.brokerage || {};
    const url = c.url || 'https://www.bowdoinrealestate.com';
    return `<div class="market-cta"><div><span class="eyebrow">Stay in the know</span><h3>${esc(c.title || 'Want property alerts & market updates?')}</h3><p>${esc(c.text || 'Register at bowdoinrealestate.com to get new-listing alerts, market info and more.')}</p></div>
      <div class="acts"><a class="btn brass" href="${esc(url)}" target="_blank" rel="noopener">${esc(c.label || 'Register at bowdoinrealestate.com')} →</a>${b.email ? `<a class="small" href="mailto:${esc(b.email)}?subject=${encodeURIComponent('Real estate question')}">or ask us a question</a>` : ''}</div></div>`;
  }
  function marketHTML() {
    const m = D.market || {};
    const r = m.rates || {}, has = (r['30yr'] || ((m.local_stats || []).some((s) => s.value)));
    return `${m.note ? `<div class="market-note">${md(m.note)}${m.note_source ? `<p class="small muted">${esc(m.note_source)}</p>` : ''}</div>` : ''}${has ? ratesHTML() : ''}${marketCTA()}`;
  }
  function ratesHTML() {
    const r = (D.market || {}).rates || {};
    const items = [['30yr', '30-yr fixed'], ['15yr', '15-yr fixed']].filter(([k]) => r[k]);
    const stats = ((D.market || {}).local_stats || []).filter((s) => s.value);
    if (!items.length && !stats.length) return `<div class="card empty small">Mortgage rates appear here after the first daily data sync runs.</div>`;
    const rateCards = items.map(([k, label]) => {
      const x = r[k], ch = x.change; const cls = ch > 0 ? 'up' : ch < 0 ? 'down' : '';
      return `<div class="card stat"><div class="l">${label} avg.</div><div class="v">${Number(x.rate).toFixed(2)}%</div>
        <div class="c ${cls}">${ch ? (ch > 0 ? '▲ ' : '▼ ') + Math.abs(ch).toFixed(2) + ' vs. prior week' : 'Unchanged'}</div><div class="small muted">Freddie Mac · week of ${longDate(x.date)}</div></div>`;
    });
    const statCards = stats.map((s) => `<div class="card stat"><div class="l">${esc(s.label)}</div><div class="v">${esc(s.value)}</div>${s.change ? `<div class="c">${esc(s.change)}</div>` : ''}${s.period ? `<div class="small muted">${esc(s.period)}</div>` : ''}</div>`);
    const all = rateCards.concat(statCards);
    return `<div class="grid g${Math.min(4, all.length)}">${all.join('')}</div>`;
  }

  /* ---------------- giveaway ---------------- */
  function nextDraw() {
    const g = D.config.giveaway || {}; const [hh, mm] = (g.draw_time || '12:00').split(':').map(Number);
    const now = new Date(); const d = new Date(now); d.setHours(hh, mm, 0, 0);
    const wd = g.draw_weekday == null ? 5 : g.draw_weekday;
    let add = (wd - d.getDay() + 7) % 7; if (add === 0 && d <= now) add = 7;
    d.setDate(d.getDate() + add);
    if (g.frequency === 'monthly') { const m = new Date(now.getFullYear(), now.getMonth() + 1, 0, hh, mm); while (m.getDay() !== wd) m.setDate(m.getDate() - 1); if (m > now) return m; const n = new Date(now.getFullYear(), now.getMonth() + 2, 0, hh, mm); while (n.getDay() !== wd) n.setDate(n.getDate() - 1); return n; }
    if (g.frequency === 'biweekly') { const anchor = new Date(2026, 0, 2, hh, mm); while (Math.round((d - anchor) / 864e5 / 7) % 2) d.setDate(d.getDate() + 7); }
    return d;
  }
  function currentSet() {
    const t = D.trivia || {}; const today = new Date();
    return (t.sets || []).filter((x) => parseLocal(x.start) <= today).sort((a, b) => b.start.localeCompare(a.start))[0];
  }
  function giveawayBox(compact) {
    const g = D.config.giveaway || {}; if (g.enabled === false) return '';
    const draw = nextDraw(), set = currentSet();
    return `<div class="give"><div class="gift" aria-hidden="true">🧠</div>
      <span class="eyebrow">${esc(g.game_name || 'Boston Trivia Challenge')}</span>
      <h3 style="margin-top:8px">Know Boston? Win a ${esc(g.prize)}</h3>
      <p style="margin:0">${set ? `Theme: <b>${esc(set.title)}</b>. ` : ''}${set ? set.questions.length : 10} questions, ${esc((D.trivia || {}).seconds_per_question || 15)} seconds each. Free for ${esc(D.config.newsletter_name)} subscribers. Highest score wins; ties go to the fastest time. Closes <b>${fmtDate(draw, { weekday: 'long', month: 'short', day: 'numeric' })} at ${fmtTime(draw)}</b>.</p>
      <div class="count" data-countdown="${draw.toISOString()}"><div><b>–</b><span>days</span></div><div><b>–</b><span>hrs</span></div><div><b>–</b><span>min</span></div>${compact ? '' : '<div><b>–</b><span>sec</span></div>'}</div>
      ${compact ? '<a class="btn brass" href="trivia.html#play">Play the trivia →</a>' : ''}
      <div class="fine">Free to play. No purchase necessary. Open to ${esc(g.eligible_area || 'Massachusetts')} residents ${esc(g.min_age || 18)}+. <a href="trivia.html#rules">Official rules</a>.</div></div>`;
  }
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  function tickCountdowns() {
    $$('[data-countdown]').forEach((el) => {
      let ms = Math.max(0, new Date(el.dataset.countdown) - new Date());
      const parts = [864e5, 36e5, 6e4, 1e3].map((u) => { const v = Math.floor(ms / u); ms -= v * u; return v; });
      $$('b', el).forEach((b, i) => { b.textContent = parts[i]; });
    });
  }

  /* ---------------- news ---------------- */
  function newsBlock(el) {
    const n = D.news || {}; const cats = Object.keys(n.categories || {}).filter((k) => (n.categories[k] || []).length);
    const picks = n.editors_picks || [];
    const tabs = (picks.length ? ["Editor's picks"] : []).concat(cats);
    if (!tabs.length) { el.innerHTML = `<div class="card empty">Headlines refresh automatically every morning once the site's daily sync is turned on.</div>`; return; }
    const listFor = (t) => (t === "Editor's picks" ? picks : n.categories[t]).map((a) => `<li><a href="${esc(a.url)}" target="_blank" rel="noopener">${esc(a.title)}</a>
      <div class="src">${esc(a.source || '')}${a.published ? ' · ' + esc(relTime(a.published)) : ''}</div>${a.blurb ? `<div class="small">${esc(a.blurb)}</div>` : ''}</li>`).join('');
    el.innerHTML = `<div class="card pad"><div class="tabs">${tabs.map((t, i) => `<button class="tab ${i ? '' : 'on'}" data-t="${esc(t)}">${esc(t)}</button>`).join('')}</div>
      <ul class="news-list">${listFor(tabs[0])}</ul>${n.updated ? `<div class="small muted" style="margin-top:8px">Updated ${esc(relTime(n.updated))}</div>` : ''}</div>`;
    el.addEventListener('click', (ev) => { const b = ev.target.closest('.tab'); if (!b) return; $$('.tab', el).forEach((x) => x.classList.toggle('on', x === b)); $('.news-list', el).innerHTML = listFor(b.dataset.t); });
  }
  /* ---------- collapse long lists (keeps phone scrolling short) ---------- */
  const CLAMPS = [
    ['.news-list', 4, 4, 'headlines'],
    ['.cal-wrap .grid', 3, 4, 'events'],
    ['[data-evlist]', 3, 4, 'events'],
    ['.season-grid', 2, 4, 'markets & shops'],
    ['.features-grid', 2, 99, 'stories'],
  ];
  function clampAll() {
    const phone = window.matchMedia('(max-width:700px)').matches;
    CLAMPS.forEach(([sel, nPhone, nDesk, label]) => document.querySelectorAll(sel).forEach((el) => {
      const n = phone ? nPhone : nDesk, kids = Array.from(el.children).filter((c) => !c.classList.contains('clamp-btn'));
      const extra = kids.length - n;
      let btn = el.__clampBtn && el.__clampBtn.isConnected ? el.__clampBtn : null;
      if (extra <= 0) { kids.forEach((c) => c.classList.remove('clamp-x')); el.classList.remove('clamped'); if (btn) btn.remove(); return; }
      const done = kids.every((c, i) => c.classList.contains('clamp-x') === (i >= n)) && btn;
      if (done) return;
      kids.forEach((c, i) => c.classList.toggle('clamp-x', i >= n));
      el.classList.add('clamped');
      if (!btn) {
        btn = document.createElement('button'); btn.type = 'button'; btn.className = 'clamp-btn';
        btn.addEventListener('click', () => { const open = el.classList.toggle('open'); btn.dataset.open = open ? '1' : ''; setLabel(); if (!open) el.scrollIntoView({ block: 'nearest' }); });
        el.after(btn); el.__clampBtn = btn;
      }
      const setLabel = () => { const c = el.querySelectorAll(':scope > .clamp-x').length; btn.textContent = el.classList.contains('open') ? 'Show less ▴' : `Show ${c} more ${label} ▾`; };
      setLabel();
    }));
  }
  let clampT; const queueClamp = () => { clearTimeout(clampT); clampT = setTimeout(clampAll, 60); };
  new MutationObserver(queueClamp).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('resize', queueClamp);

  function relTime(iso) {
    const d = new Date(iso); const h = (Date.now() - d) / 36e5;
    if (isNaN(h)) return ''; if (h < 1) return 'just now'; if (h < 24) return Math.round(h) + 'h ago'; if (h < 24 * 7) return Math.round(h / 24) + 'd ago';
    return fmtDate(d, { month: 'short', day: 'numeric' });
  }

  /* ---------------- markdown (tiny) ---------------- */
  function inline(t) {
    return esc(t)
      .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<img src="$2" alt="$1" style="border-radius:12px;margin:10px 0">')
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, a, u) => `<a href="${u}"${/^https?:/.test(u.replace(/&amp;/g, '&')) ? ' target="_blank" rel="noopener"' : ''}>${a}</a>`)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[\s(])_([^_]+)_(?=[\s).,!?:;]|$)/g, '$1<em>$2</em>')
      .replace(/(^|[\s(])\*([^*]+)\*(?=[\s).,!?:;]|$)/g, '$1<em>$2</em>');
  }
  function shortcode(code) {
    const [name, arg] = code.split(':').map((s) => s.trim());
    switch (name) {
      case 'listing': return listingCard(D.listings.find((l) => l.mls === arg), true) || `<div class="notice">Listing ${esc(arg)} is no longer active. <a href="${esc(D.config.brokerage.listings_page)}" target="_blank">See current listings →</a></div>`;
      case 'listings': return `<div class="grid g2">${sortedListings().map((l) => listingCard(l)).join('')}</div>`;
      case 'events': { const list = upcoming().slice(0, +arg || 4); return list.length ? `<div class="grid" data-evlist>${list.map(eventCard).join('')}</div>` : '<div class="card empty">No upcoming events right now. Check back soon!</div>'; }
      case 'rates': return ratesHTML();
      case 'market': return marketHTML();
      case 'giveaway': case 'trivia': return giveawayBox(true);
      case 'signup': return signupBox();
      default: return (window.LLShortcodes && window.LLShortcodes[name]) ? window.LLShortcodes[name](arg) : '';
    }
  }
  function md(src) {
    src = src.replace(/<!--[\s\S]*?-->/g, '').replace(/\r/g, '');
    const out = []; let para = [], list = null;
    const flushP = () => { if (para.length) { out.push('<p>' + inline(para.join(' ')) + '</p>'); para = []; } };
    const flushL = () => { if (list) { out.push(`<${list.t}>${list.items.map((i) => '<li>' + inline(i) + '</li>').join('')}</${list.t}>`); list = null; } };
    for (const raw of src.split('\n')) {
      const line = raw.trim(); let m;
      if (!line) { flushP(); flushL(); continue; }
      if ((m = line.match(/^\{\{(.+)\}\}$/))) { flushP(); flushL(); out.push(`<div class="embed">${shortcode(m[1])}</div>`); continue; }
      if ((m = line.match(/^(#{1,4})\s+(.*)$/))) { flushP(); flushL(); const n = Math.min(4, Math.max(2, m[1].length)); out.push(`<h${n}>${inline(m[2])}</h${n}>`); continue; }
      if ((m = line.match(/^>\s?(.*)$/))) { flushP(); flushL(); out.push('<blockquote>' + inline(m[1]) + '</blockquote>'); continue; }
      if (/^(-{3,}|\*{3,})$/.test(line)) { flushP(); flushL(); out.push('<hr>'); continue; }
      if ((m = line.match(/^([-*]|\d+\.)\s+(.*)$/))) { flushP(); const t = /\d/.test(m[1]) ? 'ol' : 'ul'; if (!list || list.t !== t) { flushL(); list = { t, items: [] }; } list.items.push(m[2]); continue; }
      flushL(); para.push(line);
    }
    flushP(); flushL();
    return out.join('\n');
  }

  /* ---------------- pages ---------------- */
  const pages = {};

  pages.home = function () {
    $('#hero-signup').innerHTML = signupForm();
    const mb = $('#market-block'); if (mb) { mb.innerHTML = marketHTML(); const mt = $('#market-title'); if (mt && D.market && D.market.headline) mt.textContent = D.market.headline; }
    newsBlock($('#news'));
    const ev = upcoming().slice(0, 4);
    $('#events').innerHTML = ev.length ? ev.map(eventCard).join('') : '<div class="card empty">No upcoming events yet.</div>';
    wireICS($('#events'), ev);
    $('#giveaway').innerHTML = giveawayBox(true);
    const f = D.config.forms || {}, b = D.config.brokerage;
    $('#ask-btn').href = f.ask_an_agent_url || `mailto:${b.email}?subject=${encodeURIComponent('Ask an agent – ' + D.config.newsletter_name)}`;
    $('#event-btn').href = f.submit_event_url || `mailto:${b.email}?subject=${encodeURIComponent('Event submission')}&body=${encodeURIComponent('Event name:\nDate & time:\nLocation / town:\nCost:\nLink:\nShort description:')}`;
    if ($('#quick')) $('#quick').innerHTML = Object.entries(b.links || {}).map(([t, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)}</a>`).join('');
    if ($('#agents')) $('#agents').innerHTML = (b.agents || []).map((a) => `<div class="card agent-card"><b>${esc(a.name)}</b><span class="small muted">${esc(b.name)}</span>
      <a href="tel:${a.phone.replace(/\D/g, '')}">${esc(a.phone)}</a><a href="mailto:${esc(a.email)}">${esc(a.email)}</a>${a.website ? `<a href="${esc(a.website)}" target="_blank" rel="noopener">Website →</a>` : ''}</div>`).join('');
    $('#signup-box').innerHTML = signupBox();
  };

  pages.events = function () {
    const all = upcoming();
    const cats = [...new Set(all.map((e) => e.category).filter(Boolean))].sort();
    const towns = [...new Set(all.map((e) => e.town).filter(Boolean))].sort();
    const st = { cat: 'All', town: '', q: '', kids: false, weekend: false };
    $('#chips').innerHTML = ['All'].concat(cats).map((c) => `<button class="chip ${c === 'All' ? 'on' : ''}" data-c="${esc(c)}">${esc(c)}</button>`).join('');
    $('#town').innerHTML = '<option value="">All towns</option>' + towns.map((t) => `<option>${esc(t)}</option>`).join('');
    const f = D.config.forms || {}, b = D.config.brokerage;
    $('#submit-event').href = f.submit_event_url || `mailto:${b.email}?subject=${encodeURIComponent('Event submission')}&body=${encodeURIComponent('Event name:\nDate & time:\nLocation / town:\nCost:\nLink:\nShort description:')}`;
    function weekendRange() { const n = new Date(); const fri = new Date(n); fri.setHours(0, 0, 0, 0); fri.setDate(fri.getDate() + ((5 - fri.getDay() + 7) % 7) - (n.getDay() === 6 ? 1 : n.getDay() === 0 ? 2 : 0)); const mon = new Date(fri); mon.setDate(fri.getDate() + 3); return [fri, mon]; }
    function render() {
      const [ws, we] = weekendRange();
      const list = all.filter((e) => (st.cat === 'All' || e.category === st.cat) && (!st.town || e.town === st.town) && (!st.kids || e.kid_friendly)
        && (!st.weekend || (parseLocal(e.start) < we && eventEnd(e) >= ws))
        && (!st.q || (e.title + ' ' + (e.description || '') + ' ' + (e.location || '')).toLowerCase().includes(st.q)));
      if (!list.length) { $('#list').innerHTML = '<div class="card empty">No events match. Try another filter.</div>'; return; }
      let html = '', cur = '';
      list.forEach((e) => { const s = parseLocal(e.start); const k = s.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }); if (k !== cur) { html += `<h3 style="margin:26px 0 12px">${k}</h3>`; cur = k; } html += eventCard(e, all.indexOf(e)); });
      $('#list').innerHTML = `<div class="grid" style="gap:12px">${html}</div>`;
    }
    $('#chips').addEventListener('click', (ev) => { const c = ev.target.closest('.chip'); if (!c) return; st.cat = c.dataset.c; $$('.chip').forEach((x) => x.classList.toggle('on', x === c)); render(); });
    $('#town').addEventListener('change', (e) => { st.town = e.target.value; render(); });
    $('#q').addEventListener('input', (e) => { st.q = e.target.value.toLowerCase(); render(); });
    $('#kids').addEventListener('change', (e) => { st.kids = e.target.checked; render(); });
    $('#weekend').addEventListener('change', (e) => { st.weekend = e.target.checked; render(); });
    wireICS($('#list'), all);
    render();
  };

  pages.listings = function () {
    const b = D.config.brokerage;
    $('#all-listings').innerHTML = D.listings.length ? sortedListings().map((l) => listingCard(l)).join('') : '<div class="card empty">No active listings right now.</div>';
    const u = D.listingsMeta.updated; $('#updated').textContent = u ? 'Synced from bowdoinrealestate.com ' + relTime(u) : '';
    $('#search-btn').href = (b.links || {})['Search homes'] || b.website;
    $('#alerts-btn').href = (b.links || {})['Set listing alerts'] || b.website;
    $('#value-btn').href = (b.links || {})["What's my home worth?"] || b.website;
    $('#signup-box').innerHTML = signupBox();
  };

  pages.issues = function () {
    $('#issue-list').innerHTML = D.issues.length ? `<div class="card">${D.issues.map((i, n) => `<a class="issue-row" href="issue.html?id=${esc(i.id)}" style="${n ? 'border-top:1px solid var(--line)' : ''}">
      <div class="no">No. ${esc(i.number)}</div><div><h3 style="margin:0 0 4px;font-size:1.25rem">${esc(i.title)}</h3><div class="muted small">${esc(i.summary || '')}</div></div><div class="small muted">${longDate(i.date)}</div></a>`).join('')}</div>` : '<div class="card empty">The first issue is on its way.</div>';
    $('#signup-box').innerHTML = signupBox();
  };

  pages.issue = async function () {
    const id = new URLSearchParams(location.search).get('id') || (D.issues[0] || {}).id;
    const meta = D.issues.find((i) => i.id === id);
    if (!meta) { $('#issue').innerHTML = '<div class="card empty">Issue not found. <a href="issues.html">See all issues →</a></div>'; return; }
    document.title = meta.title + ' · ' + D.config.newsletter_name;
    let body = '';
    try { body = md(await getText('issues/' + id + '.md')); } catch (e) { body = '<div class="notice">Could not load this issue.</div>'; }
    const idx = D.issues.indexOf(meta), newer = D.issues[idx - 1], older = D.issues[idx + 1];
    $('#issue').innerHTML = `<article class="prose"><span class="eyebrow">Issue No. ${esc(meta.number)} · ${longDate(meta.date)}</span><h1 style="margin-top:12px">${esc(meta.title)}</h1>${body}
      <div style="display:flex;justify-content:space-between;gap:12px;margin-top:40px;padding-top:20px;border-top:1px solid var(--line)">
      ${older ? `<a href="issue.html?id=${esc(older.id)}">← ${esc(older.title)}</a>` : '<span></span>'}${newer ? `<a href="issue.html?id=${esc(newer.id)}">${esc(newer.title)} →</a>` : ''}</div>
      <div style="margin-top:30px">${signupBox()}</div></article>`;
    $$('[data-evlist]').forEach((el) => wireICS(el, upcoming()));
  };

  pages.trivia = function () {
    const g = D.config.giveaway || {}, b = D.config.brokerage || {};
    const set = currentSet(), secs = (D.trivia || {}).seconds_per_question || 15;
    $('#giveaway').innerHTML = giveawayBox(false);
    // rules placeholders
    const map = { sponsor: b.name, address: b.address, email: b.email, prize: g.prize, value: g.prize_value || g.prize, area: g.eligible_area || 'Massachusetts', age: g.min_age || 18, freq: g.frequency || 'weekly', day: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][g.draw_weekday == null ? 5 : g.draw_weekday], time: g.draw_time || '12:00', name: g.game_name || 'Boston Trivia Challenge', secs, n: set ? set.questions.length : 10 };
    $$('[data-r]').forEach((el) => { el.textContent = map[el.dataset.r]; });
    const winners = (g.past_winners || []).slice().sort((a, c) => c.date.localeCompare(a.date));
    $('#winners').innerHTML = winners.length ? `<ul class="news-list">${winners.map((w) => `<li><b>${esc(w.name)}</b> of ${esc(w.town)}${w.score ? ` · ${esc(w.score)}` : ''} <span class="src">· ${longDate(w.date)}</span>${w.sample ? ' <span class="badge warn">Sample</span>' : ''}</li>`).join('')}</ul>` : '<p class="muted">Our first champion will be crowned soon!</p>';

    const game = $('#game');
    if (!set) { game.innerHTML = '<div class="card empty">New questions are on their way. Check back soon!</div>'; return; }
    const store = (k, v) => { try { if (v === undefined) return JSON.parse(localStorage.getItem(k)); localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } };
    const KEY = 'bb-trivia-' + set.id;
    const prev = store(KEY);
    let player = store('bb-player') || {}, practice = false;

    function intro() {
      game.innerHTML = `<div class="card pad">
        <span class="eyebrow">This round · ${esc(set.title)}</span>
        <h3 style="font-size:1.6rem;margin-top:8px">${set.questions.length} questions · ${secs} seconds each</h3>
        <p class="muted">Score = correct answers. Ties go to whoever finished fastest. One official play per person per round.</p>
        ${prev ? `<div class="notice">You already played this round: <b>${prev.score}/${set.questions.length}</b> in ${prev.seconds}s. ${prev.submitted ? 'Your entry is in. Good luck! 🍀' : ''} You can play again for fun, but only your first game counts.</div>` : ''}
        <form id="tform" class="grid g2" style="gap:12px;margin-top:12px">
          <label>Name<br><input required name="name" value="${esc(player.name || '')}" class="tin"></label>
          <label>Town<br><input required name="town" value="${esc(player.town || '')}" class="tin"></label>
          <label style="grid-column:1/-1">Email (so we can reach you if you win)<br><input required type="email" name="email" value="${esc(player.email || '')}" class="tin"></label>
          <label style="grid-column:1/-1" class="small"><input type="checkbox" required name="eligible"> I'm ${esc(g.min_age || 18)}+ and a ${esc(g.eligible_area || 'Massachusetts')} resident, and I agree to the <a href="#rules">official rules</a>.</label>
          <label style="grid-column:1/-1" class="small"><input type="checkbox" name="optin" required checked> <b>Subscribe me to ${esc(D.config.newsletter_name)}.</b> Trivia is for subscribers only. It's free and you can unsubscribe anytime.</label>
          <div style="grid-column:1/-1"><button class="btn brass" type="submit">${prev ? 'Play again for fun' : 'Start the clock ⏱'}</button></div>
        </form></div>`;
      $$('.tin', game).forEach((i) => Object.assign(i.style, { width: '100%', padding: '11px 14px', border: '1px solid var(--line)', borderRadius: '10px', font: 'inherit', marginTop: '4px' }));
      $('#tform').addEventListener('submit', (e) => {
        e.preventDefault(); const f = new FormData(e.target);
        player = { name: f.get('name').trim(), town: f.get('town').trim(), email: f.get('email').trim(), optin: true };
        store('bb-player', player); practice = !!prev; play();
      });
    }

    function play() {
      const answers = [], times = []; let i = 0, timer = null;
      function ask() {
        const q = set.questions[i]; const t0 = performance.now(); let done = false;
        game.innerHTML = `<div class="card pad">
          <div style="display:flex;justify-content:space-between;align-items:center"><span class="eyebrow">Question ${i + 1} of ${set.questions.length}${practice ? ' · practice' : ''}</span><b id="tleft" style="font:600 1.4rem var(--serif)">${secs}</b></div>
          <div style="height:6px;background:var(--sea);border-radius:9px;margin:10px 0 18px;overflow:hidden"><div id="tbar" style="height:100%;width:100%;background:var(--brass);transition:width .1s linear"></div></div>
          <h3 style="font-size:1.45rem">${esc(q.q)}</h3>
          <div class="grid g2" style="gap:10px;margin-top:14px">${q.options.map((o, k) => `<button class="chip opt" data-k="${k}" style="padding:14px 16px;text-align:left;border-radius:12px;font-size:1rem">${'ABCD'[k]}. ${esc(o)}</button>`).join('')}</div>
          <div id="fact" style="min-height:48px;margin-top:14px"></div></div>`;
        function finish(k) {
          if (done) return; done = true; clearInterval(timer);
          const used = Math.min(secs, (performance.now() - t0) / 1000);
          answers.push(k); times.push(+used.toFixed(2));
          $$('.opt', game).forEach((btn) => { const bk = +btn.dataset.k; btn.disabled = true;
            if (bk === q.answer) Object.assign(btn.style, { background: '#e3f3e9', borderColor: '#2f7a52' });
            else if (bk === k) Object.assign(btn.style, { background: '#fbe5df', borderColor: '#a8432f' }); });
          $('#fact', game).innerHTML = `<b>${k === q.answer ? '✅ Correct!' : k === -1 ? '⏰ Time\'s up!' : '❌ Not quite.'}</b> <span class="muted">${esc(q.fact || '')}</span>`;
          setTimeout(() => { i++; i < set.questions.length ? ask() : results(); }, 2400);
        }
        game.addEventListener('click', function h(ev) { const o = ev.target.closest('.opt'); if (o && !done) { game.removeEventListener('click', h); finish(+o.dataset.k); } });
        timer = setInterval(() => {
          const left = secs - (performance.now() - t0) / 1000;
          if ($('#tleft', game)) { $('#tleft', game).textContent = Math.max(0, Math.ceil(left)); $('#tbar', game).style.width = Math.max(0, left / secs * 100) + '%'; }
          if (left <= 0) finish(-1);
        }, 100);
      }
      function results() {
        const score = answers.filter((a, k) => a === set.questions[k].answer).length;
        const seconds = +times.reduce((a, c) => a + c, 0).toFixed(2);
        const official = !practice;
        if (official) store(KEY, { score, seconds, submitted: false });
        const shareText = `I scored ${score}/${set.questions.length} on the ${g.game_name || 'Boston Trivia Challenge'}. Think you can beat me?`;
        game.innerHTML = `<div class="card pad" style="text-align:center">
          <span class="eyebrow">${official ? 'Final score' : 'Practice score'}</span>
          <div style="font:600 4rem/1 var(--serif);margin:12px 0">${score}<span class="muted" style="font-size:2rem">/${set.questions.length}</span></div>
          <p class="muted">Total time: ${seconds.toFixed(1)} seconds</p>
          <div id="sub" style="margin:14px 0">${official ? 'Submitting your entry…' : 'Practice games aren\'t entered. Only your first game this round counts.'}</div>
          <button class="btn ghost sm" id="share">Challenge a friend</button></div>`;
        $('#share').onclick = async () => { const url = location.href.split('#')[0]; try { if (navigator.share) await navigator.share({ text: shareText, url }); else { await navigator.clipboard.writeText(shareText + ' ' + url); $('#share').textContent = 'Link copied!'; } } catch (e) {} };
        if (official) submit({ score, seconds, answers: answers.join(','), times: times.join(',') });
      }
      ask();
    }

    async function submit(r) {
      const sf = g.score_form || {}, F = sf.fields || {};
      const vals = { name: player.name, email: player.email, town: player.town, score: r.score, seconds: r.seconds, answers: r.answers, set_id: set.id, newsletter_optin: player.optin ? 'Yes' : 'No' };
      if (sf.action_url && F.email) {
        const body = new URLSearchParams(); Object.entries(F).forEach(([k, id]) => { if (id) body.append(id, vals[k]); });
        try { await fetch(sf.action_url, { method: 'POST', mode: 'no-cors', body }); store(KEY, { score: r.score, seconds: r.seconds, submitted: true });
          $('#sub').innerHTML = '<b>🎉 You\'re entered!</b> The winner is announced in the next issue. Good luck!'; return; } catch (e) {}
      }
      const mail = `mailto:${b.email}?subject=${encodeURIComponent('Trivia entry ' + set.id)}&body=${encodeURIComponent(Object.entries(vals).map(([k, v]) => k + ': ' + v).join('\n'))}`;
      $('#sub').innerHTML = `<a class="btn brass" href="${mail}">Send my score to enter →</a>`;
      store(KEY, { score: r.score, seconds: r.seconds, submitted: true });
    }
    intro();
  };

  // shared helpers for assets/community.js
  window.LL = { D, $, $$, esc, md, getJSON, parseLocal, fmtDate, fmtTime, longDate, money, MONTHS, DAYS, eventCard, eventEnd, upcoming, wireICS, gcal, giveawayBox, signupBox, signupForm, ratesHTML, listingCard, sortedListings, newsBlock, relTime, pages };

  /* ---------------- boot ---------------- */
  document.addEventListener('DOMContentLoaded', async () => {
    await loadAll();
    const page = document.body.dataset.page;
    chrome(page);
    const custom = window.LLPages && window.LLPages[page];
    if (custom) await custom(); else if (pages[page]) await pages[page]();
    tickCountdowns(); setInterval(tickCountdowns, 1000);
  });
})();
