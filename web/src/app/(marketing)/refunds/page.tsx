import { LegalLayout, LegalSection, P } from '@/components/legal/LegalLayout';

export const metadata = {
  title: 'Refund & Chargeback Policy — NETWORX',
  description: 'How refunds, chargebacks, and payout impacts work for purchases on NETWORX.',
};

export default function RefundsPage() {
  return (
    <LegalLayout
      title="Refund & Chargeback Policy"
      effectiveDate="June 14, 2026"
      intro="This Refund & Chargeback Policy applies to purchases, digital music sales, services, subscriptions, listing fees, event payments, and other payments on NETWORX, unless a different policy is displayed at checkout."
    >
      <LegalSection title="1. Digital Music Purchases">
        <P>
          Digital music purchases are generally final once the buyer receives access to the full
          track, download, or purchased library item. NETWORX may issue refunds case-by-case for
          duplicate payments, technical inability to access purchased content, accidental duplicate
          purchases, confirmed unauthorized charges, or content removed before delivery.
        </P>
      </LegalSection>

      <LegalSection title="2. Services and PRO-NETWORX Purchases">
        <P>
          For services purchased from or through PRO-NETWORX, refunds depend on the service agreement,
          provider policy, work performed, and whether NETWORX processed the payment. NETWORX may help
          facilitate disputes but does not guarantee refunds for third-party services unless expressly
          stated.
        </P>
      </LegalSection>

      <LegalSection title="3. Chargebacks">
        <P>
          If a buyer disputes a charge with their payment provider, NETWORX may restrict account
          access, reverse purchases, pause seller payouts, collect evidence, and offset chargeback
          costs against seller balances where allowed. Repeated chargeback abuse may result in account
          suspension.
        </P>
      </LegalSection>

      <LegalSection title="4. Refund Request Process">
        <P>
          Email support with your account email, order ID, purchase date, content title, and reason
          for the request. NETWORX may ask for screenshots or additional information.
        </P>
      </LegalSection>

      <LegalSection title="5. Payout Impact">
        <P>
          Refunds, reversals, disputes, chargebacks, taxes, processor fees, and fraud concerns may
          reduce seller payout amounts or delay payouts.
        </P>
      </LegalSection>

      <LegalSection title="6. Contact">
        <P>
          Refund requests may be sent to{' '}
          <a className="text-primary hover:underline" href="mailto:support@networxradio.com">
            support@networxradio.com
          </a>
          .
        </P>
      </LegalSection>
    </LegalLayout>
  );
}
