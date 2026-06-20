import React from "react";
import { NavLink, Outlet, Link } from "react-router-dom";
import {
  Home, Search, ShoppingBag, MessageSquare, UserCircle, Plus, Bell, Settings, LogOut,
} from "lucide-react";
import { me } from "@/data/proAppData";

const tabs = [
  { to: "/pro/app/feed", label: "Feed", Icon: Home },
  { to: "/pro/app/explore", label: "Explore", Icon: Search },
  { to: "/pro/app/services", label: "Services", Icon: ShoppingBag },
  { to: "/pro/app/messages", label: "Messages", Icon: MessageSquare, badge: 3 },
  { to: "/pro/app/profile", label: "Profile", Icon: UserCircle },
];

export default function ProAppShell() {
  return (
    <div className="relative pt-20 min-h-screen" data-testid="pro-app-shell">
      <div className="max-w-[1400px] mx-auto px-4 lg:px-6 grid grid-cols-[64px_1fr] lg:grid-cols-[240px_1fr] gap-5">
        {/* Sidebar */}
        <aside className="sticky top-24 self-start h-[calc(100vh-7rem)] rounded-2xl glass p-3 lg:p-5 flex flex-col gap-2">
          <div className="hidden lg:flex items-center gap-2 px-2 mb-3">
            <div className="w-7 h-7 rounded-md bg-black border border-cyan-400/40 glow-cyan overflow-hidden p-0.5">
              <img src="/brand/networx-logo.png" alt="" className="w-full h-full object-contain" />
            </div>
            <div className="font-mono text-[10px] tracking-[0.3em] text-cyan-300">PRO-APP</div>
          </div>
          {tabs.map(({ to, label, Icon, badge }) => (
            <NavLink
              key={to}
              to={to}
              data-testid={`pro-tab-${label.toLowerCase()}`}
              className={({ isActive }) =>
                `relative flex items-center gap-3 px-3 py-2.5 rounded-lg font-mono text-[11px] tracking-[0.2em] uppercase transition-colors ${
                  isActive
                    ? "bg-cyan-400 text-black"
                    : "text-white/70 hover:bg-white/5 hover:text-cyan-300"
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="hidden lg:inline truncate">{label}</span>
              {badge ? (
                <span className="ml-auto hidden lg:inline-flex items-center justify-center w-5 h-5 rounded-full bg-pink-500 text-white text-[10px] font-bold">
                  {badge}
                </span>
              ) : null}
            </NavLink>
          ))}

          <div className="mt-auto space-y-1 pt-3 border-t border-white/10">
            <button
              data-testid="pro-new-post"
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-pink-500/15 border border-pink-400/30 text-pink-300 font-mono text-[11px] tracking-[0.2em] uppercase hover:bg-pink-500/25"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden lg:inline">New post</span>
            </button>
            <Link
              to="/pro"
              data-testid="pro-app-exit"
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/60 font-mono text-[11px] tracking-[0.2em] uppercase hover:text-white/90 hover:bg-white/5"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden lg:inline">Exit app</span>
            </Link>
          </div>
        </aside>

        {/* Top bar + main */}
        <div className="min-w-0">
          <header className="flex items-center justify-between mb-4 px-1">
            <div className="font-mono text-[10px] tracking-[0.3em] text-cyan-300">
              ◤ NETWORX / PRO-APP
            </div>
            <div className="flex items-center gap-3">
              <button data-testid="pro-bell" className="relative w-9 h-9 rounded-full border border-white/10 text-white/70 hover:text-cyan-300 hover:border-cyan-400/50 flex items-center justify-center">
                <Bell className="w-4 h-4" />
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-pink-500" />
              </button>
              <button data-testid="pro-settings" className="w-9 h-9 rounded-full border border-white/10 text-white/70 hover:text-cyan-300 hover:border-cyan-400/50 flex items-center justify-center">
                <Settings className="w-4 h-4" />
              </button>
              <Link to="/pro/app/profile" data-testid="pro-self-avatar" className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full border border-white/10 hover:border-cyan-400/50 transition-colors">
                <img src={me.avatar} alt={me.name} className="w-7 h-7 rounded-full object-cover" />
                <span className="font-mono text-[10px] tracking-[0.15em] text-white/80 hidden md:inline">
                  {me.handle}
                </span>
              </Link>
            </div>
          </header>

          <main className="pb-20">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
