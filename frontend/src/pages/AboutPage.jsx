import React from "react";
import { glossary } from "@/data/mockData";
import Reveal from "@/components/Reveal";

export default function AboutPage() {
  return (
    <div className="relative pt-28 pb-40 min-h-screen" data-testid="about-page">
      <div className="max-w-5xl mx-auto px-6 lg:px-10">
        <Reveal>
          <div className="font-mono text-[10px] tracking-[0.3em] text-cyan-300 mb-3">◤ THE LORE</div>
        </Reveal>
        <h1 className="font-unbounded font-black tracking-tighter uppercase text-5xl md:text-8xl leading-[0.9]">
          <Reveal as="span" className="block">The <span className="glitch text-glow-cyan" data-text="Butterfly">Butterfly</span></Reveal>
          <Reveal as="span" delay={0.2} className="block"><span className="text-glow-pink text-pink-400">Effect.</span></Reveal>
        </h1>

        <Reveal delay={0.45}>
          <div className="mt-10 max-w-3xl space-y-6 text-white/80 text-lg leading-relaxed">
            <p>
              One small ripple can become a storm. That's the bet Networx makes
              every single broadcast — that a single vote from a stranger, a single
              late-night listen, a single shared link can be the chain reaction that
              launches a career.
            </p>
            <p>
              We built a radio that doesn't gate-keep. Hidden gems upload. Prospectors
              tune in. The community refines the signal. The temperature rises. The
              people decide what breaks out.
            </p>
            <p className="font-mono text-cyan-300 text-base">
              // No algorithms. No payola. Just transparent heat and honest feedback.
            </p>
          </div>
        </Reveal>

        <div className="mt-20 grid md:grid-cols-3 gap-5">
          {glossary.map((g, i) => {
            const color = g.color === "cyan" ? "cyan-300" : g.color === "pink" ? "pink-400" : "yellow-300";
            return (
              <Reveal key={g.group} delay={i * 0.15} y={40}>
                <div data-testid={`about-pillar-${i}`} className="rounded-2xl glass p-6 tracing-border h-full">
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
      </div>
    </div>
  );
}
