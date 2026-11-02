/**
 * index.tsx — Home. Shows your overall balance and your groups.
 */
import { Link, router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BalanceText, Button, Card, ErrorText, Loading, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { getMyBalancesByGroup, joinGroup, listMyGroups, type Group } from '@/lib/api';
import { useUserId } from '@/lib/auth';
import { takePendingInvite } from '@/lib/pending-invite';

export default function HomeScreen() {
  const userId = useUserId();
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      // Joined through an invite link before logging in? Finish joining now.
      const invite = await takePendingInvite();
      if (invite) {
        const groupId = await joinGroup(invite);
        router.push({ pathname: '/group/[id]', params: { id: groupId } });
      }

      const myGroups = await listMyGroups();
      setGroups(myGroups);
      setBalances(await getMyBalancesByGroup(userId, myGroups.map((g) => g.id)));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [userId]);

  // Reload every time this screen comes back into view (e.g. after adding an expense).
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const total = Object.values(balances).reduce((sum, b) => sum + b, 0);

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Link href="/profile">
              <ThemedText type="linkPrimary">Profile</ThemedText>
            </Link>
          ),
        }}
      />

      <ErrorText message={error} />

      {groups === null ? (
        <Loading />
      ) : (
        <>
          <Card>
            <ThemedText themeColor="textSecondary">Overall</ThemedText>
            <BalanceText amount={total} settledText="You're all settled up 🎉" />
          </Card>

          <View style={{ flexDirection: 'row', gap: Spacing.two }}>
            <Button title="New group" onPress={() => router.push('/new-group')} style={{ flex: 1 }} />
            <Button title="Join group" variant="secondary" onPress={() => router.push('/join')} style={{ flex: 1 }} />
          </View>

          {groups.length === 0 && (
            <ThemedText themeColor="textSecondary">
              No groups yet. Create one for your flat, a trip, or that friend who never pays. 😉
            </ThemedText>
          )}

          {groups.map((g) => (
            <Pressable key={g.id} onPress={() => router.push({ pathname: '/group/[id]', params: { id: g.id } })}>
              <Card style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.three }}>
                <ThemedText style={{ fontSize: 28 }}>{g.emoji}</ThemedText>
                <View style={{ flex: 1 }}>
                  <ThemedText type="smallBold">{g.name}</ThemedText>
                  <BalanceText amount={balances[g.id] ?? 0} />
                </View>
              </Card>
            </Pressable>
          ))}
        </>
      )}
    </Screen>
  );
}
