import React from "react";
import { Link } from "react-router-dom";
import { Music, Headphones, Heart, Flame, BarChart3, UploadCloud, Award, Rss } from "lucide-react";
import { trendingSongs, platformStats, radioMe } from "@/data/radioAppData";
import Reveal from "@/components/Reveal";

const QUICK = [
  { to: "/networx/app/radio", label: "Radio", Icon: Music, color: "cyan-300", body: "Tune into the live broadcast." },
  { to: "/networx/app/refinery", label: "The Refinery", Icon: Flame, color: "pink-400", body: "Rank tonight's queue & earn." },
  { to: "/networx/app/uploads", label: "My Uploads", Icon: UploadCloud, color: "yellow-300", body: "Manage your songs." },
  { to: "/networx/app/analytics", label: "Analytics", Icon: BarChart3, color: "cyan-300", body: "See your wake." },
];

export default function DashboardPage() {
  return (
    <div data-testid="dashboard-page" className="space-y-6">
      {/* Hero card with logo */}
      <Reveal>
        <div className="relative rounded-3xl glass overflow-hidden">
          <div className="absolute inset-0 cyber-grid opacity-30" />
          <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full bg-cyan-500/15 blur-3xl" />
          <div className="absolute -bottom-20 -right-20 w-72 h-72 rounded-full bg-pink-500/15 blur-3xl" />
          <div className="relative grid md:grid-cols-[1fr_320px] gap-8 p-6 md:p-10 items-center">
            <div>
              <div className="font-mono text-[10px] tracking-[0.3em] text-cyan-300 mb-3">
                ◤ DASHBOARD · WELCOME BACK
              </div>
              <h1 className="font-unbounded font-black tracking-tighter uppercase text-4xl md:text-6xl leading-[0.95]">
                Hey <span className="text-glow-cyan text-cyan-300">{radioMe.name}.</span><br />
                Mine the frequency.
              </h1>
              <p className="text-white/60 mt-4 max-w-md">
                {radioMe.level} · You've earned ${radioMe.rewards} this season and your wake reaches {radioMe.yield} ears.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link to="/networx/app/refinery" data-testid="db-refinery-cta" className="px-5 py-2.5 rounded-full bg-cyan-400 text-black font-mono text-[10px] tracking-[0.25em] uppercase font-bold glow-cyan hover:bg-white">
                  Enter The Refinery
                </Link>
                <Link to="/networx/app/uploads" data-testid="db-upload-cta" className="px-5 py-2.5 rounded-full border border-pink-400 text-pink-400 font-mono text-[10px] tracking-[0.25em] uppercase hover:bg-pink-400 hover:text-black">
                  Upload a song
                </Link>
              </div>
            </div>
            <div className="relative h-[260px] md:h-[320px] flex items-center justify-center">
              <div className="absolute inset-0 rounded-2xl bg-black/40 border border-cyan-400/20 overflow-hidden flex items-center justify-center">
                <img src="/brand/networx-logo.png" alt="NETWORX" className="w-44 h-44 md:w-56 md:h-56 object-contain drop-shadow-[0_0_40px_rgba(0,240,255,0.6)]" />
              </div>
            </div>
          </div>
        </div>
      </Reveal>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { l: "Songs", v: platformStats.songs, c: "cyan-300", Icon: Music },
          { l: "Members", v: platformStats.members, c: "pink-400", Icon: Headphones },
          { l: "Ripples", v: platformStats.ripples, c: "yellow-300", Icon: Heart },
          { l: "Avg Heat", v: `${platformStats.avgTemp}°`, c: "cyan-300", Icon: Flame },
        ].map((s, i) => (
          <Reveal key={s.l} delay={i * 0.06}>
            <div data-testid={`db-stat-${s.l.toLowerCase()}`} className="rounded-2xl glass p-4 flex items-center gap-3">
              <span className={`w-10 h-10 rounded-full bg-black border border-${s.c}/40 flex items-center justify-center`}>
                <s.Icon className={`w-4 h-4 text-${s.c}`} />
              </span>
              <div>
                <div className={`font-unbounded font-black text-2xl text-${s.c}`}>{s.v}</div>
                <div className="font-mono text-[9px] tracking-[0.25em] text-white/50 uppercase">{s.l}</div>
              </div>
            </div>
          </Reveal>
        ))}
      </div>

      {/* Quick actions + Trending */}
      <div className="grid lg:grid-cols-[1fr_360px] gap-5">
        <Reveal>
          <div className="rounded-2xl glass p-6">
            <div className="font-mono text-[10px] tracking-[0.3em] text-cyan-300 mb-4">QUICK ACTIONS</div>
            <div className="grid sm:grid-cols-2 gap-3">
              {QUICK.map((q) => (
                <Link
                  key={q.to}
                  to={q.to}
                  data-testid={`db-quick-${q.label.toLowerCase().replace(/\s/g, "-")}`}
                  className="tilt rounded-xl border border-white/10 bg-black/40 p-4 flex items-center gap-3 hover:border-cyan-400/50"
                >
                  <span className={`w-10 h-10 rounded-full bg-black border border-${q.color}/40 flex items-center justify-center shrink-0`}>
                    <q.Icon className={`w-4 h-4 text-${q.color}`} />
                  </span>
                  <div>
                    <div className="font-unbounded font-bold text-sm">{q.label}</div>
                    <div className="text-xs text-white/50">{q.body}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="rounded-2xl glass p-6">
            <div className="font-mono text-[10px] tracking-[0.3em] text-pink-400 mb-4">TRENDING TONIGHT</div>
            <div className="space-y-2">
              {trendingSongs.slice(0, 5).map((s, i) => (
                <div key={s.id} className="flex items-center gap-3 py-1.5">
                  <div className="font-mono text-[10px] text-white/40 w-5 text-right">#{i + 1}</div>
                  <img src={s.img} alt="" className="w-9 h-9 rounded object-cover" />
                  <div className="flex-1 min-w-0">
                    <div className="font-unbounded font-bold text-xs truncate">{s.title}</div>
                    <div className="font-mono text-[9px] text-white/50 truncate">{s.artist}</div>
                  </div>
                  <div className="font-mono text-[10px] text-cyan-300">{s.temp}°</div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </div>
  );
}
