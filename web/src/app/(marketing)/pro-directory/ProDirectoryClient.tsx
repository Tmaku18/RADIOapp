'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Filter, Search } from 'lucide-react';
import { Reveal } from '@/components/dimension/Reveal';
import { proDirectoryRoles, proDisciplines } from '@/data/pro-marketing-data';
import { getProNetworxAppUrl } from '@/lib/site-url';

export function ProDirectoryClient() {
  const [q, setQ] = useState('');
  const [role, setRole] = useState('All');

  const liveDirectoryUrl = `${getProNetworxAppUrl()}/pro-networx/directory`;
  const browseUrl = useMemo(() => {
    const params = new URLSearchParams();
    const ql = q.trim();
    if (ql) params.set('q', ql);
    if (role !== 'All') params.set('role', role);
    const qs = params.toString();
    return qs ? `${liveDirectoryUrl}?${qs}` : liveDirectoryUrl;
  }, [liveDirectoryUrl, q, role]);

  const totalDisciplines = proDisciplines.reduce((s, d) => s + d.count, 0);

  return (
    <div className="relative pb-40 min-h-screen" data-testid="pro-directory-page">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10">
        <Reveal>
          <div className="mb-8 pt-8">
            <div className="font-dim-mono text-[10px] tracking-[0.3em] text-yellow-300 mb-2">
              ◤ PRO-NETWORX · DIRECTORY
            </div>
            <h1 className="font-unbounded font-black tracking-tighter uppercase text-4xl md:text-7xl">
              Hire a <span className="text-glow-cyan text-cyan-300">Catalyst.</span>
            </h1>
            <p className="text-white/60 mt-3 max-w-xl">
              Every profile is a verified creative ready to ship the next chapter of an artist&apos;s story.
            </p>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="rounded-2xl glass p-4 md:p-5 mb-8 flex flex-col lg:flex-row gap-3 lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <input
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                data-testid="directory-search"
                placeholder="Search by name, skill, city…"
                className="w-full bg-black/60 border border-white/10 rounded-lg pl-11 pr-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-cyan-400 transition-all"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="w-4 h-4 text-cyan-300 shrink-0" />
              {proDirectoryRoles.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  data-testid={`directory-filter-${r.replace(/\s/g, '-').toLowerCase()}`}
                  className={`px-3 py-1.5 rounded-full font-dim-mono text-[10px] tracking-[0.2em] uppercase border transition-colors ${
                    role === r
                      ? 'bg-cyan-400 text-black border-cyan-400'
                      : 'border-white/15 text-white/70 hover:border-cyan-400/50 hover:text-cyan-300'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.15}>
          <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
            <div className="font-dim-mono text-[11px] tracking-[0.25em] text-white/60">
              Browse live catalyst profiles on Pro-Networx
            </div>
            <div className="font-dim-mono text-[11px] tracking-[0.25em] text-cyan-300">
              {totalDisciplines}+ LISTED ON PLATFORM
            </div>
          </div>
        </Reveal>

        <Reveal>
          <div className="rounded-2xl border border-dashed border-white/15 p-10 md:p-16 text-center glass">
            <div className="font-unbounded font-black text-2xl md:text-3xl mb-3">
              Live directory on Pro-Networx
            </div>
            <p className="text-white/50 max-w-lg mx-auto mb-8">
              Catalyst profiles, portfolios, and messaging live on Pro-Networx. Use your search and filters, then open the live directory.
            </p>
            <Link
              href={browseUrl}
              data-testid="directory-browse-live"
              className="inline-flex items-center gap-3 px-7 py-3 rounded-full bg-cyan-400 text-black font-dim-mono text-[11px] tracking-[0.25em] uppercase font-bold glow-cyan hover:bg-white transition-colors"
            >
              Browse live directory
            </Link>
          </div>
        </Reveal>

        <Reveal delay={0.2}>
          <div className="mt-16 rounded-2xl tracing-border p-8 md:p-10 text-center">
            <div className="font-dim-mono text-[10px] tracking-[0.3em] text-pink-400 mb-3">
              ARE YOU A CATALYST?
            </div>
            <h3 className="font-unbounded font-black text-3xl md:text-4xl mb-3">
              Get listed in the directory.
            </h3>
            <p className="text-white/60 max-w-xl mx-auto">
              Build a profile in minutes. Free forever. Subscribe only when you want to unlock messaging.
            </p>
            <div className="mt-6 flex flex-wrap gap-3 justify-center">
              <Link
                href="/signup"
                data-testid="directory-cta"
                className="inline-flex items-center gap-3 px-7 py-3 rounded-full bg-cyan-400 text-black font-dim-mono text-[11px] tracking-[0.25em] uppercase font-bold glow-cyan hover:bg-white"
              >
                Create your profile — free
              </Link>
              <Link
                href="/pro"
                className="inline-flex items-center gap-3 px-7 py-3 rounded-full border border-white/20 text-white font-dim-mono text-[11px] tracking-[0.25em] uppercase hover:border-cyan-400 hover:text-cyan-300"
              >
                Learn about Pro-Networx
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </div>
  );
}
