/** Entry point: wires state, rendering and the delegated event listeners. */

import { state, subscribe, setState } from './store.js';
import { render } from './render.js';
import { load } from './controller.js';
import { changeActions, clickActions, formActions, inputActions } from './actions.js';
import { initTheme } from './ui/theme.js';
import { auth } from './auth.js';

subscribe(render);
auth.onChange(() => load());
initTheme(document.querySelector('#theme-button'));

document.addEventListener('click', (event) => {
  const actionEl = event.target.closest('[data-action]');
  if (actionEl) {
    clickActions[actionEl.dataset.action]?.(actionEl, event);
    return;
  }
  // Tapping a card opens its session, unless the tap was on a control inside it.
  if (event.target.closest('input, select, textarea, label, a, form')) return;
  const card = event.target.closest('[data-open-session]');
  if (card) setState({ modal: { kind: 'session', id: card.dataset.openSession, editingResult: false }, pendingRsvp: {} });
});

document.addEventListener('submit', (event) => {
  const form = event.target.closest('[data-form]');
  if (!form) return;
  event.preventDefault();
  formActions[form.dataset.form]?.(form, new FormData(form));
});

document.addEventListener('change', (event) => {
  const input = event.target.closest('[data-change]');
  if (input) changeActions[input.dataset.change]?.(input);
});

document.addEventListener('input', (event) => {
  const input = event.target.closest('[data-input]');
  if (input) inputActions[input.dataset.input]?.(input);
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && state.modal && state.me) clickActions['close-modal']();
});

document.querySelector('#me-button').addEventListener('click', () => clickActions['open-name-picker']());

// Phones keep tabs alive for days, so refresh when the app returns to the foreground.
// Skipped while a sheet is open so a half-filled form isn't wiped.
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && state.data && !state.busy && !state.modal) load();
});

render(state);
load();
