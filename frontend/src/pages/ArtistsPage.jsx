import React from "react";
import { trendingArtists } from "@/data/mockData";
import { Headphones, Heart } from "lucide-react";
import Reveal from "@/components/Reveal";

export default function ArtistsPage() {
  return (
    <div className="relative pt-28 pb-40 min-h-screen" data-testid="artists-page">
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        <Reveal>
          <div className="mb-12">
            <div className="font-mono text-[10px] tracking-[0.3em] text-pink-400 mb-2">◤ CATALYSTS</div>
            <h1 className="font-unbounded font-black tracking-tighter uppercase text-5xl md:text-7xl">
              The <span className="text-glow-pink text-pink-400">Gems</span>
            </h1>
            <p className="text-white/60 mt-3 max-w-xl">
              Hidden talent refined under pressure. These are the artists currently mining the frequency.
            </p>
          </div>
        </Reveal>

        <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {trendingArtists.map((a, i) => (
            <Reveal key={a.name} delay={(i % 4) * 0.08} y={36}>
              <div
                data-testid={`artist-card-${i}`}
                className="tilt group rounded-2xl glass overflow-hidden cursor-pointer h-full"
              >
              <div className="aspect-[4/5] relative overflow-hidden bg-gradient-to-br from-cyan-400/10 to-pink-500/10">
                {a.img ? (
                  <img
                    src={a.img}
                    alt={a.name}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="font-unbounded font-black text-[120px] text-white/10">
                      {a.name[0]}
                    </span>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
                <div className="absolute top-3 left-3 font-mono text-[10px] tracking-[0.2em] text-white/60">
                  #{String(i + 1).padStart(2, "0")}
                </div>
                <div className="absolute bottom-3 left-3 right-3">
                  <div className="font-unbounded font-black text-xl tracking-tight">{a.name}</div>
                  <div className="flex items-center gap-3 mt-2 text-xs">
                    <span className="flex items-center gap-1 text-cyan-300">
                      <Headphones className="w-3 h-3" /> {a.ears}
                    </span>
                    <span className="flex items-center gap-1 text-pink-400">
                      <Heart className="w-3 h-3" /> {a.likes}
                    </span>
                  </div>
                </div>
              </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </div>
  );
}
