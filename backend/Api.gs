/**
 * HTTP entry points. The app POSTs { action, pin, ...payload } as text/plain
 * and always gets back JSON: { ok: true, ...result } or { ok: false, error }.
 *
 * The action maps are built inside functions rather than as top-level
 * constants because Apps Script runs each file's top-level code in order,
 * before the functions in later files (Players.gs, Sessions.gs...) exist.
 */

/** Actions anyone can call. */
function publicActions_() {
  return {
    bootstrap: (b) => bootstrap_(b.pin),
    checkPin: (b) => {
      requireAdmin_(b.pin);
      return { admin: true };
    },
    rsvp: (b) => withLock_(() => saveRsvp_(b)),
    feedback: (b) => withLock_(() => addFeedback_(b)),
  };
}

/** Actions that need the admin PIN. Each runs under the script lock. */
function adminActions_() {
  return {
    addPlayer: addPlayer_,
    setPlayerActive: setPlayerActive_,
    setSessionStatus: setSessionStatus_,
    addSession: addSession_,
    importMatches: importMatches_,
    addVideo: addVideo_,
    removeVideo: removeVideo_,
    setFeedbackStatus: setFeedbackStatus_,
    saveMatchResult: saveMatchResult_,
    clearMatchResult: clearMatchResult_,
  };
}

/** Opening the /exec URL in a browser shows the public data: a quick health check. Never takes a PIN. */
function doGet() {
  return respond_(() => bootstrap_(''));
}

function doPost(e) {
  return respond_(() => route_(JSON.parse((e && e.postData && e.postData.contents) || '{}')));
}

function route_(body) {
  const action = body.action;
  const open = publicActions_();
  if (open[action]) return open[action](body);
  const admin = adminActions_();
  if (!admin[action]) throw new Error('Unknown action: ' + action);
  requireAdmin_(body.pin);
  return withLock_(() => admin[action](body));
}

function respond_(handler) {
  let out;
  try {
    out = Object.assign({ ok: true }, handler() || { saved: true });
  } catch (err) {
    out = { ok: false, error: String(err && err.message ? err.message : err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

/** Serialises writes so two phones saving at once can't clobber each other's rows. */
function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}
