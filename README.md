# The Bowdoin Bulletin

The newsletter website for **Bowdoin Real Estate Partners**: real estate news, Greater Boston headlines, local events, featured listings pulled from [bowdoinrealestate.com](https://www.bowdoinrealestate.com), and a weekly timed **Boston Trivia Challenge** where the top score wins an Amazon gift card.

It's a plain static site: no build step, no server. GitHub Pages hosts it for free, and a GitHub Action refreshes listings, headlines and mortgage rates every morning.

---

## 1. Put it online (one time, ~10 min)

1. Create a new GitHub repository (e.g. `bowdoin-bulletin`) and upload everything in this folder, including the hidden `.github` folder.
2. **Settings → Pages →** Source: *Deploy from a branch*, Branch: `main` / `(root)` → Save. The site goes live at `https://<username>.github.io/bowdoin-bulletin/` within a minute or two.
3. **Settings → Actions → General →** Workflow permissions: *Read and write* → Save. (This lets the daily sync save new data.)
4. **Actions tab → "Daily data sync" → Run workflow** to fill in listings, headlines and rates right away.
5. Optional: use a custom domain like `news.bowdoinrealestate.com` (Settings → Pages → Custom domain, plus a CNAME DNS record pointing to `<username>.github.io`).

## 2. Connect the forms (data/config.json)

A static site can't store emails itself, so signups and trivia scores go to free tools:

| What | Recommended | Where it goes in `data/config.json` |
|---|---|---|
| **Newsletter signup + sending** | Mailchimp (free up to 500 contacts). Create an audience → *Signup forms → Embedded form* → copy the `<form action="...">` URL. Beehiiv or Substack also work (use `"provider": "link"`). | `signup.provider` = `"mailchimp"`, `signup.action_url` |
| **Trivia scores** | A Google Form the game posts to behind the scenes (setup below). Scores land in a Google Sheet. | `giveaway.score_form` |
| **Submit an event / Ask an agent** | Two more short Google Forms | `forms.submit_event_url`, `forms.ask_an_agent_url` |

Until these are filled in, buttons fall back to emailing admin@bowdoinrealestate.com, so nothing is ever broken.

> The email itself is written and sent from Mailchimp/Beehiiv each week. This site is the **home base**: the archive, the full events calendar, live listings and the weekly trivia game. Link to it from every email.

## 2½. The editor page (for Jenny & LeighAnn)

`https://bowdoin-real-estate.github.io/bowdoin-bulletin/admin.html` is a private page (not linked anywhere, hidden from Google) where they pick each week's stories:

- **Story ideas** on the left: every headline the daily sync found over the past week, filterable by topic and searchable.
- **Add** a story, reorder with ↑ ↓, and write a one-line "our take". They can also add any link of their own (local paper, town notice…).
- **Publish to site**: the picks appear first under Headlines on the home page within a minute.
- **Copy for email**: copies the picks as a formatted list to paste into Mailchimp/Beehiiv.

**One-time setup: an editor key for each person.** Signed in to GitHub as Bowdoin-Real-Estate: Settings → Developer settings → Personal access tokens → **Fine-grained tokens → Generate new token**. Name it "Bulletin editor – Jenny", set the expiration (1 year is fine), choose **Only select repositories → bowdoin-bulletin**, and under Repository permissions set **Contents: Read and write**. Generate it, then text it to Jenny privately; she pastes it into the editor once per device. Repeat for LeighAnn. Revoke a key anytime from the same page. Each save is recorded in the repo history with the editor's name.

## 3. Weekly routine

**Write an issue.** Copy `issues/_TEMPLATE.md` → `issues/2026-11-27-thanksgiving.md`, fill it in, then add it to the **top** of `data/issues.json`. You can edit right on github.com (click a file → ✏️ pencil). Shortcodes you can drop on their own line:

| Shortcode | Shows |
|---|---|
| `{{listing:73592852}}` | A listing card (MLS # is the number at the end of any bowdoinrealestate.com property URL) |
| `{{listings}}` | All current listings |
| `{{events:4}}` | The next 4 upcoming events |
| `{{rates}}` | Current 30- and 15-yr mortgage rates |
| `{{trivia}}` | Weekly trivia box with countdown |
| `{{signup}}` | Subscribe box |

**Add events** in `data/events.json` (copy any entry). Past events disappear on their own. Mark one `"featured": true` to push it up. ⚠️ Delete the `SAMPLE` events before launch.

**Load next week's trivia.** Add a new set to `data/trivia.json` (10 questions, 4 options each, `answer` = 0–3, plus a fun `fact`). Give it a `start` date and the game switches over automatically, so you can load a month ahead. Two weeks are already written.

**Pick the trivia winner (Friday after noon).** In the Google Sheet: File → Download → CSV → open `https://<your-site>/tools/draw.html` (not linked anywhere on the site) → load the CSV → choose the week → *Rank entries*. It re-scores every entry against the answer key (so faked scores don't work), keeps only each person's first game, ranks by score then fastest time, breaks exact ties at random, and shows a leaderboard you can download. Add the winner to `giveaway.past_winners` in `config.json` and announce them in the next issue (delete the sample winner).

**Local market stats.** Fill in `local_stats` in `data/market.json` from MLS whenever you like (median price, days on market…). Empty ones are hidden.

**Hand-picked news.** Add stories to `editors_picks` in `data/news.json`; they show as the first tab and never get overwritten.

## 3½. Hooking the trivia game to Google Forms (10 min, one time)

1. Create a Google Form with 8 **short-answer** questions, in this order: `Name`, `Email`, `Town`, `Score`, `Seconds`, `Answers`, `Set ID`, `Newsletter opt-in`. Turn off "Collect email addresses" and sign-in requirements.
2. Responses tab → link to a Google Sheet.
3. ⋮ menu → **Get pre-filled link** → type anything in each box → *Get link* → copy it. It contains `entry.123456789=...` for each question, in order.
4. In `data/config.json → giveaway.score_form`:
   - `action_url`: your form's URL with `/viewform` changed to `/formResponse`
   - `fields`: the matching `entry.NNNNNNNNN` IDs, e.g. `"name": "entry.1234567890"`
5. Play a test game on the site and check that a row appears in the Sheet.

Until this is set up, players get a "Send my score" button that emails their result to admin@bowdoinrealestate.com instead, so the game still works.

> **Honest caveat:** this is a static site, so a tech-savvy player could dig the answers out of the page code. The 15-second timer, one official play per email, and server-side re-scoring keep it fair for a newsletter contest. If a perfect score in 20 seconds shows up, you're allowed to raise an eyebrow (rule 8 lets you disqualify tampering).

## 4. What updates automatically (every morning)

`scripts/sync.py`, run by `.github/workflows/sync.yml`:

- **Listings**: reads the [company listings page](https://www.bowdoinrealestate.com/bowdoin-real-estate-partners/listings), visits each property, and saves price/beds/baths/photo/agent. Your `featured` and `note` (e.g. "New price", "Open house Sat") edits are kept. If the site ever changes layout and nothing is found, the old listings stay up.
- **Headlines**: Google News feeds for Boston/MA real estate, Boston news, and local town news ("Around Town"). Change the searches in `config.json → news_feeds` (any RSS feed works).
- **Mortgage rates**: Freddie Mac's weekly survey via FRED.

## 5. Customize

- Name, tagline, frequency, prize, draw day (`draw_weekday`: 0 = Sun … 5 = Fri) and time are all in `data/config.json`. `giveaway.frequency` can be `weekly`, `biweekly` or `monthly`.
- Colors and fonts are at the top of `assets/style.css`.

## 6. Before launch: trivia contest checklist

- [ ] Have an attorney skim the Official Rules at the bottom of `trivia.html` (a template written for a free skill contest: no purchase necessary, MA residents 18+, highest score wins, fastest time breaks ties, then random draw).
- [ ] Keep it free to play. Never require a purchase or a listing appointment.
- [ ] Gift cards are a marketing expense; keep the downloaded results record each week.
- [ ] Amazon is named as the gift card brand only, not as a sponsor (already stated in the rules).
