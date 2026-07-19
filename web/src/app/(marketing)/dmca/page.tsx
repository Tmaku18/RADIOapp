import { LegalLayout, LegalSection, P, Bullets } from '@/components/legal/LegalLayout';

export const metadata = {
  title: 'DMCA & Copyright Policy — NETWORX',
  description: 'How NETWORX handles copyright complaints, takedown notices, counter-notices, and repeat infringers.',
};

export default function DmcaPage() {
  return (
    <LegalLayout
      title="DMCA & Copyright Policy"
      effectiveDate="June 14, 2026"
      intro="NETWORX respects the intellectual property rights of artists, producers, songwriters, photographers, designers, and all other creators. Users are expected to upload only content they own, control, or have permission to use."
    >
      <LegalSection title="1. Copyright Ownership Requirements">
        <P>
          Users may not upload content that violates copyright, trademark, publicity, privacy,
          contract, or other legal rights. For music uploads, the uploader must confirm they own or
          have permission to use the master recording, beat/instrumental, lyrics/composition, samples,
          features, artwork, and any names, images, voices, or likenesses.
        </P>
      </LegalSection>

      <LegalSection title="2. DMCA Takedown Notices">
        <P>
          If you believe content on NETWORX infringes your copyright, submit a written DMCA takedown
          notice to our designated copyright agent. Your notice should include:
        </P>
        <Bullets
          items={[
            'Your full legal name and contact information.',
            'A description of the copyrighted work you believe has been infringed.',
            'The URL or specific location of the allegedly infringing content on NETWORX.',
            "A statement that you have a good-faith belief that the use is not authorized by the copyright owner, the owner's agent, or the law.",
            'A statement, made under penalty of perjury, that the information in your notice is accurate and that you are the copyright owner or authorized to act on behalf of the owner.',
            'Your physical or electronic signature.',
          ]}
        />
        <P>
          You can use our{' '}
          <a className="text-primary hover:underline" href="/dmca-takedown-notice">
            DMCA Takedown Notice form
          </a>{' '}
          to make sure your notice is complete.
        </P>
      </LegalSection>

      <LegalSection title="3. Designated Copyright Agent">
        <div className="rounded-lg border border-border bg-card p-4 text-muted-foreground space-y-1">
          <p>DMCA Agent: Copyright Agent</p>
          <p>Company: DISCOVERMERADIO GROUP LLC / NETWORX</p>
          <p>
            Email:{' '}
            <a className="text-primary hover:underline" href="mailto:copyright@networxradio.com">
              copyright@networxradio.com
            </a>
          </p>
          <p>Mailing Address: available on request to the copyright agent.</p>
          <p>
            Website:{' '}
            <a className="text-primary hover:underline" href="https://www.networxradio.com/">
              https://www.networxradio.com/
            </a>
          </p>
        </div>
      </LegalSection>

      <LegalSection title="4. Counter-Notices">
        <P>
          If your content was removed because of a DMCA notice and you believe the removal was a
          mistake or misidentification, you may submit a counter-notice. A counter-notice should
          include:
        </P>
        <Bullets
          items={[
            'Your full legal name and contact information.',
            'Identification of the content removed and where it appeared before removal.',
            'A statement, made under penalty of perjury, that you have a good-faith belief the content was removed or disabled because of mistake or misidentification.',
            'A statement that you consent to the jurisdiction of the federal district court for your judicial district, or if outside the United States, the judicial district where NETWORX is located.',
            'A statement that you will accept service of process from the original complaining party or their agent.',
            'Your physical or electronic signature.',
          ]}
        />
        <P>
          See the{' '}
          <a className="text-primary hover:underline" href="/dmca-counter-notice">
            DMCA Counter-Notice form
          </a>
          .
        </P>
      </LegalSection>

      <LegalSection title="5. Repeat Infringer Policy">
        <P>
          NETWORX may suspend or terminate users who repeatedly upload infringing content or
          repeatedly violate copyright policies. NETWORX may remove content, restrict uploads, pause
          sales, freeze pending payouts, reduce marketplace visibility, suspend accounts, or terminate
          accounts.
        </P>
      </LegalSection>

      <LegalSection title="6. Marketplace Sales and Disputed Content">
        <P>
          If content is subject to a copyright dispute, NETWORX may temporarily pause sales,
          downloads, payouts, promotion, or public access while the matter is reviewed.
        </P>
      </LegalSection>

      <LegalSection title="7. False or Misleading Claims">
        <P>
          Submitting false copyright claims, false counter-notices, or misleading ownership
          information may result in account suspension or termination and may create legal liability
          under applicable law.
        </P>
      </LegalSection>
    </LegalLayout>
  );
}
