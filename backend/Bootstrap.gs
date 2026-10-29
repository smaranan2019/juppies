/**
 * Everything the app needs in one payload. Attendance, results and stats are
 * public; feedback and inactive players are only sent to admins.
 */
function bootstrap_(pin) {
  const admin = isAdmin_(pin);
  ensureTrainings_();
  const settings = settings_();

  const players = rows_('Players')
    .filter((p) => p.Name)
    .map((p) => ({ name: p.Name, active: isActiveFlag_(p.Active) }));

  const out = {
    now: new Date().toISOString(),
    admin,
    settings: {
      trainingLockHours: num_(settings.TRAINING_LOCK_HOURS, 2),
      matchLockHours: num_(settings.MATCH_LOCK_HOURS, 12),
      venue: settings.MATCH_VENUE || '',
    },
    players: admin ? players : players.filter((p) => p.active),
    sessions: rows_('Sessions').filter((r) => r.ID).map((r) => ({
      id: r.ID, type: r.Type, date: r.Date, start: normTime_(r.Start), end: normTime_(r.End),
      opponent: r.Opponent, status: r.Status || 'Active', note: r.Note,
    })),
    rsvps: rows_('RSVPs').filter((r) => r.SessionID).map((r) => ({
      sessionId: r.SessionID, player: r.Player, status: r.Status, reason: r.Reason, updatedAt: r.UpdatedAt,
    })),
    videos: rows_('Videos').filter((r) => r.URL).map((r) => ({
      sessionId: r.SessionID, title: r.Title, url: r.URL,
    })),
    results: rows_('MatchResults').filter((r) => r.SessionID).map((r) => ({
      sessionId: r.SessionID, ourScore: num_(r.OurScore, 0), theirScore: num_(r.TheirScore, 0), playerOfMatch: r.PlayerOfMatch,
    })),
    playerStats: rows_('PlayerStats').filter((r) => r.SessionID && r.Player).map((r) => ({
      sessionId: r.SessionID, player: r.Player, goals: num_(r.Goals, 0), assists: num_(r.Assists, 0),
    })),
  };

  if (admin) {
    out.feedback = rows_('Feedback').filter((r) => r.ID).map((r) => ({
      id: r.ID, timestamp: r.Timestamp, name: r.Name, sessionId: r.SessionID, message: r.Message, status: r.Status || 'New',
    }));
  }
  return out;
}
