function saveRsvp_(b) {
  const status = String(b.status || '');
  if (RSVP_STATUSES.indexOf(status) < 0) throw new Error('Status must be Going, Not going or TBC');
  const player = String(b.player || '').trim();
  if (!isActivePlayer_(player)) throw new Error('Name not on the team list');

  const session = findSession_(b.sessionId);
  if (!session) throw new Error('Session not found');
  if (session.Status === 'Cancelled') throw new Error('This session is cancelled');

  const current = rows_('RSVPs').find((r) => r.SessionID === session.ID && r.Player === player);
  if (isLocked_(session, current ? current.Status : '', new Date())) {
    throw new Error('RSVP is locked. Please message the coach to change it.');
  }

  const row = [session.ID, player, status, text_(b.reason, 'reason'), new Date().toISOString()];
  if (current) updateRowWhere_('RSVPs', ['SessionID', 'Player'], [session.ID, player], row);
  else appendRows_('RSVPs', [row]);
}

/**
 * Locked when past the cutoff AND the player already gave a firm answer.
 * TBC or no answer can still be updated. Mirrors isLocked in js/logic/rsvp.js.
 */
function isLocked_(session, currentStatus, now) {
  if (currentStatus !== 'Going' && currentStatus !== 'Not going') return false;
  const settings = settings_();
  const hours = session.Type === 'Match' ? num_(settings.MATCH_LOCK_HOURS, 12) : num_(settings.TRAINING_LOCK_HOURS, 2);
  const start = sgDate_(session.Date, normTime_(session.Start) || '00:00');
  return now.getTime() >= start.getTime() - hours * 3600000;
}
