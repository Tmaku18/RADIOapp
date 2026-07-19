import { LegalLayout, LegalSection, P, Bullets } from '@/components/legal/LegalLayout';

export const metadata = {
  title: 'Prohibited Content Policy — NETWORX',
  description: 'Content and services that are not allowed on NETWORX or PRO-NETWORX.',
};

export default function ProhibitedContentPage() {
  return (
    <LegalLayout
      title="Prohibited Content Policy"
      effectiveDate="June 14, 2026"
      intro="This policy explains content and services that are not allowed on NETWORX or PRO-NETWORX. It applies to music, profiles, posts, services, livestreams, messages, portfolios, artwork, links, and listings."
    >
      <LegalSection title="1. Intellectual Property Violations">
        <Bullets
          items={[
            'Stolen songs, beats, samples, instrumentals, artwork, photos, videos, or logos.',
            'Unauthorized remixes, mashups, covers, or sampled works without required rights.',
            "Content that uses another person's name, image, voice, brand, or likeness without permission.",
            'Counterfeit goods, fake licensing claims, fake credits, or impersonation.',
          ]}
        />
      </LegalSection>

      <LegalSection title="2. Harmful or Illegal Content">
        <Bullets
          items={[
            'Content promoting violence, terrorism, criminal activity, or exploitation.',
            'Hate speech or harassment targeting protected groups.',
            'Non-consensual sexual content or sexual content involving minors.',
            'Threats, doxxing, extortion, blackmail, or stalking.',
            'Fraud, scams, phishing, malware, spyware, or credential theft.',
            'Illegal weapons, illegal drugs, stolen goods, or regulated services not permitted by platform policy.',
          ]}
        />
      </LegalSection>

      <LegalSection title="3. Marketplace and Services Restrictions">
        <Bullets
          items={[
            'False service listings or fake portfolios.',
            'Services that require professional licenses unless the provider has the required license and discloses it.',
            'Services involving illegal activity, impersonation, academic cheating, fake documents, fake engagement, or platform manipulation.',
            'Adult sexual services or explicit in-person services.',
            'Any service NETWORX determines creates safety, legal, payment, or reputational risk.',
          ]}
        />
      </LegalSection>

      <LegalSection title="4. Enforcement">
        <P>
          NETWORX may remove content, suspend accounts, pause payments, report suspected illegal
          activity, or take any action needed to protect users, rights holders, and the platform.
        </P>
      </LegalSection>
    </LegalLayout>
  );
}
