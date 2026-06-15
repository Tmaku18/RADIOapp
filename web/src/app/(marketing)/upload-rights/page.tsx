import { LegalLayout, LegalSection, P, Bullets } from '@/components/legal/LegalLayout';

export const metadata = {
  title: 'Music Upload Rights Confirmation — NETWORX',
  description: 'The rights you confirm before uploading music to the NETWORX marketplace.',
};

export default function UploadRightsPage() {
  return (
    <LegalLayout
      title="Music Upload Rights Confirmation"
      effectiveDate="June 14, 2026"
      intro="Before uploading music to NETWORX, the artist/uploader must confirm the statements below. These statements appear as checkboxes in the upload flow."
    >
      <LegalSection title="Rights you confirm">
        <Bullets
          items={[
            'I own or control the master recording I am uploading.',
            'I own or control the composition, lyrics, melody, and publishing rights, or I have permission from all required rights holders.',
            'I have permission from all producers, beatmakers, featured artists, songwriters, and collaborators.',
            'This song does not contain uncleared samples, unauthorized remixes, stolen beats, or copyrighted material I do not have permission to use.',
            'I have the right to allow NETWORX to host, display, promote, preview, sell, deliver, and make this song available to buyers.',
            'I understand that buyers receive personal-use access only and do not own the copyright to my song.',
            'I am responsible for paying any collaborators, producers, writers, publishers, or rights holders connected to this song.',
            'I understand NETWORX may remove, restrict, or pause sales/payouts for this song if there is a copyright dispute.',
            "I agree not to upload music that violates another person's rights.",
            'I understand repeated copyright violations may result in account suspension or termination.',
          ]}
        />
      </LegalSection>

      <LegalSection title="Required confirmation">
        <div className="rounded-lg border border-border bg-card p-4 text-muted-foreground">
          ☑ I confirm that I have the legal rights needed to upload and sell this music on NETWORX.
        </div>
      </LegalSection>
    </LegalLayout>
  );
}
