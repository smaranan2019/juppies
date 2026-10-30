import { sessionStart } from './dates.js';

export const RSVP_STATUSES = ['Going', 'Not going', 'TBC'];

const FIRM_ANSWERS = new Set(['Going', 'Not going']);

/** The moment firm answers stop being editable. */
export function lockTime(session, settings) {
  const hours = session.type === 'Match' ? settings.matchLockHours : settings.trainingLockHours;
  return new Date(sessionStart(session).getTime() - hours * 60 * 60 * 1000);
}

/**
 * Firm answers (Going / Not going) lock at the cutoff so the coach can plan.
 * TBC or no answer stays open, so late players can still confirm.
 * The database enforces the same rule in submit_rsvp (supabase/setup.sql).
 */
export function isLocked(session, currentStatus, settings, now) {
  return FIRM_ANSWERS.has(currentStatus) && now >= lockTime(session, settings);
}
