/** Small view building blocks shared across pages. Each returns SafeHtml. */

import { html } from '../ui/html.js';
import { icons } from '../ui/icons.js';
import { formatTime, formatWhen, relativeDay, sessionTitle } from '../ui/format.js';
import { clockSG, sessionEnd } from '../logic/dates.js';
import { RSVP_STATUSES, isLocked, lockTime } from '../logic/rsvp.js';
import { outcome } from '../logic/match-result.js';
import { resultFor, rsvpCounts, rsvpOf, videosFor } from '../logic/selectors.js';

export const TEAM_NAME = 'Juppies';

const OUTCOME_LABEL = { W: 'Win', D: 'Draw', L: 'Loss' };

export const pageHeader = (title, subtitle) => html`
  <header class="page-header">
    <h1>${title}</h1>
    ${subtitle && html`<p>${subtitle}</p>`}
  </header>`;

export const sectionHeader = (title, action) => html`
  <div class="section-header">
    <h2>${title}</h2>
    ${action}
  </div>`;

export const emptyState = (message) => html`<div class="card empty">${message}</div>`;

export const chip = (text, variant = '', icon = null) => html`<span class="chip ${variant}">${icon}${text}</span>`;

/** "3 – 1" with a coloured W/D/L chip. */
export function resultChip(result) {
  if (!result) return null;
  const o = outcome(result);
  return chip(`${OUTCOME_LABEL[o]} ${result.ourScore}–${result.theirScore}`, `chip--${o.toLowerCase()}`);
}

export function rsvpCountChips(data, sessionId) {
  const counts = rsvpCounts(data, sessionId);
  return html`
    <div class="chip-row">
      ${chip(`${counts.Going} going`, 'chip--going')}
      ${counts.TBC > 0 && chip(`${counts.TBC} TBC`, 'chip--tbc')}
      ${counts['Not going'] > 0 && chip(`${counts['Not going']} out`, 'chip--not')}
      ${counts.none > 0 && chip(`${counts.none} no reply`)}
    </div>`;
}

/** The Going / Not going / TBC control for the current player. */
export function rsvpControl(state, session, now = new Date()) {
  const { data, me } = state;
  if (session.status === 'Cancelled') return html`<p class="note note--warn">This session is cancelled.</p>`;
  if (!me) return html`<button class="btn btn--ghost btn--block" type="button" data-action="open-name-picker">Pick your name to RSVP</button>`;

  const mine = rsvpOf(data, session.id, me);
  const current = mine ? mine.status : '';
  if (sessionEnd(session) <= now) {
    return mine && html`<p class="note">You said <b>${current}</b>${mine.reason && ` (${mine.reason})`}</p>`;
  }

  const locked = isLocked(session, current, data.settings, now);
  const pending = state.pendingRsvp[session.id];
  const shown = pending ? pending.status : current;
  const lockAt = lockTime(session, data.settings);

  let hint = null;
  if (locked) hint = html`<p class="note note--warn">Locked since ${formatTime(clockSG(lockAt))}. Message the coach to change.</p>`;
  else if (now >= lockAt) hint = html`<p class="note note--warn">Past the cutoff, but you can still confirm.</p>`;
  else if (!current) hint = html`<p class="note">You haven't answered yet.</p>`;

  return html`
    <div class="rsvp" data-session-id="${session.id}">
      <div class="segmented" role="group" aria-label="Your RSVP">
        ${RSVP_STATUSES.map((status) => html`
          <button type="button" data-action="rsvp" data-status="${status}"
            class="${shown === status ? 'is-on' : ''}" aria-pressed="${shown === status}" ${locked ? 'disabled' : ''}>${status}</button>`)}
      </div>
      ${pending
        ? html`
          <form class="inline-form" data-form="rsvp-reason">
            <input type="text" name="reason" maxlength="200" placeholder="Reason (optional), e.g. ovs, work" value="${pending.reason}" autocomplete="off">
            <button class="btn btn--primary" type="submit">Save</button>
          </form>`
        : mine?.reason && html`<p class="note">Reason: ${mine.reason}</p>`}
      ${hint}
    </div>`;
}

