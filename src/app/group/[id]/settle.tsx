/**
 * settle.tsx — pay someone back (or record that they paid you).
 *
 * Opened from a suggested payment with ?from=...&to=...&amount=... filled in,
 * or from the "Settle up" button, where you pick the person yourself.
 */
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, Chip, ErrorText, Field, Loading, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { getGroupDetail, recordSettlement, upiLink, type GroupDetail, type Settlement } from '@/lib/api';
import { useUserId } from '@/lib/auth';
import { formatINR, rupeesToPaise } from '@/lib/balances';

export default function SettleScreen() {
  const params = useLocalSearchParams<{ id: string; from?: string; to?: string; amount?: string }>();
  const groupId = params.id;
  const userId = useUserId();

  const [detail, setDetail] = useState<GroupDetail | null>(null);
  const [from, setFrom] = useState(params.from ?? userId);
  const [to, setTo] = useState(params.to ?? '');
  const [amountText, setAmountText] = useState(params.amount ? String(Number(params.amount) / 100) : '');
  const [method, setMethod] = useState<Settlement['method']>('upi');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getGroupDetail(groupId)
      .then((d) => {
        setDetail(d);
        // No one picked yet? Suggest the first payment that involves you.
        if (!params.to) {
          const mine = d.transfers.find((t) => t.from === userId || t.to === userId);
          if (mine) {
            setFrom(mine.from);
            setTo(mine.to);
            setAmountText(String(mine.amount / 100));
          }
        }
      })
      .catch((e) => setError(String(e.message ?? e)));
  }, [groupId, params.to, userId]);

  if (!detail) {
    return (
      <Screen>
        <ErrorText message={error} />
        {!error && <Loading />}
      </Screen>
    );
  }

  const nameOf = (uid: string) =>
    uid === userId ? 'You' : (detail.members.find((m) => m.id === uid)?.display_name ?? 'Someone');
  const amount = rupeesToPaise(amountText);
  const payee = detail.members.find((m) => m.id === to);
  const iAmPaying = from === userId;
  const upi = payee && amount ? upiLink(payee, amount, `SplitFree: ${detail.group.name}`) : null;

  async function openUpi() {
    if (!upi) return;
    try {
      await Linking.openURL(upi);
    } catch {
      setError('Could not open a UPI app. Try this on your phone, or pay another way and mark it as paid.');
    }
  }

  async function markPaid() {
    setError(null);
    if (!to || from === to) return setError('Pick who is paying whom');
    if (!amount || amount <= 0) return setError('Enter an amount');
    setBusy(true);
    try {
      await recordSettlement({ groupId, fromUser: from, toUser: to, amountPaise: amount, method });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  // You can record payments you made or received, so one side must be you.
  const others = detail.members.filter((m) => m.id !== userId);

  return (
    <Screen>
      <ThemedText type="smallBold">Direction</ThemedText>
      <View style={rowWrap}>
        <Chip
          label="I paid someone"
          selected={from === userId}
          onPress={() => {
            setTo(from === userId ? to : from);
            setFrom(userId);
          }}
        />
        <Chip
          label="Someone paid me"
          selected={to === userId}
          onPress={() => {
            setFrom(to === userId ? from : to || (others[0]?.id ?? ''));
            setTo(userId);
          }}
        />
      </View>

      <ThemedText type="smallBold">{iAmPaying ? 'Paid to' : 'Paid by'}</ThemedText>
      <View style={rowWrap}>
        {others.map((m) => {
          const selected = iAmPaying ? to === m.id : from === m.id;
          return (
            <Chip
              key={m.id}
              label={m.display_name}
              selected={selected}
              onPress={() => (iAmPaying ? setTo(m.id) : setFrom(m.id))}
            />
          );
        })}
      </View>
      {others.length === 0 && (
        <ThemedText themeColor="textSecondary">Invite friends to this group first.</ThemedText>
      )}

      <Field label="Amount (₹)" value={amountText} onChangeText={setAmountText} keyboardType="decimal-pad" />

      {to && from !== to && amount ? (
        <Card>
          <ThemedText>
            {nameOf(from)} {from === userId ? 'pay' : 'pays'} {nameOf(to)} {formatINR(amount)}
          </ThemedText>
          {iAmPaying && upi && <Button title={`Pay ${formatINR(amount)} with UPI`} onPress={openUpi} />}
          {iAmPaying && payee && !payee.upi_id && (
            <ThemedText type="small" themeColor="textSecondary">
              {payee.display_name} hasn't added a UPI ID yet, so pay them another way.
            </ThemedText>
          )}
        </Card>
      ) : null}

      <ThemedText type="smallBold">How was it paid?</ThemedText>
      <View style={rowWrap}>
        <Chip label="UPI" selected={method === 'upi'} onPress={() => setMethod('upi')} />
        <Chip label="Cash" selected={method === 'cash'} onPress={() => setMethod('cash')} />
        <Chip label="Other" selected={method === 'other'} onPress={() => setMethod('other')} />
      </View>

      <ErrorText message={error} />
      <Button title="Mark as paid" onPress={markPaid} loading={busy} />
    </Screen>
  );
}

const rowWrap = { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two } as const;
