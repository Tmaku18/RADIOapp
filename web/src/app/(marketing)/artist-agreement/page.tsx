import { LegalLayout, LegalSection, P, Bullets, LegalContact } from '@/components/legal/LegalLayout';

export const metadata = {
  title: 'Artist / Seller Agreement — NETWORX',
  description: 'Terms that apply when artists, rights holders, and sellers upload music and content to the NETWORX marketplace.',
};

export default function ArtistSellerAgreementPage() {
  return (
    <LegalLayout
      title="Artist / Seller Agreement"
      effectiveDate="June 14, 2026"
      intro="This Artist/Seller Agreement applies when an artist, rights holder, producer, creator, or seller uploads music, artwork, content, or related materials to NETWORX for preview, promotion, sale, delivery, or marketplace access. The agreement is between the uploading seller (the “Artist” or “Seller”) and DISCOVERMERADIO GROUP LLC / NETWORX."
    >
      <LegalSection title="1. Seller Eligibility">
        <P>
          Seller must have the legal authority to upload, license, preview, sell, and deliver the
          submitted content. Seller must provide truthful account, payment, tax, and contact
          information when requested.
        </P>
      </LegalSection>

      <LegalSection title="2. Rights Granted to NETWORX">
        <P>
          Seller grants NETWORX a non-exclusive, worldwide, royalty-free license during the time the
          content is listed on NETWORX to host, store, reproduce, display, publicly show, create
          30-second previews, stream previews, promote, market, sell, deliver downloads or purchased
          playback, display metadata/artwork, and otherwise operate the content on the NETWORX
          platform.
        </P>
        <P>
          This license does not transfer ownership of Seller content to NETWORX. Seller keeps
          ownership of Seller content unless a separate written agreement says otherwise.
        </P>
      </LegalSection>

      <LegalSection title="3. Marketplace Sales">
        <P>
          Seller may set or approve pricing where available. NETWORX may deduct disclosed platform
          fees, payment processing fees, refunds, chargebacks, taxes, and other authorized deductions
          before calculating Seller payout. Buyers receive only personal-use rights under the Buyer
          License Terms.
        </P>
      </LegalSection>

      <LegalSection title="4. Seller Warranties">
        <Bullets
          items={[
            'Seller owns or controls the master recording.',
            'Seller owns or controls the composition, lyrics, melody, and publishing rights, or has permission from all required rights holders.',
            'Seller has permission from all producers, beatmakers, featured artists, songwriters, collaborators, photographers, designers, and any other contributors.',
            'Seller has cleared all samples, loops, beats, remixes, cover song rights, artwork, names, likenesses, voices, and other third-party materials.',
            'Seller has the right to authorize NETWORX to preview, promote, sell, deliver, and support purchased access to the content.',
            'Seller content does not violate copyright, trademark, publicity, privacy, contract, or other rights.',
            'Seller will pay any collaborators, rights holders, producers, publishers, or tax obligations owed in connection with Seller content.',
          ]}
        />
      </LegalSection>

      <LegalSection title="5. No Radio or Chart Promise">
        <P>
          This marketplace agreement is for NETWORX marketplace activity unless a separate written
          addendum applies. NETWORX does not promise radio royalties, official chart reporting,
          Billboard/Luminate reporting, SoundExchange reporting, major-label discovery, or guaranteed
          income. Future radio/reporting features may require separate licensing, policies, and
          agreements.
        </P>
      </LegalSection>

      <LegalSection title="6. Content Review and Removal">
        <P>
          NETWORX may approve, reject, hide, remove, demonetize, restrict, or pause content at any
          time for legal, safety, quality, copyright, fraud, payment, or policy reasons. NETWORX may
          pause sales and payouts for disputed content.
        </P>
      </LegalSection>

      <LegalSection title="7. Refunds, Chargebacks, and Payout Holds">
        <P>
          Seller understands that refunds, chargebacks, disputes, fraud flags, copyright claims,
          payment processor actions, or legal concerns may reduce or delay payouts. NETWORX may hold
          funds linked to disputed content until the issue is resolved.
        </P>
      </LegalSection>

      <LegalSection title="8. Account Termination">
        <P>
          Seller may remove content or close their account subject to pending transaction, legal,
          dispute, and payout obligations. NETWORX may retain records needed for compliance, dispute
          resolution, accounting, and safety.
        </P>
      </LegalSection>

      <LegalContact emails={['support']} />
    </LegalLayout>
  );
}
