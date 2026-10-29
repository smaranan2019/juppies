/** Light/dark toggle. Defaults to the device setting until the user picks one. */

import { storage } from '../storage.js';
import { icons } from './icons.js';

const root = document.documentElement;

function currentTheme() {
  return root.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}

function paintButton(button) {
  const dark = currentTheme() === 'dark';
  button.innerHTML = String(dark ? icons.sun : icons.moon);
  button.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
}

export function initTheme(button) {
  const saved = storage.get('theme');
  if (saved) root.dataset.theme = saved;
  paintButton(button);
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => paintButton(button));
  button.addEventListener('click', () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    storage.set('theme', next);
    paintButton(button);
  });
}
