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
    // Admins sign in with a PIN (see js/controller.js), so Supabase Auth stays off.
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return client;
}
