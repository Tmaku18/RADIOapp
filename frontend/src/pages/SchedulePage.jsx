import React from "react";
import { schedule } from "@/data/mockData";
import { Clock, Radio } from "lucide-react";
import Reveal from "@/components/Reveal";

export default function SchedulePage() {
  return (
    <div className="relative pt-28 pb-40 min-h-screen" data-testid="schedule-page">
      <div className="max-w-5xl mx-auto px-6 lg:px-10">
        <Reveal>
          <div className="mb-12">
            <div className="font-mono text-[10px] tracking-[0.3em] text-yellow-300 mb-2">◤ MINING TIMELINE</div>
            <h1 className="font-unbounded font-black tracking-tighter uppercase text-5xl md:text-7xl">
              Weekly <span className="text-glow-cyan text-cyan-300">Schedule</span>
            </h1>
            <p className="text-white/60 mt-3 max-w-xl">
              Every show is a fresh dig through the frequency. Tune in when your sound calls.
            </p>
          </div>
        </Reveal>

        <div className="relative">
          {/* Vertical neon timeline */}
          <div className="absolute left-6 top-0 bottom-0 w-px bg-gradient-to-b from-cyan-400 via-pink-500 to-yellow-300 opacity-60" />
          <ul className="space-y-4">
            {schedule.map((s, i) => (
              <Reveal key={s.day} delay={i * 0.06} y={20}>
                <li
                  data-testid={`schedule-row-${i}`}
                  className="tilt relative pl-16 pr-6 py-5 rounded-xl glass group"
                >
                <div className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black border-2 border-cyan-400 flex items-center justify-center glow-cyan">
                  <span className="font-mono text-[10px] font-bold text-cyan-300">{s.day}</span>
                </div>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                  <div className="flex items-center gap-2 font-mono text-xs text-white/60">
                    <Clock className="w-3 h-3" /> {s.time}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-unbounded font-bold text-lg tracking-tight">
                      {s.show}
                    </div>
                    <div className="font-mono text-[11px] text-white/50 mt-1">
                      with <span className="text-cyan-300">{s.host}</span> · {s.genre}
                    </div>
                  </div>
                  <button
                    data-testid={`schedule-remind-${i}`}
                    className="px-4 py-2 rounded-full border border-white/15 text-white/70 font-mono text-[10px] tracking-[0.2em] uppercase hover:border-pink-400 hover:text-pink-400 transition-colors flex items-center gap-2"
                  >
                    <Radio className="w-3 h-3" /> Remind Me
                  </button>
                </div>
              </li>
              </Reveal>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
