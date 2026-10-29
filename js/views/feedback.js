import { html } from '../ui/html.js';
import { formatDate, sessionTitle } from '../ui/format.js';
import { sessionStart } from '../logic/dates.js';
import { pageHeader } from './components.js';

const TAGGABLE_WINDOW_MS = 21 * 24 * 60 * 60 * 1000;

export function feedbackView(state, now = new Date()) {
  const { data, me } = state;
  const taggable = data.sessions
    .filter((s) => s.status !== 'Cancelled' && Math.abs(sessionStart(s) - now) < TAGGABLE_WINDOW_MS)
    .sort((a, b) => sessionStart(b) - sessionStart(a));

  return html`
    ${pageHeader('Feedback', 'Ideas, concerns, shout-outs. Only admins can read this.')}
    <form class="card form" data-form="feedback">
      <label class="field">
        <span>Your feedback</span>
        <textarea name="message" maxlength="2000" placeholder="What's on your mind?" required></textarea>
      </label>
      <label class="field">
        <span>About a session (optional)</span>
        <select name="sessionId">
          <option value="">General</option>
          ${taggable.map((s) => html`<option value="${s.id}">${sessionTitle(s)} · ${formatDate(s.date)}</option>`)}
        </select>
      </label>
      <label class="check">
        <input type="checkbox" name="anonymous" ${me ? '' : 'checked disabled'}>
        <span>Send anonymously</span>
      </label>
      <p class="note">${me ? `Sending as ${me} unless you tick anonymous.` : 'Sending anonymously (no name picked).'}</p>
      <button class="btn btn--primary btn--block" type="submit">Send feedback</button>
    </form>`;
}
