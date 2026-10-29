function addFeedback_(b) {
  const message = text_(b.message, 'message');
  if (!message) throw new Error('Feedback is empty');
  appendRows_('Feedback', [[
    Utilities.getUuid().slice(0, 8),
    new Date().toISOString(),
    b.anonymous ? 'Anonymous' : text_(b.name, 'name') || 'Anonymous',
    text_(b.sessionId, 'name'),
    message,
    'New',
  ]]);
}

function setFeedbackStatus_(b) {
  const status = FEEDBACK_STATUSES.indexOf(b.status) >= 0 ? b.status : 'Seen';
  updateCellWhere_('Feedback', 'ID', b.id, 'Status', status);
}
