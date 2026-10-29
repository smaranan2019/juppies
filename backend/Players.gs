function addPlayer_(b) {
  const name = text_(b.name, 'name');
  if (!name) throw new Error('Name is empty');
  const exists = rows_('Players').some((p) => p.Name.toLowerCase() === name.toLowerCase());
  if (exists) throw new Error(name + ' is already on the list');
  appendRows_('Players', [[name, 'TRUE']]);
}

/** Deactivating hides a player from the name list but keeps their history and stats. */
function setPlayerActive_(b) {
  updateCellWhere_('Players', 'Name', b.name, 'Active', b.active ? 'TRUE' : 'FALSE');
}

function isActiveFlag_(value) {
  return String(value).toUpperCase() !== 'FALSE';
}

function isActivePlayer_(name) {
  return rows_('Players').some((p) => p.Name === name && isActiveFlag_(p.Active));
}
