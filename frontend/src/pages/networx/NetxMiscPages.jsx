import React from "react";
import { Headphones, Mic2, Calendar, Ticket } from "lucide-react";
import { liveDjs, livePerformances } from "@/data/radioAppData";
import Reveal from "@/components/Reveal";

export function LiveDJPage() {
  return (
    <div data-testid="live-dj-page" className="space-y-6">
      <Reveal>
        <div>
          <h1 className="font-unbounded font-black tracking-tighter uppercase text-3xl md:text-4xl">
            Live <span className="text-glow-pink text-pink-400">DJs</span>
          </h1>
          <p className="text-white/50 mt-1 text-sm">Who's behind the booth right now.</p>
        </div>
      </Reveal>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {liveDjs.map((d, i) => (
          <Reveal key={d.id} delay={i * 0.06}>
            <div data-testid={`live-dj-${d.id}`} className="tilt rounded-2xl glass overflow-hidden">
              <div className="aspect-square relative">
                <img src={d.img} alt={d.name} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                {d.live && (
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2 py-1 rounded-full bg-pink-500/30 border border-pink-400/50 backdrop-blur">
                    <span className="live-dot w-1.5 h-1.5 rounded-full bg-pink-400" />
                    <span className="font-mono text-[9px] tracking-[0.25em] text-pink-300">ON AIR</span>
                  </div>
                )}
                <div className="absolute bottom-3 left-3 right-3">
                  <div className="font-unbounded font-black text-lg">{d.name}</div>
                  <div className="font-mono text-[10px] text-cyan-300">{d.show}</div>
                </div>
              </div>
              <div className="p-3 flex items-center justify-between border-t border-white/10">
                <div className="text-xs text-white/60">{d.genre}</div>
                <div className="flex items-center gap-1 font-mono text-[10px] text-white/50">
                  <Headphones className="w-3 h-3" /> {d.listeners}
                </div>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </div>
  );
}

export function LivePerformancesPage() {
  return (
    <div data-testid="live-performances-page" className="space-y-6">
      <Reveal>
        <div>
          <h1 className="font-unbounded font-black tracking-tighter uppercase text-3xl md:text-4xl">
            Live <span className="text-glow-cyan text-cyan-300">performances</span>
          </h1>
          <p className="text-white/50 mt-1 text-sm">Shows you can catch in person.</p>
        </div>
      </Reveal>
      <div className="grid sm:grid-cols-2 lg:grid-cols-2 gap-4">
        {livePerformances.map((p, i) => {
          const pct = Math.round((p.tickets / p.capacity) * 100);
          return (
            <Reveal key={p.id} delay={i * 0.07}>
              <div data-testid={`perf-${p.id}`} className="tilt rounded-2xl glass overflow-hidden flex">
                <img src={p.img} alt="" className="w-32 h-auto object-cover" />
                <div className="flex-1 p-4 flex flex-col">
                  <div className="flex items-center justify-between">
                    <div className="font-unbounded font-black text-lg">{p.artist}</div>
                    <div className="font-unbounded font-black text-pink-400 text-xl">${p.price}</div>
                  </div>
                  <div className="text-sm text-white/60 mt-0.5">{p.venue}</div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-white/50">
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {p.date} · {p.time}</span>
                  </div>
                  <div className="mt-3 h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-cyan-400 to-pink-500" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="font-mono text-[9px] tracking-[0.2em] text-white/50">{p.tickets} / {p.capacity} SOLD</div>
                    <button data-testid={`perf-ticket-${p.id}`} className="px-3 py-1.5 rounded-full bg-cyan-400 text-black font-mono text-[10px] tracking-[0.2em] uppercase font-bold hover:bg-white flex items-center gap-1">
                      <Ticket className="w-3 h-3" /> Tickets
                    </button>
                  </div>
                </div>
              </div>
            </Reveal>
          );
        })}
      </div>
    </div>
  );
}

export function LibraryPage() {
  return (
    <div data-testid="library-page" className="space-y-6">
      <Reveal>
        <div>
          <h1 className="font-unbounded font-black tracking-tighter uppercase text-3xl md:text-4xl">
            Your <span className="text-glow-cyan text-cyan-300">library</span>
          </h1>
          <p className="text-white/50 mt-1 text-sm">Everything you've saved or ripple'd.</p>
        </div>
      </Reveal>
      <p className="text-white/60 text-sm">Library coming online — saved songs, playlists, and offline tracks will appear here.</p>
    </div>
  );
}
