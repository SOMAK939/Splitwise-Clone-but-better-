/**
 * profile.tsx — your name and UPI ID, and signing out.
 *
 * The UPI ID (like rahul@okicici) lets friends pay you in one tap.
 */
import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Platform, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, ErrorText, Field, Loading, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { deleteMyAccount, getProfile, updateProfile } from '@/lib/api';
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

  function confirmDelete() {
    const title = 'Delete your account?';
    const message =
      'This removes your login and email for good. Expenses you shared stay in your groups as "Deleted user", ' +
      "so settle up first if you can. This can't be undone.";
    const doDelete = async () => {
      setBusy(true);
      try {
        await deleteMyAccount(); // signs out, which takes you back to the start
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setBusy(false);
      }
    };
    // Buttons inside Alert don't work on web, so use the browser's confirm there.
    if (Platform.OS === 'web') {
      if (window.confirm(`${title}\n\n${message}`)) doDelete();
    } else {
      Alert.alert(title, message, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete forever', style: 'destructive', onPress: doDelete },
      ]);
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
      <Button title="Delete my account" variant="danger" onPress={confirmDelete} loading={busy} />
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
