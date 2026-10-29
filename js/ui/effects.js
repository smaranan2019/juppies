/**
 * Motion for the big moments only: numbers counting up when a page or sheet
 * opens, and a celebration when a win is saved. Everything here is skipped
 * when the viewer has asked their device to reduce motion.
 *
 * Markup opts in declaratively:
 *   <strong data-count-up>12</strong>   counts from 0 to 12 on entrance
 */

import { outcome } from '../logic/match-result.js';

const COUNT_UP_MS = 700;
const CONFETTI_PIECES = 60;
const CONFETTI_MS = 1800;
const CONFETTI_COLORS = ['#5B5FEF', '#F5A524', '#1F8A55', '#EE7A22', '#FFFFFF'];

const prefersReducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

const easeOutCubic = (t) => 1 - (1 - t) ** 3;

function countUp(el) {
  const target = Number(el.textContent);
  if (!Number.isFinite(target) || target === 0) return;
  const startedAt = performance.now();
  const tick = (now) => {
    const progress = Math.min(1, (now - startedAt) / COUNT_UP_MS);
    el.textContent = String(Math.round(target * easeOutCubic(progress)));
    if (progress < 1) requestAnimationFrame(tick);
  };
  el.textContent = '0';
  requestAnimationFrame(tick);
}

/** Runs entrance effects for freshly rendered content inside `root`. */
export function playEntrance(root) {
  if (!root || prefersReducedMotion()) return;
  root.querySelectorAll('[data-count-up]').forEach(countUp);
}

function confetti() {
  const layer = document.createElement('div');
  layer.className = 'confetti';
  layer.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < CONFETTI_PIECES; i++) {
    const piece = document.createElement('i');
    piece.style.setProperty('--x', `${Math.random() * 100}vw`);
    piece.style.setProperty('--drift', `${(Math.random() - 0.5) * 40}vw`);
    piece.style.setProperty('--spin', `${(Math.random() - 0.5) * 1440}deg`);
    piece.style.setProperty('--delay', `${Math.random() * 300}ms`);
    piece.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    layer.appendChild(piece);
  }
  document.body.appendChild(layer);
  setTimeout(() => layer.remove(), CONFETTI_MS + 400);
}

/** After a result is saved: replay the scoreboard reveal, and throw confetti for a win. */
export function celebrateResult(root, result) {
  if (prefersReducedMotion()) return;
  const scoreboard = root.querySelector('.scoreboard');
  if (scoreboard) {
    scoreboard.classList.add('is-revealing');
    playEntrance(scoreboard);
  }
  if (outcome(result) === 'W') confetti();
}
