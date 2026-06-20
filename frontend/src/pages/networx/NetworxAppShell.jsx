import React, { useState } from "react";
import { NavLink, Outlet, Link } from "react-router-dom";
import {
  Music, Headphones, Mic2, Library, Rss, Flame, UploadCloud, BarChart3,
  Cog, Network, Award, ChevronDown, MoreHorizontal, Shield, Upload, Bell,
  HelpCircle, LogOut, PanelLeftClose, PanelLeftOpen, FileSearch,
} from "lucide-react";
import { radioMe } from "@/data/radioAppData";

const MAIN_TABS = [
  { to: "/networx/app/radio", label: "Radio", Icon: Music },
  { to: "/networx/app/live-dj", label: "Live DJ", Icon: Headphones },
  { to: "/networx/app/live-performances", label: "Live Performances", Icon: Mic2 },
  { to: "/networx/app/library", label: "Library", Icon: Library },
  { to: "/networx/app/feed", label: "Feed", Icon: Rss },
  { to: "/networx/app/discover", label: "Discover", Icon: Flame },
  { to: "/networx/app/uploads", label: "My Uploaded Songs", Icon: UploadCloud },
  { to: "/networx/app/analytics", label: "Analytics", Icon: BarChart3 },
  { to: "/networx/app/refinery", label: "The Refinery", Icon: FileSearch },
  { to: "/pro/app", label: "Pro-Networx", Icon: Network },
  { to: "/networx/app/rewards", label: "Rewards", Icon: Award },
];

const MORE_TABS = [
  { to: "/networx/app/settings", label: "Settings", Icon: Cog },
  { to: "/networx/app/notifications", label: "Notifications", Icon: Bell },
  { to: "/networx/app/help", label: "Help & Support", Icon: HelpCircle },
];

const ADMIN_TABS = [
  { to: "/networx/app/admin", label: "Admin Home", Icon: Shield },
  { to: "/networx/app/admin/users", label: "Users", Icon: Shield },
  { to: "/networx/app/admin/queue", label: "Submission Queue", Icon: Shield },
];

