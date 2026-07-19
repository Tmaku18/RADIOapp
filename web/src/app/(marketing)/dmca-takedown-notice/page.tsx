import { LegalLayout, LegalSection, P, Bullets } from '@/components/legal/LegalLayout';

export const metadata = {
  title: 'DMCA Takedown Notice — NETWORX',
  description: 'Submit a DMCA takedown notice to the NETWORX designated copyright agent.',
};

export default function DmcaTakedownNoticePage() {
  return (
    <LegalLayout
      title="DMCA Takedown Notice"
      effectiveDate="June 14, 2026"
      intro="Use this form to submit a DMCA takedown notice to NETWORX. Include all of the information below and send it to the designated copyright agent."
    >
      <LegalSection title="Information to include">
        <Bullets
          items={[
            'Full legal name',
            'Company / organization (if any)',
            'Email address',
            'Phone number',
            'Mailing address',
            'The copyrighted work you are claiming',
            'The NETWORX URL or specific location of the allegedly infringing content',
            'The song/content title and the artist/uploader',
            'A description of the infringement',
          ]}
        />
      </LegalSection>

      <LegalSection title="Required statements">
        <Bullets
          items={[
            'Good-faith statement: “I have a good-faith belief that the use of the material is not authorized by the copyright owner, the copyright owner’s agent, or the law.”',
            'Accuracy and authority statement: “I state under penalty of perjury that the information in this notice is accurate and that I am the copyright owner or authorized to act on behalf of the owner.”',
            'Your physical or electronic signature and the date.',
          ]}
        />
      </LegalSection>

      <LegalSection title="Where to send it">
        <P>
          Email:{' '}
          <a className="text-primary hover:underline" href="mailto:copyright@networxradio.com">
            copyright@networxradio.com
          </a>
        </P>
        <P>
          You may also mail a notice to the designated copyright agent for DISCOVERMERADIO GROUP LLC /
          NETWORX. See the{' '}
          <a className="text-primary hover:underline" href="/dmca">
            DMCA &amp; Copyright Policy
          </a>{' '}
          for the designated agent details.
        </P>
      </LegalSection>

      <LegalSection title="A note on false claims">
        <P>
          Submitting false copyright claims or misleading ownership information may result in account
          action and may create legal liability under applicable law.
        </P>
      </LegalSection>
    </LegalLayout>
  );
}
