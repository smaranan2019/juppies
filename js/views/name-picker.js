import { html } from '../ui/html.js';
import { icons } from '../ui/icons.js';
import { activePlayers } from '../logic/selectors.js';

export function namePicker(state) {
  const names = activePlayers(state.data).map((p) => p.name).sort((a, b) => a.localeCompare(b));
  return html`
    <div class="welcome-art" aria-hidden="true"></div>
    <div class="sheet__head">
      <div>
        <h2 id="sheet-title" class="sheet__title">Who are you?</h2>
        <p class="muted">This phone will remember it. You can change it anytime.</p>
      </div>
      ${state.me && html`<button class="icon-button" type="button" data-action="close-modal" aria-label="Close">${icons.close}</button>`}
    </div>
    ${names.length
      ? html`<div class="name-grid">${names.map((name) => html`
          <button type="button" class="${name === state.me ? 'is-on' : ''}" data-action="set-me" data-name="${name}">${name}</button>`)}</div>`
      : html`<div class="empty">No players yet. An admin needs to add the team list first.
          <button class="btn btn--ghost" type="button" data-action="close-modal">Continue</button></div>`}
    <p class="note">Not on the list? Ask an admin to add you.</p>`;
}
