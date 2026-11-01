/**
 * User interactions. Views declare intent with attributes and these maps
 * hold the matching handlers:
 *   data-action="x"  on a button    -> clickActions.x(element, event)
 *   data-form="x"    on a <form>    -> formActions.x(form, formData)
 *   data-change="x"  on an input    -> changeActions.x(input)   (on commit)
 *   data-input="x"   on an input    -> inputActions.x(input)    (on every keystroke)
 */

import { state, setState } from './store.js';
import { storage } from './storage.js';
import { load, runAction, signInAdmin, signOutAdmin } from './controller.js';
import { toast } from './ui/toast.js';
import { escapeHtml } from './ui/html.js';
import { unassignedHint } from './ui/format.js';
import { youTubeId } from './logic/ids.js';
import { ourScoreFrom, unassignedGoals, validateMatchResult } from './logic/match-result.js';
import { celebrateResult } from './ui/effects.js';
import { rsvpOf } from './logic/selectors.js';
import { exportWorkbook, readScheduleFile } from './admin/excel.js';

const sessionIdOf = (element) => element.closest('[data-session-id]')?.dataset.sessionId;
const openSessionId = () => (state.modal?.kind === 'session' ? state.modal.id : null);
const toCount = (value) => (value === '' || value === null ? NaN : Number(value));

function closeModal() {
  setState({ modal: null, pendingRsvp: {} });
}

function saveRsvp(sessionId, status, reason) {
  const { [sessionId]: _done, ...stillPending } = state.pendingRsvp;
  setState({ pendingRsvp: stillPending });
  return runAction('rsvp', { sessionId, player: state.me, status, reason }, `Saved: ${status}`);
}

/** Reads the admin's result form into the shape the backend expects. */
function readResultForm(form, formData) {
  const players = [...form.querySelectorAll('[data-lineup-player]')]
    .filter((row) => row.querySelector('[name="played"]').checked)
    .map((row) => ({
      player: row.dataset.lineupPlayer,
      goals: toCount(row.querySelector('[name="goals"]').value || 0),
      assists: toCount(row.querySelector('[name="assists"]').value || 0),
    }));
  return {
    sessionId: openSessionId(),
    ourScore: toCount(formData.get('ourScore')),
    theirScore: toCount(formData.get('theirScore')),
    playerOfMatch: formData.get('playerOfMatch') || '',
    players,
  };
}

export const clickActions = {
  go(el) {
    setState({ view: el.dataset.view, pendingRsvp: {} });
    window.scrollTo(0, 0);
  },
  retry() {
    setState({ loadError: '' });
    load();
  },
  'open-name-picker'() {
    setState({ modal: { kind: 'names' } });
  },
  'set-me'(el) {
    const me = el.dataset.name;
    storage.set('me', me);
    setState({ me, modal: null });
    toast(`Hi ${me}!`);
  },
  'close-modal': closeModal,
  'close-modal-backdrop'(el, event) {
    // Only a tap on the dimmed backdrop itself closes; and a name must be picked first.
    if (event.target === el && state.me) closeModal();
  },
  rsvp(el) {
    const sessionId = sessionIdOf(el);
    const status = el.dataset.status;
    if (status === 'Going') {
      saveRsvp(sessionId, status, '');
      return;
    }
    // Not going / TBC: ask for an optional reason first.
    const mine = rsvpOf(state.data, sessionId, state.me);
    const reason = mine && mine.status === status ? mine.reason : '';
    setState({ pendingRsvp: { ...state.pendingRsvp, [sessionId]: { status, reason } } });
    // The same card can be on the page and in the open sheet; focus the one the player is looking at.
    const scope = state.modal ? document.querySelector('#modal') : document.querySelector('#app');
    scope.querySelector(`[data-session-id="${CSS.escape(sessionId)}"] [name="reason"]`)?.focus();
  },
  'toggle-past'(el) {
    const type = el.dataset.type;
    setState({ showPast: { ...state.showPast, [type]: !state.showPast[type] } });
  },
  'sign-out': signOutAdmin,
  'feedback-filter'(el) {
    setState({ feedbackFilter: el.dataset.filter });
  },
  'feedback-status'(el) {
    runAction('setFeedbackStatus', { id: el.dataset.id, status: el.dataset.status });
  },
  async 'import-confirm'() {
    const preview = state.importPreview;
    if (!preview?.matches) return;
    const matches = preview.matches.map(({ date, start, opponent, note, rsvps }) => ({ date, start, opponent, note, rsvps }));
    const response = await runAction('importMatches', { matches, importRsvps: preview.withRsvps }, (r) =>
      `Imported: ${r.added} new, ${r.updated} updated${r.rsvpsAdded ? `, ${r.rsvpsAdded} RSVPs` : ''}${r.playersAdded ? `, ${r.playersAdded} players` : ''}`);
    if (response) setState({ importPreview: null });
  },
  'player-active'(el) {
    const name = el.dataset.name;
    const active = el.dataset.active === 'true';
    if (!active && !confirm(`Deactivate ${name}? They'll be hidden from the name list. History is kept.`)) return;
    runAction('setPlayerActive', { name, active }, `${name} ${active ? 'reactivated' : 'deactivated'}`);
  },
  'session-status'(el) {
    const status = el.dataset.status;
    if (status === 'Cancelled' && !confirm('Cancel this session? Players will see it as cancelled.')) return;
    runAction('setSessionStatus', { id: openSessionId(), status }, status === 'Cancelled' ? 'Session cancelled' : 'Session restored');
  },
  'remove-video'(el) {
    if (!confirm('Remove this video?')) return;
    runAction('removeVideo', { sessionId: openSessionId(), url: el.dataset.url }, 'Video removed');
  },
  'edit-result'() {
    setState({ modal: { ...state.modal, editingResult: true } });
  },
  'cancel-result'() {
    setState({ modal: { ...state.modal, editingResult: false } });
  },
  async 'clear-result'() {
    if (!confirm('Delete this result? The score, goals, assists and player of the match will be removed.')) return;
    const response = await runAction('clearMatchResult', { sessionId: openSessionId() }, 'Result deleted');
    if (response) setState({ modal: { ...state.modal, editingResult: false } });
  },
  async export() {
    try {
      await exportWorkbook(state.data);
    } catch (error) {
      toast(error.message, { error: true });
    }
  },
};

