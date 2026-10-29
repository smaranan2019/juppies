/**
 * Identifier helpers. Session IDs are readable on purpose, so admins can
 * recognise rows in the Sheet. Keep these in sync with backend/Sessions.gs.
 */

const slugify = (text) => String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** ('2026-09-13', 'NUS Titans') -> 'M-20260913-nus-titans' */
export const matchId = (date, opponent) => `M-${date.replace(/-/g, '')}-${slugify(opponent || 'match') || 'match'}`;

/** One-off trainings get an '-X' suffix so they never clash with the regular weekly slots. */
export const oneOffTrainingId = (date, start) => `T-${date.replace(/-/g, '')}-${start.replace(':', '')}-X`;

/**
 * Extracts the 11-character video id from an https youtube.com / youtu.be link
 * ('' for anything else). Mirrors youTubeId_ in backend/Matches.gs.
 */
export function youTubeId(url) {
  const text = String(url || '').trim();
  if (!/^https:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)\//i.test(text)) return '';
  const match = text.match(/(?:youtu\.be\/|v=|\/embed\/|\/shorts\/|\/live\/)([A-Za-z0-9_-]{11})/);
  return match ? match[1] : '';
}
