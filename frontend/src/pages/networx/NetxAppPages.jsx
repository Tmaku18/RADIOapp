import React, { useState } from "react";
import { Music, Eye, Edit3, Trash2, Plus } from "lucide-react";
import { myUploads, analyticsDaily, refineryQueue, rewards } from "@/data/radioAppData";
import Reveal from "@/components/Reveal";

export function FeedPage() {
  return (
    <div data-testid="netx-feed-page" className="space-y-6">
      <Reveal>
        <h1 className="font-unbounded font-black tracking-tighter uppercase text-3xl md:text-4xl">
          Your <span className="text-glow-pink text-pink-400">feed</span>
        </h1>
      </Reveal>
      <p className="text-white/60">Posts and announcements from artists you follow appear here. Visit <a href="/pro/app/feed" className="text-cyan-300 underline">/pro/app/feed</a> for the full social feed.</p>
    </div>
  );
}

export function DiscoverPage() {
  return (
    <div data-testid="discover-page" className="space-y-6">
      <Reveal>
        <h1 className="font-unbounded font-black tracking-tighter uppercase text-3xl md:text-4xl">
          Discover <span className="text-glow-cyan text-cyan-300">gems</span>
        </h1>
        <p className="text-white/50 mt-1 text-sm">Fresh signals coming through the frequency.</p>
      </Reveal>
      <div className="rounded-2xl border border-dashed border-white/15 p-12 text-center">
        <div className="font-unbounded font-black text-xl mb-2">Discovery engine warming up…</div>
        <p className="text-white/50">Surfacing hidden gems based on your listening fingerprint.</p>
      </div>
    </div>
  );
}

