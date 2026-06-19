'use client';

import Link from 'next/link';
import { useRef, useEffect, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Reveal } from './Reveal';

const MetamorphosisScene = dynamic(
  () => import('./MetamorphosisScene').then((m) => m.MetamorphosisScene),
  { ssr: false },
);

const STAGES = [
  {
    label: 'GEM',
    title: 'A hidden gem',
    body: 'Every signal starts unheard. A bedroom recording, a freestyle in a friend\'s basement, a beat looped at 3am. Networx pulls it onto the frequency.',
    colorClass: 'text-yellow-300',
  },
  {
    label: 'RIPPLE',
    title: 'Caught in a ripple',
    body: 'Prospectors hit play. Votes start flowing. Heat rises. The sound is encased — refined under pressure inside the community\'s cocoon.',
    colorClass: 'text-pink-400',
  },
  {
    label: 'WINGS',
    title: 'The wings unfold',
    body: 'The artist breaks out. The wake widens. Reach, engagement, growth — the analytics trail of a thousand Ripples carries the sound further.',
    colorClass: 'text-cyan-300',
  },
  {
    label: 'DIAMOND',
    title: 'Crystallized.',
    body: 'A Gem refined under pressure becomes a Diamond — a name the people know. No payola. No algorithm. Just transparent heat and the Butterfly Effect.',
    colorClass: 'text-yellow-300',
  },
];