export const formActions = {
  'rsvp-reason'(form, formData) {
    const sessionId = sessionIdOf(form);
    saveRsvp(sessionId, state.pendingRsvp[sessionId].status, formData.get('reason').trim());
  },
  async feedback(form, formData) {
    const message = formData.get('message').trim();
    if (!message) {
      toast('Write something first', { error: true });
      return;
    }
    const anonymous = formData.get('anonymous') === 'on' || !state.me;
    await runAction('feedback', {
      message,
      sessionId: formData.get('sessionId'),
      anonymous,
      name: anonymous ? '' : state.me,
    }, 'Thanks! Sent to the admins.');
  },
  'admin-sign-in'(form, formData) {
    signInAdmin(formData.get('pin'));
  },
  async 'import-preview'(form, formData) {
    const seasonYear = Number(formData.get('seasonYear')) || new Date().getFullYear();
    try {
      const preview = await readScheduleFile(formData.get('file'), seasonYear);
      setState({ importPreview: { ...preview, withRsvps: formData.get('withRsvps') === 'on' } });
    } catch (error) {
      setState({ importPreview: { error: `Could not read that file: ${error.message}` } });
    }
  },
  'add-session'(form, formData) {
    const session = Object.fromEntries(formData);
    session.opponent = session.opponent.trim();
    if (session.type === 'Match' && !session.opponent) {
      toast('Add the opponent for a match', { error: true });
      return;
    }
    runAction('addSession', session, `${session.type} added`);
  },
  'add-player'(form, formData) {
    const name = formData.get('name').trim();
    if (name) runAction('addPlayer', { name }, `${name} added`);
  },
  'add-video'(form, formData) {
    const url = formData.get('url').trim();
    if (!youTubeId(url)) {
      toast("That doesn't look like a YouTube link", { error: true });
      return;
    }
    runAction('addVideo', { sessionId: openSessionId(), title: formData.get('title').trim() || 'Video', url }, 'Video added');
  },
  async 'match-result'(form, formData) {
    const result = readResultForm(form, formData);
    // Check here first so a typo doesn't cost a round trip. Errors are written
    // straight into the form rather than through setState, because a re-render
    // would wipe what the admin typed. The server repeats the same checks.
    const errors = validateMatchResult(result, state.data.players.map((p) => p.name));
    const errorBox = form.querySelector('[data-form-errors]');
    errorBox.hidden = errors.length === 0;
    errorBox.innerHTML = errors.map(escapeHtml).join('<br>');
    if (errors.length) return;
    const response = await runAction('saveMatchResult', result, 'Result saved');
    if (!response) return;
    setState({ modal: { ...state.modal, editingResult: false } });
    celebrateResult(document.querySelector('#modal'), result);
  },
};

export const changeActions = {
  'stats-season'(input) {
    setState({ statsSeason: Number(input.value) });
  },
  'import-rsvps'(input) {
    if (state.importPreview) setState({ importPreview: { ...state.importPreview, withRsvps: input.checked } });
  },
  /** Ticking "played" enables that player's goal/assist boxes, without a re-render. */
  'lineup-played'(input) {
    const row = input.closest('[data-lineup-player]');
    row.querySelectorAll('input[type="number"]').forEach((box) => {
      box.disabled = !input.checked;
    });
    syncOurScore(input.form);
  },
};

/*
 * The result form updates itself in place (no setState) so typing never
 * loses focus or wipes other fields.
 */
export const inputActions = {
  'lineup-goals'(input) {
    syncOurScore(input.form);
  },
  /** Typing our score by hand records any goals above the players' total as unassigned. */
  'our-score'(input) {
    const unassigned = unassignedGoals(toCount(input.value), playerGoalsIn(input.form));
    input.form.dataset.unassignedGoals = String(unassigned);
    input.form.querySelector('[data-unassigned-hint]').textContent = unassignedHint(unassigned);
  },
};

const playerGoalsIn = (form) =>
  [...form.querySelectorAll('[data-lineup-player]')]
    .filter((row) => row.querySelector('[name="played"]').checked)
    .reduce((sum, row) => sum + (toCount(row.querySelector('[name="goals"]').value) || 0), 0);

/** Our score = goals by players who played + goals without a scorer. */
function syncOurScore(form) {
  const scoreInput = form.elements.ourScore;
  const next = String(ourScoreFrom(playerGoalsIn(form), Number(form.dataset.unassignedGoals) || 0));
  if (scoreInput.value === next) return;
  scoreInput.value = next;
  scoreInput.classList.remove('is-bumped');
  void scoreInput.offsetWidth; // restart the bump animation
  scoreInput.classList.add('is-bumped');
}
