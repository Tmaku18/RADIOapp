import React, { useState } from "react";
import { Plus, Shield, Clock, ArrowRight } from "lucide-react";
import { services } from "@/data/proAppData";
import Reveal from "@/components/Reveal";

const TABS = ["All", "Design", "Photo", "Video", "Audio", "Words"];

const ROLE_TAB = {
  "Graphic Designer": "Design",
  "Illustrator": "Design",
  "Stylist": "Design",
  "Photographer": "Photo",
  "Videographer": "Video",
  "Beat Maker": "Audio",
  "Engineer": "Audio",
  "Lyricist": "Words",
};

export default function ServicesPage() {
  const [tab, setTab] = useState("All");
  const list = tab === "All" ? services : services.filter((s) => ROLE_TAB[s.role] === tab);

  return (
    <div data-testid="services-page">
      <Reveal>
        <div className="flex items-end justify-between flex-wrap gap-4 mb-6">
          <div>
            <h1 className="font-unbounded font-black tracking-tighter uppercase text-3xl md:text-4xl">
              Services <span className="text-glow-yellow text-yellow-300">marketplace</span>
            </h1>
            <p className="text-white/50 mt-1 text-sm">
              List what you do, set a price, let buyers find you.
            </p>
          </div>
          <button
            data-testid="services-list-btn"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-cyan-400 text-black font-mono text-[10px] tracking-[0.25em] uppercase font-bold glow-cyan hover:bg-white"
          >
            <Plus className="w-4 h-4" /> List a service
          </button>
        </div>
      </Reveal>

      <Reveal delay={0.05}>
        <div className="flex items-center gap-2 flex-wrap mb-6">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              data-testid={`services-tab-${t.toLowerCase()}`}
              className={`px-4 py-2 rounded-full font-mono text-[10px] tracking-[0.2em] uppercase border transition-colors ${
                tab === t
                  ? "bg-cyan-400 text-black border-cyan-400"
                  : "border-white/15 text-white/70 hover:border-cyan-400/50 hover:text-cyan-300"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </Reveal>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {list.map((s, i) => (
          <Reveal key={s.id} delay={(i % 3) * 0.08}>
            <div data-testid={`service-card-${s.id}`} className="tilt rounded-2xl glass overflow-hidden h-full flex flex-col cursor-pointer">
              <div className="aspect-[16/9] relative overflow-hidden">
                <img src={s.img} alt={s.title} className="w-full h-full object-cover" loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
                <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/70 border border-cyan-400/30 backdrop-blur font-mono text-[9px] tracking-[0.2em] text-cyan-300">
                  {s.role.toUpperCase()}
                </div>
                {s.verified && (
                  <div className="absolute top-3 right-3 px-2 py-1 rounded-full bg-black/70 border border-pink-400/30 backdrop-blur flex items-center gap-1">
                    <Shield className="w-3 h-3 text-pink-400" />
                    <span className="font-mono text-[9px] tracking-[0.2em] text-pink-400">VERIFIED</span>
                  </div>
                )}
              </div>
              <div className="p-4 flex-1 flex flex-col">
                <div className="font-unbounded font-bold text-lg leading-snug">{s.title}</div>
                <div className="mt-1 font-mono text-[10px] text-white/50">by {s.handle}</div>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {s.tags.map((t) => (
                    <span key={t} className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 font-mono text-[9px] text-white/70">
                      {t}
                    </span>
                  ))}
                </div>
                <div className="mt-auto pt-4 border-t border-white/5 flex items-center justify-between">
                  <div>
                    <div className="font-unbounded font-black text-yellow-300 text-2xl">${s.price}</div>
                    <div className="font-mono text-[10px] text-white/40 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {s.eta}
                    </div>
                  </div>
                  <button
                    data-testid={`service-hire-${s.id}`}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-pink-500/15 border border-pink-400/40 text-pink-300 font-mono text-[10px] tracking-[0.2em] uppercase hover:bg-pink-500/30"
                  >
                    Hire <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
