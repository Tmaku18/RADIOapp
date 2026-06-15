import { LegalLayout, LegalSection, P, Bullets } from '@/components/legal/LegalLayout';

export const metadata = {
  title: 'Buyer License Terms — NETWORX',
  description: 'What you receive when you purchase music or digital content on NETWORX.',
};

export default function BuyerLicensePage() {
  return (
    <LegalLayout
      title="Buyer License Terms"
      effectiveDate="June 14, 2026"
      intro="These Buyer License Terms explain what a user receives when buying music or digital content on NETWORX."
    >
      <LegalSection title="1. Personal-Use License">
        <P>
          When a buyer purchases a track, album, download, or other digital music item on NETWORX,
          the buyer receives a limited, personal, non-exclusive, non-transferable, non-commercial
          license to access the purchased item through NETWORX, and to download it if downloads are
          enabled for that item.
        </P>
      </LegalSection>

      <LegalSection title="2. What Buyers May Do">
        <Bullets
          items={[
            'Listen to purchased music for personal use.',
            'Access purchased music in My Library where available.',
            'Download the purchased file for personal use if downloads are enabled.',
            'Use the purchase to support the artist directly through NETWORX.',
          ]}
        />
      </LegalSection>

      <LegalSection title="3. What Buyers May Not Do">
        <Bullets
          items={[
            'Resell, redistribute, upload, share, publish, or commercially exploit the track.',
            'Use the music in a video, advertisement, livestream, podcast, performance, beat pack, remix, sample, or other project without separate permission.',
            'Claim ownership or copyright in the music.',
            'Remove artist credits, metadata, watermarks, or rights notices.',
            'Use bots, fraud, chargeback abuse, or unauthorized payment methods.',
          ]}
        />
      </LegalSection>

      <LegalSection title="4. Access Changes">
        <P>
          NETWORX may remove or limit access to purchased content if required by law, copyright
          dispute, payment reversal, chargeback, fraud issue, policy violation, or rights holder
          request. If content becomes unavailable, refund eligibility is governed by the Refund &amp;
          Chargeback Policy.
        </P>
      </LegalSection>

      <LegalSection title="5. No Copyright Transfer">
        <P>
          Purchasing music on NETWORX does not transfer copyright ownership. All rights not expressly
          granted remain with the artist, rights holder, or other owner.
        </P>
      </LegalSection>
    </LegalLayout>
  );
}
