import React, { useState, useRef, useEffect, useMemo } from "react";
import { Play, Pause, SkipBack, SkipForward, Volume2, Send, MessageSquare, ChevronRight, Radio as RadioIcon, Headphones, Heart, Flame, Wifi, WifiOff } from "lucide-react";
import { trendingSongs, platformStats } from "@/data/radioAppData";
import { radioMe } from "@/data/radioAppData";
import { usePlayer } from "@/context/PlayerContext";
import Reveal from "@/components/Reveal";
import useAudioAnalyser from "@/hooks/useAudioAnalyser";

const STREAM_URL = process.env.REACT_APP_RADIO_STREAM_URL || "";
const BARS = 32;

// Audio-reactive 32-bar visualizer driven by AnalyserNode FFT data
function Visualizer({ dataRef, playing }) {
  const barsRef = useRef([]);
  useEffect(() => {
    let raf;
    const tick = () => {
      const data = dataRef.current;
      barsRef.current.forEach((el, i) => {
        if (!el) return;
        const v = (data[i] || 0) / 255; // 0..1
        const h = Math.max(0.04, v);
        el.style.height = `${h * 100}%`;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [dataRef]);

  return (
    <div className="flex items-end justify-between gap-1.5 h-20 px-2" data-testid="netx-visualizer">
      {Array.from({ length: BARS }).map((_, i) => (
        <span
          key={i}
          ref={(el) => (barsRef.current[i] = el)}
          className={`flex-1 min-w-[3px] rounded-sm transition-[height] duration-75 ease-out ${
            playing
              ? "bg-gradient-to-t from-cyan-400 via-cyan-300 to-pink-500"
              : "bg-gradient-to-t from-cyan-400/40 via-cyan-300/30 to-pink-500/40"
          }`}
          style={{ height: "4%" }}
        />
      ))}
    </div>
  );
}

// Compact, slim live chat — small, never dominates
function LiveChat() {
  const [msgs, setMsgs] = useState([
    { id: 1, u: "Merkell", t: "first 🦋" },
    { id: 2, u: "PayAuto", t: "this beat is heat" },
    { id: 3, u: "Tanaka", t: "set list mid-week stronger" },
    { id: 4, u: "SSQB", t: "ripple sent" },
  ]);
  const [draft, setDraft] = useState("");
  const listRef = useRef(null);
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [msgs]);

  const send = (e) => {
    e.preventDefault();
    if (!draft.trim()) return;
    setMsgs((m) => [...m, { id: Date.now(), u: radioMe.name, t: draft }]);
    setDraft("");
  };

  return (
    <aside data-testid="live-chat" className="rounded-2xl glass overflow-hidden flex flex-col h-full">
      <header className="px-4 py-3 border-b border-white/10 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-3.5 h-3.5 text-cyan-300" />
          <div>
            <div className="font-mono text-[10px] tracking-[0.3em] text-cyan-300">LIVE CHAT</div>
            <div className="font-mono text-[9px] text-white/40">us-ready-now-rap · {msgs.length + 28} online</div>
          </div>
        </div>
        <span className="live-dot w-1.5 h-1.5 rounded-full bg-cyan-400" />
      </header>

      <div ref={listRef} className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[280px] max-h-[320px]">
        {msgs.map((m) => (
          <div key={m.id} data-testid={`chat-msg-${m.id}`} className="text-xs leading-snug">
            <span className="font-mono text-[10px] tracking-[0.15em] text-cyan-300 mr-2">{m.u}</span>
            <span className="text-white/80">{m.t}</span>
          </div>
        ))}
      </div>

      <form onSubmit={send} className="p-3 border-t border-white/10 flex items-center gap-2 shrink-0">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={280}
          data-testid="chat-input"
          placeholder="Send a ripple…"
          className="flex-1 bg-black/60 border border-white/10 rounded-full px-3 py-2 text-xs placeholder-white/30 focus:outline-none focus:border-cyan-400"
        />
        <button
          type="submit"
          data-testid="chat-send"
          className="w-8 h-8 rounded-full bg-cyan-400 text-black flex items-center justify-center glow-cyan hover:bg-white shrink-0"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </aside>
  );
}

export default function NetxRadioPage() {
  const { song, next, prev, idx, setIdx, volume, setVolume, progress } = usePlayer();
  const { audioRef, playing, toggle, dataRef, error } = useAudioAnalyser(STREAM_URL, BARS);
  const cur = useMemo(() => `${Math.floor((progress / 100) * 141)}s`, [progress]);
  const artRef = useRef(null);

  // Keep <audio> element volume synced to slider
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = Math.max(0, Math.min(1, volume / 100));
  }, [volume, audioRef]);

  // Bass-pulse the album art using the lowest 4 FFT bins of THIS page's analyser
  useEffect(() => {
    let raf;
    let smoothed = 0;
    const tick = () => {
      const d = dataRef?.current;
      if (d && d.length) {
        const raw = ((d[0] || 0) + (d[1] || 0) + (d[2] || 0) + (d[3] || 0)) / 4 / 255;
        smoothed = smoothed * 0.7 + raw * 0.3;
      } else {
        smoothed = smoothed * 0.95;
      }
      const i = Math.min(1, smoothed * 1.6);
      if (artRef.current) {
        artRef.current.style.boxShadow = `0 0 ${20 + i * 60}px rgba(0,240,255,${0.3 + i * 0.55}), 0 0 ${50 + i * 120}px rgba(255,0,127,${0.08 + i * 0.35})`;
        artRef.current.style.transform = `scale(${1 + i * 0.03})`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [dataRef]);

  return (
    <div data-testid="netx-radio-page" className="space-y-5">
      {/* Page header — minimal */}
      <Reveal>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="live-dot w-1.5 h-1.5 rounded-full bg-pink-500" />
              <span className="font-mono text-[10px] tracking-[0.3em] text-pink-400">ON AIR · THE REFINERY</span>
            </div>
            <h1 className="font-unbounded font-black tracking-tighter uppercase text-3xl md:text-4xl">
              Live <span className="text-glow-cyan text-cyan-300">radio</span>
            </h1>
          </div>
          <button data-testid="change-station" className="px-4 py-2 rounded-full border border-cyan-400/40 text-cyan-300 font-mono text-[10px] tracking-[0.25em] uppercase hover:bg-cyan-400 hover:text-black flex items-center gap-2">
            Change station <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </Reveal>

      {/* 2-column: player center stage, slim chat right rail */}
      <div className="grid lg:grid-cols-[1fr_320px] gap-5 items-start">
        {/* MAIN PLAYER — front and center */}
        <Reveal>
          <div data-testid="player-hero" className="relative rounded-3xl glass overflow-hidden">
            <div className="absolute inset-0 cyber-grid opacity-20 pointer-events-none" />
            <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-cyan-500/20 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -right-24 w-72 h-72 rounded-full bg-pink-500/15 blur-3xl pointer-events-none" />

            <div className="relative p-6 md:p-8 flex flex-col md:flex-row gap-6 md:gap-8 items-center">
              {/* Album art — large but not dominating, bass-pulsed aura */}
              <div
                ref={artRef}
                className="relative w-56 h-56 md:w-72 md:h-72 rounded-2xl overflow-hidden ring-1 ring-cyan-400/30 shrink-0 transition-[box-shadow,transform] duration-75 will-change-transform"
              >
                <img src={song.img} alt={song.title} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-black/70 border border-pink-400/40 backdrop-blur">
                  <span className="live-dot w-1.5 h-1.5 rounded-full bg-pink-500" />
                  <span className="font-mono text-[9px] tracking-[0.25em] text-pink-400">ON AIR</span>
                </div>
              </div>

              {/* Info + controls + progress */}
              <div className="flex-1 min-w-0 w-full">
                <div className="font-mono text-[10px] tracking-[0.3em] text-cyan-300 mb-2">NOW PLAYING</div>
                <div className="font-unbounded font-black text-3xl md:text-5xl tracking-tighter leading-none">
                  {song.title}
                </div>
                <div className="text-white/65 mt-1">{song.artist}</div>

                {/* Inline stats */}
                <div className="mt-4 flex items-center gap-5 text-xs text-white/60 flex-wrap">
                  <span className="flex items-center gap-1.5"><Headphones className="w-3.5 h-3.5 text-cyan-300" /> {song.ears} ears</span>
                  <span className="flex items-center gap-1.5"><Heart className="w-3.5 h-3.5 text-pink-400" /> {song.likes} ripples</span>
                  <span className="flex items-center gap-1.5"><Flame className="w-3.5 h-3.5 text-yellow-300" /> {song.temp}°</span>
                  <span className="flex items-center gap-1.5"><RadioIcon className="w-3.5 h-3.5 text-cyan-300" /> {platformStats.liveListeners} listeners</span>
                </div>

                {/* Controls */}
                <div className="mt-6 flex items-center gap-4">
                  <button onClick={prev} data-testid="radio-prev" className="w-10 h-10 rounded-full border border-white/15 text-white/80 hover:text-cyan-300 hover:border-cyan-400/50 flex items-center justify-center">
                    <SkipBack className="w-4 h-4" />
                  </button>
                  <button
                    onClick={toggle}
                    data-testid="radio-play-big"
                    className="w-16 h-16 rounded-full bg-cyan-400 text-black flex items-center justify-center glow-cyan hover:bg-white"
                  >
                    {playing ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1" />}
                  </button>
                  <button onClick={next} data-testid="radio-next" className="w-10 h-10 rounded-full border border-white/15 text-white/80 hover:text-cyan-300 hover:border-cyan-400/50 flex items-center justify-center">
                    <SkipForward className="w-4 h-4" />
                  </button>
                  <div className="flex items-center gap-2 ml-auto w-44">
                    <Volume2 className="w-4 h-4 text-white/50" />
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={volume}
                      onChange={(e) => setVolume(+e.target.value)}
                      data-testid="radio-volume"
                      className="w-full accent-cyan-400"
                    />
                  </div>
                </div>

                {/* Progress + timing */}
                <div className="mt-5 flex items-center gap-3">
                  <span className="font-mono text-[10px] text-white/40 w-10 text-right">{cur}</span>
                  <div className="relative flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyan-400 to-pink-500" style={{ width: `${progress}%` }} />
                  </div>
                  <span className="font-mono text-[10px] text-white/40 w-10">2:21</span>
                </div>
              </div>
            </div>

            {/* Visualizer — flush with player, full width, aligned, audio-reactive */}
            <div className="relative border-t border-white/10 bg-black/40 px-6 md:px-8 py-5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3 font-mono text-[10px] tracking-[0.3em] text-cyan-300">
                  <span>FREQUENCY VISUALIZER</span>
                  {STREAM_URL ? (
                    <span className="flex items-center gap-1 text-cyan-300/60">
                      <Wifi className="w-3 h-3" /> LIVE FFT
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-white/40">
                      <WifiOff className="w-3 h-3" /> NO STREAM
                    </span>
                  )}
                </div>
                <div className="font-mono text-[10px] tracking-[0.25em] text-white/40">
                  {error ? `ERR · ${String(error).slice(0, 30)}` : playing ? "TRANSMITTING ▶" : "STANDBY ■"}
                </div>
              </div>
              <Visualizer dataRef={dataRef} playing={playing} />
              {/* Hidden audio element — actual stream source */}
              <audio
                ref={audioRef}
                src={STREAM_URL}
                crossOrigin="anonymous"
                preload="none"
                data-testid="radio-audio"
                className="hidden"
              />
            </div>
          </div>
        </Reveal>

        {/* RIGHT RAIL — slim live chat */}
        <Reveal delay={0.1}>
          <LiveChat />
        </Reveal>
      </div>

      {/* UP NEXT — full-width row below player */}
      <Reveal>
        <div className="rounded-2xl glass p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="font-mono text-[10px] tracking-[0.3em] text-pink-400">UP NEXT IN THE QUEUE</div>
            <span className="font-mono text-[10px] tracking-[0.25em] text-white/40">{trendingSongs.length} TRACKS</span>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {trendingSongs.slice(0, 8).map((s, i) => (
              <button
                key={s.id}
                onClick={() => setIdx(i)}
                data-testid={`netx-queue-${i}`}
                className={`text-left tilt rounded-xl p-2.5 flex items-center gap-3 transition-colors ${
                  i === idx ? "bg-cyan-400/10 ring-1 ring-cyan-400/40" : "bg-black/40 border border-white/5 hover:border-cyan-400/30"
                }`}
              >
                <img src={s.img} alt="" className="w-12 h-12 rounded object-cover shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="font-unbounded font-bold text-xs truncate">{s.title}</div>
                  <div className="font-mono text-[9px] text-white/50 truncate">{s.artist}</div>
                </div>
                <div className="font-mono text-[10px] text-cyan-300 shrink-0">{s.temp}°</div>
              </button>
            ))}
          </div>
        </div>
      </Reveal>
    </div>
  );
}
