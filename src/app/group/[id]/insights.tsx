/**
 * insights.tsx — the fun screen: this month's badges, the monthly recap,
 * nudges for people who owe money, and the group's roast settings.
 *
 * All the rules live in src/lib/insights.ts. This screen only displays them.
 */
import * as Linking from 'expo-linking';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { Share, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, Chip, ErrorText, Loading, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  CATEGORIES,
  getGroupDetail,
  localToday,
  setHideNegativeBadges,
  toInsightInput,
  updateGroup,
  type GroupDetail,
} from '@/lib/api';
import { useUserId } from '@/lib/auth';
import { formatINR } from '@/lib/balances';
import { computeBadges, computeNudges, computeRecap, monthOf, type RoastLevel } from '@/lib/insights';
import { playSound } from '@/lib/sounds';

const ROAST_LEVELS: { id: RoastLevel; label: string; help: string }[] = [
  { id: 'off', label: '😇 Off', help: 'Only nice badges. Good for family and office groups.' },
  { id: 'mild', label: '🙂 Mild', help: 'Gentle teasing, like Chindi of the Month.' },
  { id: 'spicy', label: '🌶️ Spicy', help: 'Full roast mode. For friends with thick skin.' },
];

export default function InsightsScreen() {
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

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // 🎺 Sad trombone the first time each month you see a roast badge about you.
  useEffect(() => {
    if (!detail || detail.group.roast_level === 'off') return;
    const today = localToday();
    const roastedMe = computeBadges(toInsightInput(detail, today)).some((b) => b.negative && b.userId === userId);
    if (!roastedMe) return;
    const key = `splitfree.roastSound.${id}.${monthOf(today)}`;
    AsyncStorage.getItem(key)
      .then((done) => {
        if (done) return;
        playSound('roast');
        return AsyncStorage.setItem(key, '1');
      })
      .catch(() => {});
  }, [detail, id, userId]);

  if (!detail) {
    return (
      <Screen>
        <ErrorText message={error} />
        {!error && <Loading />}
      </Screen>
    );
  }

  // Work out everything from the loaded data.
  const today = localToday();
  const input = toInsightInput(detail, today);
  const badges = computeBadges(input);
  const nudges = computeNudges({ ...input, groupName: detail.group.name });
  const recap = computeRecap(input.expenses, monthOf(today));
  const monthName = new Date(`${today}T12:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const nameOf = (uid: string) =>
    uid === userId ? 'You' : (detail.members.find((m) => m.id === uid)?.display_name ?? 'Someone');
  const iHideMine = detail.hiddenBadgeUsers.includes(userId);
  const topCategory = CATEGORIES.find((c) => c.id === recap.topCategory?.id);

  /** Share text through the phone's share sheet, or WhatsApp on desktop. */
  async function shareText(message: string) {
    try {
      await Share.share({ message });
    } catch {
      Linking.openURL(`https://wa.me/?text=${encodeURIComponent(message)}`);
    }
  }

  function shareRecap() {
    const lines = [
      `📊 ${detail!.group.emoji} ${detail!.group.name}: ${monthName} recap on SplitFree`,
      `Spent together: ${formatINR(recap.total)} across ${recap.count} expenses`,
      topCategory ? `Top category: ${topCategory.emoji} ${topCategory.label}` : null,
      recap.biggest ? `Biggest bill: ${recap.biggest.description} (${formatINR(recap.biggest.amount)})` : null,
      '',
      ...badges.map((b) => `${b.emoji} ${b.title}: ${nameOf(b.userId) === 'You' ? 'me' : nameOf(b.userId)}`),
    ].filter((line) => line !== null);
    shareText(lines.join('\n'));
  }

  // Settings changes save straight away, then reload.
  async function save(change: Promise<void>) {
    try {
      await change;
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <Screen>
      <ErrorText message={error} />

      {/* ---- Badges ---- */}
      <ThemedText type="smallBold">🏆 {monthName} badges</ThemedText>
      {badges.length === 0 && (
        <ThemedText themeColor="textSecondary">
          No badges yet this month. Add a few expenses and settle up, then check back!
        </ThemedText>
      )}
      {badges.map((b) => (
        <Card key={b.id} style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.three }}>
          <ThemedText style={{ fontSize: 32, lineHeight: 40 }}>{b.emoji}</ThemedText>
          <View style={{ flex: 1 }}>
            <ThemedText type="smallBold" style={b.negative ? { color: theme.negative } : undefined}>
              {b.title}
            </ThemedText>
            <ThemedText style={{ fontWeight: 700 }}>{nameOf(b.userId)}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {b.line}
            </ThemedText>
          </View>
        </Card>
      ))}

      {/* ---- Monthly recap ---- */}
      <Card>
        <ThemedText type="smallBold">📊 {monthName} recap</ThemedText>
        <ThemedText>
          Spent together: <ThemedText style={{ fontWeight: 700 }}>{formatINR(recap.total)}</ThemedText> across{' '}
          {recap.count} {recap.count === 1 ? 'expense' : 'expenses'}
        </ThemedText>
        {topCategory && recap.topCategory && (
          <ThemedText>
            Top category: {topCategory.emoji} {topCategory.label} ({formatINR(recap.topCategory.amount)})
          </ThemedText>
        )}
        {recap.biggest && (
          <ThemedText>
            Biggest bill: {recap.biggest.description} ({formatINR(recap.biggest.amount)})
          </ThemedText>
        )}
        <Button title="Share recap" variant="secondary" onPress={shareRecap} disabled={recap.count === 0} />
      </Card>

      {/* ---- Nudges ---- */}
      <Card>
        <ThemedText type="smallBold">👀 Who still owes</ThemedText>
        {nudges.length === 0 && <ThemedText themeColor="textSecondary">Nobody! Everyone is settled up. 🎉</ThemedText>}
        {nudges.map((nudge) => (
          <View key={nudge.userId} style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
            <ThemedText style={{ flex: 1 }}>
              {nameOf(nudge.userId)} {nudge.userId === userId ? 'owe' : 'owes'} {formatINR(nudge.amount)}
              <ThemedText type="small" themeColor="textSecondary">
                {' '}
                · {nudge.days === 0 ? 'since today' : `${nudge.days} ${nudge.days === 1 ? 'day' : 'days'}`}
              </ThemedText>
            </ThemedText>
            {nudge.userId !== userId && (
              <Button
                title="Nudge"
                variant="secondary"
                onPress={() => {
                  playSound('nudge'); // 👀 ding-dong
                  shareText(nudge.message);
                }}
              />
            )}
          </View>
        ))}
      </Card>

      {/* ---- Settings ---- */}
      <Card>
        <ThemedText type="smallBold">🌶️ Roast level (whole group)</ThemedText>
        <View style={rowWrap}>
          {ROAST_LEVELS.map((r) => (
            <Chip
              key={r.id}
              label={r.label}
              selected={detail.group.roast_level === r.id}
              onPress={() => save(updateGroup(id, { roast_level: r.id }))}
            />
          ))}
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          {ROAST_LEVELS.find((r) => r.id === detail.group.roast_level)?.help}
        </ThemedText>

        <ThemedText type="smallBold">Just for you</ThemedText>
        <View style={rowWrap}>
          <Chip
            label="Hide roast badges about me"
            selected={iHideMine}
            onPress={() => save(setHideNegativeBadges(id, userId, !iHideMine))}
          />
        </View>

        <ThemedText type="smallBold">Settle-up suggestions</ThemedText>
        <View style={rowWrap}>
          <Chip
            label="Fewest payments"
            selected={detail.group.simplify_debts}
            onPress={() => save(updateGroup(id, { simplify_debts: true }))}
          />
          <Chip
            label="Pay each person back"
            selected={!detail.group.simplify_debts}
            onPress={() => save(updateGroup(id, { simplify_debts: false }))}
          />
        </View>
      </Card>
    </Screen>
  );
}

const rowWrap = { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two } as const;
