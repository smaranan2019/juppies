/**
 * localStorage wrapper for per-device preferences (chosen name, admin session, theme).
 * Storage can be unavailable (private mode, blocked cookies), so every access
 * is guarded and the app simply forgets the preference in that case.
 */

const PREFIX = 'juppies_';

export const storage = {
  get(key) {
    try {
      return localStorage.getItem(PREFIX + key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      if (value === null || value === '') localStorage.removeItem(PREFIX + key);
      else localStorage.setItem(PREFIX + key, value);
    } catch {
      // Preference just isn't remembered on this device.
    }
  },
};
