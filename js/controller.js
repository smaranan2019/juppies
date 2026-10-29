/**
 * Loading data and running backend actions. After every successful change we
 * reload the whole bootstrap payload: the team's data is small, and it keeps
 * the screen identical to what is in the Sheet.
 */

import { callApi } from './api.js';
import { state, setState } from './store.js';
import { sessionStart } from './logic/dates.js';
import { storage } from './storage.js';
import { toast } from './ui/toast.js';

export async function load() {
  try {
    const data = await callApi('bootstrap', {}, state.pin);
    data.sessions.sort((a, b) => sessionStart(a) - sessionStart(b));

    const patch = { data, loadError: '' };
    if (state.pin && !data.admin) {
      patch.pin = '';
      storage.set('pin', null);
    }
    if (state.me && !data.players.some((p) => p.name === state.me && p.active)) {
      patch.me = '';
      storage.set('me', null);
    }
    if (!(patch.me ?? state.me) && !state.modal) patch.modal = { kind: 'names' };
    setState(patch);
  } catch (error) {
    setState({ loadError: error.message });
  }
}

/**
 * Runs a backend action, shows a toast and reloads.
 * `successMessage` can be a string or a function of the response.
 * Resolves with the response, or null if the action failed (the error is shown).
 */
export async function runAction(action, payload, successMessage) {
  if (state.busy) return null;
  setState({ busy: true });
  try {
    const response = await callApi(action, payload, state.pin);
    if (successMessage) toast(typeof successMessage === 'function' ? successMessage(response) : successMessage);
    await load();
    return response;
  } catch (error) {
    toast(error.message, { error: true });
    await load();
    return null;
  } finally {
    setState({ busy: false });
  }
}

export async function unlockAdmin(pin) {
  try {
    const { admin } = await callApi('checkPin', {}, pin);
    if (!admin) {
      toast('Wrong PIN', { error: true });
      return;
    }
    storage.set('pin', pin);
    setState({ pin });
    toast('Admin unlocked');
    await load();
  } catch (error) {
    toast(error.message, { error: true });
  }
}

export function lockAdmin() {
  storage.set('pin', null);
  setState({ pin: '' });
  return load();
}
