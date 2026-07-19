import { LegalLayout, LegalSection, P, Bullets } from '@/components/legal/LegalLayout';

export const metadata = {
  title: 'Community Guidelines — NETWORX',
  description: 'The behavior we expect from artists, listeners, service providers, and fans on NETWORX.',
};

export default function CommunityGuidelinesPage() {
  return (
    <LegalLayout
      title="Community Guidelines"
      effectiveDate="June 14, 2026"
      intro="NETWORX exists to help hidden talent get seen, supported, and paid. The community should be creative, respectful, ambitious, and safe for artists, listeners, service providers, and fans."
    >
      <LegalSection title="1. Expected Behavior">
        <Bullets
          items={[
            'Respect artists, fans, creators, buyers, and service providers.',
            'Give honest feedback without harassment or abuse.',
            'Only post content and services you have rights to share.',
            'Be clear and truthful in profiles, listings, prices, and service descriptions.',
            'Honor service agreements, deadlines, payment obligations, and communication commitments.',
            'Report copyright, safety, fraud, or abuse concerns through the proper tools.',
          ]}
        />
      </LegalSection>

      <LegalSection title="2. Prohibited Behavior">
        <Bullets
          items={[
            'Harassment, threats, intimidation, stalking, bullying, or targeted abuse.',
            'Hate speech, dehumanizing language, or attacks based on protected characteristics.',
            'Sexual exploitation, coercion, non-consensual intimate content, or content involving minors.',
            'Fraud, scams, impersonation, fake engagement, fake reviews, or payment abuse.',
            'Uploading stolen songs, beats, samples, artwork, photos, videos, or services.',
            'Spam, bots, scraping, platform manipulation, or unauthorized automation.',
            'Posting private information without permission.',
            'Violating the Prohibited Content Policy or Terms of Service.',
          ]}
        />
      </LegalSection>

      <LegalSection title="3. Enforcement">
        <P>
          NETWORX may remove content, issue warnings, reduce visibility, restrict features, pause
          sales, pause payouts, suspend accounts, terminate accounts, or contact authorities where
          appropriate.
        </P>
      </LegalSection>
    </LegalLayout>
  );
}
