/**
 * Match results: the final score, who played, goals, assists and player of the match.
 *
 * Shape of a result as entered by an admin:
 *   { sessionId, ourScore, theirScore, playerOfMatch,
 *     players: [{ player, goals, assists }] }   // everyone listed played
 */

export const MAX_COUNT = 99;

/** 'W' | 'D' | 'L' from our point of view, or null when there is no result. */
export function outcome(result) {
  if (!result) return null;
  if (result.ourScore > result.theirScore) return 'W';
  if (result.ourScore < result.theirScore) return 'L';
  return 'D';
}

const isCount = (n) => Number.isInteger(n) && n >= 0 && n <= MAX_COUNT;

/**
 * Our score is always player goals plus goals nobody on our team scored (own
 * goals by the opponent). The result form keeps the unassigned part fixed and
 * recomputes the score whenever a player's goals change.
 */
export const unassignedGoals = (ourScore, playerGoals) =>
  Number.isFinite(ourScore) ? Math.max(0, ourScore - playerGoals) : 0;

export const ourScoreFrom = (playerGoals, unassigned) => Math.min(MAX_COUNT, playerGoals + unassigned);

/**
 * Returns human-readable problems with a result (an empty list means valid).
 * Player goals may add up to less than our score, because own goals by the
 * opponent count for us without a scorer.
 *
 * The server repeats these checks in validateMatchResult_ (backend/Matches.gs).
 * Keep the two in sync.
 */
export function validateMatchResult(result, rosterNames) {
  const errors = [];
  if (!isCount(result.ourScore) || !isCount(result.theirScore)) {
    errors.push(`Scores must be whole numbers from 0 to ${MAX_COUNT}.`);
  }

  const roster = new Set(rosterNames);
  const seen = new Set();
  let totalGoals = 0;
  let totalAssists = 0;
  for (const line of result.players) {
    if (!roster.has(line.player)) errors.push(`${line.player} is not on the team list.`);
    if (seen.has(line.player)) errors.push(`${line.player} is listed twice.`);
    if (!isCount(line.goals) || !isCount(line.assists)) {
      errors.push(`${line.player}: goals and assists must be whole numbers.`);
    }
    seen.add(line.player);
    totalGoals += line.goals;
    totalAssists += line.assists;
  }

  if (isCount(result.ourScore)) {
    if (totalGoals > result.ourScore) {
      errors.push(`Player goals (${totalGoals}) add up to more than our score (${result.ourScore}).`);
    }
    if (totalAssists > result.ourScore) {
      errors.push(`Assists (${totalAssists}) can't be more than our score (${result.ourScore}).`);
    }
  }
  if (result.playerOfMatch && !seen.has(result.playerOfMatch)) {
    errors.push('Player of the match must be someone who played.');
  }
  return errors;
}