/** A tappable session card. `featured` adds the "Next match/training" label. */
export function sessionCard(state, session, { featured = false } = {}) {
  const isMatch = session.type === 'Match';
  const cancelled = session.status === 'Cancelled';
  const when = relativeDay(session.date);
  const label = featured ? `Next ${isMatch ? 'match' : 'training'}` : session.type;
  return html`
    <article class="card card--tap ${cancelled ? 'is-cancelled' : ''}" data-open-session="${session.id}">
      <div class="chip-row">
        ${chip(label, isMatch ? 'chip--accent' : 'chip--soft', isMatch ? icons.ball : icons.calendar)}
        ${when && chip(when)}
        ${cancelled && chip('Cancelled', 'chip--not')}
      </div>
      <h3 class="card-title">${sessionTitle(session)}</h3>
      <p class="meta">${icons.clock}${formatWhen(session)}${session.note && ` · ${session.note}`}</p>
      ${rsvpCountChips(state.data, session.id)}
      ${rsvpControl(state, session)}
    </article>`;
}

/** A compact row for past sessions: title, date and result or video count. */
export function pastSessionRow(data, session) {
  const result = resultFor(data, session.id);
  const videos = videosFor(data, session.id).length;
  return html`
    <button type="button" class="list-row ${session.status === 'Cancelled' ? 'is-cancelled' : ''}" data-open-session="${session.id}">
      <span class="list-row__main">
        <span class="list-row__title">${sessionTitle(session)}</span>
        <span class="list-row__sub">${formatWhen(session)}</span>
      </span>
      <span class="chip-row chip-row--end">
        ${session.status === 'Cancelled' ? chip('Cancelled', 'chip--not') : resultChip(result)}
        ${videos > 0 && chip(String(videos), '', icons.play)}
      </span>
      ${icons.chevron}
    </button>`;
}

/** Big "Juppies 4 – 2 Opponent" score display. Scores count up when it appears. */
export function scoreboard(session, result) {
  const o = outcome(result);
  return html`
    <div class="scoreboard scoreboard--${o.toLowerCase()}">
      <div class="scoreboard__team">${TEAM_NAME}</div>
      <div class="scoreboard__score"><span data-count-up>${result.ourScore}</span><span class="scoreboard__dash">–</span><span data-count-up>${result.theirScore}</span></div>
      <div class="scoreboard__team">${session.opponent || 'Opponent'}</div>
      <div class="scoreboard__outcome">${chip(OUTCOME_LABEL[o], `chip--${o.toLowerCase()}`)}</div>
    </div>`;
}

/** Gold spotlight card for the player of the match. */
export const playerOfMatchCard = (name) => html`
  <div class="potm">
    <span class="potm__badge" aria-hidden="true">${icons.star}</span>
    <span><small>Player of the match</small>${name}</span>
  </div>`;

/** Stat tile in the style of the design reference: small label chip, big number. */
export const statTile = (label, value) => html`
  <div class="stat-tile">
    <span class="chip chip--soft">${label}</span>
    <strong data-count-up>${value}</strong>
  </div>`;

/**
 * The home page's next-match card: illustrated header (assets/match-hero.webp,
 * with a gradient fallback when the image isn't there), then the RSVP control.
 */
export function matchHero(state, session) {
  const when = relativeDay(session.date);
  return html`
    <article class="card card--tap match-hero" data-open-session="${session.id}">
      <div class="match-hero__art">
        <div class="chip-row">
          ${chip('Next match', 'chip--glass', icons.ball)}
          ${when && chip(when, 'chip--glass')}
        </div>
        <div>
          <p class="match-hero__vs">${TEAM_NAME} vs</p>
          <h3 class="match-hero__title">${session.opponent || 'TBA'}</h3>
          <p class="meta meta--light">${icons.clock}${formatWhen(session)}</p>
        </div>
      </div>
      <div class="match-hero__body">
        ${rsvpCountChips(state.data, session.id)}
        ${rsvpControl(state, session)}
      </div>
    </article>`;
}
