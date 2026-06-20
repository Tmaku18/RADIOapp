import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Search, MapPin, Shield, MessageSquare, Star, Filter } from "lucide-react";
import { directory, disciplines } from "@/data/proData";
import Reveal from "@/components/Reveal";

const ROLES = ["All", ...Array.from(new Set(directory.map((d) => d.role)))];

export default function ProDirectoryPage() {
  const [q, setQ] = useState("");
  const [role, setRole] = useState("All");

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return directory.filter((p) => {
      const roleOk = role === "All" || p.role === role;
      if (!roleOk) return false;
      if (!ql) return true;
      return (
        p.name.toLowerCase().includes(ql) ||
        p.handle.toLowerCase().includes(ql) ||
        p.role.toLowerCase().includes(ql) ||
        p.city.toLowerCase().includes(ql) ||
        p.skills.some((s) => s.toLowerCase().includes(ql))
      );
    });
  }, [q, role]);

  return (
    <div className="relative pt-28 pb-40 min-h-screen" data-testid="pro-directory-page">
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        <Reveal>
          <div className="mb-8">
            <div className="font-mono text-[10px] tracking-[0.3em] text-yellow-300 mb-2">
              ◤ PRO-NETWORX · DIRECTORY
            </div>
            <h1 className="font-unbounded font-black tracking-tighter uppercase text-5xl md:text-7xl">
              Hire a <span className="text-glow-cyan text-cyan-300">Catalyst.</span>
            </h1>
            <p className="text-white/60 mt-3 max-w-xl">
              Every profile is a verified creative ready to ship the next chapter of an artist's story.
            </p>
          </div>
        </Reveal>

        {/* Search + filters */}
        <Reveal delay={0.1}>
          <div className="rounded-2xl glass p-4 md:p-5 mb-8 flex flex-col lg:flex-row gap-3 lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <input
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                data-testid="directory-search"
                placeholder="Search by name, skill, city…"
                className="w-full bg-black/60 border border-white/10 rounded-lg pl-11 pr-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-cyan-400 focus:glow-cyan transition-all"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="w-4 h-4 text-cyan-300 shrink-0" />
              {ROLES.map((r) => (
                <button
                  key={r}
                  onClick={() => setRole(r)}
                  data-testid={`directory-filter-${r.replace(/\s/g, "-").toLowerCase()}`}
                  className={`px-3 py-1.5 rounded-full font-mono text-[10px] tracking-[0.2em] uppercase border transition-colors ${
                    role === r
                      ? "bg-cyan-400 text-black border-cyan-400"
                      : "border-white/15 text-white/70 hover:border-cyan-400/50 hover:text-cyan-300"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </Reveal>

        {/* Counter */}
        <Reveal delay={0.15}>
          <div className="flex items-center justify-between mb-5">
            <div className="font-mono text-[11px] tracking-[0.25em] text-white/60" data-testid="directory-count">
              {filtered.length} CATALYST{filtered.length === 1 ? "" : "S"} FOUND
            </div>
            <div className="font-mono text-[11px] tracking-[0.25em] text-cyan-300">
              {disciplines.reduce((s, d) => s + d.count, 0)} TOTAL ON PLATFORM
            </div>
          </div>
        </Reveal>

        {/* Grid */}
        {filtered.length === 0 ? (
          <Reveal>
            <div className="rounded-2xl border border-dashed border-white/15 p-16 text-center">
              <div className="font-unbounded font-black text-2xl mb-2">No catalysts found.</div>
              <p className="text-white/50">Try a different role or skill.</p>
            </div>
          </Reveal>
        ) : (
          <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {filtered.map((p, i) => (
              <Reveal key={p.id} delay={(i % 4) * 0.07} y={28}>
                <div
                  data-testid={`directory-card-${p.id}`}
                  className="tilt group rounded-2xl glass overflow-hidden cursor-pointer h-full flex flex-col"
                >
                  <div className="aspect-[5/6] relative overflow-hidden">
                    <img
                      src={p.img}
                      alt={p.name}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
                    {p.verified && (
                      <div className="absolute top-3 left-3 flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/70 border border-cyan-400/40 backdrop-blur">
                        <Shield className="w-3 h-3 text-cyan-300" />
                        <span className="font-mono text-[9px] tracking-[0.2em] text-cyan-300">VERIFIED</span>
                      </div>
                    )}
                    <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-black/70 border border-white/10 backdrop-blur">
                      <span className="font-mono text-[10px] font-bold text-yellow-300">${p.rate}/h</span>
                    </div>
                    <div className="absolute bottom-3 left-3 right-3">
                      <div className="font-unbounded font-black text-lg truncate">{p.name}</div>
                      <div className="font-mono text-[10px] text-cyan-300/90">{p.handle}</div>
                    </div>
                  </div>
                  <div className="p-4 flex-1 flex flex-col">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono tracking-[0.15em] text-pink-400">{p.role.toUpperCase()}</span>
                      <span className="flex items-center gap-1 text-white/60">
                        <MapPin className="w-3 h-3" /> {p.city}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {p.skills.map((s) => (
                        <span
                          key={s}
                          className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 font-mono text-[9px] tracking-[0.1em] text-white/70"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                    <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                      <button
                        data-testid={`directory-message-${p.id}`}
                        className="flex items-center gap-1.5 text-white/70 hover:text-cyan-300 transition-colors text-xs font-mono tracking-[0.2em]"
                      >
                        <MessageSquare className="w-3.5 h-3.5" /> DM
                      </button>
                      <button
                        data-testid={`directory-favorite-${p.id}`}
                        className="flex items-center gap-1.5 text-white/70 hover:text-pink-400 transition-colors text-xs font-mono tracking-[0.2em]"
                      >
                        <Star className="w-3.5 h-3.5" /> SAVE
                      </button>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        )}

        {/* Footer CTA */}
        <Reveal delay={0.2}>
          <div className="mt-16 rounded-2xl tracing-border p-8 md:p-10 text-center">
            <div className="font-mono text-[10px] tracking-[0.3em] text-pink-400 mb-3">
              ARE YOU A CATALYST?
            </div>
            <h3 className="font-unbounded font-black text-3xl md:text-4xl mb-3">
              Get listed in the directory.
            </h3>
            <p className="text-white/60 max-w-xl mx-auto">
              Build a profile in minutes. Free forever. Subscribe only when you want
              to unlock messaging.
            </p>
            <Link
              to="/pro"
              data-testid="directory-cta"
              className="mt-6 inline-flex items-center gap-3 px-7 py-3 rounded-full bg-cyan-400 text-black font-mono text-[11px] tracking-[0.25em] uppercase font-bold glow-cyan hover:bg-white"
            >
              Create your profile — free
            </Link>
          </div>
        </Reveal>
      </div>
    </div>
  );
}
