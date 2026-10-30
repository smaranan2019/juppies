/**
 * Loading data, running backend actions and admin sign-in. After every
 * successful change we reload the whole bootstrap payload: the team's data is
 * small, and it keeps the screen identical to what is in the database.
 */

import { callApi } from './api.js';
import { auth } from './auth.js';
import { state, setState } from './store.js';
import { sessionStart } from './logic/dates.js';
import { storage } from './storage.js';
import { toast } from './ui/toast.js';
import { latestOnly } from './lib/async.js';

/** Fetches everything. If loads overlap (a save, then the app regaining focus), only the newest is applied. */
const fetchLatest = latestOnly(() => Promise.all([callApi('bootstrap'), auth.currentEmail()]));

/**
 * Loads (or reloads) everything. On failure the last good data stays on
 * screen and `loadError` is set, so the page can say it's out of date.
 */
export async function load() {
  try {
    const fetched = await fetchLatest();
    if (!fetched) return; // a newer load is already on its way
    const [data, adminEmail] = fetched;
    data.sessions.sort((a, b) => sessionStart(a) - sessionStart(b));

    const patch = { data, adminEmail, loadError: '', loadedAt: new Date() };
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
    const response = await callApi(action, payload);
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

/** Emails the admin a sign-in link (in demo mode, signs in straight away). */
export async function sendAdminLink(email) {
  try {
    const { signedInNow } = await auth.sendSignInLink(email);
    if (signedInNow) {
      toast('Signed in');
      await load();
    } else {
      setState({ adminLinkSentTo: email });
    }
  } catch (error) {
    toast(error.message, { error: true });
  }
}

export async function signOutAdmin() {
  await auth.signOut();
  setState({ adminEmail: null, adminLinkSentTo: '' });
  toast('Signed out');
  return load();
}
