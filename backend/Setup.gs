/** Adds a "Juppies" menu to the Sheet so admins can repair tabs without opening the editor. */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Juppies')
    .addItem('Set up / repair tabs', 'setup')
    .addToUi();
}

/**
 * Creates any missing tabs with their headers and defaults.
 * Safe to run again: existing tabs and data are left alone, so running it
 * after an update simply adds the new tabs (e.g. MatchResults, PlayerStats).
 */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(TABS).forEach((name) => {
    if (ss.getSheetByName(name)) return;
    const sheet = ss.insertSheet(name);
    const width = TABS[name].length;
    // Plain text everywhere so Sheets never reformats dates, times or scores.
    sheet.getRange(1, 1, sheet.getMaxRows(), width).setNumberFormat('@');
    sheet.getRange(1, 1, 1, width).setValues([TABS[name]]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  });

  if (rows_('Settings').length === 0) {
    const defaults = DEFAULT_SETTINGS.map((row) => (row[0] === 'TRAINING_START' ? [row[0], todaySG_(), row[2]] : row));
    appendRows_('Settings', defaults);
  }
  if (rows_('TrainingSlots').length === 0) appendRows_('TrainingSlots', DEFAULT_SLOTS);
  return 'Setup complete';
}
