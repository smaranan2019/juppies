/**
 * Deployment settings: the only file you normally change.
 *
 * Both values come from Supabase → Project Settings → API ("Project URL" and
 * the "anon public" key). They are public by design: every visitor's browser
 * uses them, and the rules in supabase/setup.sql decide what each visitor may do.
 *
 * Leave SUPABASE_URL empty ('') to run in demo mode with fake data.
 */
export const SUPABASE_URL = 'https://rwbddkgbmwsjmrnaoyow.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3YmRka2dibXdzam1ybmFveW93Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMzMTc1ODcsImV4cCI6MjEwODg5MzU4N30.45WAUp6WIOBEse_-WBJ2akYbb6SVQ-Wm3OY4t4nlOEQ';
