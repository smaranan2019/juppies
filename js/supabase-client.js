/**
 * The shared Supabase client. supabase-js is self-hosted in js/vendor/supabase.js
 * (loaded by index.html as the global `supabase`) so the site depends on no
 * extra CDN. To update it, replace that file with a newer dist/umd/supabase.js.
 */

import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config.js';

export const isDemo = !SUPABASE_URL;

let client = null;

/** The client, created on first use. Never called in demo mode. */
export function supabaseClient() {
  client ??= window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      // Implicit flow: a magic link works even when opened in a different
      // browser than the one that asked for it (e.g. the Gmail app on a phone).
      flowType: 'implicit',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return client;
}
