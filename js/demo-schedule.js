/**
 * Demo data: the team's real 2026/27 fixtures, results and match streams
 * (all public league information), with made-up player names and generic
 * RSVP reasons. The answer patterns mirror the real sheet's messiness (mixed
 * case, stray spaces, a 19th column) so the demo exercises the real parser,
 * and tests/schedule-import.test.js checks it parses cleanly.
 *
 * The real roster and RSVPs live only in the database. Never commit them.
 */

export const DEMO_SEASON = 2026;

export const DEMO_SCHEDULE_ROWS = [
  ['Date', '13 September', '19 September', '26 September', '3 October', '10 October', '4 October (NEW) ', '10 October (NEW)', '17 October', '25 October', '1 November', '6 December', '3 January', '9 January', '17 January', '24 January', '13 February', '20 February', '6 March'],
  ['Day', 'SUNDAY', 'SATURDAY', 'SATURDAY', 'SATURDAY', 'SATURDAY', 'SUNDAY', 'SATURDAY', 'SATURDAY', 'SUNDAY', 'SUNDAY', 'SATURDAY', 'SUNDAY', 'SATURDAY', 'SUNDAY', 'SUNDAY', 'SATURDAY', 'SATURDAY', 'SATURDAY'],
  ['Time', '11:30 AM', '9:45 AM', '4:45 PM', '1:15 PM', '11:30 AM', '11:30 AM', '9:45 AM', '4:45 PM', '3:00 PM', '3:00 PM', '6:30 PM', '11:30 AM', '4:45 PM', '11:30 AM', '1:15 PM', '4:45 PM', '1:15 PM', '11:30 AM'],
  ['VS', 'NUS Titans', 'Merlions XXVI', 'Tazlings', 'Tampines Cheetahs', 'Callistans', 'NUS Titans FC', 'Merlions XXVI', 'XCEL Unihockey', 'Liitto', 'Owls', 'Wondersticks', 'Youth Wondersticks', 'Protege Yrixie', 'OneFF', 'Cripz ', 'Tazlings', 'Tampines Cheetahs', 'Callistans'],
  ['Ava', 'Yes', 'Yes', 'Yes', 'No (plans)', 'No (ovs)', 'yes', 'No (ovs)', 'No (ovs)', 'Yes', 'No (work)', 'No (ovs)', 'No (ovs)', 'Yes', 'Yes', 'Yes', 'yes', 'yes', 'no (plans)', 'Yes'],
  ['Bianca', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes', 'yes', 'yes', 'Yes', 'Yes', 'Yes', '', '', '', '', '', '', '', '', 'No (plans)'],
  ['Chloe', 'No (work)', 'No (work)', 'Tbc (work)', 'Tbc (work)', 'Tbc (work)', 'No (work)', 'Yes', 'Yes', 'Yes', 'No (work)', 'Tbc (work)', 'Tbc (work)', 'Tbc (work)', 'Tbc (work)', 'Tbc (work)', 'Tbc (work)', 'Tbc (work)', 'Tbc (work)', 'Tbc '],
  ['Dana', 'Yes', 'No (ovs)', 'Yes', 'Yes', 'Yes', 'yes', 'yes', 'No (ovs)', 'Yes', 'Yes', 'No (ovs)', 'Yes', 'Yes', 'Yes', 'Yes'],
  ['Ella', 'Yes', 'No (work)', 'Yes (work)', 'Yes', 'Yes', 'yes', 'yes', 'Yes', 'Yes', 'Yes', '', 'Yes'],
  ['Fiona', 'Yes', 'Yes', 'Yes', 'No (exams)', 'tbc (exams)', 'No (exams)', ' Yes', 'no (plans)', 'No (plans) ', 'No (plans)', 'Yes', 'Tbc (ovs)', 'Tbc (ovs)', 'Yes', 'Yes'],
  ['Grace', 'Yes', 'Yes', 'Yes', 'Yes', 'yes', 'yes', 'yes', 'no (exams)', 'Yes', 'Yes', 'tbc (ovs)', 'Yes', 'Yes', 'Yes', 'Yes', 'yes', 'yes', 'yes'],
  ['Hazel', 'No (work)', 'No (work)', 'tbc (work)', 'no (ovs)', 'no (ovs)', 'no (ovs)', 'No (ovs)', 'yes', 'no (plans)', 'no (work)', 'No(work)', 'no (work)', 'Yes', 'Yes', 'No (work)'],
  ['Iris', 'No (work)', 'yes', 'yes ', 'yes', 'yes', 'yes', 'No (ovs)', 'yes', 'yes', 'yes', 'yes', 'yes'],
  ['Jade', 'Yes', 'Yes', 'Yes', 'Yes', 'yes', 'yes', 'yes', 'yes', 'yes', 'yes', 'No (work)', 'tbc(work)', 'tbc(work)', 'tbc(work)', 'tbc(work)', 'tbc(work)', 'tbc(work)', 'tbc(work)'],
  ['Kara', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes'],
  ['Lena', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes'],
  ['Mia', 'Yes', 'Yes', 'No (plans)', 'Yes', 'Yes', 'no (plans)', 'Yes', 'Yes', 'No (plans)', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes'],
  ['Nora', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes', 'Tbc', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes', 'No (ovs)', 'Yes', 'Yes', 'Yes'],
  ['Olive', 'Yes', 'Yes', 'No (ovs)', 'No (plans)', 'Yes', 'yes', 'yes', 'No (plans)', 'No (plans)', 'yes', 'yes', 'yes', 'yes', 'yes', 'yes', 'tbc (ovs)', 'no (plans)', 'no (plans)'],
  ['Pia', 'yes', 'Yes', 'Yes', 'tbc (exams)', 'yes', 'yes', 'yes', 'No (exams)', 'Yes', 'Yes', 'Yes', 'tbc (ovs)', 'Yes', 'Yes', 'yes'],
  ['Quinn', 'Yes', 'No (ovs)', 'No (plans)', 'No (ovs)', 'Yes', 'Yes', 'No (ovs) ', 'Yes', 'Yes', 'Yes', 'No (work)', 'Yes ', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes'],
  ['Rosa', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes', 'No (exams)', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes'],
  ['Sara', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes', 'no (plans)', 'yes', 'Yes', 'No (ovs)', 'Yes', 'Yes', 'yes', 'yes', 'yes', 'yes', 'tbc (ovs)', 'tbc (ovs)', 'yes'],
  ['Tess', 'No (plans)', 'No (plans)', 'No (plans)', 'No (plans)', 'No (plans)', 'No (plans)', 'No (plans)', 'No (plans)', 'No (plans)', 'No (plans)', 'tbc (plans)', 'tbc (plans)', 'tbc (plans)', 'tbc (plans)', 'tbc (plans)', 'Yes', 'Yes'],
  ['Uma', 'Yes', 'No (work)', 'No (ovs)', 'Yes', 'No (work)', 'Yes', 'no (work)', 'Yes', 'Yes', 'no (work)', 'no (work)'],
  ['Vera', 'Yes', 'No (ovs)', 'No (ovs)', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes (plans)', 'Yes', 'No (ovs)', 'tbc (work)', 'tbc (work)', 'tbc (work)', 'tbc (work)'],
  ['Wren', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes', 'No (ovs)', 'No (ovs)', 'No (ovs)', 'No (ovs)', 'Yes', 'Yes', 'Yes'],
  ['Xin', 'No (ovs)', 'Yes', 'Yes', 'Yes', 'tbc (plans)', 'Yes', 'no (work)', 'Yes', 'Yes', 'no (work)', 'tbc (work)', 'tbc (work)', 'tbc (work)', 'tbc (work)', 'tbc (work)'],
  ['Yuna', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes'],
  ['Zoe', 'Yes', 'Yes', 'Yes', 'No (ovs)', 'No (ovs)', 'No (ovs)', 'No (ovs)', 'Yes', 'Yes', 'no (ovs)', 'Yes'],
];

/** Real results so far, with the match streams. Scorers weren't recorded. */
export const DEMO_RESULTS = [
  { date: '2026-10-04', opponent: 'NUS Titans FC', ourScore: 0, theirScore: 13, video: 'https://www.youtube.com/live/GM1stGl6DiM' },
  { date: '2026-10-10', opponent: 'Merlions XXVI', ourScore: 6, theirScore: 2, video: 'https://www.youtube.com/live/G7Pocvdtxes' },
  { date: '2026-10-17', opponent: 'XCEL Unihockey', ourScore: 1, theirScore: 5, video: 'https://www.youtube.com/live/7UCvpFPWd5g' },
  { date: '2026-10-25', opponent: 'Liitto', ourScore: 1, theirScore: 3, video: 'https://www.youtube.com/live/EMC1ZASCwPQ' },
];
