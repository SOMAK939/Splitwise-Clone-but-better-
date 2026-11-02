/**
 * login.tsx — sign in, or create an account.
 *
 * Uses email + password through Supabase Auth. Google login can be added
 * later (it needs a Google Cloud setup first).
 */
import { useState } from 'react';
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, ErrorText, Field, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

export default function LoginScreen() {
  // Which form are we showing?
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      if (mode === 'signIn') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        // Success: AuthProvider notices the new session and the app moves to Home.
      } else {
        if (!name.trim()) throw new Error('Please tell us your name');
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          // Stored with the account; the database copies it into `profiles`.
          options: { data: { display_name: name.trim() } },
        });
        if (error) throw error;
        // If email confirmation is on in Supabase, there's no session yet.
        if (!data.session) setInfo('Check your email for a confirmation link, then sign in.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <View style={{ marginTop: Spacing.six, gap: Spacing.one }}>
        <ThemedText type="subtitle">SplitFree</ThemedText>
        <ThemedText themeColor="textSecondary">
          Split bills with friends. Free forever, with a little roast.
        </ThemedText>
      </View>

      <Card>
        {mode === 'signUp' && (
          <Field label="Your name" value={name} onChangeText={setName} placeholder="Rahul" autoComplete="name" />
        )}
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="At least 6 characters"
          secureTextEntry
          autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
          onSubmitEditing={submit}
        />
        <ErrorText message={error} />
        {info && <ThemedText>{info}</ThemedText>}
        <Button title={mode === 'signIn' ? 'Sign in' : 'Create account'} onPress={submit} loading={busy} />
        <Button
          variant="secondary"
          title={mode === 'signIn' ? 'New here? Create an account' : 'Have an account? Sign in'}
          onPress={() => setMode(mode === 'signIn' ? 'signUp' : 'signIn')}
        />
      </Card>
    </Screen>
  );
}
