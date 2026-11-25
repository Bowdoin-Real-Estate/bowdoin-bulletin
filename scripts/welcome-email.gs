/**
 * The Local Loop: send the current issue to every new subscriber.
 *
 * Install (once), signed in to Google as admin@bowdoinrealestate.com:
 *   1. Open the subscriber Google Sheet (the one linked to the signup form).
 *   2. Extensions → Apps Script. Delete what's there and paste this whole file. Click Save.
 *   3. In the function dropdown at the top choose "setup", then click Run.
 *   4. Approve the permissions Google asks for (Advanced → Go to project → Allow).
 *   5. Check the admin inbox: a test copy of the current issue should arrive.
 *
 * From then on, every time someone subscribes on the website (or plays trivia),
 * they get the issue that was last saved in the editor with
 * "📬 Send this to new subscribers automatically".
 */

const SITE = 'https://bowdoin-real-estate.github.io/bowdoin-bulletin/';
const FROM_NAME = 'The Local Loop | Bowdoin Real Estate Partners';
const REPLY_TO = 'admin@bowdoinrealestate.com';

/** Run once to turn on automatic sending. Safe to run again. */
function setup() {
  const ss = SpreadsheetApp.getActive();
  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === 'onSubscribe')
    .forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('onSubscribe').forSpreadsheet(ss).onFormSubmit().create();
  sendTest();
}

/** Sends the current issue to you so you can see exactly what subscribers get. */
function sendTest() {
  const me = Session.getActiveUser().getEmail();
  const cur = getCurrent_();
  if (!cur) throw new Error('No welcome email saved yet. In the site editor, open "Build the email" and click "📬 Send this to new subscribers automatically".');
  sendIssue_(me, 'Test', cur);
}

/** Runs automatically on every new form response. */
function onSubscribe(e) {
  const v = (e && e.namedValues) || {};
  const email = pick_(v, /e-?mail/i);
  const name = pick_(v, /name/i);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return;

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const cur = getCurrent_();
    if (!cur) return;
    const props = PropertiesService.getScriptProperties();
    const key = 'sent:' + email.toLowerCase();
    if (props.getProperty(key) === cur.id) return; // already got this issue
    sendIssue_(email, name, cur);
    props.setProperty(key, cur.id);
  } finally {
    lock.releaseLock();
  }
}

function sendIssue_(email, name, cur) {
  let html = UrlFetchApp.fetch(SITE + 'email/current.html?t=' + Date.now()).getContentText();
  const first = String(name || '').trim().split(/\s+/)[0];
  const hello = (first ? 'Hi ' + esc_(first) + ', thanks' : 'Thanks') +
    " for subscribing to The Local Loop! Here's our latest edition. 🎉";
  const note = '<div style="max-width:640px;margin:0 auto 12px;padding:14px 18px;background:#ffffff;border-radius:6px;' +
    'font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#1f2a24;text-align:left">' + hello + '</div>';
  html = html.replace(/(<td align="center" style="padding:20px 10px">)/, '$1' + note);
  GmailApp.sendEmail(email, cur.subject, hello + '\n\nRead it online: ' + (cur.web_url || SITE), {
    htmlBody: html,
    name: FROM_NAME,
    replyTo: REPLY_TO,
  });
}

function getCurrent_() {
  const r = UrlFetchApp.fetch(SITE + 'email/current.json?t=' + Date.now(), { muteHttpExceptions: true });
  return r.getResponseCode() === 200 ? JSON.parse(r.getContentText()) : null;
}

function pick_(v, re) {
  const k = Object.keys(v).find((x) => re.test(x));
  return k ? String([].concat(v[k])[0] || '').trim() : '';
}

function esc_(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
