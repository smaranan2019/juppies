/** The Admin page: email sign-in, then collapsible tool panels. */

import { html } from '../ui/html.js';
import { formatDate, formatTime, formatTimestamp, sessionTitle } from '../ui/format.js';
import { activePlayers, matchesAwaitingResult, sessionById } from '../logic/selectors.js';
import { pageHeader, pastSessionRow } from './components.js';

const FEEDBACK_FILTERS = ['New', 'Seen', 'Done', 'All'];
const MAX_IMPORT_WARNINGS = 8;

const panel = (id, title, body, { open = false } = {}) => html`
  <details class="panel" id="${id}" ${open ? 'open' : ''}>
    <summary>${title}</summary>
    <div class="panel__body">${body}</div>
  </details>`;

function signInView(state) {
  if (state.adminEmail) {
    return html`
      ${pageHeader('Admin')}
      <div class="card form">
        <p>You're signed in as <b>${state.adminEmail}</b>, but this email isn't an admin.</p>
        <p class="note">Ask an existing admin to add it to the admins list in Supabase.</p>
        <button class="btn btn--ghost btn--block" type="button" data-action="sign-out">Sign out</button>
      </div>`;
  }
  if (state.adminLinkSentTo) {
    return html`
      ${pageHeader('Check your email')}
      <div class="card form">
        <p>If <b>${state.adminLinkSentTo}</b> is an admin email, a sign-in link is on its way.</p>
        <p class="note">Open it on the phone or computer you want to use. The link works once and expires after an hour.</p>
        <button class="btn btn--ghost btn--block" type="button" data-action="use-different-email">Use a different email</button>
      </div>`;
  }
  return html`
    ${pageHeader('Admin', 'Sign in to manage the schedule, results, players and feedback.')}
    <form class="card form" data-form="admin-sign-in">
      <label class="field">
        <span>Admin email</span>
        <input type="email" name="email" autocomplete="email" inputmode="email" required>
      </label>
      <button class="btn btn--primary btn--block" type="submit">Email me a sign-in link</button>
      <p class="note">No password needed. We'll email you a link that signs you in.</p>
    </form>`;
}

function resultsPanel(state, now) {
  const waiting = matchesAwaitingResult(state.data, now);
  return panel('panel-results', `Match results${waiting.length ? ` (${waiting.length} to enter)` : ''}`, waiting.length
    ? html`
      <p class="note">These matches are over but have no score yet. Open one and tap <b>Enter result</b>.</p>
      <div class="card card--list">${waiting.map((s) => pastSessionRow(state.data, s))}</div>`
    : html`<p class="note">All past matches have a result. To change one, open the match from the Matches page.</p>`,
  { open: waiting.length > 0 });
}

function feedbackPanel(state) {
  const all = state.data.feedback || [];
  const newCount = all.filter((f) => f.status === 'New').length;
  const shown = all.filter((f) => state.feedbackFilter === 'All' || f.status === state.feedbackFilter).reverse();
  return panel('panel-feedback', `Feedback inbox${newCount ? ` (${newCount} new)` : ''}`, html`
    <div class="pill-tabs">
      ${FEEDBACK_FILTERS.map((f) => html`
        <button type="button" class="${state.feedbackFilter === f ? 'is-on' : ''}" data-action="feedback-filter" data-filter="${f}">${f}</button>`)}
    </div>
    ${shown.length ? shown.map((f) => {
      const session = f.sessionId && sessionById(state.data, f.sessionId);
      return html`
        <div class="feedback-item">
          <div class="feedback-item__head"><b>${f.name || 'Anonymous'}</b><span class="muted small">${formatTimestamp(f.timestamp)}</span></div>
          ${session && html`<div class="muted small">Re: ${sessionTitle(session)} · ${formatDate(session.date)}</div>`}
          <p>${f.message}</p>
          <div class="button-row">
            ${['Seen', 'Done', 'New'].filter((s) => s !== f.status).map((s) => html`
              <button type="button" class="btn btn--ghost btn--small" data-action="feedback-status" data-id="${f.id}" data-status="${s}">Mark ${s.toLowerCase()}</button>`)}
          </div>
        </div>`;
    }) : html`<p class="empty">No feedback here.</p>`}`,
  { open: newCount > 0 });
}

