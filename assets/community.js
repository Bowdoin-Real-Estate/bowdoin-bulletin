/* The Local Loop – community features: visual calendar, spotlights, contests, Ask the Attorney Q&As. */
(function () {
  'use strict';
  const L = window.LL; if (!L) return;
  const { $, esc } = L;
  const X = { features: [], qa: [] };
  let loaded = null;
  function loadExtras() {
    if (!loaded) loaded = Promise.all([L.getJSON('data/features.json', { items: [] }), L.getJSON('data/qa.json', { items: [] })]).then(([f, q]) => {
      X.features = (f.items || []).filter((i) => i.published !== false);
      X.qa = (q.items || []).filter((i) => i.published !== false).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    });
    return loaded;
  }
  const today0 = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const trim = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n).replace(/\s+\S*$/, '') + '…' : s; };
  const activeFeatures = () => X.features.filter((f) => !f.end || L.parseLocal(f.end) >= today0())
    .sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || (a.type === 'contest' ? -1 : 0) || (b.date || '').localeCompare(a.date || ''));
  const qp = (k) => new URLSearchParams(location.search).get(k);

  /* ---------- pieces ---------- */
  function expertLine(e) {
    if (!e || !e.name) return '';
    const ini = e.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2);
    return `<div class="expert">${e.photo ? `<img src="${esc(e.photo)}" alt="">` : `<div class="ini">${esc(ini)}</div>`}<div><b>${esc(e.name)}</b><div class="small muted">${esc([e.title, e.firm].filter(Boolean).join(', '))}</div></div></div>`;
  }
  function qaTeaser(q) {
    if (!q) return '';
    const n = (q.questions || []).length;
    return `<div class="card qa-teaser"><div class="pad">
      <span class="eyebrow">${esc(q.kicker || 'Ask the Attorney')}</span><h3 style="font-size:1.6rem;margin-top:8px">${esc(q.title)}</h3>
      ${q.dek ? `<p class="dek">${esc(q.dek)}</p>` : ''}${expertLine(q.expert)}${q.teaser ? q.teaser.split(/\n\s*\n/).map((x) => `<p>${esc(x.trim())}</p>`).join('') : q.intro ? `<p class="muted">${esc(trim(q.intro, 220))}</p>` : ''}
      ${(q.questions || []).slice(0, q.teaser ? 0 : (q.teaser_count || 2)).map((x) => `<div class="qa-item"><div class="q">Q. ${esc(x.q)}</div><div class="a">${esc(trim(x.a, 200))}</div></div>`).join('')}
      <a class="btn brass" href="qa.html?id=${encodeURIComponent(q.id)}">${esc(q.cta || (q.teaser ? 'Read the full Q&A' : `Read all ${n} answers`))} →</a></div></div>`;
  }
  function featureHref(f) { return f.body ? `spotlight.html?id=${encodeURIComponent(f.id)}` : (f.link_url || 'spotlight.html'); }
  function featureCard(f) {
    const contest = f.type === 'contest', href = featureHref(f);
    const days = f.deadline ? Math.ceil((L.parseLocal(f.deadline) - new Date()) / 864e5) : null;
    return `<article class="card feature ${contest ? 'contest' : ''}">${f.image ? `<a class="fimg" href="${esc(href)}" style="background-image:url('${esc(f.image)}')" aria-label="${esc(f.title)}"></a>` : ''}
      <div class="pad"><span class="eyebrow">${esc(f.kicker || (contest ? 'Holiday Contest' : 'Community Spotlight'))}</span>${f.sample ? ' <span class="badge warn">Draft – details coming</span>' : ''}
      <h3>${esc(f.title)}</h3>${(f.when || f.where) ? `<div class="meta small">${[f.when, f.where].filter(Boolean).map(esc).join(' · ')}</div>` : ''}
      <p>${esc(f.summary || '')}</p>
      ${contest && f.deadline ? `<p class="small"><b>Enter by ${L.longDate(f.deadline)}</b>${days > 0 ? ` · ${days} day${days === 1 ? '' : 's'} left` : ''}</p>` : ''}
      ${contest && f.prize ? `<p class="small"><b>Prize:</b> ${esc(f.prize)}</p>` : ''}
      <div class="acts">${f.body ? `<a class="btn sm" href="${esc(href)}">Read more →</a>` : ''}${f.link_url ? `<a class="btn sm ${f.body ? 'ghost' : 'brass'}" href="${esc(f.link_url)}" target="_blank" rel="noopener">${esc(f.link_label || (contest ? 'Enter now' : 'Learn more'))} →</a>` : ''}</div></div></article>`;
  }
  function featuredEvent() {
    const e = L.upcoming().find((x) => x.featured); if (!e) return '';
    const s = L.parseLocal(e.start), en = L.parseLocal(e.end);
    return `<div class="feat-event"><div class="fe-date"><div class="m">${L.MONTHS[s.getMonth()]}</div><div class="d">${s.getDate()}</div><div class="w">${L.fmtDate(s, { weekday: 'long' })}</div></div>
      <div class="fe-body"><span class="eyebrow">Don't miss it</span>${e.sample ? ' <span class="badge warn">Details coming</span>' : ''}<h2>${esc(e.title)}</h2>
      <div class="meta">${L.fmtTime(s)}${en && en.toDateString() === s.toDateString() ? ' – ' + L.fmtTime(en) : ''}${e.location ? ' · ' + esc(e.location) : ''}${e.town ? ', ' + esc(e.town) : ''}${e.cost ? ' · ' + esc(e.cost) : ''}</div>
      ${e.description ? `<p>${esc(e.description)}</p>` : ''}
      <div class="acts"><a class="btn brass" href="${L.gcal(e)}" target="_blank" rel="noopener">Add to calendar</a>${e.url ? `<a class="btn ghost" href="${esc(e.url)}" target="_blank" rel="noopener">Details</a>` : ''}</div></div></div>`;
  }

  /* ---------- visual month calendar ---------- */
  function calendar(el) {
    const events = L.D.events; const cur = new Date(); cur.setDate(1); let sel = null;
    const isSeason = (ev) => L.eventEnd(ev) - L.parseLocal(ev.start) > 3 * 864e5; // markets, rinks etc. that run for weeks
    const onAll = (d) => { const s = new Date(d); s.setHours(0, 0, 0, 0); const e = new Date(s); e.setDate(e.getDate() + 1); return events.filter((ev) => ev.start && L.parseLocal(ev.start) < e && L.eventEnd(ev) >= s); };
    const on = (d) => onAll(d).filter((ev) => !isSeason(ev));
    const seasonCard = (ev) => `<div class="card season"><span class="badge alt">${esc(ev.town || ev.category || '')}</span>${ev.sample ? ' <span class="badge warn">Confirm dates</span>' : ''}<h4>${ev.url ? `<a href="${esc(ev.url)}" target="_blank" rel="noopener">${esc(ev.title)}</a>` : esc(ev.title)}</h4><div class="small muted">${L.fmtDate(L.parseLocal(ev.start))} – ${L.fmtDate(L.eventEnd(ev))}${ev.cost ? ' · ' + esc(ev.cost) : ''}</div><p class="small">${esc(ev.description || '')}</p></div>`;
    function render() {
      const y = cur.getFullYear(), m = cur.getMonth(), first = new Date(y, m, 1).getDay(), days = new Date(y, m + 1, 0).getDate(), t = today0();
      let cells = '';
      for (let i = 0; i < first; i++) cells += '<div class="cd empty"></div>';
      for (let d = 1; d <= days; d++) {
        const dt = new Date(y, m, d), evs = on(dt);
        const cls = ['cd', evs.length && 'has', evs.some((e) => e.featured) && 'feat', +dt === +t && 'today', sel && +sel === +dt && 'sel', dt < t && 'past'].filter(Boolean).join(' ');
        cells += `<button class="${cls}" data-d="${d}" aria-label="${L.fmtDate(dt, { month: 'long', day: 'numeric' })}${evs.length ? ', ' + evs.length + ' event' + (evs.length > 1 ? 's' : '') : ''}"><span>${d}</span>${evs.length ? `<i>${'•'.repeat(Math.min(3, evs.length))}</i>` : ''}</button>`;
      }
      const list = sel ? on(sel) : L.upcoming().filter((ev) => !isSeason(ev)).slice(0, 6);
      const season = (sel ? onAll(sel) : L.upcoming()).filter(isSeason);
      el.innerHTML = `<div class="cal-wrap"><div class="cal card pad">
          <div class="cal-head"><button class="ib" data-nav="-1" aria-label="Previous month">‹</button><b>${new Date(y, m, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</b><button class="ib" data-nav="1" aria-label="Next month">›</button></div>
          <div class="cal-dow">${['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((x) => `<span>${x}</span>`).join('')}</div><div class="cal-grid">${cells}</div>
          <div class="small muted" style="margin-top:12px">${sel ? '<a href="#" data-clear>← Back to everything coming up</a>' : 'Tap a date to see what\'s happening. <span class="key feat"></span> featured'}</div></div>
        <div><h3 style="margin:0 0 12px;font-size:1.4rem">${sel ? L.fmtDate(sel, { weekday: 'long', month: 'long', day: 'numeric' }) : 'Coming up'}</h3>
          <div class="grid" style="gap:12px">${list.length ? list.map((e) => L.eventCard(e, events.indexOf(e))).join('') : '<div class="card empty">Nothing on the calendar this day yet.</div>'}</div></div></div>
        ${season.length ? `<div class="season-wrap"><h3 style="margin:0 0 12px;font-size:1.4rem">${sel ? 'Also open this day' : 'All season long'}</h3><div class="season-grid">${season.map(seasonCard).join('')}</div></div>` : ''}`;
    }
    el.addEventListener('click', (ev) => {
      const n = ev.target.closest('[data-nav]'); if (n) { cur.setMonth(cur.getMonth() + +n.dataset.nav); render(); return; }
      const c = ev.target.closest('.cd[data-d]'); if (c) { sel = new Date(cur.getFullYear(), cur.getMonth(), +c.dataset.d); render(); return; }
      if (ev.target.closest('[data-clear]')) { ev.preventDefault(); sel = null; render(); }
    });
    L.wireICS(el, events);
    render();
  }

  /* ---------- shortcodes for issues ---------- */
  window.LLShortcodes = {
    qa: (id) => qaTeaser(id ? X.qa.find((q) => q.id === id) : X.qa[0]) || '',
    spotlight: (id) => { const f = X.features.find((x) => x.id === id); return f ? featureCard(f) : ''; },
    features: () => { const a = activeFeatures(); return a.length ? `<div class="features-grid">${a.map(featureCard).join('')}</div>` : ''; },
    calendar: () => '<div data-cal></div>',
    featured: () => featuredEvent(),
  };

  /* ---------- pages ---------- */
  const P = window.LLPages = {};
  const show = (id, html) => { const el = $(id); if (!el) return; el.innerHTML = html; const sec = el.closest('section'); if (sec) sec.hidden = !html; };

  P.home = async function () {
    await loadExtras();
    await L.pages.home();
    show('#featured-event', featuredEvent());
    calendar($('#calendar'));
    const f = activeFeatures();
    show('#features', f.length ? `<div class="features-grid">${f.map(featureCard).join('')}</div>` : '');
    show('#qa-teaser', X.qa[0] ? `<div class="qa-wrap">${qaTeaser(X.qa[0])}<div class="card pad ask-side"><span class="eyebrow">Your turn</span><h3 style="margin-top:8px">Have a question for an expert?</h3><p class="muted">Send it in. We pick reader questions for future Q&amp;As with local attorneys, lenders, contractors and more.</p><a class="btn ghost" id="ask-btn2" href="#">Ask a question →</a></div></div>` : '');
    const ab = $('#ask-btn'), ab2 = $('#ask-btn2'); if (ab && ab2) ab2.href = ab.href;
  };

  P.events = async function () { await L.pages.events(); calendar($('#calendar')); };

  P.issue = async function () { await loadExtras(); await L.pages.issue(); document.querySelectorAll('[data-cal]').forEach((el) => calendar(el)); };

  P.qa = async function () {
    await loadExtras(); const el = $('#qa'), id = qp('id'), q = id ? X.qa.find((x) => x.id === id) : null;
    if (!q) {
      el.innerHTML = `<span class="eyebrow">Ask the Expert</span><h1 style="margin-top:12px">Q&amp;As with local pros</h1><p class="lead">Straight answers from attorneys, lenders and other local experts on the questions our neighbors ask most.</p>
        ${X.qa.length ? `<div class="grid g2" style="margin-top:24px">${X.qa.map(qaTeaser).join('')}</div>` : '<div class="card empty">Our first Q&amp;A is on its way.</div>'}`;
      return;
    }
    document.title = q.title + ' · ' + L.D.config.newsletter_name;
    const e = q.expert || {}, qs = q.questions || [];
    el.innerHTML = `<article class="prose"><a href="qa.html" class="small">← All Q&amp;As</a><br><span class="eyebrow">${esc(q.kicker || 'Ask the Attorney')}${q.date ? ' · ' + L.longDate(q.date) : ''}</span>
      <h1 style="margin-top:12px">${esc(q.title)}</h1>${q.dek ? `<p class="lead">${esc(q.dek)}</p>` : ''}${expertLine(e)}${e.bio ? `<p class="muted small">${esc(e.bio)}</p>` : ''}${q.intro ? `<p>${esc(q.intro)}</p>` : q.teaser ? q.teaser.split(/\n\s*\n/).slice(0, -1).map((x) => `<p>${esc(x.trim())}</p>`).join('') : ''}
      ${q.sample ? '<div class="notice">Draft: the full Q&amp;A is being added.</div>' : ''}
      <nav class="qa-toc"><b class="small" style="letter-spacing:.12em;text-transform:uppercase;color:var(--brass)">In this Q&amp;A</b>${qs.map((x, i) => `<a href="#q${i + 1}">${i + 1}. ${esc(x.q)}</a>`).join('')}</nav>
      ${qs.map((x, i) => `<section class="qa-full" id="q${i + 1}"><h2>${i + 1}. ${esc(x.q)}</h2>${L.md(x.a || '')}</section>`).join('')}
      ${q.disclaimer ? `<p class="small muted" style="margin-top:30px"><i>${esc(q.disclaimer)}</i></p>` : ''}
      ${e.website ? `<p><a class="btn" href="${esc(e.website)}" target="_blank" rel="noopener">Contact ${esc(e.name)} →</a></p>` : ''}
      <div style="margin-top:30px">${L.signupBox()}</div></article>`;
  };

  P.spotlight = async function () {
    await loadExtras(); const el = $('#spotlight'), id = qp('id'), f = id ? X.features.find((x) => x.id === id) : null;
    if (!f) {
      const a = activeFeatures();
      el.innerHTML = `<span class="eyebrow">Community first</span><h1 style="margin-top:12px">Community spotlights &amp; contests</h1><p class="lead">The people, classes, causes and celebrations that make our neighborhoods home.</p>
        ${a.length ? `<div class="features-grid" style="margin-top:24px">${a.map(featureCard).join('')}</div>` : '<div class="card empty">New spotlights coming soon.</div>'}`;
      return;
    }
    document.title = f.title + ' · ' + L.D.config.newsletter_name;
    el.innerHTML = `<article class="prose"><a href="spotlight.html" class="small">← All spotlights</a><br><span class="eyebrow">${esc(f.kicker || (f.type === 'contest' ? 'Holiday Contest' : 'Community Spotlight'))}</span>
      <h1 style="margin-top:12px">${esc(f.title)}</h1>${(f.when || f.where) ? `<p class="muted">${[f.when, f.where].filter(Boolean).map(esc).join(' · ')}</p>` : ''}
      ${f.image ? `<img src="${esc(f.image)}" alt="" style="border-radius:var(--radius);margin:10px 0 20px;width:100%">` : ''}
      ${f.sample ? '<div class="notice">Draft: details are being added.</div>' : ''}
      ${f.type === 'contest' && f.deadline ? `<div class="notice"><b>Enter by ${L.longDate(f.deadline)}</b>${f.prize ? ' · Prize: ' + esc(f.prize) : ''}</div>` : ''}
      ${L.md(f.body || f.summary || '')}
      ${f.link_url ? `<p><a class="btn brass" href="${esc(f.link_url)}" target="_blank" rel="noopener">${esc(f.link_label || 'Learn more')} →</a></p>` : ''}
      <div style="margin-top:30px">${L.signupBox()}</div></article>`;
  };
})();
