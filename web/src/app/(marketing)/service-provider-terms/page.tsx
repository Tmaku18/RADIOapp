import { LegalLayout, LegalSection, P, Bullets } from '@/components/legal/LegalLayout';

export const metadata = {
  title: 'PRO-NETWORX Service Provider Terms — NETWORX',
  description: 'Terms for creatives, freelancers, vendors, mentors, and service providers on PRO-NETWORX.',
};

export default function ServiceProviderTermsPage() {
  return (
    <LegalLayout
      title="PRO-NETWORX Service Provider Terms"
      effectiveDate="June 14, 2026"
      intro="These PRO-NETWORX Service Provider Terms apply to creatives, freelancers, vendors, mentors, and service providers who list or promote services on PRO-NETWORX."
    >
      <LegalSection title="1. Provider Responsibilities">
        <Bullets
          items={[
            'Provide truthful profile, pricing, portfolio, availability, and service information.',
            'Only display work you created or have permission to use.',
            'Clearly describe deliverables, timelines, revisions, usage rights, deposit requirements, and cancellation terms.',
            'Maintain professional communication and complete paid work in good faith.',
            'Comply with taxes, licenses, permits, contracts, and applicable laws.',
          ]}
        />
      </LegalSection>

      <LegalSection title="2. Relationship Between Users">
        <P>
          Unless NETWORX expressly states otherwise, service providers are independent sellers and not
          employees, agents, partners, or representatives of NETWORX. NETWORX does not guarantee
          bookings, income, service quality, or user outcomes.
        </P>
      </LegalSection>

      <LegalSection title="3. Payments and Disputes">
        <P>
          Payments may be processed on-platform or arranged off-platform depending on available
          features. Providers are responsible for honoring the disclosed terms of their services.
          NETWORX may assist with disputes but is not required to resolve every disagreement between
          users.
        </P>
      </LegalSection>

      <LegalSection title="4. Prohibited Services">
        <P>
          Providers may not offer illegal, unsafe, fraudulent, exploitative, adult sexual,
          counterfeit, rights-infringing, or policy-violating services. NETWORX may remove listings or
          accounts that create legal, safety, payment, or reputational risk.
        </P>
      </LegalSection>

      <LegalSection title="5. Content and Portfolio License">
        <P>
          Provider grants NETWORX a limited license to display, host, promote, and share profile
          content, listings, portfolio items, images, videos, and descriptions for the purpose of
          operating and promoting PRO-NETWORX.
        </P>
      </LegalSection>
    </LegalLayout>
  );
}
