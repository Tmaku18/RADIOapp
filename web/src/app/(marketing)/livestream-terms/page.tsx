import { LegalLayout, LegalSection, P, Bullets } from '@/components/legal/LegalLayout';

export const metadata = {
  title: 'Livestream & Events Terms — NETWORX',
  description: 'Terms for NETWORX livestreams, virtual concerts, events, tips, and donations.',
};

export default function LivestreamTermsPage() {
  return (
    <LegalLayout
      title="Livestream & Events Terms"
      effectiveDate="June 14, 2026"
      intro="These Livestream & Events Terms apply to NETWORX livestreams, virtual concerts, listening sessions, launch events, showcases, artist battles, donations, tips, and event pages."
    >
      <LegalSection title="1. Creator Responsibilities">
        <Bullets
          items={[
            'Only perform, stream, upload, display, or play content you own or have permission to use.',
            'Do not livestream copyrighted music, beats, videos, images, or performances without the required rights.',
            'Follow community, safety, and prohibited content rules.',
            'Disclose sponsors, paid promotions, or affiliate relationships where required.',
            'Comply with venue, local, state, federal, and platform rules for in-person events.',
          ]}
        />
      </LegalSection>

      <LegalSection title="2. Donations, Tips, and Event Payments">
        <P>
          Donations, tips, tickets, sponsorships, and paid event features may be subject to platform
          fees, payment processing fees, refunds, chargebacks, payout holds, taxes, and app
          store/payment rules. Unless otherwise stated, tips and donations are voluntary and do not
          guarantee specific services or outcomes.
        </P>
      </LegalSection>

      <LegalSection title="3. Event Changes and Cancellations">
        <P>
          Events, livestreams, performances, and schedules may be changed, canceled, rescheduled, or
          removed for technical, legal, safety, rights, moderation, payment, or business reasons.
          Refund eligibility depends on the event-specific terms and Refund &amp; Chargeback Policy.
        </P>
      </LegalSection>

      <LegalSection title="4. Enforcement">
        <P>
          NETWORX may remove streams, restrict accounts, pause payments, end events, or block users
          for safety, copyright, rights, harassment, fraud, or policy violations.
        </P>
      </LegalSection>
    </LegalLayout>
  );
}
