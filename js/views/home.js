import { html } from '../ui/html.js';
import { formatDate } from '../ui/format.js';
import { latestResultMatch, nextSession, resultFor, unansweredSessions } from '../logic/selectors.js';
import { emptyState, matchHero, pageHeader, resultChip, sectionHeader, sessionCard } from './components.js';

const MAX_UNANSWERED = 6;

export function homeView(state, now = new Date()) {
  const { data, me } = state;
  const training = nextSession(data, 'Training', now);
  const match = nextSession(data, 'Match', now);
  const lastMatch = latestResultMatch(data, now);
  const todo = me
    ? unansweredSessions(data, me, now).filter((s) => s !== training && s !== match).slice(0, MAX_UNANSWERED)
    : [];

  return html`
    ${pageHeader(me ? `Hi ${me}` : 'Welcome', "Here's what's coming up for the team.")}

    ${sectionHeader('Up next')}
    <div class="grid">
      ${match ? matchHero(state, match) : emptyState('No upcoming match.')}
      ${training ? sessionCard(state, training, { featured: true }) : emptyState('No upcoming training.')}
    </div>

    ${lastMatch && html`
      ${sectionHeader('Last result', html`<button type="button" class="link" data-action="go" data-view="stats">See stats</button>`)}
      <button type="button" class="card card--tap result-strip" data-open-session="${lastMatch.id}">
        <span>
          <span class="list-row__title">vs ${lastMatch.opponent}</span>
          <span class="list-row__sub">${formatDate(lastMatch.date)}</span>
        </span>
        ${resultChip(resultFor(data, lastMatch.id))}
      </button>`}

    ${todo.length > 0 && html`
      ${sectionHeader(`Still need your answer (${todo.length})`)}
      <div class="grid">${todo.map((s) => sessionCard(state, s))}</div>`}`;
}
