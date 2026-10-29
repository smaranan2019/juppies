const SUCCESS_MS = 2400;
const ERROR_MS = 4500;

let timer;

/** Shows a short message at the bottom of the screen. */
export function toast(message, { error = false } = {}) {
  document.querySelector('.toast')?.remove();
  const el = document.createElement('div');
  el.className = error ? 'toast toast--error' : 'toast';
  el.setAttribute('role', error ? 'alert' : 'status');
  el.textContent = message;
  document.body.appendChild(el);
  clearTimeout(timer);
  timer = setTimeout(() => el.remove(), error ? ERROR_MS : SUCCESS_MS);
}
