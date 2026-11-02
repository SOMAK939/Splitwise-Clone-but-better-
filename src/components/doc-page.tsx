/**
 * doc-page.tsx — a simple page of headings and paragraphs, used for the
 * About, Privacy and Terms pages.
 */
import type { ReactNode } from 'react';

import { ThemedText } from '@/components/themed-text';
import { Screen } from '@/components/ui';

export const CONTACT_URL = 'https://github.com/SOMAK939/Splitwise-Clone-but-better-/issues';
export const SOURCE_URL = 'https://github.com/SOMAK939/Splitwise-Clone-but-better-';

export function DocPage({ children, updated }: { children: ReactNode; updated?: string }) {
  return (
    <Screen>
      {updated && (
        <ThemedText type="small" themeColor="textSecondary">
          Last updated {updated}
        </ThemedText>
      )}
      {children}
    </Screen>
  );
}

export function H({ children }: { children: ReactNode }) {
  return <ThemedText type="smallBold" style={{ fontSize: 18, marginTop: 8 }}>{children}</ThemedText>;
}

export function P({ children }: { children: ReactNode }) {
  return <ThemedText>{children}</ThemedText>;
}
