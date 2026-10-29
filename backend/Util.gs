/** Small helpers. Time and id helpers mirror js/logic/dates.js and js/logic/ids.js. */

let settingsCache_ = null;

/** Settings tab as { KEY: value }, read once per request. */
function settings_() {
  if (!settingsCache_) {
    settingsCache_ = {};
    rows_('Settings').forEach((r) => { if (r.Key) settingsCache_[r.Key] = r.Value; });
  }
  return settingsCache_;
}

const PIN_FAILURES_KEY = 'adminPinFailures';

/**
 * 'ok' | 'wrong' | 'locked' | 'weak'. Wrong guesses are counted for everyone
 * (Apps Script can't see who is calling), so a burst of guesses pauses
 * admin unlock for a few minutes instead of eventually finding the PIN.
 */
function checkAdminPin_(pin) {
  if (!pin) return 'wrong';
  const cache = CacheService.getScriptCache();
  const failures = Number(cache.get(PIN_FAILURES_KEY) || 0);
  if (failures >= MAX_PIN_FAILURES) return 'locked';
  const real = String(settings_().ADMIN_PIN || '');
  if (real && String(pin) === real) {
    return real.length < MIN_PIN_LENGTH || real === DEFAULT_ADMIN_PIN ? 'weak' : 'ok';
  }
  cache.put(PIN_FAILURES_KEY, String(failures + 1), PIN_LOCKOUT_SECONDS);
  return 'wrong';
}

function isAdmin_(pin) {
  return checkAdminPin_(pin) === 'ok';
}

/** Throws a message the admin can act on unless the PIN unlocks admin tools. */
function requireAdmin_(pin) {
  const status = checkAdminPin_(pin);
  if (status === 'wrong') throw new Error('Wrong admin PIN');
  if (status === 'locked') throw new Error('Too many wrong PINs. Admin unlock is paused for 10 minutes.');
  if (status === 'weak') {
    throw new Error('The admin PIN is still the default or shorter than ' + MIN_PIN_LENGTH +
      ' characters. Change ADMIN_PIN in the Settings tab of the Sheet first.');
  }
}

/** Free text from the app: trimmed and capped at MAX_LENGTH[kind]. */
function text_(value, kind) {
  return String(value == null ? '' : value).trim().slice(0, MAX_LENGTH[kind]);
}

function slugify_(text) {
  return String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function matchId_(date, opponent) {
  return 'M-' + date.replace(/-/g, '') + '-' + (slugify_(opponent || 'match') || 'match');
}

function oneOffTrainingId_(date, start) {
  return 'T-' + date.replace(/-/g, '') + '-' + start.replace(':', '') + '-X';
}

/** "6:45 PM", "18:45", "0845" -> "18:45" ('' if unreadable). */
function normTime_(value) {
  const match = String(value || '').trim().toUpperCase().match(/^(\d{1,2})[:.]?(\d{2})?\s*(AM|PM)?$/);
  if (!match) return '';
  let hours = Number(match[1]);
  const minutes = match[2] ? Number(match[2]) : 0;
  if (match[3] === 'PM' && hours < 12) hours += 12;
  if (match[3] === 'AM' && hours === 12) hours = 0;
  if (hours > 23 || minutes > 59) return '';
  return ('0' + hours).slice(-2) + ':' + ('0' + minutes).slice(-2);
}

function dayIndex_(day) {
  return ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].indexOf(String(day || '').trim().slice(0, 3).toLowerCase());
}

function isIsoDate_(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}

function sgDate_(date, time) {
  return new Date(date + 'T' + time + ':00+08:00');
}

function todaySG_() {
  return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
}

function addDays_(isoDate, days) {
  const d = new Date(isoDate + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function num_(value, fallback) {
  const n = parseFloat(value);
  return Number.isNaN(n) ? fallback : n;
}
