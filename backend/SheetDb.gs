/**
 * Generic helpers for treating a tab as a table. Columns are addressed by
 * header name (not position), so admins can add their own columns at the end.
 * Everything is read and written as display strings.
 *
 * `keyCols` / `keys` can be a single header and value, or arrays of them for
 * a composite key, e.g. (['SessionID', 'Player'], [id, name]).
 */

function sheet_(name) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sheet) throw new Error('Missing tab "' + name + '". In the Sheet, use Juppies > Set up / repair tabs.');
  return sheet;
}

/** Reads a tab as an array of objects keyed by header. */
function rows_(name) {
  const [head = [], ...body] = sheet_(name).getDataRange().getDisplayValues();
  return body.map((cells) => {
    const row = {};
    head.forEach((h, i) => { row[h] = String(cells[i] || '').trim(); });
    return row;
  });
}

/**
 * Text typed into the app is stored as text, never as a formula: a value like
 * "=IMPORTDATA(...)" gets Sheets' leading-apostrophe marker, which Sheets
 * hides when displaying (and rows_ reads display values).
 */
function safeCell_(value) {
  const text = String(value == null ? '' : value);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

const safeRow_ = (row) => row.map(safeCell_);

function appendRows_(name, rows) {
  if (!rows.length) return;
  const sheet = sheet_(name);
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setNumberFormat('@').setValues(rows.map(safeRow_));
}

/** Returns 1-based sheet row numbers whose key columns match. */
function findRowNumbers_(name, keyCols, keys) {
  const cols = [].concat(keyCols);
  const values = [].concat(keys).map(String);
  const [head = [], ...body] = sheet_(name).getDataRange().getDisplayValues();
  const idx = cols.map((c) => head.indexOf(c));
  if (idx.some((i) => i < 0)) throw new Error('Tab "' + name + '" is missing a column: ' + cols.join(', '));
  const matches = [];
  body.forEach((cells, i) => {
    if (idx.every((col, k) => cells[col] === values[k])) matches.push(i + 2);
  });
  return matches;
}

function columnNumber_(name, header) {
  const col = TABS[name].indexOf(header);
  if (col < 0) throw new Error('Unknown column ' + header + ' in ' + name);
  return col + 1;
}

/** Sets one cell in the first matching row. */
function updateCellWhere_(name, keyCols, keys, header, value) {
  const [rowNumber] = findRowNumbers_(name, keyCols, keys);
  if (!rowNumber) throw new Error('Not found: ' + [].concat(keys).join(' / '));
  sheet_(name).getRange(rowNumber, columnNumber_(name, header)).setValue(safeCell_(value));
}

/** Overwrites the first matching row with `row` (in TABS column order). */
function updateRowWhere_(name, keyCols, keys, row) {
  const [rowNumber] = findRowNumbers_(name, keyCols, keys);
  if (!rowNumber) throw new Error('Not found: ' + [].concat(keys).join(' / '));
  sheet_(name).getRange(rowNumber, 1, 1, row.length).setNumberFormat('@').setValues([safeRow_(row)]);
}

/** Deletes every matching row (bottom-up so row numbers stay valid). */
function deleteRowsWhere_(name, keyCols, keys) {
  const sheet = sheet_(name);
  findRowNumbers_(name, keyCols, keys).reverse().forEach((n) => sheet.deleteRow(n));
}

/** Replaces all rows matching the key with `rows`. Callers hold the script lock. */
function replaceRowsWhere_(name, keyCols, keys, rows) {
  deleteRowsWhere_(name, keyCols, keys);
  appendRows_(name, rows);
}

/** { [row[key]]: row } for quick lookups. */
function indexBy_(rows, key) {
  const out = {};
  rows.forEach((r) => { out[r[key]] = r; });
  return out;
}
