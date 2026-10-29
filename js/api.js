/**
 * Talks to the Apps Script backend (or the in-memory demo backend when no
 * API_URL is configured). Every call resolves with the JSON payload or
 * rejects with an Error whose message is safe to show to the user.
 */

import { API_URL } from './config.js';
import { createDemoBackend } from './demo-backend.js';

export const isDemo = !API_URL;

const demoBackend = isDemo ? createDemoBackend() : null;
const DEMO_LATENCY_MS = 150;

export async function callApi(action, payload, pin) {
  const body = { action, pin, ...payload };

  if (demoBackend) {
    await new Promise((resolve) => setTimeout(resolve, DEMO_LATENCY_MS));
    return demoBackend.handle(body);
  }

  // Sent as text/plain (fetch's default for a string body) on purpose:
  // a JSON content type triggers a CORS preflight that Apps Script can't answer.
  const response = await fetch(API_URL, { method: 'POST', body: JSON.stringify(body) });
  const json = await response.json();
  if (!json.ok) throw new Error(json.error || 'Something went wrong');
  return json;
}
