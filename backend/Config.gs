/**
 * Juppies backend: turns the Google Sheet it lives in into the app's database.
 *
 * Files (Apps Script shares one global scope across them):
 *   Config.gs    tab layout and defaults
 *   Setup.gs     creates/repairs tabs, adds the Sheet menu
 *   Api.gs       HTTP entry points and routing
 *   Bootstrap.gs the read model sent to the app
 *   Players.gs, Sessions.gs, Rsvps.gs, Matches.gs, Feedback.gs   actions
 *   SheetDb.gs   generic tab read/write helpers
 *   Util.gs      dates, times, settings, ids
 *
 * Functions ending in _ are private (Apps Script hides them from the Run menu).
 */

const TZ = 'Asia/Singapore';

/** Every tab and its header row. Never rename these: the code looks them up by name. */
const TABS = {
  Settings: ['Key', 'Value', 'Notes'],
  Players: ['Name', 'Active'],
  TrainingSlots: ['Day', 'Start', 'End'],
  Sessions: ['ID', 'Type', 'Date', 'Start', 'End', 'Opponent', 'Status', 'Note'],
  RSVPs: ['SessionID', 'Player', 'Status', 'Reason', 'UpdatedAt'],
  Videos: ['SessionID', 'Title', 'URL', 'AddedAt'],
  Feedback: ['ID', 'Timestamp', 'Name', 'SessionID', 'Message', 'Status'],
  MatchResults: ['SessionID', 'OurScore', 'TheirScore', 'PlayerOfMatch', 'UpdatedAt'],
  PlayerStats: ['SessionID', 'Player', 'Goals', 'Assists'],
};

const DEFAULT_SETTINGS = [
  ['ADMIN_PIN', '1234', 'Change this to at least 6 characters. Admin tools stay locked until you do.'],
  ['TRAINING_LOCK_HOURS', '2', 'RSVP locks this many hours before training.'],
  ['MATCH_LOCK_HOURS', '12', 'RSVP locks this many hours before a match.'],
  ['WEEKS_AHEAD', '3', 'How many weeks of trainings to create in advance.'],
  ['TRAINING_START', '', 'Trainings are created from this date (yyyy-mm-dd). Filled in by setup.'],
  ['MATCH_VENUE', '', 'Optional. Shown on every match.'],
];

const DEFAULT_SLOTS = [
  ['Tuesday', '18:45', '21:30'],
  ['Saturday', '08:45', '11:30'],
];

const RSVP_STATUSES = ['Going', 'Not going', 'TBC'];
const FEEDBACK_STATUSES = ['New', 'Seen', 'Done'];
const MAX_COUNT = 99;

/** Admin PIN policy. The setup default never unlocks anything. */
const DEFAULT_ADMIN_PIN = '1234';
const MIN_PIN_LENGTH = 6;
/** After this many wrong PINs, admin unlock pauses for PIN_LOCKOUT_SECONDS (stops guessing). */
const MAX_PIN_FAILURES = 10;
const PIN_LOCKOUT_SECONDS = 600;

/** Longest text accepted for each kind of free-text field. */
const MAX_LENGTH = { name: 60, opponent: 80, note: 200, reason: 200, title: 100, message: 2000 };