export function MetamorphosisAbout() {
  const storyRef = useRef<HTMLElement>(null);
  const progressRef = useRef(0);

  const { scrollYProgress } = useScroll({
    target: storyRef,
    offset: ['start start', 'end end'],
  });

  useEffect(() => {
    const unsub = scrollYProgress.on('change', (v) => {
      progressRef.current = v;
    });
    return () => unsub();
  }, [scrollYProgress]);

  const op0 = useTransform(scrollYProgress, [0.0, 0.05, 0.2, 0.27], [1, 1, 1, 0]);
  const op1 = useTransform(scrollYProgress, [0.22, 0.32, 0.45, 0.52], [0, 1, 1, 0]);
  const op2 = useTransform(scrollYProgress, [0.47, 0.57, 0.7, 0.77], [0, 1, 1, 0]);
  const op3 = useTransform(scrollYProgress, [0.72, 0.82, 0.95, 1.0], [0, 1, 1, 1]);
  const panelOpacities = [op0, op1, op2, op3];

  const y0 = useTransform(scrollYProgress, [0, 0.125, 0.25], [40, 0, -40]);
  const y1 = useTransform(scrollYProgress, [0.18, 0.375, 0.55], [40, 0, -40]);
  const y2 = useTransform(scrollYProgress, [0.45, 0.625, 0.82], [40, 0, -40]);
  const y3 = useTransform(scrollYProgress, [0.72, 0.875, 1.0], [40, 0, -40]);
  const panelYs = [y0, y1, y2, y3];

  const railWidth = useTransform(scrollYProgress, (v) => `${v * 100}%`);

  return (
    <div className="relative" data-testid="about-page">
      <section className="relative pt-16 pb-12">
        <div className="max-w-5xl mx-auto px-6 lg:px-10">
          <Reveal>
            <div className="font-dim-mono text-[10px] tracking-[0.3em] text-cyan-300 mb-3">
              ◤ THE LORE
            </div>
          </Reveal>
          <h1 className="font-unbounded font-black tracking-tighter uppercase text-5xl md:text-8xl leading-[0.9] text-white">
            <Reveal as="span" className="block">
              The{' '}
              <span className="glitch text-glow-cyan" data-text="Butterfly">
                Butterfly
              </span>
            </Reveal>
            <Reveal as="span" delay={0.2} className="block">
              <span className="text-glow-pink text-pink-400">Effect.</span>
            </Reveal>
          </h1>
          <Reveal delay={0.45}>
            <p className="mt-8 max-w-2xl text-white/70 text-lg leading-relaxed">
              Scroll. Watch a Gem become a Diamond — the same arc every artist on Networx walks.
              This is Metamorphosis, in four beats.
            </p>
          </Reveal>
          <Reveal delay={0.6}>
            <div className="mt-6 inline-flex items-center gap-2 font-dim-mono text-[10px] tracking-[0.3em] text-cyan-300">
              <span className="w-6 h-px bg-cyan-400" />
              SCROLL ▾ TO TRANSFORM
              <span className="w-6 h-px bg-cyan-400" />
            </div>
          </Reveal>
        </div>
      </section>

      <section ref={storyRef} className="relative h-[400vh]" data-testid="metamorphosis-story">
        <div className="sticky top-0 h-screen w-full overflow-hidden">
          <div className="absolute inset-0">
            <Suspense fallback={<div className="absolute inset-0 bg-black" />}>
              <MetamorphosisScene progressRef={progressRef} />
            </Suspense>
            <div className="absolute inset-0 cyber-grid opacity-20 pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/50 pointer-events-none" />
          </div>

          <div className="relative z-10 h-full max-w-6xl mx-auto px-6 lg:px-10 grid lg:grid-cols-2 items-center">
            <div className="hidden lg:block" />
            <div className="relative h-72 md:h-96">
              {STAGES.map((s, i) => (
                <motion.div
                  key={s.label}
                  data-testid={`stage-panel-${i}`}
                  style={{ opacity: panelOpacities[i], y: panelYs[i] }}
                  className="absolute inset-0 flex flex-col justify-center"
                >
                  <div className={`font-dim-mono text-[10px] tracking-[0.4em] ${s.colorClass} mb-3`}>
                    STAGE 0{i + 1} / {s.label}
                  </div>
                  <h2 className="font-unbounded font-black tracking-tighter uppercase text-4xl md:text-6xl leading-[0.95] text-white">
                    {s.title}
                  </h2>
                  <p className="mt-5 text-white/70 text-base md:text-lg leading-relaxed max-w-md">
                    {s.body}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-[80vw] max-w-3xl">
            <div className="flex items-center justify-between mb-2">
              {STAGES.map((s) => (
                <span
                  key={s.label}
                  className="font-dim-mono text-[9px] tracking-[0.25em] text-white/50"
                >
                  {s.label}
                </span>
              ))}
            </div>
            <div className="h-px bg-white/10 relative overflow-hidden">
              <motion.div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyan-400 to-pink-500"
                style={{ width: railWidth }}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 max-w-4xl mx-auto px-6 lg:px-10 py-24">
        <Reveal>
          <h2 className="font-unbounded font-black text-3xl text-white mb-4">Our Mission</h2>
          <p className="text-white/70 mb-6 leading-relaxed">
            To maximize the frequency of &quot;Butterfly Effects&quot; by democratizing discovery. We
            exist to ensure that no hidden gem goes undiscovered and that talent is never sacrificed
            at the altar of lack of opportunity.
          </p>
        </Reveal>
        <Reveal delay={0.1}>
          <h2 className="font-unbounded font-black text-3xl text-white mt-12 mb-4">
            Our Story: The 4 AM Catalyst
          </h2>
          <p className="text-white/70 mb-4 leading-relaxed">
            Most tech companies start in a Silicon Valley garage. Networx started at a gas station at
            4 AM — where Tanaka and Merquise first crossed paths, a butterfly effect in its purest
            form.
          </p>
          <p className="text-white/70 mb-6 leading-relaxed">
            We built Networx to make those 4 AM moments happen for everyone: always-on radio,
            livestreams, ripples, transparent analytics, and ProNetworx mentorship.
          </p>
        </Reveal>
        <Reveal delay={0.2}>
          <div className="glass rounded-2xl p-8 tracing-border mt-12">
            <h3 className="font-unbounded font-bold text-xl text-white mb-4">Join the movement</h3>
            <p className="text-white/60 mb-6">
              Networx is for artists ready to grow and supporters who want talent discovered fairly.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button
                asChild
                className="bg-cyan-400 text-black font-dim-mono tracking-wider uppercase glow-cyan hover:bg-white"
              >
                <Link href="/signup">Create Account</Link>
              </Button>
              <Button
                variant="outline"
                asChild
                className="border-white/20 text-white hover:border-pink-400 hover:text-pink-400 font-dim-mono tracking-wider uppercase"
              >
                <Link href="/pro-networx">Explore ProNetworx</Link>
              </Button>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
