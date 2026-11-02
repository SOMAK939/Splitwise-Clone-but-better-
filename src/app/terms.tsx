/** terms.tsx — the simple rules for using SplitFree. Public page. */
import { DocPage, H, P } from '@/components/doc-page';

export default function TermsScreen() {
  return (
    <DocPage updated="2 November 2026">
      <H>The short version</H>
      <P>SplitFree is a free tool for keeping track of shared expenses. Use it kindly and honestly.</P>

      <H>What SplitFree is, and isn't</H>
      <P>
        SplitFree records who paid what and who owes whom. It is not a bank or payment service, and it never holds or
        moves money. Payments happen in your own UPI or banking app, and SplitFree can't reverse them.
      </P>

      <H>Your responsibilities</H>
      <P>• Enter amounts honestly, and only add people to groups who agreed to join.</P>
      <P>• Badges and roasts are jokes. Turn them off for your group if they're not welcome.</P>
      <P>• Don't use SplitFree for anything illegal, or to harass anyone.</P>

      <H>No guarantees</H>
      <P>
        SplitFree is provided free and "as is". We work hard to keep the maths right and your data safe, but we can't
        promise it will always be available or error-free. Double-check large amounts before paying.
      </P>

      <H>Changes</H>
      <P>We may update these terms. If we do, we'll change the date at the top of this page.</P>
    </DocPage>
  );
}
