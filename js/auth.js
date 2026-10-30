/**
 * Admin sign-in with email magic links (players never sign in).
 * In demo mode any email signs in instantly and nothing leaves the page.
 *
 * Signing in only proves who you are; admin powers come from the `admins`
 * table in the database (see is_admin() in supabase/setup.sql).
 */

import { isDemo, supabaseClient } from './supabase-client.js';

let demoEmail = null;

/** Supabase's answer when an email has no account (we never create accounts from the app). */
const isUnknownEmail = (error) => /signups not allowed|user not found/i.test(error.message);

export const auth = {
  /** The signed-in email, or null. */
  async currentEmail() {
    if (isDemo) return demoEmail;
    const { data } = await supabaseClient().auth.getSession();
    return data.session?.user?.email ?? null;
  },

  /**
   * Emails a sign-in link. Unknown emails get the same response as real ones,
   * so the form can't be used to discover who the admins are.
   * Resolves { signedInNow } (true only in demo mode).
   */
  async sendSignInLink(email) {
    if (isDemo) {
      demoEmail = email;
      return { signedInNow: true };
    }
    const { error } = await supabaseClient().auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false, emailRedirectTo: `${location.origin}${location.pathname}` },
    });
    if (error && !isUnknownEmail(error)) throw error;
    return { signedInNow: false };
  },

  async signOut() {
    if (isDemo) {
      demoEmail = null;
      return;
    }
    await supabaseClient().auth.signOut();
  },

  /** Calls `listener` when someone signs in (e.g. returning from a magic link) or out. */
  onChange(listener) {
    if (isDemo) return;
    supabaseClient().auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') listener(event);
    });
  },
};
