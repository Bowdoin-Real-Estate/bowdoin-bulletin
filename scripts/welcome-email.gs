/**
 * The Local Loop: sends the newsletter from the Bowdoin admin Gmail.
 *
 * What it does, once installed:
 *   - Every 5 minutes it checks the website for a send request made in the
 *     site editor ("Send test" or "Send to all subscribers") and sends it.
 *   - When someone new subscribes, it emails them the latest issue, if the
 *     editor box "Also email this issue to anyone who subscribes later" was ticked.
 *
 * Install or update (signed in to Google as admin@bowdoinrealestate.com):
 *   1. Open the subscriber Google Sheet → Extensions → Apps Script.
 *   2. Select everything in the code box, delete it, paste this whole file. Click Save.
 *   3. Choose "setup" in the function dropdown and click Run. Approve the permissions.
 *   That's it. Nothing is emailed during setup.
 *
 * To stop everything: choose "turnOff" in the dropdown and click Run.
 */

const SITE = 'https://bowdoin-real-estate.github.io/bowdoin-bulletin/';
const FROM_NAME = 'The Local Loop | Bowdoin Real Estate Partners';
const REPLY_TO = 'admin@bowdoinrealestate.com';
const MAX_AGE_HOURS = 12; // ignore send requests older than this

/** Run once to switch on. Safe to run again. Sends nothing. */
function setup() {
  turnOff();
  const ss = SpreadsheetApp.getActive();
  ScriptApp.newTrigger('onSubscribe').forSpreadsheet(ss).onFormSubmit().create();
  ScriptApp.newTrigger('checkOutbox').timeBased().everyMinutes(5).create();
  // Anything already waiting on the site is treated as handled, so setup never sends.
  const box = fetchJson_('email/outbox.json');
  if (box && box.id) PropertiesService.getScriptProperties().setProperty('lastOutbox', box.id);
  Logger.log('The Local Loop sender is ON. Subscribers found: ' + subscribers_().length);
}

/** Run to switch everything off. */
function turnOff() {
  ScriptApp.getProjectTriggers().forEach((t) => ScriptApp.deleteTrigger(t));
}

/** Runs every 5 minutes: sends whatever the site editor queued. */
function checkOutbox() {
  const box = fetchJson_('email/outbox.json');
  if (!box || !box.id || !box.html || !box.subject) return;
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('lastOutbox') === box.id) return;
  if (Date.now() - new Date(box.requested).getTime() > MAX_AGE_HOURS * 3600 * 1000) {
    props.setProperty('lastOutbox', box.id);
    return;
  }
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    if (box.mode === 'test') {
      if (isEmail_(box.to)) send_(box.to, '[TEST] ' + box.subject, box.html, box.web_url);
      props.setProperty('lastOutbox', box.id);
      return;
    }
    if (box.mode !== 'all') return;

    const people = subscribers_();
    const doneKey = 'done:' + box.id;
    let done = +(props.getProperty(doneKey) || 0); // how many have been sent so far
    const todo = people.slice(done);
    if (todo.length > MailApp.getRemainingDailyQuota()) {
      props.setProperty('lastOutbox', box.id);
      send_(REPLY_TO, 'The Local Loop was NOT sent', '<p>Gmail\'s daily sending limit is too low to reach all ' +
        people.length + ' subscribers today, so nothing was sent. Try again tomorrow, or send in smaller groups.</p>', '');
      return;
    }
    const started = Date.now();
    for (let i = 0; i < todo.length; i++) {
      if (Date.now() - started > 4 * 60 * 1000) break; // continue on the next run
      try { send_(todo[i].email, box.subject, box.html, box.web_url); } catch (err) { Logger.log(todo[i].email + ': ' + err); }
      done++;
      if (i % 10 === 9) props.setProperty(doneKey, String(done));
    }
    props.setProperty(doneKey, String(done));
    if (done >= people.length) {
      props.setProperty('lastOutbox', box.id);
      props.deleteProperty(doneKey);
      send_(REPLY_TO, '✅ The Local Loop was sent to ' + people.length + ' subscribers',
        '<p>"' + esc_(box.subject) + '" went out to ' + people.length + ' subscribers' +
        (box.by ? ' (sent by ' + esc_(box.by) + ')' : '') + '.</p>', '');
    }
  } finally {
    lock.releaseLock();
  }
}

/** Runs on every new signup: sends the latest issue if that option is on. */
function onSubscribe(e) {
  const v = (e && e.namedValues) || {};
  const email = pick_(v, /e-?mail/i).toLowerCase();
  const name = pick_(v, /name/i);
  if (!isEmail_(email)) return;
  const w = fetchJson_('email/welcome.json');
  if (!w || w.off || !w.html || !w.subject) return;

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const props = PropertiesService.getScriptProperties();
    const key = 'welcomed:' + email;
    if (props.getProperty(key) === w.id) return;
    const first = String(name || '').trim().split(/\s+/)[0];
    const hello = (first ? 'Hi ' + esc_(first) + ', thanks' : 'Thanks') +
      " for subscribing to The Local Loop! Here's our latest edition. 🎉";
    const note = '<div style="max-width:640px;margin:0 auto 12px;padding:14px 18px;background:#ffffff;border-radius:6px;' +
      'font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#1f2a24;text-align:left">' + hello + '</div>';
    send_(email, w.subject, w.html.replace(/(<td align="center" style="padding:20px 10px">)/, '$1' + note), w.web_url);
    props.setProperty(key, w.id);
  } finally {
    lock.releaseLock();
  }
}

/** Everyone on the signup sheet: unique emails, skipping rows marked in an "Unsubscribed" column. */
function subscribers_() {
  const sheets = SpreadsheetApp.getActive().getSheets();
  const out = [], seen = {};
  sheets.forEach((sh) => {
    const rows = sh.getDataRange().getValues();
    if (rows.length < 2) return;
    const head = rows[0].map((h) => String(h));
    const ei = head.findIndex((h) => /e-?mail/i.test(h));
    if (ei < 0) return;
    const ui = head.findIndex((h) => /unsub/i.test(h));
    for (let r = 1; r < rows.length; r++) {
      const email = String(rows[r][ei] || '').trim().toLowerCase();
      if (!isEmail_(email) || seen[email]) continue;
      if (ui >= 0 && String(rows[r][ui] || '').trim()) continue;
      seen[email] = true;
      out.push({ email: email });
    }
  });
  return out;
}

function send_(to, subject, html, webUrl) {
  GmailApp.sendEmail(to, subject, 'Read this issue online: ' + (webUrl || SITE), {
    htmlBody: html, name: FROM_NAME, replyTo: REPLY_TO,
  });
}

function fetchJson_(path) {
  const r = UrlFetchApp.fetch(SITE + path + '?t=' + Date.now(), { muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) return null;
  try { return JSON.parse(r.getContentText()); } catch (err) { return null; }
}

function isEmail_(s) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(s || '')); }

function pick_(v, re) {
  const k = Object.keys(v).find((x) => re.test(x));
  return k ? String([].concat(v[k])[0] || '').trim() : '';
}

function esc_(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
