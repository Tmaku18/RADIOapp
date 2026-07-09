import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  LegalLayout,
  LegalSection,
  P,
  Bullets,
  LegalContact,
} from '@/components/legal/LegalLayout';
import { FULL_SONG_RADIO_OPT_IN } from '@/lib/legal/full-song-radio-opt-in';

export const metadata = {
  title: `${FULL_SONG_RADIO_OPT_IN.title} — NETWORX`,
  description:
    'Optional addendum for artists who authorize NETWORX to stream their full songs on NETWORX Radio and in DJ programming.',
};

function OptInCheckbox({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 text-muted-foreground">
      ☑ {children}
    </div>
  );
}

export default function FullSongRadioOptInPage() {
  return (
    <LegalLayout
      title={FULL_SONG_RADIO_OPT_IN.title}
      effectiveDate="July 3, 2026"
      intro={
        <>
          This addendum applies when an artist or rights holder submits a song for NETWORX Radio
          rotation or opts in to full-song radio and DJ programming features. It supplements the{' '}
          <Link href="/artist-agreement" className="text-primary hover:underline">
            Artist / Seller Agreement
          </Link>{' '}
          and does not replace your ownership of your music.
        </>
      }
    >
      <LegalSection title="1. What you authorize">
        <P>
          By checking the required confirmation below (or otherwise accepting this addendum in the
          upload flow), you grant NETWORX a non-exclusive license to publicly perform and stream your
          full song on NETWORX Radio as part of non-interactive, live radio-style programming
          operated by NETWORX.
        </P>
        <P>
          This authorization is for platform radio and related promotional programming only. It is
          not a sale, assignment, or transfer of your copyright, master rights, or publishing
          rights.
        </P>
      </LegalSection>

      <LegalSection title="2. Rights you confirm">
        <Bullets
          items={[
            'You own or control the master recording and all rights needed for this radio use.',
            'You own or control composition, lyrics, and publishing rights, or have permission from required rights holders.',
            'Your song does not include uncleared samples, unauthorized remixes, or third-party material you cannot license for this use.',
            'You understand NETWORX may remove or restrict your song from radio or DJ programming for legal, rights, quality, or policy reasons.',
          ]}
        />
      </LegalSection>

      <LegalSection title="3. Required radio opt-in">
        <P>
          Artists must confirm the following statement before submitting a track for NETWORX Radio
          rotation:
        </P>
        <OptInCheckbox>{FULL_SONG_RADIO_OPT_IN.primaryAuthorization}</OptInCheckbox>
      </LegalSection>

      <LegalSection title="4. DJ livestreams and mix stations">
        <P>
          Separate from general NETWORX Radio rotation, you may opt in to allow NETWORX DJs to
          include your song in live DJ streams and DJ mix stations:
        </P>
        <OptInCheckbox>{FULL_SONG_RADIO_OPT_IN.djLivestreams}</OptInCheckbox>
      </LegalSection>

      <LegalSection title="5. Recorded and archived DJ mixes (optional)">
        <P>
          You may optionally allow your song to be included in recorded or archived DJ mixes that
          remain available after a live session ends:
        </P>
        <OptInCheckbox>{FULL_SONG_RADIO_OPT_IN.djArchivedMixes}</OptInCheckbox>
        <P>
          This optional permission does not apply unless you explicitly check the box. You may change
          these preferences later where the product provides controls for your uploaded songs.
        </P>
      </LegalSection>

      <LegalSection title="6. No chart or royalty promise">
        <P>
          This addendum does not promise chart reporting, SoundExchange reporting, performance
          royalties, guaranteed spins, or minimum income. Future reporting or royalty features may
          require separate agreements.
        </P>
      </LegalSection>

      <LegalContact emails={['legal', 'support']} />
    </LegalLayout>
  );
}
