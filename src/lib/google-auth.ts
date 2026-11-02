/**
 * google-auth.ts — "Continue with Google".
 *
 * How Google sign-in works (OAuth), in plain words:
 * 1. We send the person to Google's own sign-in page.
 * 2. Google asks "Let SplitFree see your name and email?" and they tap Allow.
 * 3. Google sends them back to us with a one-time pass (a token), and
 *    Supabase turns that pass into a normal SplitFree login.
 * We never see their Google password; Google only tells us who they are.
 */
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { supabase } from './supabase';

export async function signInWithGoogle(): Promise<void> {
  if (Platform.OS === 'web') {
    // On the website, Supabase sends the whole page to Google and back.
    // When it returns, supabase.ts (detectSessionInUrl) picks up the login.
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) throw error;
    return;
  }

  // On a phone app: open Google in an in-app browser and wait for it to come back.
  const redirectTo = Linking.createURL('/'); // e.g. splitfree://
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return; // they closed the window: nothing to do

  // The tokens come back after the "#" in the URL, like #access_token=...&refresh_token=...
  const params = new URLSearchParams(result.url.split('#')[1] ?? '');
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (!access_token || !refresh_token) throw new Error('Google sign-in did not finish. Please try again.');
  const { error: sessionError } = await supabase.auth.setSession({ access_token, refresh_token });
  if (sessionError) throw sessionError;
}
