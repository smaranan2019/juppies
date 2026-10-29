/** Public season stats: team record, player leaderboard, results and attendance. */

import { html } from '../ui/html.js';
import { icons } from '../ui/icons.js';
import { formatDate, percent } from '../ui/format.js';
import { seasonLabel } from '../logic/dates.js';
import { attendanceStats, availableSeasons, leaderboard, seasonResults, teamRecord } from '../logic/stats.js';
import { emptyState, pageHeader, resultChip, sectionHeader, statTile } from './components.js';

/** The season the page shows: the chosen one, else the newest with data. */
export function selectedSeason(state) {
  return state.statsSeason ?? availableSeasons(state.data.sessions)[0] ?? null;
}

function seasonPicker(state, season) {
  const seasons = availableSeasons(state.data.sessions);
  if (seasons.length < 2) return null;
  return html`
    <label class="select-pill">
      <span class="visually-hidden">Season</span>
      <select data-change="stats-season">
        ${seasons.map((s) => html`<option value="${s}" ${s === season ? 'selected' : ''}>${seasonLabel(s)}</option>`)}
      </select>
    </label>`;
}

function recordTiles(record) {
  return html`
    <div class="tile-row">
      ${statTile('Played', record.played)}
      ${statTile('Won', record.won)}
      ${statTile('Drawn', record.drawn)}
      ${statTile('Lost', record.lost)}
      ${statTile('Goals for', record.goalsFor)}
      ${statTile('Against', record.goalsAgainst)}
    </div>`;
}

const PODIUM_ORDER = [1, 0, 2]; // 2nd, 1st, 3rd, so the winner stands in the middle

/** Top three by points, on rising steps. Only shown once someone has a point. */
function podium(rows) {
  const top = rows.slice(0, 3);
  if (top.length < 3 || top[0].points === 0) return null;
  return html`
    <div class="podium" aria-label="Top three by points">
      ${PODIUM_ORDER.map((rank) => html`
        <div class="podium__place podium__place--${rank + 1}" style="--i:${rank}">
          <span class="podium__name">${top[rank].name}</span>
          <span class="podium__points"><b data-count-up>${top[rank].points}</b> pts</span>
          <div class="podium__step">${rank + 1}</div>
        </div>`)}
    </div>`;
}

function leaderboardTable(rows) {
  if (!rows.length) return emptyState('No goals or assists recorded yet. Admins can add them by editing a match result.');
  return html`
    <div class="card card--flush table-wrap">
      <table>
        <thead><tr><th>Player</th><th class="num">Apps</th><th class="num">G</th><th class="num">A</th><th class="num">Pts</th><th class="num" title="Player of the match">${icons.star}</th></tr></thead>
        <tbody>
          ${rows.map((r, i) => html`
            <tr>
              <td><span class="rank">${i + 1}</span>${r.name}</td>
              <td class="num">${r.apps}</td>
              <td class="num">${r.goals}</td>
              <td class="num">${r.assists}</td>
              <td class="num"><b>${r.points}</b></td>
              <td class="num">${r.playerOfMatch || ''}</td>
            </tr>`)}
        </tbody>
      </table>
    </div>`;
}

function resultsList(results) {
  if (!results.length) return emptyState('No results yet.');
  return html`
    <div class="card card--list">
      ${results.map(({ match, result }) => html`
        <button type="button" class="list-row" data-open-session="${match.id}">
          <span class="list-row__main">
            <span class="list-row__title">vs ${match.opponent}</span>
            <span class="list-row__sub">${formatDate(match.date)}${result.playerOfMatch && html` · ${icons.star} ${result.playerOfMatch}`}</span>
          </span>
          ${resultChip(result)}
          ${icons.chevron}
        </button>`)}
    </div>`;
}

function attendanceCell({ attended, total }) {
  if (!total) return html`<td class="num muted">–</td>`;
  const pct = percent(attended, total);
  return html`
    <td class="num">
      ${pct}% <span class="muted small">(${attended}/${total})</span>
      <div class="bar"><span style="width:${pct}%"></span></div>
    </td>`;
}

function attendanceTable(rows) {
  return html`
    <div class="card card--flush table-wrap">
      <table>
        <thead><tr><th>Player</th><th class="num">Training</th><th class="num">Matches</th></tr></thead>
        <tbody>
          ${rows.map((r) => html`<tr><td>${r.name}</td>${attendanceCell(r.training)}${attendanceCell(r.match)}</tr>`)}
        </tbody>
      </table>
    </div>
    <p class="note">Matches with a result count who actually played. Everything else counts who RSVP'd Going. Cancelled sessions are left out.</p>`;
}

export function statsView(state, now = new Date()) {
  const { data } = state;
  const season = selectedSeason(state);
  const board = leaderboard(data, season);
  return html`
    <div class="page-header page-header--split">
      ${pageHeader('Stats', season === null ? 'No sessions yet.' : `Season ${seasonLabel(season)}`)}
      ${seasonPicker(state, season)}
    </div>

    ${sectionHeader('Team record')}
    ${recordTiles(teamRecord(data, season))}

    ${sectionHeader('Leaderboard')}
    ${podium(board)}
    ${leaderboardTable(board)}

    ${sectionHeader('Results')}
    ${resultsList(seasonResults(data, season))}

    ${sectionHeader('Attendance')}
    ${attendanceTable(attendanceStats(data, now, season))}`;
}
