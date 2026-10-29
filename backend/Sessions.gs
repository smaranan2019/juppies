/** Trainings, matches, schedule import. Session IDs mirror js/logic/ids.js. */

function findSession_(id) {
  return rows_('Sessions').find((s) => s.ID === id) || null;
}

function setSessionStatus_(b) {
  updateCellWhere_('Sessions', 'ID', b.id, 'Status', b.status === 'Cancelled' ? 'Cancelled' : 'Active');
}

function addSession_(b) {
  const type = b.type === 'Match' ? 'Match' : 'Training';
  if (!isIsoDate_(b.date)) throw new Error('Date must be yyyy-mm-dd');
  const start = normTime_(b.start);
  if (!start) throw new Error('Start time is missing');
  const id = type === 'Match' ? matchId_(b.date, text_(b.opponent, 'opponent')) : oneOffTrainingId_(b.date, start);
  if (findSession_(id)) throw new Error('That session already exists');
  appendRows_('Sessions', [[id, type, b.date, start, normTime_(b.end), text_(b.opponent, 'opponent'), 'Active', text_(b.note, 'note')]]);
  return { saved: true, id };
}

/**
 * b.matches: [{ date, start, opponent, note, rsvps: { name: { status, reason } } }]
 * Matches are upserted by date + opponent, keeping any cancelled state and admin
 * note. RSVPs only fill blanks, so answers given in the app are never overwritten.
 */
function importMatches_(b) {
  const matches = (b.matches || []).filter((m) => isIsoDate_(m.date));
  const existing = indexBy_(rows_('Sessions'), 'ID');
  const summary = { added: 0, updated: 0, playersAdded: 0, rsvpsAdded: 0 };

  matches.forEach((m) => {
    m.opponent = text_(m.opponent, 'opponent');
    m.id = matchId_(m.date, m.opponent);
    const current = existing[m.id];
    const row = [m.id, 'Match', m.date, normTime_(m.start), '', m.opponent,
      current ? current.Status || 'Active' : 'Active',
      current ? current.Note || text_(m.note, 'note') : text_(m.note, 'note')];
    if (current) {
      updateRowWhere_('Sessions', 'ID', m.id, row);
      summary.updated++;
    } else {
      appendRows_('Sessions', [row]);
      existing[m.id] = { ID: m.id };
      summary.added++;
    }
  });

  if (b.importRsvps) Object.assign(summary, importRsvps_(matches));
  return summary;
}

function importRsvps_(matches) {
  const roster = {};
  rows_('Players').forEach((p) => { roster[p.Name.toLowerCase()] = true; });
  const answered = {};
  rows_('RSVPs').forEach((r) => { answered[r.SessionID + '|' + r.Player] = true; });

  const newPlayers = [];
  const newRsvps = [];
  const now = new Date().toISOString();
  matches.forEach((m) => {
    Object.keys(m.rsvps || {}).forEach((rawName) => {
      const name = text_(rawName, 'name');
      const answer = m.rsvps[rawName];
      if (!name) return;
      if (!roster[name.toLowerCase()]) {
        roster[name.toLowerCase()] = true;
        newPlayers.push([name, 'TRUE']);
      }
      const key = m.id + '|' + name;
      if (RSVP_STATUSES.indexOf(answer.status) < 0 || answered[key]) return;
      answered[key] = true;
      newRsvps.push([m.id, name, answer.status, text_(answer.reason, 'reason'), now]);
    });
  });
  appendRows_('Players', newPlayers);
  appendRows_('RSVPs', newRsvps);
  return { playersAdded: newPlayers.length, rsvpsAdded: newRsvps.length };
}

/** Creates training rows from TrainingSlots, from TRAINING_START up to WEEKS_AHEAD from today. */
function ensureTrainings_() {
  const settings = settings_();
  const today = todaySG_();
  const from = isIsoDate_(settings.TRAINING_START) ? settings.TRAINING_START : today;
  const to = addDays_(today, 7 * num_(settings.WEEKS_AHEAD, 3));
  const slots = rows_('TrainingSlots')
    .map((r) => ({ weekday: dayIndex_(r.Day), start: normTime_(r.Start), end: normTime_(r.End) }))
    .filter((slot) => slot.weekday >= 0 && slot.start);
  if (!slots.length) return;

  const have = indexBy_(rows_('Sessions'), 'ID');
  const toAdd = [];
  for (let date = from; date <= to; date = addDays_(date, 1)) {
    const weekday = new Date(date + 'T00:00:00Z').getUTCDay();
    slots.filter((slot) => slot.weekday === weekday).forEach((slot) => {
      const id = 'T-' + date.replace(/-/g, '') + '-' + slot.start.replace(':', '');
      if (have[id]) return;
      have[id] = true;
      toAdd.push([id, 'Training', date, slot.start, slot.end, '', 'Active', '']);
    });
  }
  if (toAdd.length) withLock_(() => appendRows_('Sessions', toAdd));
}
