import { LegalLayout, LegalSection, P } from '@/components/legal/LegalLayout';

export const metadata = {
  title: 'Beta Tester Terms & Feedback License — NETWORX',
  description: 'Terms for beta access, free premium features, and feedback provided to NETWORX.',
};

export default function BetaTermsPage() {
  return (
    <LegalLayout
      title="Beta Tester Terms & Feedback License"
      effectiveDate="June 14, 2026"
    >
      <LegalSection title="1. Beta Access">
        <P>
          NETWORX may provide early beta access, free premium features, testing tools, unreleased
          features, and experimental functionality. Beta access is temporary and may be changed,
          limited, revoked, or discontinued at any time.
        </P>
      </LegalSection>

      <LegalSection title="2. No Permanent Free Access Promise">
        <P>
          Free beta premium access does not guarantee permanent free access, lifetime pricing, future
          premium status, or continued access to any feature after beta ends.
        </P>
      </LegalSection>

      <LegalSection title="3. Feedback License">
        <P>
          If you provide feedback, ideas, suggestions, bug reports, designs, feature requests,
          comments, or other input about NETWORX, you grant NETWORX a perpetual, worldwide,
          royalty-free right to use that feedback to improve and operate the platform without owing
          compensation.
        </P>
      </LegalSection>

      <LegalSection title="4. Testing Risks">
        <P>
          Beta features may contain bugs, errors, downtime, data loss, inaccurate analytics, or
          incomplete functionality. Users should not rely on beta data as final business, legal, or
          financial reporting.
        </P>
      </LegalSection>

      <LegalSection title="5. User Conduct">
        <P>
          Beta users must follow the Terms of Service, Community Guidelines, Prohibited Content
          Policy, DMCA &amp; Copyright Policy, and any beta-specific instructions.
        </P>
      </LegalSection>
    </LegalLayout>
  );
}
