/**
 * The bottom sheet opened by tapping a session: details, the RSVP control,
 * the match result (score, scorers, player of the match), videos and who's coming.
 * Admins also get the result editor, video tools and cancel/restore.
 */

import { html } from '../ui/html.js';
import { icons } from '../ui/icons.js';
import { formatWhen, relativeDay, sessionTitle, unassignedHint } from '../ui/format.js';
import { sessionStart } from '../logic/dates.js';
import { youTubeId } from '../logic/ids.js';
import { MAX_COUNT, ourScoreFrom, unassignedGoals } from '../logic/match-result.js';
import { activePlayers, resultFor, rsvpGroups, rsvpOf, statLinesFor, videosFor } from '../logic/selectors.js';
import { chip, playerOfMatchCard, rsvpControl, rsvpCountChips, scoreboard, sectionHeader } from './components.js';

const RSVP_GROUPS = [
  ['Going', 'Going', 'chip--going'],
  ['TBC', 'TBC', 'chip--tbc'],
  ['Not going', 'Not going', 'chip--not'],
  ['none', 'No reply', ''],
];

function resultSummary(data, session, result) {
  const lines = statLinesFor(data, session.id);
  const contributors = lines
    .filter((l) => l.goals || l.assists)
    .sort((a, b) => b.goals - a.goals || b.assists - a.assists || a.player.localeCompare(b.player));
  return html`
    ${scoreboard(session, result)}
    ${result.playerOfMatch && playerOfMatchCard(result.playerOfMatch)}
    ${contributors.length > 0 && html`
      <div class="card card--flush table-wrap">
        <table>
          <thead><tr><th>Player</th><th class="num">Goals</th><th class="num">Assists</th></tr></thead>
          <tbody>${contributors.map((l) => html`<tr><td>${l.player}</td><td class="num">${l.goals}</td><td class="num">${l.assists}</td></tr>`)}</tbody>
        </table>
      </div>`}
    ${lines.length > 0 && html`<p class="note">Played (${lines.length}): ${lines.map((l) => l.player).sort().join(', ')}</p>`}`;
}

/** Players the admin can tick: everyone active, plus anyone already recorded (even if since deactivated). */
function lineupCandidates(data, session) {
  const recorded = new Map(statLinesFor(data, session.id).map((l) => [l.player, l]));
  const names = new Set([...activePlayers(data).map((p) => p.name), ...recorded.keys()]);
  return [...names].sort((a, b) => a.localeCompare(b)).map((name) => {
    const line = recorded.get(name);
    // Until a lineup is recorded, pre-tick whoever said they were going.
    const played = recorded.size ? Boolean(line) : rsvpOf(data, session.id, name)?.status === 'Going';
    return { name, played, goals: line?.goals ?? 0, assists: line?.assists ?? 0 };
  });
}

const countInput = (name, value, { disabled = false, onInput = '' } = {}) => html`
  <input type="number" name="${name}" value="${value}" min="0" max="${MAX_COUNT}" inputmode="numeric"
    ${onInput && html`data-input="${onInput}"`} ${disabled ? 'disabled' : ''} aria-label="${name}">`;

function resultForm(state, session) {
  const { data } = state;
  const result = resultFor(data, session.id);
  const candidates = lineupCandidates(data, session);
  const playerGoals = candidates.filter((c) => c.played).reduce((sum, c) => sum + c.goals, 0);
  const unassigned = unassignedGoals(result?.ourScore, playerGoals);
  return html`
    <form class="card form" data-form="match-result" data-unassigned-goals="${unassigned}">
      <div class="score-inputs">
        <label class="field"><span>Juppies</span>${countInput('ourScore', ourScoreFrom(playerGoals, unassigned), { onInput: 'our-score' })}</label>
        <span class="score-inputs__dash">–</span>
        <label class="field"><span>${session.opponent || 'Opponent'}</span>${countInput('theirScore', result?.theirScore ?? '')}</label>
      </div>
      <p class="note" data-unassigned-hint>${unassignedHint(unassigned)}</p>

      <div class="lineup">
        <div class="lineup__head"><span>Played</span><span>Goals</span><span>Assists</span></div>
        ${candidates.map((c) => html`
          <div class="lineup__row" data-lineup-player="${c.name}">
            <label class="check"><input type="checkbox" name="played" data-change="lineup-played" ${c.played ? 'checked' : ''}><span>${c.name}</span></label>
            ${countInput('goals', c.goals, { disabled: !c.played, onInput: 'lineup-goals' })}
            ${countInput('assists', c.assists, { disabled: !c.played })}
          </div>`)}
      </div>

      <label class="field">
        <span>Player of the match</span>
        <select name="playerOfMatch">
          <option value="">Not chosen</option>
          ${candidates.map((c) => html`<option ${result?.playerOfMatch === c.name ? 'selected' : ''}>${c.name}</option>`)}
        </select>
      </label>

      <div class="note note--warn" role="alert" data-form-errors hidden></div>

      <div class="button-row">
        <button class="btn btn--primary" type="submit">Save result</button>
        <button class="btn btn--ghost" type="button" data-action="cancel-result">Cancel</button>
        ${result && html`<button class="btn btn--danger" type="button" data-action="clear-result">Delete result</button>`}
      </div>
    </form>`;
}

