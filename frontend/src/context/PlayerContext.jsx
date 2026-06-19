import React, { createContext, useContext, useState, useEffect } from "react";
import { trendingSongs } from "@/data/mockData";

const PlayerContext = createContext(null);

export function PlayerProvider({ children }) {
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(72);
  const [progress, setProgress] = useState(34);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setProgress((p) => (p >= 100 ? 0 : p + 0.3));
    }, 250);
    return () => clearInterval(id);
  }, [playing]);

  const song = trendingSongs[idx];
  const next = () => setIdx((i) => (i + 1) % trendingSongs.length);
  const prev = () => setIdx((i) => (i - 1 + trendingSongs.length) % trendingSongs.length);

  return (
    <PlayerContext.Provider
      value={{
        idx,
        setIdx,
        song,
        playing,
        setPlaying,
        volume,
        setVolume,
        progress,
        next,
        prev,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used inside PlayerProvider");
  return ctx;
}
