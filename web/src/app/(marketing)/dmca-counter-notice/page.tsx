import { LegalLayout, LegalSection, P, Bullets } from '@/components/legal/LegalLayout';

export const metadata = {
  title: 'DMCA Counter-Notice — NETWORX',
  description: 'Submit a DMCA counter-notice if your content was removed by mistake or misidentification.',
};

export default function DmcaCounterNoticePage() {
  return (
    <LegalLayout
      title="DMCA Counter-Notice"
      effectiveDate="June 14, 2026"
      intro="Use this form if your content was removed because of a DMCA notice and you believe the removal was a mistake or misidentification."
    >
      <LegalSection title="Information to include">
        <Bullets
          items={[
            'Full legal name',
            'Email address',
            'Phone number',
            'Mailing address',
            'Removed content title / ID',
            'Original location of the content on NETWORX',
            'An explanation of the mistake or misidentification',
          ]}
        />
      </LegalSection>

      <LegalSection title="Required statements">
        <Bullets
          items={[
            'Good-faith statement: “I state under penalty of perjury that I have a good-faith belief the content was removed or disabled because of mistake or misidentification.”',
            'Jurisdiction statement: “I consent to the jurisdiction of the federal district court for my judicial district, or if outside the United States, the judicial district where NETWORX is located.”',
            'Service of process statement: “I will accept service of process from the person who submitted the original DMCA notice or their agent.”',
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
          See the{' '}
          <a className="text-primary hover:underline" href="/dmca">
            DMCA &amp; Copyright Policy
          </a>{' '}
          for the designated copyright agent and mailing details.
        </P>
      </LegalSection>
    </LegalLayout>
  );
}