function resultSection(state, session, editing, now) {
  const { data } = state;
  if (session.type !== 'Match' || session.status === 'Cancelled') return null;
  const result = resultFor(data, session.id);
  const started = sessionStart(session) <= now;
  if (!result && !(data.admin && started)) return null;

  const action = data.admin && !editing && started
    ? html`<button type="button" class="link" data-action="edit-result">${result ? 'Edit' : 'Enter result'}</button>`
    : null;
  let body = null;
  if (editing) body = resultForm(state, session);
  else if (result) body = resultSummary(data, session, result);
  else body = html`<p class="note">No result yet.</p>`;
  return html`${sectionHeader('Result', action)}${body}`;
}

function videoSection(data, session) {
  if (session.type !== 'Match') return null;
  const videos = videosFor(data, session.id);
  return html`
    ${sectionHeader('Videos')}
    ${videos.length ? videos.map((v) => {
      const id = youTubeId(v.url);
      return html`
        <div class="video-item">
          <div class="video-item__head">
            <b>${v.title}</b>
            ${data.admin && html`<button class="btn btn--danger btn--small" type="button" data-action="remove-video" data-url="${v.url}">Remove</button>`}
          </div>
          ${id
            ? html`<div class="video"><iframe loading="lazy" src="https://www.youtube-nocookie.com/embed/${id}" title="${v.title}" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen></iframe></div>`
            : html`<p class="note">This link isn't a YouTube video, so it isn't shown.</p>`}
        </div>`;
    }) : html`<p class="note">No videos yet.</p>`}
    ${data.admin && html`
      <form class="card form" data-form="add-video">
        <b>Add a YouTube video</b>
        <input type="text" name="title" placeholder="Title, e.g. Full game, Highlights">
        <input type="url" name="url" placeholder="https://youtu.be/…" required>
        <button class="btn btn--primary" type="submit">Add video</button>
      </form>`}`;
}

function whoIsComing(state, session) {
  const groups = rsvpGroups(state.data, session.id);
  return RSVP_GROUPS.map(([key, label, variant]) => groups[key].length > 0 && html`
    ${sectionHeader(html`${chip(String(groups[key].length), variant)} ${label}`)}
    <ul class="people">
      ${groups[key].map((p) => html`<li><span class="${p.name === state.me ? 'is-me' : ''}">${p.name}</span><span class="muted small">${p.reason}</span></li>`)}
    </ul>`);
}

export function sessionSheet(state, session, editingResult, now = new Date()) {
  const { data } = state;
  const isMatch = session.type === 'Match';
  const when = relativeDay(session.date);
  return html`
    <div class="sheet__head">
      <div>
        <div class="chip-row">
          ${chip(session.type, isMatch ? 'chip--accent' : 'chip--soft', isMatch ? icons.ball : icons.calendar)}
          ${when && chip(when)}
          ${session.status === 'Cancelled' && chip('Cancelled', 'chip--not')}
        </div>
        <h2 id="sheet-title" class="sheet__title">${sessionTitle(session)}</h2>
        <p class="meta">${icons.clock}${formatWhen(session)}</p>
        ${isMatch && data.settings.venue && html`<p class="meta">${icons.pin}${data.settings.venue}</p>`}
        ${session.note && html`<p class="meta">${session.note}</p>`}
      </div>
      <button class="icon-button" type="button" data-action="close-modal" aria-label="Close">${icons.close}</button>
    </div>

    <div class="card">${rsvpCountChips(data, session.id)}${rsvpControl(state, session, now)}</div>
    ${resultSection(state, session, editingResult, now)}
    ${videoSection(data, session)}
    ${whoIsComing(state, session)}

    ${data.admin && html`
      ${sectionHeader('Admin')}
      ${session.status === 'Cancelled'
        ? html`<button class="btn btn--ghost btn--block" type="button" data-action="session-status" data-status="Active">Restore session</button>`
        : html`<button class="btn btn--danger btn--block" type="button" data-action="session-status" data-status="Cancelled">Cancel session</button>`}`}`;
}
