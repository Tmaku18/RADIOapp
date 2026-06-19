import React, { Suspense, lazy } from "react";
import { Play, Pause, Headphones, Heart, Flame, Radio } from "lucide-react";
import { trendingSongs, platformStats } from "@/data/mockData";
import { usePlayer } from "@/context/PlayerContext";
import Reveal from "@/components/Reveal";

const FloatingAlbum = lazy(() => import("@/three/FloatingAlbum"));

export default function RadioPage() {
  const { idx, setIdx, playing, setPlaying, song } = usePlayer();

  return (
    <div className="relative pt-28 pb-40 min-h-screen" data-testid="radio-page">
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        <Reveal>
          <div className="mb-8">
            <div className="font-mono text-[10px] tracking-[0.3em] text-cyan-300 mb-2">
              ◤ THE REFINERY
            </div>
            <h1 className="font-unbounded font-black tracking-tighter uppercase text-5xl md:text-7xl">
              Live <span className="text-glow-cyan text-cyan-300">Radio</span>
            </h1>
            <p className="text-white/60 mt-3 max-w-xl">
              The portal where Prospectors rank, survey, and comment to refine songs before they break out.
            </p>
          </div>
        </Reveal>

        <div className="grid lg:grid-cols-12 gap-6">
          {/* 3D floating album */}
          <Reveal delay={0.1} className="lg:col-span-7">
            <div className="rounded-2xl overflow-hidden glass relative aspect-square lg:aspect-auto lg:min-h-[560px]">
            <div className="absolute inset-0 cyber-grid opacity-40" />
            <Suspense
              fallback={
                <div className="absolute inset-0 flex items-center justify-center text-white/40 font-mono text-xs">
                  Loading 3D scene…
                </div>
              }
            >
              <FloatingAlbum key={song.id} imgUrl={song.img} />
            </Suspense>
            <div className="absolute top-5 left-5 flex items-center gap-2">
              <span className="live-dot inline-block w-2 h-2 rounded-full bg-pink-500" />
              <span className="font-mono text-[10px] tracking-[0.3em] text-pink-400">
                ON AIR
              </span>
            </div>
            <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between">
              <div>
                <div className="font-mono text-[10px] tracking-[0.25em] text-cyan-300 mb-1">
                  NOW PLAYING
                </div>
                <div className="font-unbounded font-black text-2xl md:text-4xl tracking-tight">
                  {song.title}
                </div>
                <div className="text-white/60">{song.artist}</div>
              </div>
              <div className="text-right">
                <div className="font-mono text-[10px] tracking-[0.25em] text-white/50">
                  TEMP
                </div>
                <div className="font-unbounded font-black text-3xl text-pink-400 text-glow-pink">
                  {song.temp}°
                </div>
              </div>
            </div>
            </div>
          </Reveal>

          {/* Control Room */}
          <div className="lg:col-span-5 space-y-5">
            <Reveal delay={0.2}>
              <div className="rounded-2xl glass p-6">
              <div className="font-mono text-[10px] tracking-[0.3em] text-cyan-300 mb-4">
                CONTROL ROOM
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setPlaying(!playing)}
                  data-testid="refinery-play-btn"
                  className="w-16 h-16 rounded-full bg-cyan-400 text-black flex items-center justify-center glow-cyan hover:bg-white transition-colors"
                  aria-label="play"
                >
                  {playing ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1" />}
                </button>
                <div className="flex items-end gap-[3px] h-12">
                  {Array.from({ length: 24 }).map((_, i) => (
                    <span
                      key={i}
                      className="vbar w-[3px] h-full bg-gradient-to-t from-cyan-400 to-pink-500 rounded-sm"
                      style={{
                        animationDelay: `${(i * 0.07) % 1}s`,
                        animationDuration: `${0.6 + (i % 5) * 0.1}s`,
                        animationPlayState: playing ? "running" : "paused",
                      }}
                    />
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-6">
                {[
                  { l: "EARS", v: song.ears, i: Headphones, c: "cyan-300" },
                  { l: "RIPPLES", v: song.likes, i: Heart, c: "pink-400" },
                  { l: "HEAT", v: `${song.temp}°`, i: Flame, c: "yellow-300" },
                ].map(({ l, v, i: Icon, c }) => (
                  <div key={l} className="rounded-lg border border-white/10 p-3 bg-black/40">
                    <Icon className={`w-3.5 h-3.5 text-${c}`} />
                    <div className="font-unbounded font-black text-xl mt-1">{v}</div>
                    <div className="font-mono text-[9px] tracking-[0.25em] text-white/50">{l}</div>
                  </div>
                ))}
              </div>
            </div>
            </Reveal>

            <Reveal delay={0.3}>
              <div className="rounded-2xl glass p-6">
                <div className="font-mono text-[10px] tracking-[0.3em] text-pink-400 mb-4">
                  LIVE STATS
                </div>
                <div className="space-y-3">
                  {[
                    { l: "Listeners now", v: platformStats.liveListeners },
                    { l: "Ears reached", v: platformStats.earsReached },
                    { l: "Total ripples", v: platformStats.ripples },
                    { l: "Avg temperature", v: `${platformStats.avgTemp}°` },
                  ].map((s) => (
                    <div key={s.l} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                      <span className="font-mono text-[11px] tracking-[0.15em] text-white/60 uppercase">{s.l}</span>
                      <span className="font-unbounded font-bold text-cyan-300">{s.v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </div>

        {/* Up Next */}
        <div className="mt-12">
          <Reveal>
            <div className="flex items-center gap-3 mb-5">
              <Radio className="w-4 h-4 text-cyan-300" />
              <div className="font-mono text-[10px] tracking-[0.3em] text-cyan-300">UP NEXT IN THE QUEUE</div>
            </div>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {trendingSongs.slice(0, 6).map((s, i) => (
              <Reveal key={s.id} delay={(i % 3) * 0.08}>
                <button
                  onClick={() => setIdx(i)}
                  data-testid={`queue-item-${i}`}
                  className={`text-left tilt rounded-xl p-3 glass flex items-center gap-3 w-full ${
                    i === idx ? "border-cyan-400/50" : ""
                  }`}
                >
                  <img src={s.img} alt={s.title} className="w-14 h-14 rounded object-cover" />
                  <div className="min-w-0 flex-1">
                    <div className="font-unbounded font-bold text-sm truncate">{s.title}</div>
                    <div className="font-mono text-[10px] text-white/50">{s.artist}</div>
                  </div>
                  <div className="font-mono text-[10px] text-cyan-300">{s.temp}°</div>
                </button>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
