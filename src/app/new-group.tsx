/** new-group.tsx — create a group like "Goa Trip" or "Flat 302". */
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Chip, ErrorText, Field, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { createGroup } from '@/lib/api';

const EMOJIS = ['👥', '🏠', '✈️', '🏖️', '🍻', '🎉', '💼', '❤️'];

export default function NewGroupScreen() {
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState(EMOJIS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setError(null);
    setBusy(true);
    try {
      const group = await createGroup(name.trim(), emoji);
      // Replace this form with the new group's screen.
      router.replace({ pathname: '/group/[id]', params: { id: group.id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Field label="Group name" value={name} onChangeText={setName} placeholder="Goa Trip 2026" autoFocus />
      <ThemedText type="smallBold">Pick an emoji</ThemedText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }}>
        {EMOJIS.map((e) => (
          <Chip key={e} label={e} selected={e === emoji} onPress={() => setEmoji(e)} />
        ))}
      </View>
      <ErrorText message={error} />
      <Button title="Create group" onPress={create} loading={busy} disabled={!name.trim()} />
    </Screen>
  );
}
