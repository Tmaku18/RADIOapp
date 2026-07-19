import { LegalLayout, LegalSection, P, Bullets } from '@/components/legal/LegalLayout';

export const metadata = {
  title: 'Privacy Policy — NETWORX',
  description: 'How DISCOVERMERADIO GROUP LLC / NETWORX collects, uses, shares, and protects information.',
};

export default function PrivacyPage() {
  return (
    <LegalLayout
      title="Privacy Policy"
      effectiveDate="June 14, 2026"
      intro="This Privacy Policy explains how DISCOVERMERADIO GROUP LLC / NETWORX collects, uses, shares, and protects information when users access NETWORX, PRO-NETWORX, the website, mobile apps, marketplace, beta features, or related services."
    >
      <LegalSection title="1. Information We Collect">
        <Bullets
          items={[
            'Account information such as name, username, email, profile photo, artist name, service provider name, and login details.',
            'Creator profile information such as bio, links, portfolio items, service listings, music metadata, artwork, pricing, and social links.',
            'Marketplace information such as purchases, transaction IDs, order history, payout status, refunds, and chargebacks. Payment card details are processed by third-party payment providers and are not intended to be stored directly by NETWORX.',
            'Content and communications such as posts, comments, messages, reports, livestream materials, feedback, and support requests.',
            'Usage and technical data such as device information, IP address, browser, app version, logs, crash data, Sentry events, analytics, and approximate location based on technical data.',
            'Legal and safety data such as copyright complaints, dispute records, counter-notices, verification information, policy violations, and moderation history.',
          ]}
        />
      </LegalSection>

      <LegalSection title="2. How We Use Information">
        <Bullets
          items={[
            'To create and manage accounts and profiles.',
            'To operate music previews, purchases, libraries, downloads, and creative listings.',
            'To process transactions, refunds, payouts, and marketplace records.',
            'To provide customer support, safety reviews, fraud prevention, copyright enforcement, and moderation.',
            'To improve product features, debug errors, analyze usage, and understand creator/listener engagement.',
            'To send transactional emails, beta notices, product updates, support messages, and marketing messages where allowed.',
            'To comply with legal obligations and enforce our policies.',
          ]}
        />
      </LegalSection>

      <LegalSection title="3. How We Share Information">
        <P>
          NETWORX may share information with service providers that help operate the platform,
          including hosting, database, storage, analytics, payments, email, monitoring, and customer
          support providers. NETWORX may share transaction or payout information with payment
          processors, tax or compliance providers, and marketplace participants as needed to complete
          transactions.
        </P>
        <P>
          NETWORX may disclose information if required by law, legal process, safety concerns, rights
          enforcement, fraud prevention, or business transfers.
        </P>
      </LegalSection>

      <LegalSection title="4. Public Content">
        <P>
          Profiles, artist pages, service listings, posts, portfolios, music previews, links,
          comments, and other public-facing content may be visible to other users or the public.
          Users should not post private or sensitive information they do not want others to see.
        </P>
      </LegalSection>

      <LegalSection title="5. Children and Teens">
        <P>
          NETWORX is not directed to children under 13. We do not knowingly collect personal
          information from children under 13. If we learn that a child under 13 has provided personal
          information, we may delete the account and information. Users under the age of majority
          should use NETWORX with permission from a parent or guardian.
        </P>
      </LegalSection>

      <LegalSection title="6. Cookies and Similar Technologies">
        <P>
          NETWORX may use cookies, pixels, local storage, device identifiers, and similar
          technologies for login, security, analytics, preferences, advertising measurement, and
          product improvement.
        </P>
      </LegalSection>

      <LegalSection title="7. Data Retention">
        <P>
          We keep information for as long as needed to operate the platform, comply with legal
          obligations, resolve disputes, prevent fraud, enforce agreements, and maintain business
          records. Copyright and transaction records may be retained after account closure where
          needed for compliance, safety, or dispute purposes.
        </P>
      </LegalSection>

      <LegalSection title="8. Security">
        <P>
          NETWORX uses reasonable administrative, technical, and organizational safeguards designed to
          protect information. No system is completely secure, and users are responsible for
          protecting their account credentials.
        </P>
      </LegalSection>

      <LegalSection title="9. User Choices">
        <Bullets
          items={[
            'Users may update certain account/profile information in the app.',
            'Users may request account deletion or data access by contacting support, subject to legal, safety, and transaction record limitations.',
            'Users may opt out of non-essential marketing emails using available unsubscribe options.',
          ]}
        />
      </LegalSection>

      <LegalSection title="10. Contact">
        <P>
          Privacy questions may be sent to{' '}
          <a className="text-primary hover:underline" href="mailto:legal@networxradio.com">
            legal@networxradio.com
          </a>{' '}
          or{' '}
          <a className="text-primary hover:underline" href="mailto:support@networxradio.com">
            support@networxradio.com
          </a>
          .
        </P>
      </LegalSection>
    </LegalLayout>
  );
}