function importPreview(preview, withRsvps) {
  if (preview.error) return html`<p class="note note--warn">${preview.error}</p>`;
  const { matches, players, warnings } = preview;
  return html`
    <p class="small"><b>${matches.length} matches</b> found${players.length > 0 && html`, <b>${players.length} players</b>`}.</p>
    ${warnings.length > 0 && html`
      <p class="note note--warn">${warnings.length} cell(s) could not be read:<br>
        ${warnings.slice(0, MAX_IMPORT_WARNINGS).map((w) => html`${w}<br>`)}${warnings.length > MAX_IMPORT_WARNINGS && '…'}</p>`}
    <div class="table-wrap table-wrap--scroll">
      <table>
        <thead><tr><th>Date</th><th>Time</th><th>VS</th><th class="num">RSVPs</th></tr></thead>
        <tbody>
          ${matches.map((m) => html`
            <tr>
              <td>${formatDate(m.date)} ${m.date.slice(0, 4)} ${m.note && html`<span class="chip chip--tbc">${m.note}</span>`}</td>
              <td>${formatTime(m.start)}</td>
              <td>${m.opponent}</td>
              <td class="num">${Object.keys(m.rsvps).length}</td>
            </tr>`)}
        </tbody>
      </table>
    </div>
    <button class="btn btn--primary btn--block" type="button" data-action="import-confirm">Import ${matches.length} matches${withRsvps ? ' + RSVPs' : ''}</button>`;
}

function uploadPanel(state) {
  const now = new Date();
  const seasonStart = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  const hasMatches = state.data.sessions.some((s) => s.type === 'Match');
  const withRsvps = state.importPreview?.withRsvps ?? !hasMatches;
  return panel('panel-upload', 'Upload match schedule', html`
    <form class="form" data-form="import-preview">
      <p class="note">Use the usual Excel layout: rows labelled <b>Date</b>, <b>Time</b> and <b>VS</b>, one column per match. Player rows underneath are optional.</p>
      <label class="field"><span>Excel file (.xlsx, .xls or .csv)</span><input type="file" name="file" accept=".xlsx,.xls,.csv" required></label>
      <label class="field"><span>Season starts in (Jul–Dec of)</span><input type="number" name="seasonYear" value="${seasonStart}" required></label>
      <label class="check"><input type="checkbox" name="withRsvps" data-change="import-rsvps" ${withRsvps ? 'checked' : ''}><span>Also import RSVPs (only fills blanks)</span></label>
      <button class="btn btn--ghost btn--block" type="submit">Preview</button>
    </form>
    ${state.importPreview && importPreview(state.importPreview, withRsvps)}`,
  { open: Boolean(state.importPreview) });
}

const addSessionPanel = () => panel('panel-add', 'Add a one-off session', html`
  <form class="form" data-form="add-session">
    <div class="form-row">
      <label class="field"><span>Type</span><select name="type"><option>Training</option><option>Match</option></select></label>
      <label class="field"><span>Date</span><input type="date" name="date" required></label>
    </div>
    <div class="form-row">
      <label class="field"><span>Start</span><input type="time" name="start" required></label>
      <label class="field"><span>End (optional)</span><input type="time" name="end"></label>
    </div>
    <label class="field"><span>Opponent (matches only)</span><input type="text" name="opponent"></label>
    <button class="btn btn--primary btn--block" type="submit">Add session</button>
    <p class="note">To cancel a session, open it and tap <b>Cancel session</b>. Regular Tue/Sat trainings are created automatically.</p>
  </form>`);

function playersPanel(state) {
  const players = [...state.data.players].sort((a, b) => b.active - a.active || a.name.localeCompare(b.name));
  return panel('panel-players', `Players (${activePlayers(state.data).length} active)`, html`
    <form class="inline-form" data-form="add-player">
      <input type="text" name="name" placeholder="New player name" required>
      <button class="btn btn--primary" type="submit">Add</button>
    </form>
    <ul class="people">
      ${players.map((p) => html`
        <li>
          <span class="${p.active ? '' : 'muted'}">${p.name}${!p.active && ' (inactive)'}</span>
          <button type="button" class="btn btn--ghost btn--small" data-action="player-active" data-name="${p.name}" data-active="${p.active ? 'false' : 'true'}">${p.active ? 'Deactivate' : 'Reactivate'}</button>
        </li>`)}
    </ul>
    <p class="note">Inactive players are hidden from the name list, but their history and stats are kept.</p>`);
}

const exportPanel = () => panel('panel-export', 'Export to Excel', html`
  <p class="note">Downloads RSVPs in the same sideways layout as your schedule sheet, plus player stats and results.</p>
  <button class="btn btn--primary btn--block" type="button" data-action="export">Download Excel</button>`);

export function adminView(state, now = new Date()) {
  if (!state.data.admin) return signInView(state);
  return html`
    <div class="page-header page-header--split">
      ${pageHeader('Admin', state.adminEmail && `Signed in as ${state.adminEmail}`)}
      <button class="btn btn--ghost btn--small" type="button" data-action="sign-out">Sign out</button>
    </div>
    ${resultsPanel(state, now)}
    ${feedbackPanel(state)}
    ${uploadPanel(state)}
    ${addSessionPanel()}
    ${playersPanel(state)}
    ${exportPanel()}`;
}
