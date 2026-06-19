import React, { Suspense, lazy, useRef, useEffect } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { glossary } from "@/data/mockData";
import Reveal from "@/components/Reveal";

const MetamorphosisScene = lazy(() => import("@/three/MetamorphosisScene"));

const STAGES = [
  {
    label: "GEM",
    title: "A hidden gem",
    body: "Every signal starts unheard. A bedroom recording, a freestyle in a friend's basement, a beat looped at 3am. Networx pulls it onto the frequency.",
    color: "yellow-300",
  },
  {
    label: "RIPPLE",
    title: "Caught in a ripple",
    body: "Prospectors hit play. Votes start flowing. Heat rises. The sound is encased — refined under pressure inside the community's cocoon.",
    color: "pink-400",
  },
  {
    label: "WINGS",
    title: "The wings unfold",
    body: "The artist breaks out. The wake widens. Reach, engagement, growth — the analytics trail of a thousand Ripples carries the sound further.",
    color: "cyan-300",
  },
  {
    label: "DIAMOND",
    title: "Crystallized.",
    body: "A Gem refined under pressure becomes a Diamond — a name the people know. No payola. No algorithm. Just transparent heat and the Butterfly Effect.",
    color: "yellow-300",
  },
];

export default function AboutPage() {
  const storyRef = useRef(null);
  const progressRef = useRef(0);

  const { scrollYProgress } = useScroll({
    target: storyRef,
    offset: ["start start", "end end"],
  });

  // Push progress into a ref each frame so r3f can read without re-rendering React
  useEffect(() => {
    const unsub = scrollYProgress.on("change", (v) => {
      progressRef.current = v;
    });
    return () => unsub();
  }, [scrollYProgress]);

  // Stage opacities for the 4 panels — clean handoff, no two panels share visibility
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
      {/* Intro */}
      <section className="relative pt-28 pb-12">
        <div className="max-w-5xl mx-auto px-6 lg:px-10">
          <Reveal>
            <div className="font-mono text-[10px] tracking-[0.3em] text-cyan-300 mb-3">
              ◤ THE LORE
            </div>
          </Reveal>
          <h1 className="font-unbounded font-black tracking-tighter uppercase text-5xl md:text-8xl leading-[0.9]">
            <Reveal as="span" className="block">
              The <span className="glitch text-glow-cyan" data-text="Butterfly">Butterfly</span>
            </Reveal>
            <Reveal as="span" delay={0.2} className="block">
              <span className="text-glow-pink text-pink-400">Effect.</span>
            </Reveal>
          </h1>
          <Reveal delay={0.45}>
            <p className="mt-8 max-w-2xl text-white/70 text-lg leading-relaxed">
              Scroll. Watch a Gem become a Diamond — the same arc every artist on
              Networx walks. This is Metamorphosis, in four beats.
            </p>
          </Reveal>
          <Reveal delay={0.6}>
            <div className="mt-6 inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.3em] text-cyan-300">
              <span className="w-6 h-px bg-cyan-400" />
              SCROLL ▾ TO TRANSFORM
              <span className="w-6 h-px bg-cyan-400" />
            </div>
          </Reveal>
        </div>
      </section>

      {/* Scroll-locked metamorphosis story */}
      <section
        ref={storyRef}
        className="relative h-[400vh]"
        data-testid="metamorphosis-story"
      >
        <div className="sticky top-0 h-screen w-full overflow-hidden">
          {/* 3D scene */}
          <div className="absolute inset-0">
            <Suspense fallback={<div className="absolute inset-0 bg-black" />}>
              <MetamorphosisScene progressRef={progressRef} />
            </Suspense>
            <div className="absolute inset-0 cyber-grid opacity-20 pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/50 pointer-events-none" />
          </div>

          {/* Layered panel texts */}
          <div className="relative z-10 h-full max-w-6xl mx-auto px-6 lg:px-10 grid lg:grid-cols-2 items-center">
            {/* Left empty for 3D focus */}
            <div className="hidden lg:block" />

            {/* Right text frames stacked */}
            <div className="relative h-72 md:h-96">
              {STAGES.map((s, i) => (
                <motion.div
                  key={s.label}
                  data-testid={`stage-panel-${i}`}
                  style={{ opacity: panelOpacities[i], y: panelYs[i] }}
                  className="absolute inset-0 flex flex-col justify-center"
                >
                  <div className={`font-mono text-[10px] tracking-[0.4em] text-${s.color} mb-3`}>
                    STAGE 0{i + 1} / {s.label}
                  </div>
                  <h2 className="font-unbounded font-black tracking-tighter uppercase text-4xl md:text-6xl leading-[0.95]">
                    {s.title}
                  </h2>
                  <p className="mt-5 text-white/70 text-base md:text-lg leading-relaxed max-w-md">
                    {s.body}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Stage progress rail */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-[80vw] max-w-3xl">
            <div className="flex items-center justify-between mb-2">
              {STAGES.map((s, i) => (
                <span
                  key={s.label}
                  className={`font-mono text-[10px] tracking-[0.3em] text-${s.color}`}
                >
                  {s.label}
                </span>
              ))}
            </div>
            <div className="h-px bg-white/10 relative overflow-hidden">
              <motion.div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-yellow-300 via-pink-500 via-50% to-cyan-300"
                style={{ width: railWidth }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Glossary recap */}
      <section className="relative max-w-5xl mx-auto px-6 lg:px-10 py-24">
        <Reveal>
          <div className="font-mono text-[10px] tracking-[0.3em] text-cyan-300 mb-3">
            ◤ THE THREE PILLARS
          </div>
          <h2 className="font-unbounded font-black tracking-tighter uppercase text-4xl md:text-6xl">
            The framework, <span className="text-glow-pink text-pink-400">defined.</span>
          </h2>
        </Reveal>

        <div className="mt-12 grid md:grid-cols-3 gap-5">
          {glossary.map((g, i) => {
            const color =
              g.color === "cyan" ? "cyan-300" : g.color === "pink" ? "pink-400" : "yellow-300";
            return (
              <Reveal key={g.group} delay={i * 0.15} y={40}>
                <div
                  data-testid={`about-pillar-${i}`}
                  className="rounded-2xl glass p-6 tracing-border h-full"
                >
                  <div className={`font-mono text-[10px] tracking-[0.3em] text-${color} mb-3`}>
                    PILLAR {String(i + 1).padStart(2, "0")}
                  </div>
                  <h3 className="font-unbounded font-black text-2xl mb-4">{g.group}</h3>
                  <ul className="space-y-3">
                    {g.items.map((it) => (
                      <li key={it.term}>
                        <div className="font-unbounded font-bold text-white text-sm">
                          {it.term}
                        </div>
                        <div className="text-white/60 text-sm mt-1">{it.def}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            );
          })}
        </div>
      </section>
    </div>
  );
}