function TabButton({ to, label, Icon, collapsed }) {
  return (
    <NavLink
      to={to}
      end={to === "/networx/app"}
      data-testid={`netx-tab-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
      className={({ isActive }) =>
        `group flex items-center gap-3 px-2.5 py-2 rounded-full transition-colors ${
          isActive ? "bg-cyan-400/10 ring-1 ring-cyan-400/30" : "hover:bg-white/5"
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
              isActive
                ? "bg-cyan-400 text-black"
                : "bg-white/[0.04] border border-white/10 text-cyan-300"
            }`}
          >
            <Icon className="w-4 h-4" />
          </span>
          {!collapsed && (
            <span
              className={`text-sm font-outfit truncate ${
                isActive ? "text-white font-medium" : "text-white/80"
              }`}
            >
              {label}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

function CollapsibleSection({ title, Icon, tabs, collapsed, open, onToggle }) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full group flex items-center gap-3 px-2.5 py-2 rounded-full hover:bg-white/5"
      >
        <span className="w-9 h-9 rounded-full bg-white/[0.04] border border-white/10 text-cyan-300 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4" />
        </span>
        {!collapsed && (
          <>
            <span className="text-sm font-outfit text-white/80 flex-1 text-left">{title}</span>
            <ChevronDown className={`w-4 h-4 text-white/40 transition-transform ${open ? "rotate-180" : ""}`} />
          </>
        )}
      </button>
      {open && !collapsed && (
        <div className="ml-12 mt-1 space-y-0.5">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              data-testid={`netx-tab-${t.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
              className={({ isActive }) =>
                `block py-1.5 px-3 text-xs font-outfit rounded-md ${
                  isActive ? "text-cyan-300 bg-cyan-400/5" : "text-white/60 hover:text-white"
                }`
              }
            >
              {t.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

export default function NetworxAppShell() {
  const [collapsed, setCollapsed] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);

  return (
    <div className="relative min-h-screen pt-20" data-testid="netx-app-shell">
      <div className={`max-w-[1600px] mx-auto px-4 lg:px-6 grid gap-4 ${collapsed ? "grid-cols-[80px_1fr]" : "grid-cols-[80px_1fr] lg:grid-cols-[280px_1fr]"}`}>
        {/* Sidebar */}
        <aside className={`sticky top-24 self-start h-[calc(100vh-7rem)] rounded-3xl glass-strong p-3 flex flex-col ${collapsed ? "" : "lg:p-4"}`}>
          {/* Logo card */}
          <Link to="/networx/app" className="flex items-center gap-3 p-2 rounded-2xl bg-black/40 border border-cyan-400/20 mb-3">
            <div className="w-10 h-10 rounded-md bg-black border border-cyan-400/40 glow-cyan overflow-hidden p-0.5 shrink-0">
              <img src="/brand/networx-logo.png" alt="" className="w-full h-full object-contain" />
            </div>
            {!collapsed && (
              <div className="leading-tight hidden lg:block">
                <div className="font-unbounded font-black text-sm">NETWORX</div>
                <div className="font-mono text-[9px] tracking-[0.25em] text-cyan-300/80">RADIO</div>
              </div>
            )}
          </Link>

          {/* Tabs */}
          <nav className="flex-1 overflow-y-auto pr-1 space-y-1">
            {MAIN_TABS.map((t) => (
              <TabButton key={t.to} {...t} collapsed={collapsed || (typeof window !== "undefined" && window.innerWidth < 1024)} />
            ))}

            <CollapsibleSection
              title="More"
              Icon={MoreHorizontal}
              tabs={MORE_TABS}
              collapsed={collapsed || (typeof window !== "undefined" && window.innerWidth < 1024)}
              open={moreOpen}
              onToggle={() => setMoreOpen(!moreOpen)}
            />
            {radioMe.role === "Admin" && (
              <CollapsibleSection
                title="Admin"
                Icon={Shield}
                tabs={ADMIN_TABS}
                collapsed={collapsed || (typeof window !== "undefined" && window.innerWidth < 1024)}
                open={adminOpen}
                onToggle={() => setAdminOpen(!adminOpen)}
              />
            )}
          </nav>

          {/* User card + actions */}
          <div className="mt-3 pt-3 border-t border-white/10 space-y-1.5">
            {!collapsed && (
              <Link
                to="/networx/app/profile"
                data-testid="netx-user-card"
                className="hidden lg:flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-white/5"
              >
                <img src={radioMe.avatar} alt={radioMe.name} className="w-9 h-9 rounded-full object-cover ring-1 ring-cyan-400/40" />
                <div className="min-w-0">
                  <div className="font-unbounded font-bold text-sm truncate">{radioMe.name}</div>
                  <div className="font-mono text-[9px] text-cyan-300 tracking-[0.2em]">{radioMe.role.toUpperCase()}</div>
                </div>
              </Link>
            )}
            <button data-testid="netx-support-btn" className="w-full flex items-center gap-3 px-2.5 py-2 rounded-full hover:bg-white/5 text-white/70">
              <span className="w-9 h-9 rounded-full bg-white/[0.04] border border-white/10 flex items-center justify-center">
                <HelpCircle className="w-4 h-4 text-cyan-300" />
              </span>
              {!collapsed && <span className="text-sm hidden lg:inline">Support</span>}
            </button>
            <Link to="/" data-testid="netx-signout-btn" className="w-full flex items-center gap-3 px-2.5 py-2 rounded-full hover:bg-white/5 text-white/70">
              <span className="w-9 h-9 rounded-full bg-white/[0.04] border border-white/10 flex items-center justify-center">
                <LogOut className="w-4 h-4 text-pink-400" />
              </span>
              {!collapsed && <span className="text-sm hidden lg:inline">Sign out</span>}
            </Link>
          </div>
        </aside>

        {/* Main column */}
        <div className="min-w-0">
          <header className="flex items-center justify-between mb-5 px-1">
            <button
              onClick={() => setCollapsed(!collapsed)}
              data-testid="netx-sidebar-toggle"
              className="w-9 h-9 rounded-full border border-white/10 text-white/70 hover:text-cyan-300 hover:border-cyan-400/50 flex items-center justify-center"
            >
              {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            </button>
            <div className="flex items-center gap-3">
              <button
                data-testid="netx-upload-btn"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-cyan-400 text-black font-mono text-[10px] tracking-[0.25em] uppercase font-bold glow-cyan hover:bg-white transition-colors"
              >
                <Upload className="w-3.5 h-3.5" /> Upload
              </button>
              <button data-testid="netx-bell" className="relative w-10 h-10 rounded-full bg-cyan-400/15 border border-cyan-400/30 text-cyan-300 hover:bg-cyan-400/25 flex items-center justify-center">
                <Bell className="w-4 h-4" />
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-pink-500 text-white text-[9px] font-bold flex items-center justify-center">
                  9+
                </span>
              </button>
              <Link to="/networx/app/profile" data-testid="netx-self-avatar" className="w-10 h-10 rounded-full border border-cyan-400/30 overflow-hidden hover:border-cyan-400 transition-colors">
                <img src={radioMe.avatar} alt="" className="w-full h-full object-cover" />
              </Link>
            </div>
          </header>

          <main className="pb-24">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
