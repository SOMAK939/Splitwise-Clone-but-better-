/**
 * join.tsx — join a group with an invite code.
 *
 * Invite links look like  https://your-app/join?code=ab12cd34
 * This screen works whether or not you're logged in:
 * - logged in  → join and open the group
 * - logged out → remember the code, then send you to log in
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, ErrorText, Field, Screen } from '@/components/ui';
import { joinGroup } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { savePendingInvite } from '@/lib/pending-invite';

export default function JoinScreen() {
  const { session } = useAuth();
  // Read ?code=... from the link, if there is one.
  const params = useLocalSearchParams<{ code?: string }>();
  const [code, setCode] = useState(params.code ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Logged out with a code in the link: save it for after login.
  useEffect(() => {
    if (!session && params.code) savePendingInvite(params.code);
  }, [session, params.code]);

  async function join() {
    setError(null);
    setBusy(true);
    try {
      const groupId = await joinGroup(code);
      router.replace({ pathname: '/group/[id]', params: { id: groupId } });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!session) {
    return (
      <Screen>
        <Card>
          <ThemedText type="smallBold">You've been invited to a group on SplitFree 🎉</ThemedText>
          <ThemedText>Log in or create a free account, and we'll add you to the group right after.</ThemedText>
          <Button title="Continue" onPress={() => router.replace('/login')} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <Card>
        <Field
          label="Invite code"
          value={code}
          onChangeText={setCode}
          placeholder="e.g. ab12cd34"
          autoCapitalize="none"
          onSubmitEditing={join}
        />
        <ErrorText message={error} />
        <Button title="Join group" onPress={join} loading={busy} disabled={!code.trim()} />
      </Card>
    </Screen>
  );
}
