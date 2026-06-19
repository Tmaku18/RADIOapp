import React, { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { Radio, Menu, X } from "lucide-react";

const links = [
  { to: "/", label: "Home" },
  { to: "/radio", label: "Live Radio" },
  { to: "/artists", label: "Artists" },
  { to: "/schedule", label: "Schedule" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
];

export default function Nav() {
  const [open, setOpen] = useState(false);
  return (
    <header className="fixed top-0 left-0 right-0 z-40" data-testid="site-nav">
      <div className="glass-strong border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-4 flex items-center justify-between">
          <Link
            to="/"
            data-testid="nav-logo"
            className="flex items-center gap-3 group"
          >
            <div className="w-9 h-9 rounded-md flex items-center justify-center bg-black border border-cyan-400/40 glow-cyan">
              <Radio className="w-5 h-5 text-cyan-300" />
            </div>
            <div className="leading-none">
              <div className="font-unbounded font-black tracking-tighter text-lg">
                NETWORX
              </div>
              <div className="font-mono text-[10px] tracking-[0.3em] text-cyan-300/80">
                UNDERGROUND.RADIO
              </div>
            </div>
          </Link>

          <nav className="hidden lg:flex items-center gap-1">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                data-testid={`nav-link-${l.label.toLowerCase().replace(/\s/g, "-")}`}
                className={({ isActive }) =>
                  `px-4 py-2 rounded-md font-mono text-[11px] tracking-[0.2em] uppercase transition-colors ${
                    isActive
                      ? "text-cyan-300 bg-cyan-300/5"
                      : "text-white/70 hover:text-cyan-300 hover:bg-white/5"
                  }`
                }
                end={l.to === "/"}
              >
                {l.label}
              </NavLink>
            ))}
          </nav>

          <div className="hidden lg:flex items-center gap-3">
            <Link
              to="/radio"
              data-testid="nav-tune-in-btn"
              className="px-5 py-2 rounded-full bg-black border border-cyan-400 text-cyan-300 font-mono text-[11px] tracking-[0.25em] uppercase hover:bg-cyan-400 hover:text-black transition-colors glow-cyan"
            >
              Tune In
            </Link>
          </div>

          <button
            className="lg:hidden text-white"
            data-testid="mobile-menu-btn"
            onClick={() => setOpen(!open)}
            aria-label="menu"
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
        <div className="neon-line" />
      </div>

      {open && (
        <div className="lg:hidden glass-strong border-b border-white/5 px-6 py-4 space-y-1">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              onClick={() => setOpen(false)}
              data-testid={`mobile-nav-link-${l.label.toLowerCase().replace(/\s/g, "-")}`}
              className={({ isActive }) =>
                `block px-3 py-2 rounded-md font-mono text-[12px] tracking-[0.2em] uppercase ${
                  isActive ? "text-cyan-300 bg-cyan-300/5" : "text-white/80"
                }`
              }
              end={l.to === "/"}
            >
              {l.label}
            </NavLink>
          ))}
        </div>
      )}
    </header>
  );
}
