import React from "react";
import { Link } from "react-router-dom";
import { Radio, Github, Twitter, Instagram } from "lucide-react";

export default function Footer() {
  return (
    <footer className="relative z-10 mt-32 border-t border-white/10 bg-black/60 backdrop-blur-xl" data-testid="site-footer">
      <div className="neon-line" />
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-14 pb-28 grid grid-cols-2 md:grid-cols-4 gap-8">
        <div className="col-span-2">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-md flex items-center justify-center bg-black border border-cyan-400/40 glow-cyan overflow-hidden p-1">
              <img src="/brand/networx-logo.png" alt="Networx" className="w-full h-full object-contain" />
            </div>
            <div className="font-unbounded font-black tracking-tighter text-xl">NETWORX</div>
          </div>
          <p className="text-white/60 max-w-md leading-relaxed">
            Underground Music Radio. Where hidden gems become diamonds. Tune in,
            send Ripples, and mine the frequency.
          </p>
          <div className="mt-6 flex items-center gap-3">
            {[Twitter, Instagram, Github].map((Icon, i) => (
              <a
                key={i}
                href="#"
                data-testid={`social-link-${i}`}
                className="w-9 h-9 rounded-full flex items-center justify-center border border-white/10 text-white/70 hover:text-cyan-300 hover:border-cyan-400/50 transition-colors"
              >
                <Icon className="w-4 h-4" />
              </a>
            ))}
          </div>
        </div>

        <div>
          <div className="font-mono text-[10px] tracking-[0.3em] text-cyan-300 mb-4">
            EXPLORE
          </div>
          <ul className="space-y-2 text-sm text-white/70">
            <li><Link className="hover:text-cyan-300" to="/radio">Live Radio</Link></li>
            <li><Link className="hover:text-cyan-300" to="/artists">Artists</Link></li>
            <li><Link className="hover:text-cyan-300" to="/schedule">Schedule</Link></li>
            <li><Link className="hover:text-cyan-300" to="/about">About</Link></li>
          </ul>
        </div>
        <div>
          <div className="font-mono text-[10px] tracking-[0.3em] text-pink-400 mb-4">
            THE LEXICON
          </div>
          <ul className="space-y-2 text-sm text-white/70">
            <li>Ripples</li>
            <li>Gems &amp; Diamonds</li>
            <li>The Refinery</li>
            <li>The Yield</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/5 py-5 text-center font-mono text-[10px] tracking-[0.3em] text-white/40">
        © {new Date().getFullYear()} NETWORX RADIO — MINING THE FREQUENCY
      </div>
    </footer>
  );
}
