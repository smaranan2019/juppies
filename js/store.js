/**
 * The single source of UI state. Change it only through setState(),
 * which re-renders the app.
 */

import { storage } from './storage.js';

export const state = {
  /** Bootstrap payload from the backend, or null while loading. */
  data: null,
  loadError: '',
  view: 'home',
  me: storage.get('me') || '',
  pin: storage.get('pin') || '',
  /** null | { kind: 'names' } | { kind: 'session', id, editingResult } */
  modal: null,
  /** sessionId -> { status, reason } while the player types a reason. */
  pendingRsvp: {},
  showPast: { Training: false, Match: false },
  /** Season start year for the Stats page; null means "the latest season". */
  statsSeason: null,
  importPreview: null,
  feedbackFilter: 'New',
  busy: false,
};

const listeners = [];

export function subscribe(listener) {
  listeners.push(listener);
}

export function setState(patch) {
  Object.assign(state, patch);
  listeners.forEach((listener) => listener(state));
}
