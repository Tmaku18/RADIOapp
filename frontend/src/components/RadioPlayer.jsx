import React from "react";
import { Play, Pause, SkipBack, SkipForward, Volume2, Radio } from "lucide-react";
import { usePlayer } from "@/context/PlayerContext";

export default function RadioPlayer() {
  const { song, playing, setPlaying, next, prev, volume, setVolume, progress } = usePlayer();

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-30 glass-strong border-t border-cyan-400/15"
      data-testid="radio-player"
    >
      <div className="neon-line" />
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-3 flex items-center gap-4">
        <div className="flex items-center gap-3 min-w-0 flex-1 lg:flex-none lg:w-72">
          <div className="relative w-12 h-12 rounded overflow-hidden border border-white/10 shrink-0">
            <img src={song.img} alt={song.title} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="live-dot inline-block w-1.5 h-1.5 rounded-full bg-pink-500" />
              <span className="font-mono text-[10px] tracking-[0.25em] text-pink-400">LIVE</span>
            </div>
            <div data-testid="player-song-title" className="font-unbounded font-bold text-sm truncate">
              {song.title}
            </div>
            <div className="font-mono text-[10px] text-white/50 truncate">{song.artist}</div>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center gap-2">
          <div className="flex items-center gap-3">
            <button onClick={prev} data-testid="player-prev-btn" className="text-white/70 hover:text-cyan-300 transition-colors" aria-label="previous">
              <SkipBack className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPlaying(!playing)}
              data-testid="player-play-btn"
              className="w-10 h-10 rounded-full bg-cyan-400 text-black flex items-center justify-center glow-cyan hover:bg-cyan-300 transition-colors"
              aria-label="play"
            >
              {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
            </button>
            <button onClick={next} data-testid="player-next-btn" className="text-white/70 hover:text-cyan-300 transition-colors" aria-label="next">
              <SkipForward className="w-4 h-4" />
            </button>
            <div className="hidden md:flex items-end gap-[3px] h-6 ml-2">
              {[0.1, 0.3, 0.2, 0.4, 0.25, 0.35, 0.15, 0.5, 0.2].map((d, i) => (
                <span
                  key={i}
                  className="vbar w-[3px] h-full bg-gradient-to-t from-cyan-400 to-pink-500 rounded-sm"
                  style={{
                    animationDelay: `${d}s`,
                    animationPlayState: playing ? "running" : "paused",
                  }}
                />
              ))}
            </div>
          </div>
          <div className="w-full max-w-2xl flex items-center gap-3">
            <span className="font-mono text-[10px] text-white/40 w-8 text-right">
              {Math.floor((progress / 100) * 180)}s
            </span>
            <div className="relative flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
              <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyan-400 to-pink-500" style={{ width: `${progress}%` }} />
            </div>
            <span className="font-mono text-[10px] text-white/40 w-8">180s</span>
          </div>
        </div>

        <div className="hidden lg:flex items-center gap-4 w-72 justify-end">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-cyan-300" />
            <span className="font-mono text-[10px] tracking-[0.2em] text-white/60">TEMP</span>
            <span className="font-unbounded font-black text-cyan-300 text-sm">{song.temp}°</span>
          </div>
          <div className="flex items-center gap-2 w-32">
            <Volume2 className="w-4 h-4 text-white/60" />
            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={(e) => setVolume(+e.target.value)}
              data-testid="player-volume"
              className="w-full accent-cyan-400"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
