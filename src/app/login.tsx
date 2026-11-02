/**
 * login.tsx — the first page a new visitor sees.
 *
 * It's a landing page and a sign-in page in one: it says what SplitFree is,
 * why it's safe, and how it works, with the sign-in box right at the top so
 * returning users can get straight in.
 */
import { Link } from 'expo-router';
import type { ReactNode } from 'react';
import { Image, View } from 'react-native';

import { AuthCard } from '@/components/auth-card';
import { SOURCE_URL } from '@/components/doc-page';
import { ThemedText } from '@/components/themed-text';
import { Card, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function LandingScreen() {
  return (
    <Screen>
      {/* ---- Hero: who we are, in one line ---- */}
      <View style={{ marginTop: Spacing.five, gap: Spacing.two }}>
        <Image
          source={require('@/assets/images/icon.png')}
          style={{ width: 64, height: 64, borderRadius: 16 }}
          accessibilityLabel="SplitFree logo"
        />
        <ThemedText type="subtitle">Split bills with friends. Free forever.</ThemedText>
        <ThemedText themeColor="textSecondary">
          Track shared expenses for your flat, trips and nights out, settle up over UPI, and find out who your group's
          Chindi of the Month is.
        </ThemedText>
      </View>

      <AuthCard />

      {/* ---- Safety, answered up front ---- */}
      <Section title="Is it safe?">
        <Point icon="🔒" title="We never touch your money">
          SplitFree only keeps track of who owes whom. When you pay, your own UPI app (GPay, PhonePe, Paytm) opens and
          handles it, just like always.
        </Point>
        <Point icon="🙈" title="Only your group sees your group">
          Expenses are visible only to members of that group. The database enforces this, not just the app.
        </Point>
        <Point icon="🚫" title="No ads, no data selling">
          We don't show ads, use tracking cookies or sell data. We don't ask for bank details.
        </Point>
        <Point icon="👀" title="Open source">
          Every line of code is public, so anyone can check what SplitFree does.{' '}
          <Link href={SOURCE_URL}>
            <ThemedText type="linkPrimary">See the code</ThemedText>
          </Link>
        </Point>
        <Point icon="🗑️" title="Leave any time">
          Delete your account from your profile in two taps. Your login and email are removed straight away.
        </Point>
      </Section>

      {/* ---- How it works ---- */}
      <Section title="How it works">
        <Point icon="1️⃣" title="Make a group">Your flat, a Goa trip, or the office lunch gang.</Point>
        <Point icon="2️⃣" title="Invite friends with a link">They join in one tap, on any phone. No app store needed.</Point>
        <Point icon="3️⃣" title="Add expenses as you go">Split equally or by exact amounts. Balances update live.</Point>
        <Point icon="4️⃣" title="Settle up over UPI">SplitFree works out the fewest payments, then opens your UPI app.</Point>
      </Section>

      {/* ---- The fun part ---- */}
      <Section title="Monthly badges">
        <ThemedText themeColor="textSecondary">
          Every month your group gets badges like 🪙 Chindi of the Month, 🐢 Slow Settler and 👑 Always Pays First. Too
          spicy? Turn roasts off for your group, or hide the ones about you.
        </ThemedText>
      </Section>

      {/* ---- Who made it ---- */}
      <Section title="Who makes SplitFree?">
        <ThemedText themeColor="textSecondary">
          SplitFree is built by Somak as a free app for friends. If anything looks wrong, or you have an idea, open an
          issue on GitHub and it gets read.
        </ThemedText>
      </Section>

      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: Spacing.three, marginBottom: Spacing.four }}>
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

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card style={{ gap: Spacing.three }}>
      <ThemedText type="smallBold" style={{ fontSize: 20, lineHeight: 28 }}>
        {title}
      </ThemedText>
      {children}
    </Card>
  );
}

/** One point with an emoji, a bold title and a short explanation. */
function Point({ icon, title, children }: { icon: string; title: string; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: Spacing.three }}>
      <ThemedText style={{ fontSize: 22, lineHeight: 28 }}>{icon}</ThemedText>
      <View style={{ flex: 1, gap: 2 }}>
        <ThemedText type="smallBold">{title}</ThemedText>
        <ThemedText type="small" style={{ color: theme.textSecondary }}>
          {children}
        </ThemedText>
      </View>
    </View>
  );
}
