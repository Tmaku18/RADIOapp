import { LegalLayout, LegalSection, P, Bullets } from '@/components/legal/LegalLayout';

export const metadata = {
  title: 'Content Report Form — NETWORX',
  description: 'Report content or behavior that may violate NETWORX policies.',
};

export default function ContentReportPage() {
  return (
    <LegalLayout
      title="Content Report"
      effectiveDate="June 14, 2026"
      intro="Use this form to report content or behavior that may violate NETWORX policies. This form is not a substitute for a formal DMCA notice if you are making a copyright claim."
    >
      <LegalSection title="Information to include">
        <Bullets
          items={[
            'Your name',
            'Your email',
            'Type of report (copyright concern, harassment, fraud, prohibited content, impersonation, safety, or other)',
            'Content URL or profile link',
            'User or artist name',
            'A description of the issue',
            'Whether you have screenshots or other evidence attached',
            'The action you are requesting',
            'The date',
          ]}
        />
      </LegalSection>

      <LegalSection title="Where to send it">
        <P>
          General reports:{' '}
          <a className="text-primary hover:underline" href="mailto:support@networxradio.com">
            support@networxradio.com
          </a>
        </P>
        <P>
          Copyright-specific complaints:{' '}
          <a className="text-primary hover:underline" href="mailto:copyright@networxradio.com">
            copyright@networxradio.com
          </a>{' '}
          (see the{' '}
          <a className="text-primary hover:underline" href="/dmca-takedown-notice">
            DMCA Takedown Notice
          </a>
          ).
        </P>
      </LegalSection>
    </LegalLayout>
  );
}
