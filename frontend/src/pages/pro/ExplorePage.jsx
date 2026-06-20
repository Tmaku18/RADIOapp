import React, { useState, useMemo } from "react";
import { Search, Heart, Eye } from "lucide-react";
import { explorePosts } from "@/data/proAppData";
import Reveal from "@/components/Reveal";

export default function ExplorePage() {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    if (!ql) return explorePosts;
    return explorePosts.filter((p) => p.handle.toLowerCase().includes(ql));
  }, [q]);

  return (
    <div data-testid="explore-page">
      <Reveal>
        <div className="mb-6">
          <h1 className="font-unbounded font-black tracking-tighter uppercase text-3xl md:text-4xl">
            Explore <span className="text-glow-pink text-pink-400">the noise.</span>
          </h1>
          <p className="text-white/50 mt-1 text-sm">An endless tile grid of creative output.</p>
        </div>
      </Reveal>

      <Reveal delay={0.05}>
        <div className="relative mb-6 max-w-xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            data-testid="explore-search"
            placeholder="@handle, mood, skill…"
            className="w-full bg-black/60 border border-white/10 rounded-lg pl-11 pr-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-cyan-400 focus:glow-cyan"
          />
        </div>
      </Reveal>

      <div
        data-testid="explore-grid"
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 auto-rows-[140px] md:auto-rows-[200px] gap-3"
      >
        {filtered.map((p, i) => {
          const spanClass =
            p.span === "tall" ? "row-span-2" : p.span === "wide" ? "col-span-2" : "";
          return (
            <Reveal key={p.id} delay={(i % 12) * 0.04} y={20}>
              <div
                data-testid={`explore-tile-${p.id}`}
                className={`tilt group relative rounded-xl overflow-hidden cursor-pointer ${spanClass}`}
              >
                <img
                  src={p.img}
                  alt=""
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="font-mono text-[10px] tracking-[0.15em] text-cyan-300">
                    {p.handle}
                  </span>
                  <span className="flex items-center gap-1 font-mono text-[10px] text-pink-400">
                    <Heart className="w-3 h-3" /> {p.likes}
                  </span>
                </div>
                <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-black/50 backdrop-blur font-mono text-[9px] tracking-[0.15em] text-white/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                  <Eye className="w-3 h-3" /> {(p.likes * 4 + 20)}
                </div>
              </div>
            </Reveal>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="rounded-2xl border border-dashed border-white/15 p-12 text-center mt-8">
          <div className="font-unbounded font-black text-xl mb-2">Nothing matched.</div>
          <p className="text-white/50">Try a broader search.</p>
        </div>
      )}
    </div>
  );
}
