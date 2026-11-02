/**
 * add-expense.tsx — record a bill: how much, who paid, and who shares it.
 *
 * Two ways to split:
 * - Equally: everyone selected pays the same (leftover paise handled for you).
 * - Exact amounts: type each person's share; they must add up to the total.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Chip, ErrorText, Field, Loading, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { CATEGORIES, createExpense, getGroupDetail, type Profile } from '@/lib/api';
import { useUserId } from '@/lib/auth';
import { formatINR, rupeesToPaise, splitEqually } from '@/lib/balances';
import { playSound } from '@/lib/sounds';

export default function AddExpenseScreen() {
  const { id: groupId } = useLocalSearchParams<{ id: string }>();
  const userId = useUserId();

  const [members, setMembers] = useState<Profile[] | null>(null);
  const [description, setDescription] = useState('');
  const [amountText, setAmountText] = useState('');
  const [category, setCategory] = useState<string>('food');
  const [payerId, setPayerId] = useState(userId); // you, by default
  const [splitWith, setSplitWith] = useState<string[]>([]); // ids of people sharing
  const [mode, setMode] = useState<'equal' | 'exact'>('equal');
  const [exact, setExact] = useState<Record<string, string>>({}); // id → typed amount
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load the group's members; split with everyone by default.
  useEffect(() => {
    getGroupDetail(groupId)
      .then((d) => {
        setMembers(d.members);
        setSplitWith(d.members.map((m) => m.id));
      })
      .catch((e) => setError(String(e.message ?? e)));
  }, [groupId]);

  if (!members) {
    return (
      <Screen>
        <ErrorText message={error} />
        {!error && <Loading />}
      </Screen>
    );
  }

  const nameOf = (m: Profile) => (m.id === userId ? 'You' : m.display_name);
  const amount = rupeesToPaise(amountText); // null if not a valid number

  // Work out each person's share for the current mode.
  const shares =
    mode === 'equal'
      ? splitEqually(amount ?? 0, splitWith)
      : splitWith.map((uid) => ({ userId: uid, amount: rupeesToPaise(exact[uid] ?? '') ?? 0 }));
  const sharesTotal = shares.reduce((sum, s) => sum + s.amount, 0);
  const remaining = (amount ?? 0) - sharesTotal;

  function toggle(uid: string) {
    setSplitWith((current) => (current.includes(uid) ? current.filter((x) => x !== uid) : [...current, uid]));
  }

  async function save() {
    setError(null);
    // Check the form before sending anything.
    if (!description.trim()) return setError('What was it for?');
    if (!amount || amount <= 0) return setError('Enter an amount, like 450 or 99.50');
    if (splitWith.length === 0) return setError('Pick at least one person to split with');
    if (mode === 'exact' && remaining !== 0) {
      return setError(`Shares must add up to ${formatINR(amount)} (${formatINR(Math.abs(remaining))} ${remaining > 0 ? 'left' : 'too much'})`);
    }

    setBusy(true);
    try {
      await createExpense({
        groupId,
        description: description.trim(),
        amountPaise: amount,
        category,
        payers: [{ user_id: payerId, amount_paise: amount }],
        shares: shares.map((s) => ({ user_id: s.userId, amount_paise: s.amount })),
      });
      playSound('add-expense'); // 💸 ka-ching!
      router.back(); // close the form; the group screen reloads itself
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Field label="What was it for?" value={description} onChangeText={setDescription} placeholder="Dinner at Toit" autoFocus />
      <Field label="Amount (₹)" value={amountText} onChangeText={setAmountText} placeholder="0" keyboardType="decimal-pad" />

      <ThemedText type="smallBold">Category</ThemedText>
      <View style={rowWrap}>
        {CATEGORIES.map((c) => (
          <Chip key={c.id} label={`${c.emoji} ${c.label}`} selected={category === c.id} onPress={() => setCategory(c.id)} />
        ))}
      </View>

      <ThemedText type="smallBold">Paid by</ThemedText>
      <View style={rowWrap}>
        {members.map((m) => (
          <Chip key={m.id} label={nameOf(m)} selected={payerId === m.id} onPress={() => setPayerId(m.id)} />
        ))}
      </View>

      <ThemedText type="smallBold">Split</ThemedText>
      <View style={rowWrap}>
        <Chip label="Equally" selected={mode === 'equal'} onPress={() => setMode('equal')} />
        <Chip label="Exact amounts" selected={mode === 'exact'} onPress={() => setMode('exact')} />
      </View>

      <ThemedText type="smallBold">Between</ThemedText>
      <View style={rowWrap}>
        {members.map((m) => (
          <Chip key={m.id} label={nameOf(m)} selected={splitWith.includes(m.id)} onPress={() => toggle(m.id)} />
        ))}
      </View>

      {mode === 'equal' && amount && splitWith.length > 0 ? (
        <ThemedText themeColor="textSecondary">
          {formatINR(shares[0].amount)} each{shares[0].amount !== shares[shares.length - 1].amount ? ' (roughly)' : ''}
        </ThemedText>
      ) : null}

      {mode === 'exact' &&
        members
          .filter((m) => splitWith.includes(m.id))
          .map((m) => (
            <Field
              key={m.id}
              label={`${nameOf(m)}'s share (₹)`}
              value={exact[m.id] ?? ''}
              onChangeText={(text) => setExact((cur) => ({ ...cur, [m.id]: text }))}
              keyboardType="decimal-pad"
              placeholder="0"
            />
          ))}
      {mode === 'exact' && amount ? (
        <ThemedText themeColor="textSecondary">
          {remaining === 0 ? 'Adds up ✅' : `${formatINR(Math.abs(remaining))} ${remaining > 0 ? 'left to assign' : 'too much'}`}
        </ThemedText>
      ) : null}

      <ErrorText message={error} />
      <Button title="Save expense" onPress={save} loading={busy} />
    </Screen>
  );
}

const rowWrap = { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two } as const;
