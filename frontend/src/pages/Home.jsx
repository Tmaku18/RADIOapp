import React, { Suspense, lazy } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Flame, Headphones, Heart, Sparkles, Zap, Pickaxe } from "lucide-react";
import { trendingSongs, trendingArtists, platformStats, glossary } from "@/data/mockData";
import SongCard from "@/components/SongCard";
import Reveal from "@/components/Reveal";

const HeroScene = lazy(() => import("@/three/HeroScene"));

export default function Home() {
  return (
    <div className="relative" data-testid="home-page">
      {/* HERO */}
      <section className="relative min-h-[calc(100vh-7rem)] flex items-center overflow-hidden">
        <div className="absolute inset-0">
          <Suspense fallback={<div className="absolute inset-0 bg-black" />}>
            <HeroScene />
          </Suspense>
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black pointer-events-none" />
          <div className="absolute inset-0 cyber-grid opacity-30 pointer-events-none" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-10 py-32 w-full">
          <div className="max-w-3xl">
            <Reveal>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass mb-6">
                <span className="live-dot inline-block w-1.5 h-1.5 rounded-full bg-pink-500" />
                <span className="font-mono text-[10px] tracking-[0.3em] text-pink-400">
                  BROADCASTING NOW
                </span>
                <span className="font-mono text-[10px] text-white/50">
                  · {platformStats.liveListeners} listeners
                </span>
              </div>
            </Reveal>

            <h1 className="font-unbounded font-black tracking-tighter uppercase text-5xl md:text-7xl lg:text-8xl leading-[0.9]">
              <Reveal as="span" delay={0.05} className="block">Join the</Reveal>
              <Reveal as="span" delay={0.18} className="block text-glow-cyan text-cyan-300">movement.</Reveal>
              <Reveal as="span" delay={0.32} className="block">Build your</Reveal>
              <Reveal as="span" delay={0.48} className="block glitch text-glow-pink" data-text="network.">network.</Reveal>
            </h1>

            <Reveal delay={0.7}>
              <p className="mt-8 max-w-xl text-white/70 text-lg leading-relaxed">
                Whether you are a hidden gem ready to be heard, a Prospector
                discovering new talent, or a pro ready to mentor — Networx is the
                underground frequency where careers begin.
              </p>
            </Reveal>

            <Reveal delay={0.85}>
              <div className="mt-10 flex flex-wrap items-center gap-4">
                <Link
                  to="/radio"
                  data-testid="hero-mine-frequency-btn"
                  className="group inline-flex items-center gap-3 px-7 py-4 rounded-full bg-cyan-400 text-black font-mono text-[12px] tracking-[0.25em] uppercase font-bold glow-cyan hover:bg-white transition-colors"
                >
                  <Pickaxe className="w-4 h-4" />
                  Mine The Frequency
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Link>
                <Link
                  to="/artists"
                  data-testid="hero-explore-btn"
                  className="inline-flex items-center gap-3 px-7 py-4 rounded-full border border-white/20 text-white font-mono text-[12px] tracking-[0.25em] uppercase hover:border-pink-400 hover:text-pink-400 transition-colors"
                >
                  Explore Artists
                </Link>
              </div>
            </Reveal>

            <div className="mt-14 grid grid-cols-3 max-w-lg gap-6">
              {[
                { v: platformStats.members, l: "Members" },
                { v: platformStats.songs, l: "Songs" },
                { v: platformStats.ripples, l: "Ripples" },
              ].map((s, i) => (
                <Reveal key={s.l} delay={1 + i * 0.1}>
                  <div className="font-unbounded font-black text-3xl text-white">
                    {s.v}
                  </div>
                  <div className="font-mono text-[10px] tracking-[0.3em] text-white/50 uppercase">
                    {s.l}
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>

        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 font-mono text-[10px] tracking-[0.4em] text-white/30 animate-pulse">
          SCROLL ▾
        </div>
      </section>

      {/* TRENDING NOW */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 lg:px-10 py-24" id="trending">
        <Reveal>
          <div className="flex items-end justify-between mb-10 flex-wrap gap-4">
            <div>
              <div className="font-mono text-[10px] tracking-[0.3em] text-cyan-300 mb-3">
                ◤ SECTION 01 — GEMS &amp; DIAMONDS
              </div>
              <h2 className="font-unbounded font-black tracking-tighter uppercase text-4xl md:text-5xl">
                Trending <span className="text-glow-pink text-pink-400">now</span>
              </h2>
              <p className="text-white/60 mt-3 max-w-lg">
                The songs the people are voting up right now. Tap play to hear a clip.
              </p>
            </div>
            <div className="flex items-center gap-6 font-mono text-[10px] tracking-[0.25em] text-white/60">
              <div className="flex items-center gap-2">
                <Flame className="w-3 h-3 text-orange-400" /> AVG {platformStats.avgTemp}°
              </div>
              <div className="flex items-center gap-2">
                <Headphones className="w-3 h-3 text-cyan-300" /> {platformStats.earsReached} EARS
              </div>
            </div>
          </div>
        </Reveal>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {trendingSongs.map((s, i) => (
            <Reveal key={s.id} delay={(i % 4) * 0.08} y={36}>
              <SongCard song={s} index={i} />
            </Reveal>
          ))}
        </div>
      </section>

      {/* TRENDING ARTISTS — marquee */}
      <section className="relative z-10 py-20 border-y border-white/5 overflow-hidden">
        <Reveal>
          <div className="max-w-7xl mx-auto px-6 lg:px-10 mb-10">
            <div className="font-mono text-[10px] tracking-[0.3em] text-pink-400 mb-3">
              ◤ SECTION 02 — CATALYSTS
            </div>
            <h2 className="font-unbounded font-black tracking-tighter uppercase text-4xl md:text-5xl">
              Trending <span className="text-glow-cyan text-cyan-300">artists</span>
            </h2>
          </div>
        </Reveal>
        <div className="marquee gap-5 px-6">
          {[...trendingArtists, ...trendingArtists].map((a, i) => (
            <Link
              key={i}
              to="/artists"
              data-testid={`artist-chip-${i}`}
              className="tilt shrink-0 w-56 rounded-xl glass p-4 flex items-center gap-3"
            >
              <div className="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br from-cyan-400/20 to-pink-500/20 border border-white/10 flex items-center justify-center shrink-0">
                {a.img ? (
                  <img src={a.img} alt={a.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="font-unbounded font-black text-white">
                    {a.name[0]}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <div className="font-unbounded font-bold text-sm truncate">{a.name}</div>
                <div className="font-mono text-[10px] text-white/50">
                  🎧 {a.ears} · ♥ {a.likes}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* THE LANGUAGE / GLOSSARY */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 lg:px-10 py-24">
        <Reveal>
          <div className="text-center mb-14">
            <div className="font-mono text-[10px] tracking-[0.3em] text-yellow-300 mb-3">
              ◤ SECTION 03 — THE LEXICON
            </div>
            <h2 className="font-unbounded font-black tracking-tighter uppercase text-4xl md:text-6xl">
              The language of <br />
              <span className="text-glow-cyan text-cyan-300">Networx</span>
            </h2>
            <p className="text-white/60 mt-4 max-w-2xl mx-auto">
              Our world runs on three ideas: the <b className="text-white">Butterfly Effect</b>,
              the artist's <b className="text-white">Metamorphosis</b>, and the{" "}
              <b className="text-white">Mining</b> of hidden talent.
            </p>
          </div>
        </Reveal>

        <div className="grid md:grid-cols-3 gap-6">
          {glossary.map((g, i) => {
            const color = g.color === "cyan" ? "cyan-300" : g.color === "pink" ? "pink-400" : "yellow-300";
            const Icon = i === 0 ? Sparkles : i === 1 ? Zap : Pickaxe;
            return (
              <Reveal key={g.group} delay={i * 0.15} y={40}>
                <div
                  data-testid={`glossary-${g.group.toLowerCase().replace(/\s/g, "-")}`}
                  className="tracing-border rounded-2xl glass p-7 h-full"
                >
                  <div className="flex items-center gap-3 mb-5">
                    <Icon className={`w-5 h-5 text-${color}`} />
                    <div className={`font-mono text-[10px] tracking-[0.3em] text-${color}`}>
                      PILLAR {String(i + 1).padStart(2, "0")}
                    </div>
                  </div>
                  <h3 className="font-unbounded font-black text-2xl mb-6 tracking-tight">
                    {g.group}
                  </h3>
                  <ul className="space-y-4">
                    {g.items.map((it) => (
                      <li key={it.term}>
                        <div className={`font-unbounded font-bold text-${color} text-sm`}>
                          {it.term}
                        </div>
                        <div className="text-white/60 text-sm mt-1 leading-relaxed">
                          {it.def}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 lg:px-10 py-24 text-center">
        <Reveal>
          <h2 className="font-unbounded font-black tracking-tighter uppercase text-4xl md:text-6xl">
            Ready to set off <br />
            <span className="text-glow-pink text-pink-400">the chain reaction?</span>
          </h2>
        </Reveal>
        <Reveal delay={0.2}>
          <div className="mt-10 flex justify-center gap-4 flex-wrap">
            <Link
              to="/radio"
              data-testid="cta-tune-in"
              className="px-8 py-4 rounded-full bg-cyan-400 text-black font-mono text-[12px] tracking-[0.25em] uppercase font-bold glow-cyan hover:bg-white"
            >
              Tune In Now
            </Link>
            <Link
              to="/contact"
              data-testid="cta-contact"
              className="px-8 py-4 rounded-full border border-pink-400 text-pink-400 font-mono text-[12px] tracking-[0.25em] uppercase hover:bg-pink-400 hover:text-black transition-colors"
            >
              Get In Touch
            </Link>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
