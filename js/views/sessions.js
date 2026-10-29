/** The Training and Matches pages: upcoming cards plus a list of past sessions. */

import { html } from '../ui/html.js';
import { icons } from '../ui/icons.js';
import { pastSessions, upcomingSessions } from '../logic/selectors.js';
import { emptyState, pageHeader, pastSessionRow, sectionHeader, sessionCard } from './components.js';

export function sessionsView(state, type, now = new Date()) {
  const { data } = state;
  const isMatch = type === 'Match';
  const upcoming = upcomingSessions(data, type, now);
  const past = pastSessions(data, type, now);
  const showPast = state.showPast[type];

  return html`
    ${pageHeader(isMatch ? 'Matches' : 'Training', isMatch && data.settings.venue
      ? html`<span class="meta">${icons.pin}${data.settings.venue}</span>`
      : 'Tap a session to see who is coming.')}

    ${sectionHeader('Upcoming')}
    ${upcoming.length ? html`<div class="grid">${upcoming.map((s) => sessionCard(state, s))}</div>` : emptyState('Nothing coming up.')}

    ${sectionHeader(isMatch ? `Results (${past.length})` : `Past (${past.length})`, html`
      <button type="button" class="link" data-action="toggle-past" data-type="${type}">${showPast ? 'Hide' : 'Show all'}</button>`)}
    ${showPast && (past.length
      ? html`<div class="card card--list">${past.map((s) => pastSessionRow(data, s))}</div>`
      : emptyState('Nothing yet.'))}`;
}
