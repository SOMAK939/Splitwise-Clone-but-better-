/**
 * group/[id]/index.tsx — one group: balances, who should pay whom, and history.
 *
 * `[id]` in the file name means the group's id comes from the URL,
 * e.g. /group/3f2a... We read it with useLocalSearchParams().
 */
import * as Linking from 'expo-linking';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, Pressable, Share, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, ErrorText, Loading, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  categoryEmoji,
  deleteExpense,
  getGroupDetail,
  localToday,
  subscribeToGroup,
  toInsightInput,
  type Expense,
  type GroupDetail,
  type Settlement,
} from '@/lib/api';
import { useUserId } from '@/lib/auth';
import { formatINR } from '@/lib/balances';
import { computeBadges } from '@/lib/insights';

export default function GroupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useUserId();
  const theme = useTheme();
  const [detail, setDetail] = useState<GroupDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setDetail(await getGroupDetail(id));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [id]);

  // Reload when the screen comes into view...
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );
  // ...and whenever a friend adds an expense or payment (live updates).
  useEffect(() => subscribeToGroup(id, load), [id, load]);

  if (!detail) {
    return (
      <Screen>
        <ErrorText message={error} />
        {!error && <Loading />}
      </Screen>
    );
  }

  const { group, members, expenses, settlements, balances, transfers } = detail;
  const badges = computeBadges(toInsightInput(detail, localToday()));
  // Quick lookup: user id → name. "You" for the current user.
  const nameOf = (uid: string) =>
    uid === userId ? 'You' : (members.find((m) => m.id === uid)?.display_name ?? 'Someone');

  async function shareInvite() {
    // Builds a link that opens this app's /join screen with the code filled in.
    const link = Linking.createURL('/join', { queryParams: { code: group.invite_code } });
    const message = `Join "${group.name}" on SplitFree to split expenses: ${link}`;
    try {
      await Share.share({ message });
    } catch {
      // Some desktop browsers can't share; show the link so it can be copied.
      if (Platform.OS === 'web') window.prompt('Copy this invite link:', link);
      else Alert.alert('Invite link', link);
    }
  }

  function confirmDelete(expense: Expense) {
    const doDelete = async () => {
      try {
        await deleteExpense(expense.id);
        load();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    };
    const question = `Delete "${expense.description}"?`;
    // Alert with buttons doesn't work on web, so use the browser's confirm there.
    if (Platform.OS === 'web') {
      if (window.confirm(question)) doDelete();
    } else {
      Alert.alert(question, 'This updates everyone’s balances.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doDelete },
      ]);
    }
  }

  // Mix expenses and payments into one timeline, newest first.
  type Item = { kind: 'expense'; date: string; e: Expense } | { kind: 'settlement'; date: string; s: Settlement };
  const timeline: Item[] = [
    ...expenses.map((e) => ({ kind: 'expense' as const, date: e.spent_on, e })),
    ...settlements.map((s) => ({ kind: 'settlement' as const, date: s.settled_on, s })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <Screen>
      <Stack.Screen options={{ title: `${group.emoji} ${group.name}` }} />
      <ErrorText message={error} />

      <View style={{ flexDirection: 'row', gap: Spacing.two }}>
        <Button
          title="Add expense"
          style={{ flex: 1 }}
          onPress={() => router.push({ pathname: '/group/[id]/add-expense', params: { id } })}
        />
        <Button
          title="Settle up"
          variant="secondary"
          style={{ flex: 1 }}
          onPress={() => router.push({ pathname: '/group/[id]/settle', params: { id } })}
        />
      </View>

      {/* Fun insights teaser: tap to see all badges, recap and nudges */}
      <Pressable onPress={() => router.push({ pathname: '/group/[id]/insights', params: { id } })}>
        <Card>
          <ThemedText type="smallBold">🏆 Badges & insights</ThemedText>
          {badges.length === 0 ? (
            <ThemedText themeColor="textSecondary">No badges yet this month. Tap to see the recap and settings.</ThemedText>
          ) : (
            // Roasts first in the preview: they're the fun part.
            [...badges].sort((x, y) => Number(y.negative) - Number(x.negative)).slice(0, 3).map((b) => (
              <ThemedText key={b.id}>
                {b.emoji} {b.title}: <ThemedText style={{ fontWeight: 700 }}>{nameOf(b.userId)}</ThemedText>
              </ThemedText>
            ))
          )}
          <ThemedText type="linkPrimary">
            {badges.length > 3 ? `See all ${badges.length} badges →` : 'See more →'}
          </ThemedText>
        </Card>
      </Pressable>

      {/* Balances: one line per member */}
      <Card>
        <ThemedText type="smallBold">Balances</ThemedText>
        {members.map((m) => {
          const b = balances[m.id] ?? 0;
          const color = b > 0 ? theme.positive : b < 0 ? theme.negative : theme.textSecondary;
          const verb = m.id === userId ? (b > 0 ? 'are owed' : 'owe') : b > 0 ? 'is owed' : 'owes';
          return (
            <ThemedText key={m.id} style={{ color }}>
              {nameOf(m.id)} {b === 0 ? (m.id === userId ? 'are settled up' : 'is settled up') : `${verb} ${formatINR(Math.abs(b))}`}
            </ThemedText>
          );
        })}
      </Card>

      {/* Suggested payments */}
      {transfers.length > 0 && (
        <Card>
          <ThemedText type="smallBold">
            {group.simplify_debts ? 'Fastest way to settle up' : 'Who owes whom'}
          </ThemedText>
          {transfers.map((t) => {
            const involvesMe = t.from === userId || t.to === userId;
            return (
              <View key={`${t.from}-${t.to}`} style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
                <ThemedText style={{ flex: 1 }}>
                  {nameOf(t.from)} → {nameOf(t.to)}: <ThemedText style={{ fontWeight: 700 }}>{formatINR(t.amount)}</ThemedText>
                </ThemedText>
                {involvesMe && (
                  <Pressable
                    onPress={() =>
                      router.push({
                        pathname: '/group/[id]/settle',
                        params: { id, from: t.from, to: t.to, amount: String(t.amount) },
                      })
                    }>
                    <ThemedText type="linkPrimary">Settle</ThemedText>
                  </Pressable>
                )}
              </View>
            );
          })}
        </Card>
      )}

      {/* Invite friends */}
      <Card>
        <ThemedText type="smallBold">Invite friends</ThemedText>
        <ThemedText themeColor="textSecondary">
          Invite code: <ThemedText type="code">{group.invite_code}</ThemedText>
        </ThemedText>
        <Button title="Share invite link" variant="secondary" onPress={shareInvite} />
      </Card>

      {/* History */}
      <ThemedText type="smallBold">History</ThemedText>
      {timeline.length === 0 && (
        <ThemedText themeColor="textSecondary">Nothing here yet. Add the first expense!</ThemedText>
      )}
      {timeline.map((item) =>
        item.kind === 'expense' ? (
          <ExpenseRow
            key={item.e.id}
            expense={item.e}
            userId={userId}
            nameOf={nameOf}
            onLongPress={() => confirmDelete(item.e)}
          />
        ) : (
          <Card key={item.s.id}>
            <ThemedText>
              💸 {nameOf(item.s.from_user)} paid {nameOf(item.s.to_user)} {formatINR(item.s.amount_paise)}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {item.s.settled_on} · {item.s.method.toUpperCase()}
            </ThemedText>
          </Card>
        ),
      )}
      {expenses.length > 0 && (
        <ThemedText type="small" themeColor="textSecondary">
          Tip: long-press an expense to delete it.
        </ThemedText>
      )}
    </Screen>
  );
}

