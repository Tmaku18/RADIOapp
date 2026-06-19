import React from "react";
import { Headphones, Heart, Flame } from "lucide-react";

export default function SongCard({ song, index }) {
  return (
    <div
      data-testid={`song-card-${song.id}`}
      className="tilt group relative rounded-xl overflow-hidden glass cursor-pointer"
    >
      <div className="aspect-square relative overflow-hidden">
        <img
          src={song.img}
          alt={song.title}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
        <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur border border-cyan-400/30">
          <Flame className="w-3 h-3 text-orange-400" />
          <span className="font-mono text-[10px] font-bold text-cyan-300">
            {song.temp}°
          </span>
        </div>
        <div className="absolute top-3 right-3 font-mono text-[9px] tracking-[0.2em] text-white/60">
          #{String(index + 1).padStart(2, "0")}
        </div>
      </div>
      <div className="p-4">
        <div className="font-unbounded font-bold text-sm truncate text-white">
          {song.title}
        </div>
        <div className="font-mono text-[11px] text-white/50 mt-0.5">
          {song.artist}
        </div>
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
          <div className="flex items-center gap-1 text-white/60 text-xs">
            <Headphones className="w-3 h-3" /> {song.ears}
          </div>
          <div className="flex items-center gap-1 text-pink-400 text-xs">
            <Heart className="w-3 h-3" /> {song.likes}
          </div>
        </div>
      </div>
    </div>
  );
}
