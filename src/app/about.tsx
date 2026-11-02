/** about.tsx — what SplitFree is and why it's free. Public page. */
import { Link } from 'expo-router';

import { CONTACT_URL, DocPage, H, P, SOURCE_URL } from '@/components/doc-page';
import { ThemedText } from '@/components/themed-text';

export default function AboutScreen() {
  return (
    <DocPage>
      <H>What is SplitFree?</H>
      <P>
        SplitFree helps friends, flatmates and travel groups split shared bills and settle up over UPI. It also hands out
        playful monthly badges, like Chindi of the Month, so settling up is a bit more fun.
      </P>

      <H>Why is it free?</H>
      <P>
        It's a personal project built for friends, running on free hosting. There are no ads, no paid tier, no daily
        limits, and your data is never sold. If it ever needs money to run, we'll say so openly here first.
      </P>

      <H>Is my money safe?</H>
      <P>
        SplitFree never touches your money. It only keeps track of who owes whom. When you pay someone, your own UPI app
        (GPay, PhonePe, Paytm...) opens and handles the payment, as it always does.
      </P>

      <H>Open source</H>
      <P>
        All of SplitFree's code is public, so anyone can check what it does with data. See it on{' '}
        <Link href={SOURCE_URL}>
          <ThemedText type="linkPrimary">GitHub</ThemedText>
        </Link>
        .
      </P>

      <H>Contact</H>
      <P>
        Found a bug or have an idea? Open an issue on{' '}
        <Link href={CONTACT_URL}>
          <ThemedText type="linkPrimary">GitHub</ThemedText>
        </Link>
        .
      </P>
    </DocPage>
  );
}