/** One expense in the history, with what it means for you. */
function ExpenseRow({
  expense,
  userId,
  nameOf,
  onLongPress,
}: {
  expense: Expense;
  userId: string;
  nameOf: (uid: string) => string;
  onLongPress: () => void;
}) {
  const theme = useTheme();
  const paid = expense.payers.find((p) => p.user_id === userId)?.amount_paise ?? 0;
  const share = expense.shares.find((s) => s.user_id === userId)?.amount_paise ?? 0;
  const net = paid - share; // positive: you lent money, negative: you borrowed
  const payerNames = expense.payers.map((p) => nameOf(p.user_id)).join(' & ');

  return (
    <Pressable onLongPress={onLongPress} delayLongPress={400}>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.three }}>
        <ThemedText style={{ fontSize: 24 }}>{categoryEmoji(expense.category)}</ThemedText>
        <View style={{ flex: 1 }}>
          <ThemedText type="smallBold">{expense.description}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {payerNames} paid {formatINR(expense.amount_paise)} · {expense.spent_on}
          </ThemedText>
        </View>
        {net !== 0 && (
          <ThemedText type="small" style={{ color: net > 0 ? theme.positive : theme.negative, fontWeight: 700 }}>
            {net > 0 ? 'you lent' : 'you borrowed'}
            {'\n'}
            {formatINR(Math.abs(net))}
          </ThemedText>
        )}
      </Card>
    </Pressable>
  );
}
