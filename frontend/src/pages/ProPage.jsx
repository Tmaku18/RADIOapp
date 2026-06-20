import React, { Suspense, lazy } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight, Palette, Camera, Film, Brush, Mic, Drum, SlidersHorizontal, Shirt,
  IdCard, LayoutGrid, ShoppingBag, MessageSquare, Radio, Infinity as InfinityIcon,
  Check, Sparkles, Briefcase, Network,
} from "lucide-react";
import { disciplines, proFeatures, proPricing, proStats } from "@/data/proData";
import Reveal from "@/components/Reveal";

const HeroScene = lazy(() => import("@/three/HeroScene"));

const ICONS = {
  Palette, Camera, Film, Brush, Mic, Drum, SlidersHorizontal, Shirt,
  IdCard, LayoutGrid, ShoppingBag, MessageSquare, Radio, Infinity: InfinityIcon,
};

function colorClass(c) {
  return c === "cyan" ? "cyan-300" : c === "pink" ? "pink-400" : "yellow-300";
}

export default function ProPage() {
  return (
    <div className="relative" data-testid="pro-page">
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
                <Briefcase className="w-3 h-3 text-yellow-300" />
                <span className="font-mono text-[10px] tracking-[0.3em] text-yellow-300">
                  PRO-NETWORX
                </span>
                <span className="font-mono text-[10px] text-white/50">
                  · For every kind of creative
                </span>
              </div>
            </Reveal>

            <h1 className="font-unbounded font-black tracking-tighter uppercase text-5xl md:text-7xl lg:text-8xl leading-[0.9]">
              <Reveal as="span" className="block">The networking</Reveal>
              <Reveal as="span" delay={0.15} className="block text-glow-cyan text-cyan-300">app for every</Reveal>
              <Reveal as="span" delay={0.3} className="block">kind of</Reveal>
              <Reveal as="span" delay={0.45} className="block glitch text-glow-pink" data-text="creative.">creative.</Reveal>
            </h1>

            <Reveal delay={0.7}>
              <p className="mt-8 max-w-xl text-white/70 text-lg leading-relaxed">
                Pro-Networx is where graphic designers, photographers, videographers,
                illustrators, lyricists, beat makers and the rest of the creative
                world post their work, get hired, and connect with each other.
              </p>
            </Reveal>

            <Reveal delay={0.85}>
              <div className="mt-10 flex flex-wrap items-center gap-4">
                <Link
                  to="/pro/directory"
                  data-testid="pro-hero-create-profile"
                  className="group inline-flex items-center gap-3 px-7 py-4 rounded-full bg-cyan-400 text-black font-mono text-[12px] tracking-[0.25em] uppercase font-bold glow-cyan hover:bg-white transition-colors"
                >
                  <Sparkles className="w-4 h-4" />
                  Create your profile — free
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Link>
                <Link
                  to="/pro/directory"
                  data-testid="pro-hero-directory"
                  className="inline-flex items-center gap-3 px-7 py-4 rounded-full border border-white/20 text-white font-mono text-[12px] tracking-[0.25em] uppercase hover:border-pink-400 hover:text-pink-400 transition-colors"
                >
                  Explore the directory
                </Link>
              </div>
            </Reveal>

            <Reveal delay={1.0}>
              <p className="mt-6 font-mono text-[11px] tracking-[0.2em] text-cyan-300/80">
                ◢ ONE LOGIN FOR BOTH NETWORX RADIO &amp; PRO-NETWORX ◣
              </p>
            </Reveal>

            <div className="mt-12 grid grid-cols-4 max-w-lg gap-4">
              {[
                { v: proStats.catalysts, l: "Catalysts" },
                { v: proStats.countries, l: "Countries" },
                { v: proStats.disciplines, l: "Disciplines" },
                { v: proStats.matchesThisMonth, l: "Matches/mo" },
              ].map((s, i) => (
                <Reveal key={s.l} delay={1.1 + i * 0.07}>
                  <div className="font-unbounded font-black text-2xl text-white">{s.v}</div>
                  <div className="font-mono text-[9px] tracking-[0.25em] text-white/50 uppercase">{s.l}</div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* DISCIPLINES */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 lg:px-10 py-24" data-testid="disciplines-section">
        <Reveal>
          <div className="text-center mb-14">
            <div className="font-mono text-[10px] tracking-[0.3em] text-pink-400 mb-3">
              ◤ SECTION 01 — DISCIPLINES
            </div>
            <h2 className="font-unbounded font-black tracking-tighter uppercase text-4xl md:text-6xl">
              Built for every <br />
              <span className="text-glow-pink text-pink-400">creative discipline.</span>
            </h2>
            <p className="text-white/60 mt-4 max-w-xl mx-auto">
              If you make something, this is for you.
            </p>
          </div>
        </Reveal>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          {disciplines.map((d, i) => {
            const Icon = ICONS[d.icon];
            const color = colorClass(d.color);
            return (
              <Reveal key={d.label} delay={(i % 4) * 0.08} y={36}>
                <div
                  data-testid={`discipline-card-${i}`}
                  className="tilt group relative rounded-2xl glass p-6 cursor-pointer overflow-hidden h-full"
                >
                  <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-cyan-500/10 blur-3xl group-hover:bg-pink-500/15 transition-colors" />
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-5 bg-black border border-${color}/40`}>
                    <Icon className={`w-5 h-5 text-${color}`} />
                  </div>
                  <div className="font-unbounded font-black text-lg tracking-tight">{d.label}</div>
                  <div className="mt-2 font-mono text-[10px] tracking-[0.25em] text-white/50">
                    {d.count} ACTIVE
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* FEATURES */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 lg:px-10 py-24" data-testid="features-section">
        <Reveal>
          <div className="text-center mb-14">
            <div className="font-mono text-[10px] tracking-[0.3em] text-cyan-300 mb-3">
              ◤ SECTION 02 — TOOLKIT
            </div>
            <h2 className="font-unbounded font-black tracking-tighter uppercase text-4xl md:text-6xl">
              Everything you need <br />
              <span className="text-glow-cyan text-cyan-300">in one place.</span>
            </h2>
          </div>
        </Reveal>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {proFeatures.map((f, i) => {
            const Icon = ICONS[f.icon];
            const color = colorClass(f.color);
            return (
              <Reveal key={f.title} delay={(i % 3) * 0.1} y={36}>
                <div
                  data-testid={`feature-card-${i}`}
                  className="tracing-border rounded-2xl glass p-7 h-full"
                >
                  <div className="flex items-center gap-3 mb-5">
                    <div className={`w-10 h-10 rounded-lg bg-black border border-${color}/40 flex items-center justify-center`}>
                      <Icon className={`w-4 h-4 text-${color}`} />
                    </div>
                    <div className={`font-mono text-[10px] tracking-[0.3em] text-${color}`}>
                      {String(i + 1).padStart(2, "0")}
                    </div>
                  </div>
                  <h3 className="font-unbounded font-black text-xl mb-3 tracking-tight">
                    {f.title}
                  </h3>
                  <p className="text-white/60 leading-relaxed">{f.body}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* PRICING */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 lg:px-10 py-24" data-testid="pricing-section">
        <Reveal>
          <div className="text-center mb-14">
            <div className="font-mono text-[10px] tracking-[0.3em] text-yellow-300 mb-3">
              ◤ SECTION 03 — SUBSCRIPTION
            </div>
            <h2 className="font-unbounded font-black tracking-tighter uppercase text-4xl md:text-6xl">
              Unlock messaging <br />
              <span className="text-glow-cyan text-cyan-300">+ contact info.</span>
            </h2>
            <p className="text-white/60 mt-4 max-w-xl mx-auto">
              Browse, post and build your profile for free. Subscribe to send DMs
              and view contact info on services listings.
            </p>
          </div>
        </Reveal>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Free tier */}
          <Reveal>
            <div data-testid="pricing-free" className="rounded-2xl glass p-8 h-full flex flex-col">
              <div className="font-mono text-[10px] tracking-[0.3em] text-white/60 mb-4">FREE FOREVER</div>
              <div className="flex items-baseline gap-2">
                <span className="font-unbounded font-black text-5xl">$0</span>
                <span className="font-mono text-[11px] tracking-[0.2em] text-white/40">/MONTH</span>
              </div>
              <p className="mt-4 text-white/60">Build, browse, and broadcast — on the house.</p>
              <ul className="mt-6 space-y-3 flex-1">
                {proPricing.free.map((p) => (
                  <li key={p} className="flex gap-3 text-sm">
                    <Check className="w-4 h-4 text-cyan-300 mt-0.5 shrink-0" />
                    <span className="text-white/80">{p}</span>
                  </li>
                ))}
              </ul>
              <Link
                to="/pro/directory"
                data-testid="pricing-free-btn"
                className="mt-8 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full border border-white/20 text-white font-mono text-[11px] tracking-[0.25em] uppercase hover:border-cyan-400 hover:text-cyan-300 transition-colors"
              >
                Start exploring
              </Link>
            </div>
          </Reveal>

          {/* Pro tier */}
          <Reveal delay={0.15}>
            <div data-testid="pricing-pro" className="relative rounded-2xl p-[1px] bg-gradient-to-br from-cyan-400 via-pink-500 to-yellow-300 h-full">
              <div className="rounded-2xl glass p-8 h-full flex flex-col bg-black/85">
                <div className="flex items-center justify-between mb-4">
                  <div className="font-mono text-[10px] tracking-[0.3em] text-pink-400">PRO — MOST POPULAR</div>
                  <Sparkles className="w-4 h-4 text-yellow-300" />
                </div>
                <div className="flex items-baseline gap-3">
                  <span className="font-unbounded font-black text-5xl text-glow-cyan">${proPricing.intro}</span>
                  <span className="font-mono text-[11px] tracking-[0.2em] text-white/50">FIRST MONTH</span>
                </div>
                <div className="mt-2 font-mono text-[11px] text-white/50">
                  Then ${proPricing.monthly}/month · Cancel anytime
                </div>
                <ul className="mt-6 space-y-3 flex-1">
                  {proPricing.perks.map((p) => (
                    <li key={p} className="flex gap-3 text-sm">
                      <Check className="w-4 h-4 text-pink-400 mt-0.5 shrink-0" />
                      <span className="text-white/85">{p}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  to="/pro/directory"
                  data-testid="pricing-pro-btn"
                  className="mt-8 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-cyan-400 text-black font-mono text-[11px] tracking-[0.25em] uppercase font-bold glow-cyan hover:bg-white transition-colors"
                >
                  Get started <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </Reveal>
        </div>

        <Reveal delay={0.3}>
          <p className="mt-10 text-center text-white/50 font-mono text-[11px] tracking-[0.2em]">
            Already have a Networx Radio account?{" "}
            <Link to="/pro/directory" className="text-cyan-300 hover:text-pink-400">
              Your profile is already waiting →
            </Link>
          </p>
        </Reveal>
      </section>

      {/* CTA */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 lg:px-10 py-24 text-center">
        <Reveal>
          <Network className="w-8 h-8 text-cyan-300 mx-auto mb-6" />
          <h2 className="font-unbounded font-black tracking-tighter uppercase text-4xl md:text-6xl">
            One profile. <br />
            <span className="text-glow-pink text-pink-400">Two universes.</span>
          </h2>
        </Reveal>
        <Reveal delay={0.2}>
          <div className="mt-10 flex justify-center gap-4 flex-wrap">
            <Link
              to="/pro/directory"
              data-testid="pro-cta-explore"
              className="px-8 py-4 rounded-full bg-cyan-400 text-black font-mono text-[12px] tracking-[0.25em] uppercase font-bold glow-cyan hover:bg-white"
            >
              Explore Directory
            </Link>
            <Link
              to="/"
              data-testid="pro-cta-radio"
              className="px-8 py-4 rounded-full border border-pink-400 text-pink-400 font-mono text-[12px] tracking-[0.25em] uppercase hover:bg-pink-400 hover:text-black transition-colors"
            >
              Back to Radio
            </Link>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
