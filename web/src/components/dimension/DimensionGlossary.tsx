'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Reveal } from '@/components/dimension';

const GLOSSARY: Array<{
  system: string;
  tagline: string;
  terms: Array<{ term: string; definition: string }>;
}> = [
  {
    system: 'The Butterfly Effect',
    tagline: 'One small ripple can become a storm.',
    terms: [
      {
        term: 'The Butterfly Effect',
        definition:
          'Our core belief: a single vote or discovery can set off the chain reaction that launches an artist\u2019s career.',
      },
      {
        term: 'Ripples',
        definition:
          'The audience\u2019s votes and likes. Every ripple carries an artist\u2019s sound a little further across the network.',
      },
      {
        term: 'The Wake',
        definition:
          'An artist\u2019s analytics report — the path left behind by a thousand Ripples, showing reach, engagement, and growth.',
      },
    ],
  },
  {
    system: 'Metamorphosis',
    tagline: 'The journey from unseen talent to recognized artist.',
    terms: [
      {
        term: 'Metamorphosis',
        definition:
          'The transformation every artist undergoes on Networx — from an unknown upload to a name the people know.',
      },
      {
        term: 'Gem',
        definition: 'An artist. A hidden gem, ready to be heard and refined by the community.',
      },
      {
        term: 'Diamond',
        definition:
          'A Gem refined under pressure — a standout artist the community has voted into the spotlight.',
      },
      {
        term: 'Catalyst',
        definition:
          'A creative service provider (producer, photographer, mentor) who speeds up the metamorphosis through ProNetworx.',
      },
    ],
  },
  {
    system: 'Mining',
    tagline: 'Surfacing value from the live frequency.',
    terms: [
      {
        term: 'Mining the Frequency',
        definition:
          'How value is surfaced from the always-on stream — the people dig through the radio to find what shines.',
      },
      {
        term: 'Prospectors',
        definition:
          'The listeners. They tune in, send Ripples, and refine raw songs into signal the market can trust.',
      },
      {
        term: 'The Refinery',
        definition:
          'The portal where Prospectors rank, survey, and comment to refine songs before they break out.',
      },
      {
        term: 'The Yield',
        definition:
          'A Prospector\u2019s rewards — steady earnings from verified engagement like refinement, surveys, and feedback.',
      },
      {
        term: 'Listens',
        definition:
          'People who heard a song — counted once per song per person. Three songs from the same account equals three Listens.',
      },
      {
        term: 'Ears Reached',
        definition:
          'Unique listeners across the network — each account or device counts once, no matter how many songs they heard.',
      },
    ],
  },
];

export function DimensionGlossarySection() {
  return (
    <section className="relative z-10 max-w-7xl mx-auto px-6 lg:px-10 py-24">
      <Reveal>
        <div className="text-center mb-14">
          <div className="font-dim-mono text-[10px] tracking-[0.3em] text-yellow-300 mb-3">
            ◤ SECTION 04 — THE LEXICON
          </div>
          <h2 className="font-unbounded font-black tracking-tighter uppercase text-4xl md:text-6xl text-white">
            The language of <br />
            <span className="text-glow-cyan text-cyan-300">Networx</span>
          </h2>
          <p className="text-white/60 mt-4 max-w-2xl mx-auto">
            Our world runs on three ideas: the <b className="text-white">Butterfly Effect</b>, the
            artist&apos;s <b className="text-white">Metamorphosis</b>, and the{' '}
            <b className="text-white">Mining</b> of hidden talent.
          </p>
        </div>
      </Reveal>

      <div className="space-y-12">
        {GLOSSARY.map((group, gi) => (
          <div key={group.system}>
            <Reveal delay={gi * 0.1}>
              <div className="mb-6 text-center sm:text-left">
                <h3 className="font-unbounded font-bold text-2xl text-white">{group.system}</h3>
                <p className="text-white/60 mt-1">{group.tagline}</p>
              </div>
            </Reveal>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {group.terms.map((t, ti) => (
                <Reveal key={t.term} delay={gi * 0.1 + ti * 0.05}>
                  <div className="glass rounded-xl p-6 h-full tracing-border">
                    <div className="font-unbounded font-bold text-cyan-300">{t.term}</div>
                    <p className="text-white/60 mt-2 leading-relaxed text-sm">{t.definition}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Reveal delay={0.3}>
        <div className="mt-14 mb-8 text-center relative z-20">
          <Link
            href="/about"
            scroll
            className="inline-flex h-11 items-center justify-center px-6 rounded-full bg-cyan-400 text-black font-dim-mono text-xs tracking-wider uppercase font-bold glow-cyan hover:bg-white transition-colors"
          >
            Read our full story
          </Link>
        </div>
      </Reveal>
    </section>
  );
}

export function DimensionFinalCta() {
  return (
    <section className="relative z-10 py-20 border-t border-white/5">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 text-center">
        <Reveal>
          <h2 className="font-unbounded font-black text-3xl text-white mb-4">Ready to get started?</h2>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
            <Button
              size="lg"
              className="bg-cyan-400 text-black font-dim-mono tracking-wider uppercase glow-cyan hover:bg-white"
              asChild
            >
              <Link href="/signup">Get Started Free</Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-white/20 text-white hover:border-pink-400 hover:text-pink-400 font-dim-mono tracking-wider uppercase"
              asChild
            >
              <Link href="/pro-networx">Explore ProNetworx</Link>
            </Button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
