import { LegalLayout, LegalSection, P, Bullets } from '@/components/legal/LegalLayout';

export const metadata = {
  title: 'Marketplace Payout Policy — NETWORX',
  description: 'How NETWORX calculates and releases seller payouts for sales, services, and other monetized features.',
};

export default function PayoutPolicyPage() {
  return (
    <LegalLayout
      title="Marketplace Payout Policy"
      effectiveDate="June 14, 2026"
      intro="This Marketplace Payout Policy explains how NETWORX may calculate and release seller payouts for music sales, creative services, donations, event payments, or other monetized features. Specific payout tools and schedules may change as NETWORX grows."
    >
      <LegalSection title="1. Net Payout Calculation">
        <P>
          Unless a specific agreement says otherwise, seller payout may equal gross sale amount minus
          platform fees, payment processing fees, taxes, refunds, chargebacks, dispute costs, app
          store fees where applicable, and any other disclosed deductions.
        </P>
      </LegalSection>

      <LegalSection title="2. Payout Eligibility">
        <Bullets
          items={[
            'Seller must have an active NETWORX account in good standing.',
            'Seller must complete any required identity, tax, bank, or payment processor verification.',
            'Seller content must not be subject to an active copyright dispute, fraud review, chargeback, or policy violation hold.',
            'Seller must reach any minimum payout threshold displayed in the platform.',
          ]}
        />
      </LegalSection>

      <LegalSection title="3. Payout Schedule">
        <P>
          Payouts may be manual during beta and may later be automated through Stripe Connect or
          another payment provider. During beta, NETWORX may process payouts on a schedule announced
          inside the dashboard or by written notice.
        </P>
      </LegalSection>

      <LegalSection title="4. Holds and Reserves">
        <P>
          NETWORX may hold, delay, offset, or reserve funds where needed for refunds, chargebacks,
          fraud prevention, copyright disputes, tax/compliance review, account verification, or
          suspected policy violations.
        </P>
      </LegalSection>

      <LegalSection title="5. Taxes">
        <P>
          Sellers are responsible for their own taxes. NETWORX may request tax information, issue tax
          forms when required, or withhold amounts as required by law or payment processors.
        </P>
      </LegalSection>
    </LegalLayout>
  );
}
