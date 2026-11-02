/** privacy.tsx — the privacy policy, in plain English. Public page. */
import { Link } from 'expo-router';

import { CONTACT_URL, DocPage, H, P } from '@/components/doc-page';
import { ThemedText } from '@/components/themed-text';

export default function PrivacyScreen() {
  return (
    <DocPage updated="2 November 2026">
      <P>This page explains what SplitFree stores, who can see it, and how to get it deleted. No legal jargon.</P>

      <H>What we store</H>
      <P>• Your name and email address, from sign-up or from Google if you continue with Google.</P>
      <P>• Your UPI ID, only if you add it, so friends can pay you.</P>
      <P>• The groups you join, and the expenses and payments recorded in them.</P>

      <H>What we don't do</H>
      <P>• No ads, and no ad or tracking cookies.</P>
      <P>• We never sell or share your data with advertisers or data brokers.</P>
      <P>• We never see your Google password or your bank details. Payments happen in your own UPI app.</P>

      <H>Who can see your data</H>
      <P>
        People in a group with you can see your name, your UPI ID (if you added one) and that group's expenses, balances
        and badges. Nobody outside a group can see anything in it. This is enforced by the database itself, not just the
        app.
      </P>

      <H>Where it's kept</H>
      <P>
        Data is stored with Supabase (database and login) and the website is served by Vercel. Both encrypt data in
        transit, and Supabase encrypts it at rest. They only process data to run SplitFree.
      </P>

      <H>Signing in with Google</H>
      <P>
        If you continue with Google, Google tells us only your name, email address and profile picture. We use your name
        and email to set up your account and nothing else.
      </P>

      <H>Deleting your data</H>
      <P>
        Go to Profile → Delete my account. Your login, email address and UPI ID are removed straight away. Expenses you
        shared with others stay in their group's history under the name "Deleted user", so their balances stay correct.
      </P>
      <P>
        Questions? Open an issue on{' '}
        <Link href={CONTACT_URL}>
          <ThemedText type="linkPrimary">GitHub</ThemedText>
        </Link>
        .
      </P>

      <H>Changes</H>
      <P>If this policy changes, we'll update this page and the date at the top.</P>
    </DocPage>
  );
}
