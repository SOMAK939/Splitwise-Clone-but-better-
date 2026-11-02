/**
 * ui.tsx — small reusable building blocks for every screen.
 *
 * Keeping buttons, inputs and cards in one file means the whole app looks
 * consistent, and a style change here updates every screen at once.
 */
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatINR } from '@/lib/balances';

/** A scrollable page with comfortable padding and a max width on big screens. */
export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const theme = useTheme();
  const inner = <View style={styles.screenInner}>{children}</View>;
  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: theme.background }}>
      {scroll ? (
        <ScrollView contentContainerStyle={styles.screenScroll} keyboardShouldPersistTaps="handled">
          {inner}
        </ScrollView>
      ) : (
        inner
      )}
    </SafeAreaView>
  );
}

type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
};

export function Button({ title, onPress, variant = 'primary', loading, disabled, style }: ButtonProps) {
  const theme = useTheme();
  const background =
    variant === 'primary' ? theme.primary : variant === 'danger' ? theme.negative : theme.backgroundElement;
  const color = variant === 'secondary' ? theme.text : theme.onPrimary;
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: background, opacity: isDisabled ? 0.5 : pressed ? 0.8 : 1 },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={color} />
      ) : (
        <ThemedText style={{ color, fontWeight: 700 }}>{title}</ThemedText>
      )}
    </Pressable>
  );
}

/** A labelled text box. */
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const theme = useTheme();
  return (
    <View style={{ gap: Spacing.one }}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <TextInput
        placeholderTextColor={theme.textSecondary}
        style={[
          styles.input,
          { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundElement },
        ]}
        {...props}
      />
    </View>
  );
}

/** A rounded box that groups related things together. */
export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const theme = useTheme();
  return <View style={[styles.card, { backgroundColor: theme.backgroundElement }, style]}>{children}</View>;
}

/** A tappable pill, used for picking people and categories. */
export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? theme.primary : theme.backgroundElement,
          borderColor: selected ? theme.primary : theme.border,
        },
      ]}>
      <ThemedText type="small" style={{ color: selected ? theme.onPrimary : theme.text }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

/**
 * Shows a balance in green (you're owed) or red (you owe).
 * Pass `amount` in paise from the current user's point of view.
 */
export function BalanceText({ amount, settledText = 'settled up' }: { amount: number; settledText?: string }) {
  const theme = useTheme();
  if (amount === 0) return <ThemedText themeColor="textSecondary">{settledText}</ThemedText>;
  const owed = amount > 0;
  return (
    <ThemedText style={{ color: owed ? theme.positive : theme.negative, fontWeight: 700 }}>
      {owed ? 'you are owed ' : 'you owe '}
      {formatINR(Math.abs(amount))}
    </ThemedText>
  );
}

export function ErrorText({ message }: { message: string | null }) {
  const theme = useTheme();
  if (!message) return null;
  return <ThemedText style={{ color: theme.negative }}>{message}</ThemedText>;
}

export function Loading() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.five }}>
      <ActivityIndicator size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  screenScroll: { flexGrow: 1, alignItems: 'center' },
  screenInner: {
    width: '100%',
    maxWidth: MaxContentWidth,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  button: {
    minHeight: 48,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  card: { borderRadius: 16, padding: Spacing.three, gap: Spacing.two },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: Spacing.one + 2,
    paddingHorizontal: Spacing.three,
  },
});
