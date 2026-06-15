import { LegalLayout, LegalSection, P, Bullets } from '@/components/legal/LegalLayout';

export const metadata = {
  title: 'Terms of Service — NETWORX',
  description: 'The Terms of Service governing your use of NETWORX, the music marketplace, and PRO-NETWORX.',
};

export default function TermsPage() {
  return (
    <LegalLayout title="Terms of Service" effectiveDate="June 14, 2026">
      <LegalSection title="1. Acceptance of Terms">
        <P>
          By accessing or using NETWORX, including the website, mobile app, music marketplace,
          PRO-NETWORX services, social features, livestream features, beta features, or any related
          services, you agree to these Terms of Service (the &ldquo;Terms&rdquo;). If you do not
          agree, do not use NETWORX.
        </P>
      </LegalSection>

      <LegalSection title="2. Platform Overview">
        <P>
          NETWORX is a music discovery marketplace and creative networking platform. Current
          marketplace features may include artist profiles, 30-second music previews, full-track
          purchases, purchased libraries, creative profiles, service listings, social engagement, and
          related discovery tools. PRO-NETWORX is the creative services and networking side of the
          platform.
        </P>
        <P>
          NETWORX is not currently advertising itself as an official chart-reporting service or fully
          licensed public radio broadcaster. Future radio, reporting, and additional monetization
          features may be added under separate terms or policies.
        </P>
      </LegalSection>

      <LegalSection title="3. Accounts and Eligibility">
        <P>
          You must provide accurate account information and keep your login credentials secure. You
          are responsible for activity under your account. NETWORX is intended for users age 13 and
          older. If you are under the age of majority in your jurisdiction, you may use NETWORX only
          with permission from a parent or legal guardian.
        </P>
      </LegalSection>

      <LegalSection title="4. User Content">
        <P>
          Users may upload, post, sell, display, preview, stream, promote, list, message, or
          otherwise submit content such as music, artwork, images, profiles, posts, services,
          livestreams, comments, and listings (&ldquo;User Content&rdquo;). You retain ownership of
          your User Content, but you grant NETWORX the limited rights needed to operate, display,
          host, promote, distribute, preview, sell, deliver, and support your User Content through the
          platform.
        </P>
        <P>
          You are solely responsible for making sure you have the rights needed to upload and use your
          User Content.
        </P>
      </LegalSection>

      <LegalSection title="5. Music Marketplace">
        <P>
          Artists and rights holders may make music available through 30-second previews and
          full-track purchase access. Buyers receive a personal-use license to access purchased tracks
          under the Buyer License Terms. Unless a separate agreement says otherwise, sales on NETWORX
          do not transfer copyright ownership to buyers.
        </P>
        <P>
          NETWORX may remove, restrict, or pause access to any music if a copyright issue, payment
          issue, policy violation, or legal concern arises.
        </P>
      </LegalSection>

      <LegalSection title="6. PRO-NETWORX Services">
        <P>
          PRO-NETWORX allows creative service providers to list, promote, and connect around creative
          services. NETWORX is not a party to every service relationship unless expressly stated.
          Users are responsible for their own agreements, deliverables, communications, taxes, and
          compliance with applicable laws.
        </P>
      </LegalSection>

      <LegalSection title="7. Payments, Fees, Refunds, and Payouts">
        <P>
          Payments may be processed by third-party providers such as Stripe, Apple, Google, or other
          providers depending on the purchase type and platform. NETWORX may charge platform fees,
          service fees, subscription fees, transaction fees, listing fees, or other fees disclosed at
          the time of purchase or listing.
        </P>
        <P>
          Refunds, chargebacks, digital purchases, seller payouts, and payout holds are governed by
          the Refund &amp; Chargeback Policy and Marketplace Payout Policy.
        </P>
      </LegalSection>

      <LegalSection title="8. Prohibited Conduct">
        <Bullets
          items={[
            'Do not upload content you do not own or have permission to use.',
            'Do not sell stolen music, beats, artwork, photos, videos, or services.',
            'Do not harass, threaten, impersonate, defraud, spam, scrape, hack, or abuse other users.',
            'Do not attempt to manipulate rankings, reviews, purchases, discovery metrics, votes, likes, or engagement.',
            'Do not use NETWORX for illegal, unsafe, deceptive, hateful, or exploitative activity.',
          ]}
        />
      </LegalSection>

      <LegalSection title="9. Copyright and Takedowns">
        <P>
          NETWORX follows a copyright complaint process described in the DMCA &amp; Copyright Policy.
          NETWORX may remove content, pause sales, suspend payouts, restrict uploads, or terminate
          accounts when content is alleged to infringe rights or violates platform policy.
        </P>
      </LegalSection>

      <LegalSection title="10. Beta Features and Changes">
        <P>
          NETWORX may release beta, experimental, or early-access features. Beta features may change,
          break, disappear, or be limited at any time. Free beta premium access does not guarantee
          permanent free access or future pricing.
        </P>
      </LegalSection>

      <LegalSection title="11. No Guarantees">
        <P>
          NETWORX does not guarantee fame, income, bookings, sales, streams, followers, placements,
          chart recognition, radio royalties, or specific business outcomes. NETWORX is built to
          create visibility, tools, and opportunity, but users are responsible for their own content,
          business decisions, and legal rights.
        </P>
      </LegalSection>

      <LegalSection title="12. Disclaimers and Limitation of Liability">
        <P>
          NETWORX is provided &ldquo;as is&rdquo; and &ldquo;as available.&rdquo; To the maximum
          extent allowed by law, NETWORX disclaims warranties and is not liable for indirect,
          incidental, consequential, special, punitive, or lost-profit damages.
        </P>
      </LegalSection>

      <LegalSection title="13. Account Suspension or Termination">
        <P>
          NETWORX may suspend, restrict, or terminate accounts that violate these Terms, fail
          verification, trigger fraud concerns, create legal risk, abuse other users, or repeatedly
          infringe rights.
        </P>
      </LegalSection>

      <LegalSection title="14. Governing Law">
        <P>
          These Terms are governed by the laws of the State of Georgia, unless applicable law requires
          otherwise.
        </P>
      </LegalSection>

      <LegalSection title="15. Contact">
        <P>
          Questions about these Terms may be sent to{' '}
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