export function UploadsPage() {
  return (
    <div data-testid="uploads-page" className="space-y-6">
      <Reveal>
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-unbounded font-black tracking-tighter uppercase text-3xl md:text-4xl">
              My uploaded <span className="text-glow-yellow text-yellow-300">songs</span>
            </h1>
            <p className="text-white/50 mt-1 text-sm">Track plays, ripples and heat across your catalog.</p>
          </div>
          <button data-testid="uploads-add-btn" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-cyan-400 text-black font-mono text-[10px] tracking-[0.25em] uppercase font-bold glow-cyan hover:bg-white">
            <Plus className="w-4 h-4" /> Upload song
          </button>
        </div>
      </Reveal>
      <div className="rounded-2xl glass overflow-hidden">
        <table className="w-full text-sm" data-testid="uploads-table">
          <thead className="bg-black/40 text-white/50 font-mono text-[10px] tracking-[0.2em]">
            <tr>
              <th className="text-left py-3 px-4">SONG</th>
              <th className="text-right py-3 px-2">PLAYS</th>
              <th className="text-right py-3 px-2">RIPPLES</th>
              <th className="text-right py-3 px-2">HEAT</th>
              <th className="text-right py-3 px-2">STATUS</th>
              <th className="text-right py-3 px-4">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {myUploads.map((u) => (
              <tr key={u.id} data-testid={`upload-row-${u.id}`} className="border-t border-white/5 hover:bg-white/[0.02]">
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <img src={u.img} alt="" className="w-10 h-10 rounded object-cover" />
                    <div>
                      <div className="font-unbounded font-bold text-sm">{u.title}</div>
                      <div className="font-mono text-[9px] text-white/40">{u.uploaded}</div>
                    </div>
                  </div>
                </td>
                <td className="text-right px-2">{u.plays.toLocaleString()}</td>
                <td className="text-right px-2 text-pink-400">{u.ripples}</td>
                <td className="text-right px-2 text-cyan-300">{u.temp}°</td>
                <td className="text-right px-2">
                  <span className={`font-mono text-[9px] tracking-[0.2em] px-2 py-0.5 rounded-full ${
                    u.status === "live" ? "bg-cyan-400/15 text-cyan-300" :
                    u.status === "review" ? "bg-yellow-300/15 text-yellow-300" :
                    "bg-white/10 text-white/50"
                  }`}>
                    {u.status.toUpperCase()}
                  </span>
                </td>
                <td className="text-right px-4">
                  <div className="inline-flex items-center gap-1">
                    <button className="w-8 h-8 rounded hover:bg-white/5 text-white/60 flex items-center justify-center"><Eye className="w-3.5 h-3.5" /></button>
                    <button className="w-8 h-8 rounded hover:bg-white/5 text-cyan-300 flex items-center justify-center"><Edit3 className="w-3.5 h-3.5" /></button>
                    <button className="w-8 h-8 rounded hover:bg-pink-500/10 text-pink-400 flex items-center justify-center"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AnalyticsPage() {
  const max = Math.max(...analyticsDaily.map((d) => d.plays));
  const totalPlays = analyticsDaily.reduce((s, d) => s + d.plays, 0);
  const totalRipples = analyticsDaily.reduce((s, d) => s + d.ripples, 0);
  const totalEars = analyticsDaily.reduce((s, d) => s + d.ears, 0);
  return (
    <div data-testid="analytics-page" className="space-y-6">
      <Reveal>
        <h1 className="font-unbounded font-black tracking-tighter uppercase text-3xl md:text-4xl">
          The <span className="text-glow-cyan text-cyan-300">wake.</span>
        </h1>
        <p className="text-white/50 mt-1 text-sm">7-day analytics for your songs and shows.</p>
      </Reveal>
      <div className="grid sm:grid-cols-3 gap-3">
        {[
          { l: "Plays", v: totalPlays.toLocaleString(), c: "cyan-300" },
          { l: "Ripples", v: totalRipples.toLocaleString(), c: "pink-400" },
          { l: "Ears reached", v: totalEars.toLocaleString(), c: "yellow-300" },
        ].map((s) => (
          <div key={s.l} className="rounded-2xl glass p-4">
            <div className={`font-unbounded font-black text-3xl text-${s.c}`}>{s.v}</div>
            <div className="font-mono text-[9px] tracking-[0.25em] text-white/50 uppercase mt-1">{s.l}</div>
          </div>
        ))}
      </div>
      <Reveal>
        <div className="rounded-2xl glass p-6">
          <div className="font-mono text-[10px] tracking-[0.3em] text-cyan-300 mb-6">DAILY PLAYS</div>
          <div className="flex items-end justify-between gap-2 h-56">
            {analyticsDaily.map((d) => (
              <div key={d.d} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full flex flex-col gap-0.5 items-center" style={{ height: "100%" }}>
                  <div
                    className="w-full bg-gradient-to-t from-cyan-400 to-pink-500 rounded-t"
                    style={{ height: `${(d.plays / max) * 100}%` }}
                    data-testid={`analytics-bar-${d.d}`}
                  />
                </div>
                <div className="font-mono text-[10px] tracking-[0.15em] text-white/60">{d.d}</div>
                <div className="font-mono text-[9px] text-cyan-300">{d.plays}</div>
              </div>
            ))}
          </div>
        </div>
      </Reveal>
    </div>
  );
}

export function RefineryPage() {
  const [idx, setIdx] = useState(0);
  const [refined, setRefined] = useState([]);
  const s = refineryQueue[idx];

  const rate = (score) => {
    setRefined((r) => [...r, { ...s, score }]);
    setIdx((i) => Math.min(i + 1, refineryQueue.length));
  };

  return (
    <div data-testid="refinery-page" className="space-y-6">
      <Reveal>
        <h1 className="font-unbounded font-black tracking-tighter uppercase text-3xl md:text-4xl">
          The <span className="text-glow-pink text-pink-400">refinery</span>
        </h1>
        <p className="text-white/50 mt-1 text-sm">Rank tonight's queue. Earn ${(1.25).toFixed(2)} per refined song.</p>
      </Reveal>
      {s ? (
        <div className="rounded-2xl glass p-6 md:p-8 max-w-2xl">
          <div className="flex items-center gap-5">
            <img src={s.img} alt={s.title} className="w-28 h-28 rounded-xl object-cover" />
            <div>
              <div className="font-mono text-[10px] tracking-[0.3em] text-cyan-300 mb-1">SONG {idx + 1} / {refineryQueue.length}</div>
              <div className="font-unbounded font-black text-2xl">{s.title}</div>
              <div className="font-mono text-[11px] text-white/50">{s.artist} · Heat {s.temp}°</div>
            </div>
          </div>
          <div className="mt-6">
            <div className="font-mono text-[10px] tracking-[0.25em] text-white/60 mb-3">RATE THE SIGNAL</div>
            <div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  data-testid={`refinery-rate-${n}`}
                  onClick={() => rate(n)}
                  className="aspect-square rounded-xl border border-cyan-400/30 hover:bg-cyan-400 hover:text-black text-cyan-300 font-unbounded font-black text-2xl transition-colors"
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl glass p-8 text-center max-w-2xl">
          <div className="font-unbounded font-black text-2xl mb-2">Queue refined ✓</div>
          <p className="text-white/60">You earned ${(refined.length * 1.25).toFixed(2)} this round. Check Rewards to cash out.</p>
        </div>
      )}
    </div>
  );
}

export function RewardsPage() {
  return (
    <div data-testid="rewards-page" className="space-y-6">
      <Reveal>
        <h1 className="font-unbounded font-black tracking-tighter uppercase text-3xl md:text-4xl">
          The <span className="text-glow-yellow text-yellow-300">yield.</span>
        </h1>
        <p className="text-white/50 mt-1 text-sm">Your prospector earnings.</p>
      </Reveal>
      <div className="grid sm:grid-cols-3 gap-3">
        <div className="rounded-2xl bg-gradient-to-br from-cyan-400 to-pink-500 p-[1px]">
          <div className="rounded-2xl bg-black/80 p-5">
            <div className="font-mono text-[10px] tracking-[0.25em] text-cyan-300 mb-1">AVAILABLE BALANCE</div>
            <div className="font-unbounded font-black text-4xl text-white">${rewards.balance.toFixed(2)}</div>
            <button data-testid="rewards-cashout" className="mt-3 px-4 py-1.5 rounded-full bg-cyan-400 text-black font-mono text-[10px] tracking-[0.25em] uppercase font-bold hover:bg-white">Cash out</button>
          </div>
        </div>
        <div className="rounded-2xl glass p-5">
          <div className="font-mono text-[10px] tracking-[0.25em] text-pink-400 mb-1">PENDING</div>
          <div className="font-unbounded font-black text-3xl text-pink-400">${rewards.pending.toFixed(2)}</div>
        </div>
        <div className="rounded-2xl glass p-5">
          <div className="font-mono text-[10px] tracking-[0.25em] text-yellow-300 mb-1">TOTAL EARNED</div>
          <div className="font-unbounded font-black text-3xl text-yellow-300">${rewards.totalEarned.toFixed(2)}</div>
        </div>
      </div>
      <div className="rounded-2xl glass p-5">
        <div className="font-mono text-[10px] tracking-[0.3em] text-cyan-300 mb-4">RECENT YIELD</div>
        <div className="divide-y divide-white/5">
          {rewards.history.map((h) => (
            <div key={h.id} className="flex items-center justify-between py-3" data-testid={`yield-row-${h.id}`}>
              <div className="min-w-0">
                <div className="text-sm truncate">{h.label}</div>
                <div className="font-mono text-[9px] text-white/40 mt-0.5">{h.when}</div>
              </div>
              <div className="font-unbounded font-black text-cyan-300">+${h.amount.toFixed(2)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AdminHomePage() {
  return (
    <div data-testid="admin-home-page" className="space-y-6">
      <Reveal>
        <div className="font-mono text-[10px] tracking-[0.3em] text-pink-400 mb-2">ADMIN · HOME</div>
        <h1 className="font-unbounded font-black tracking-tighter uppercase text-3xl md:text-4xl">
          Mission <span className="text-glow-cyan text-cyan-300">control.</span>
        </h1>
      </Reveal>
      <div className="grid sm:grid-cols-3 gap-3">
        {[
          { l: "Members", v: 96, c: "cyan-300" },
          { l: "Pending uploads", v: 7, c: "pink-400" },
          { l: "Reports", v: 2, c: "yellow-300" },
        ].map((s) => (
          <div key={s.l} className="rounded-2xl glass p-5">
            <div className={`font-unbounded font-black text-3xl text-${s.c}`}>{s.v}</div>
            <div className="font-mono text-[9px] tracking-[0.25em] text-white/50 uppercase mt-1">{s.l}</div>
          </div>
        ))}
      </div>
      <p className="text-white/60 text-sm">Manage users, moderate the submission queue, and tune the frequency from the sub-tabs.</p>
    </div>
  );
}

export function StubPage({ title, body }) {
  return (
    <div data-testid={`stub-${title.toLowerCase().replace(/\s/g, "-")}`} className="space-y-6">
      <Reveal>
        <h1 className="font-unbounded font-black tracking-tighter uppercase text-3xl md:text-4xl">{title}</h1>
        <p className="text-white/50 mt-1 text-sm">{body}</p>
      </Reveal>
      <div className="rounded-2xl border border-dashed border-white/15 p-12 text-center">
        <div className="font-unbounded font-black text-xl mb-2">Coming online soon.</div>
        <p className="text-white/50">This section is being wired into the frequency.</p>
      </div>
    </div>
  );
}
