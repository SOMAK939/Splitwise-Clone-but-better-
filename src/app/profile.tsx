/**
 * profile.tsx — your name and UPI ID, and signing out.
 *
 * The UPI ID (like rahul@okicici) lets friends pay you in one tap.
 */
import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, ErrorText, Field, Loading, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { getProfile, updateProfile } from '@/lib/api';
import { useAuth, useUserId } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export default function ProfileScreen() {
  const userId = useUserId();
  const { session } = useAuth();
  const [name, setName] = useState<string | null>(null); // null = still loading
  const [upi, setUpi] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getProfile(userId)
      .then((p) => {
        setName(p.display_name);
        setUpi(p.upi_id ?? '');
      })
      .catch((e) => setError(String(e.message ?? e)));
  }, [userId]);

  async function save() {
    setError(null);
    setSaved(false);
    setBusy(true);
    try {
      await updateProfile(userId, { display_name: (name ?? '').trim(), upi_id: upi.trim() || null });
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (name === null && !error) return <Loading />;

  return (
    <Screen>
      <Card>
        <ThemedText themeColor="textSecondary">{session?.user.email}</ThemedText>
        <Field label="Your name" value={name ?? ''} onChangeText={setName} />
        <Field
          label="UPI ID (so friends can pay you)"
          value={upi}
          onChangeText={setUpi}
          placeholder="yourname@okhdfcbank"
          autoCapitalize="none"
        />
        <ErrorText message={error} />
        {saved && <ThemedText>Saved ✅</ThemedText>}
        <Button title="Save" onPress={save} loading={busy} />
      </Card>
      <Button title="Sign out" variant="secondary" onPress={() => supabase.auth.signOut()} />
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: Spacing.three }}>
        <Link href="/about">
          <ThemedText type="linkPrimary">About</ThemedText>
        </Link>
        <Link href="/privacy">
          <ThemedText type="linkPrimary">Privacy</ThemedText>
        </Link>
        <Link href="/terms">
          <ThemedText type="linkPrimary">Terms</ThemedText>
        </Link>
      </View>
    </Screen>
  );
}
