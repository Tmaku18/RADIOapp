import React, { useState, useRef, useEffect } from "react";
import { Link, NavLink } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { usePlayer } from "@/context/PlayerContext";

const links = [
  { to: "/", label: "Home" },
  { to: "/radio", label: "Live Radio" },
  { to: "/artists", label: "Artists" },
  { to: "/schedule", label: "Schedule" },
  { to: "/pro", label: "Pro" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
];

export default function Nav() {
  const [open, setOpen] = useState(false);
  const { bassRef } = usePlayer();
  const logoRef = useRef(null);
  const imgRef = useRef(null);

  // Bass-pulse the butterfly logo: scale + neon glow on every kick
  useEffect(() => {
    let raf;
    const tick = () => {
      const b = bassRef?.current ?? 0;
      const i = Math.min(1, b * 1.5);
      if (logoRef.current) {
        logoRef.current.style.boxShadow = `0 0 ${8 + i * 28}px rgba(0,240,255,${0.35 + i * 0.55}), 0 0 ${18 + i * 60}px rgba(0,240,255,${0.1 + i * 0.35})`;
        logoRef.current.style.borderColor = `rgba(0,240,255,${0.4 + i * 0.55})`;
      }
      if (imgRef.current) {
        imgRef.current.style.transform = `scale(${1 + i * 0.12})`;
        imgRef.current.style.filter = `drop-shadow(0 0 ${4 + i * 14}px rgba(0,240,255,${0.4 + i * 0.5}))`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [bassRef]);

  return (
    <header className="fixed top-0 left-0 right-0 z-40" data-testid="site-nav">
      <div className="glass-strong border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-4 flex items-center justify-between">
          <Link
            to="/"
            data-testid="nav-logo"
            className="flex items-center gap-3 group"
          >
            <div
              ref={logoRef}
              className="w-10 h-10 rounded-md flex items-center justify-center bg-black border border-cyan-400/40 overflow-hidden p-1 transition-[box-shadow,border-color] duration-75"
            >
              <img
                ref={imgRef}
                src="/brand/networx-logo.png"
                alt="Networx"
                className="w-full h-full object-contain transition-[transform,filter] duration-75"
              />
            </div>
            <div className="leading-none">
              <div className="font-unbounded font-black tracking-tighter text-lg">
                NETWORX
              </div>
              <div className="font-mono text-[10px] tracking-[0.3em] text-cyan-300/80">
                THE BUTTERFLY EFFECT
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
              to="/networx/app"
              data-testid="nav-dashboard-btn"
              className="px-5 py-2 rounded-full bg-cyan-400 text-black font-mono text-[11px] tracking-[0.25em] uppercase font-bold hover:bg-white transition-colors glow-cyan"
            >
              Dashboard
            </Link>
            <Link
              to="/radio"
              data-testid="nav-tune-in-btn"
              className="px-5 py-2 rounded-full bg-black border border-cyan-400 text-cyan-300 font-mono text-[11px] tracking-[0.25em] uppercase hover:bg-cyan-400 hover:text-black transition-colors"
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
