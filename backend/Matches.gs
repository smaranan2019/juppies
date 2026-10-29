/** Match videos, results and per-player stats. */

function addVideo_(b) {
  if (!findSession_(b.sessionId)) throw new Error('Match not found');
  const id = youTubeId_(b.url);
  if (!id) throw new Error('Please paste a YouTube link');
  // Stored in one canonical form, so nothing but a YouTube link can ever reach the page.
  appendRows_('Videos', [[b.sessionId, text_(b.title, 'title') || 'Video', 'https://www.youtube.com/watch?v=' + id, new Date().toISOString()]]);
}

/** The 11-character video id from a youtube.com or youtu.be link, or ''. Mirrors youTubeId in js/logic/ids.js. */
function youTubeId_(url) {
  const text = String(url || '').trim();
  if (!/^https:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)\//i.test(text)) return '';
  const match = text.match(/(?:youtu\.be\/|v=|\/embed\/|\/shorts\/|\/live\/)([A-Za-z0-9_-]{11})/);
  return match ? match[1] : '';
}

function removeVideo_(b) {
  deleteRowsWhere_('Videos', ['SessionID', 'URL'], [b.sessionId, b.url]);
}

/**
 * Saves (or replaces) a match result.
 * b: { sessionId, ourScore, theirScore, playerOfMatch, players: [{ player, goals, assists }] }
 * Everyone in `players` is recorded as having played.
 */
function saveMatchResult_(b) {
  const match = findSession_(b.sessionId);
  if (!match || match.Type !== 'Match') throw new Error('Match not found');
  if (match.Status === 'Cancelled') throw new Error('This match is cancelled');
  if (sgDate_(match.Date, normTime_(match.Start) || '00:00') > new Date()) throw new Error("This match hasn't started yet");

  const result = {
    ourScore: Number(b.ourScore),
    theirScore: Number(b.theirScore),
    playerOfMatch: text_(b.playerOfMatch, 'name'),
    players: (b.players || []).map((p) => ({ player: text_(p.player, 'name'), goals: Number(p.goals), assists: Number(p.assists) })),
  };
  const errors = validateMatchResult_(result, rows_('Players').map((p) => p.Name));
  if (errors.length) throw new Error(errors.join(' '));

  const resultRow = [match.ID, String(result.ourScore), String(result.theirScore), result.playerOfMatch, new Date().toISOString()];
  if (rows_('MatchResults').some((r) => r.SessionID === match.ID)) updateRowWhere_('MatchResults', 'SessionID', match.ID, resultRow);
  else appendRows_('MatchResults', [resultRow]);

  replaceRowsWhere_('PlayerStats', 'SessionID', match.ID,
    result.players.map((p) => [match.ID, p.player, String(p.goals), String(p.assists)]));
}

function clearMatchResult_(b) {
  deleteRowsWhere_('MatchResults', 'SessionID', b.sessionId);
  deleteRowsWhere_('PlayerStats', 'SessionID', b.sessionId);
}

/**
 * Returns a list of problems with a result (empty means valid).
 * Mirrors validateMatchResult in js/logic/match-result.js. Keep the two in sync.
 */
function validateMatchResult_(result, rosterNames) {
  const errors = [];
  const isCount = (n) => Number.isInteger(n) && n >= 0 && n <= MAX_COUNT;
  if (!isCount(result.ourScore) || !isCount(result.theirScore)) errors.push('Scores must be whole numbers from 0 to ' + MAX_COUNT + '.');

  const seen = {};
  let totalGoals = 0;
  let totalAssists = 0;
  result.players.forEach((line) => {
    if (rosterNames.indexOf(line.player) < 0) errors.push(line.player + ' is not on the team list.');
    if (seen[line.player]) errors.push(line.player + ' is listed twice.');
    if (!isCount(line.goals) || !isCount(line.assists)) errors.push(line.player + ': goals and assists must be whole numbers.');
    seen[line.player] = true;
    totalGoals += line.goals;
    totalAssists += line.assists;
  });

  if (isCount(result.ourScore)) {
    if (totalGoals > result.ourScore) errors.push('Player goals (' + totalGoals + ') add up to more than our score (' + result.ourScore + ').');
    if (totalAssists > result.ourScore) errors.push("Assists (" + totalAssists + ") can't be more than our score (" + result.ourScore + ').');
  }
  if (result.playerOfMatch && !seen[result.playerOfMatch]) errors.push('Player of the match must be someone who played.');
  return errors;
}
