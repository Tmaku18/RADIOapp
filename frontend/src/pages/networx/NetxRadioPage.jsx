import React from "react";
import { Play, Pause, Headphones } from "lucide-react";
import { trendingSongs, platformStats } from "@/data/radioAppData";
import { usePlayer } from "@/context/PlayerContext";
import Reveal from "@/components/Reveal";

export default function NetxRadioPage() {
  const { song, playing, setPlaying, idx, setIdx } = usePlayer();
  return (
    <div data-testid="netx-radio-page" className="space-y-6">
      <Reveal>
        <div>
          <h1 className="font-unbounded font-black tracking-tighter uppercase text-3xl md:text-4xl">
            Live <span className="text-glow-cyan text-cyan-300">radio</span>
          </h1>
          <p className="text-white/50 mt-1 text-sm">{platformStats.liveListeners} prospectors tuned in.</p>
        </div>
      </Reveal>

      <div className="grid lg:grid-cols-[1fr_360px] gap-5">
        <Reveal>
          <div className="rounded-2xl glass overflow-hidden">
            <div className="aspect-[16/9] relative">
              <img src={song.img} alt={song.title} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
              <div className="absolute top-4 left-4 flex items-center gap-2">
                <span className="live-dot w-2 h-2 rounded-full bg-pink-500" />
                <span className="font-mono text-[10px] tracking-[0.3em] text-pink-400">ON AIR</span>
              </div>
              <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between gap-4">
                <div>
                  <div className="font-mono text-[10px] tracking-[0.25em] text-cyan-300 mb-1">NOW PLAYING</div>
                  <div className="font-unbounded font-black text-3xl md:text-4xl">{song.title}</div>
                  <div className="text-white/70">{song.artist}</div>
                </div>
                <button
                  onClick={() => setPlaying(!playing)}
                  data-testid="netx-radio-play"
                  className="w-16 h-16 rounded-full bg-cyan-400 text-black flex items-center justify-center glow-cyan hover:bg-white"
                >
                  {playing ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1" />}
                </button>
              </div>
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="rounded-2xl glass p-5">
            <div className="font-mono text-[10px] tracking-[0.3em] text-cyan-300 mb-4">UP NEXT</div>
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {trendingSongs.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => setIdx(i)}
                  data-testid={`netx-queue-${i}`}
                  className={`w-full text-left flex items-center gap-3 p-2 rounded-lg ${
                    i === idx ? "bg-cyan-400/10 ring-1 ring-cyan-400/30" : "hover:bg-white/5"
                  }`}
                >
                  <img src={s.img} alt="" className="w-10 h-10 rounded object-cover" />
                  <div className="flex-1 min-w-0">
                    <div className="font-unbounded font-bold text-xs truncate">{s.title}</div>
                    <div className="font-mono text-[9px] text-white/50">{s.artist}</div>
                  </div>
                  <Headphones className="w-3 h-3 text-white/40" />
                  <span className="font-mono text-[9px] text-white/50">{s.ears}</span>
                </button>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </div>
  );
}
