/**
 * Turns state into DOM. The whole page is re-rendered on every state change;
 * the data set is small, so this stays fast and keeps the code simple.
 */

import { html } from './ui/html.js';
import { icons } from './ui/icons.js';
import { isDemo } from './api.js';
import { sessionById } from './logic/selectors.js';
import { homeView } from './views/home.js';
import { sessionsView } from './views/sessions.js';
import { statsView } from './views/stats.js';
import { feedbackView } from './views/feedback.js';
import { adminView } from './views/admin.js';
import { sessionSheet } from './views/session-sheet.js';
import { namePicker } from './views/name-picker.js';
import { playEntrance } from './ui/effects.js';

const TABS = [
  { view: 'home', label: 'Home', icon: icons.home, render: homeView },
  { view: 'trainings', label: 'Training', icon: icons.calendar, render: (s) => sessionsView(s, 'Training') },
  { view: 'matches', label: 'Matches', icon: icons.ball, render: (s) => sessionsView(s, 'Match') },
  { view: 'stats', label: 'Stats', icon: icons.trophy, render: statsView },
  { view: 'feedback', label: 'Feedback', icon: icons.chat, render: feedbackView },
  { view: 'admin', label: 'Admin', icon: icons.lock, render: adminView },
];

/** The page currently on screen, so entrance effects run only on navigation. */
let renderedView = null;
/** Where keyboard focus was before the sheet opened, so closing it can put focus back. */
let focusBeforeModal = null;

const el = {
  app: document.querySelector('#app'),
  tabs: document.querySelector('#tabs'),
  modal: document.querySelector('#modal'),
  me: document.querySelector('#me-button'),
};

function tabsView(state) {
  const newFeedback = (state.data.feedback || []).some((f) => f.status === 'New');
  return TABS.map((tab) => html`
    <button type="button" data-action="go" data-view="${tab.view}" ${state.view === tab.view ? 'aria-current="page"' : ''}>
      ${tab.icon}<span>${tab.label}</span>
      ${tab.view === 'admin' && newFeedback && html`<span class="dot" aria-label="New feedback"></span>`}
    </button>`);
}

const loadingView = () => html`<div class="loading"><div class="spinner"></div>Loading…</div>`;

const errorView = (message) => html`
  <div class="card empty">
    <h3>Couldn't load the team data</h3>
    <p class="muted">${message}</p>
    <button class="btn btn--primary" type="button" data-action="retry">Try again</button>
  </div>`;

/** Shown when a refresh failed but older data is still on screen, so it's never mistaken for current. */
const staleBanner = (state) => html`
  <div class="stale-banner" role="alert">
    <span>Couldn't refresh. Showing data from ${state.loadedAt.toLocaleTimeString('en-SG', { hour: 'numeric', minute: '2-digit' })}.</span>
    <button type="button" class="link" data-action="retry">Try again</button>
  </div>`;

function pageView(state) {
  const tab = TABS.find((t) => t.view === state.view) ?? TABS[0];
  return html`
    ${state.loadError && state.loadedAt && staleBanner(state)}
    ${isDemo && html`<div class="demo-banner">Demo mode: real fixtures and results, made-up players and trainings. Nothing is saved. Admin: sign in with any email.</div>`}
    ${tab.render(state)}`;
}

function modalView(state) {
  const { modal } = state;
  if (!modal) return null;
  let body;
  if (modal.kind === 'names') {
    body = namePicker(state);
  } else {
    const session = sessionById(state.data, modal.id);
    if (!session) return null;
    body = sessionSheet(state, session, modal.editingResult);
  }
  return html`
    <div class="overlay" data-action="close-modal-backdrop">
      <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title" tabindex="-1">${body}</div>
    </div>`;
}

/** Re-rendering replaces <details> elements, so remember which ones were open. */
function withOpenPanelsKept(container, update) {
  const open = [...container.querySelectorAll('details[open]')].map((d) => d.id);
  update();
  open.forEach((id) => document.getElementById(id)?.setAttribute('open', ''));
}

/** Keeps the bottom sheet's scroll position when it re-renders after a save. */
function withScrollKept(container, update) {
  const scrollTop = container.querySelector('.sheet')?.scrollTop ?? 0;
  update();
  const sheet = container.querySelector('.sheet');
  if (sheet) sheet.scrollTop = scrollTop;
}

export function render(state) {
  if (!state.data) {
    el.app.innerHTML = String(state.loadError ? errorView(state.loadError) : loadingView());
    return;
  }
  el.me.textContent = state.me || 'Pick your name';
  el.tabs.innerHTML = String(html`${tabsView(state)}`);
  withOpenPanelsKept(el.app, () => {
    el.app.innerHTML = String(pageView(state));
  });
  // Entrance animations play only when the page changes, not on every re-render.
  const pageEntered = state.view !== renderedView;
  renderedView = state.view;
  el.app.classList.toggle('is-entering', pageEntered);
  if (pageEntered) playEntrance(el.app);

  const modal = modalView(state);
  const wasOpen = el.modal.hasChildNodes();
  withScrollKept(el.modal, () => {
    el.modal.innerHTML = modal ? String(modal) : '';
  });
  if (modal && !wasOpen) {
    const sheet = el.modal.querySelector('.sheet');
    sheet.classList.add('is-entering');
    playEntrance(el.modal);
    // Move keyboard and screen-reader focus into the sheet that just opened.
    focusBeforeModal = document.activeElement;
    sheet.focus({ preventScroll: true });
  } else if (!modal && wasOpen) {
    focusBeforeModal?.focus?.({ preventScroll: true });
    focusBeforeModal = null;
  }
  document.body.classList.toggle('has-modal', Boolean(modal));
}
