/**
 * supabase.ts — one shared connection to our Supabase backend.
 *
 * Supabase gives us login, a Postgres database and live updates for free.
 * The URL and key come from the `.env` file (see .env.example). Variables that
 * start with EXPO_PUBLIC_ are baked into the app, which is fine for these two:
 * the "publishable" key is meant to be public, and the database's Row Level
 * Security rules decide what each user can actually see.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_KEY;

if (!url || !key) {
  // Fail loudly with a helpful message instead of a confusing error later.
  throw new Error(
    'Missing Supabase settings. Copy .env.example to .env and fill in ' +
      'EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_KEY (see README).',
  );
}

export const supabase = createClient(url, key, {
  auth: {
    storage: AsyncStorage, // remember the login between app launches
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web', // needed for email links on web
  },
});

// On phones, only refresh the login token while the app is open on screen.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
