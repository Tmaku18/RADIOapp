import React, { useRef, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "@/App.css";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import RadioPlayer from "@/components/RadioPlayer";
import SmoothScroll from "@/components/SmoothScroll";
import { PlayerProvider, usePlayer } from "@/context/PlayerContext";
import Home from "@/pages/Home";
import RadioPage from "@/pages/RadioPage";
import ArtistsPage from "@/pages/ArtistsPage";
import SchedulePage from "@/pages/SchedulePage";
import AboutPage from "@/pages/AboutPage";
import ContactPage from "@/pages/ContactPage";
import ProPage from "@/pages/ProPage";
import ProDirectoryPage from "@/pages/ProDirectoryPage";
import ProAppShell from "@/pages/pro/ProAppShell";
import FeedPage from "@/pages/pro/FeedPage";
import ExplorePage from "@/pages/pro/ExplorePage";
import ServicesPage from "@/pages/pro/ServicesPage";
import MessagesPage from "@/pages/pro/MessagesPage";
import ProfileEditorPage from "@/pages/pro/ProfileEditorPage";
import NetworxAppShell from "@/pages/networx/NetworxAppShell";
import DashboardPage from "@/pages/networx/DashboardPage";
import NetxRadioPage from "@/pages/networx/NetxRadioPage";
import { LiveDJPage, LivePerformancesPage, LibraryPage } from "@/pages/networx/NetxMiscPages";
import { FeedPage as NetxFeedPage, DiscoverPage, UploadsPage, AnalyticsPage, RefineryPage, RewardsPage, AdminHomePage, StubPage } from "@/pages/networx/NetxAppPages";

function Layout({ children }) {
  const { bassRef } = usePlayer();
  const cyanBlobRef = useRef(null);
  const pinkBlobRef = useRef(null);
  const yellowBlobRef = useRef(null);

  // Page-edge neon glow breathes with the beat (lowest 4 FFT bins)
  useEffect(() => {
    let raf;
    const tick = () => {
      const b = bassRef?.current ?? 0;
      const i = Math.min(1, b * 1.6);
      if (cyanBlobRef.current) {
        cyanBlobRef.current.style.opacity = `${0.55 + i * 0.45}`;
        cyanBlobRef.current.style.transform = `translate3d(0,0,0) scale(${1 + i * 0.18})`;
      }
      if (pinkBlobRef.current) {
        pinkBlobRef.current.style.opacity = `${0.55 + i * 0.4}`;
        pinkBlobRef.current.style.transform = `translate3d(0,0,0) scale(${1 + i * 0.15})`;
      }
      if (yellowBlobRef.current) {
        yellowBlobRef.current.style.opacity = `${0.4 + i * 0.45}`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [bassRef]);

  return (
    <div className="relative min-h-screen bg-black text-white" data-testid="app-shell">
      {/* Static cyber grid backdrop visible on all pages */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 cyber-grid opacity-30" />
        <div className="absolute inset-0 bg-gradient-radial from-transparent via-black/40 to-black" />
        <div
          ref={cyanBlobRef}
          className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-cyan-500/10 blur-[120px] will-change-transform"
        />
        <div
          ref={pinkBlobRef}
          className="absolute top-1/3 -right-40 w-[600px] h-[600px] rounded-full bg-pink-500/10 blur-[140px] will-change-transform"
        />
        <div
          ref={yellowBlobRef}
          className="absolute bottom-0 left-1/3 w-[500px] h-[500px] rounded-full bg-yellow-500/5 blur-[120px]"
        />
      </div>
      <Nav />
      <main className="relative z-10 pb-28">{children}</main>
      <Footer />
      <RadioPlayer />
    </div>
  );
}

export default function App() {
  return (
    <PlayerProvider>
      <BrowserRouter>
        <SmoothScroll />
        <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/radio" element={<RadioPage />} />
            <Route path="/artists" element={<ArtistsPage />} />
            <Route path="/schedule" element={<SchedulePage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/pro" element={<ProPage />} />
            <Route path="/pro/directory" element={<ProDirectoryPage />} />
            <Route path="/pro/app" element={<ProAppShell />}>
              <Route index element={<Navigate to="feed" replace />} />
              <Route path="feed" element={<FeedPage />} />
              <Route path="explore" element={<ExplorePage />} />
              <Route path="services" element={<ServicesPage />} />
              <Route path="messages" element={<MessagesPage />} />
              <Route path="profile" element={<ProfileEditorPage />} />
            </Route>
            <Route path="/networx/app" element={<NetworxAppShell />}>
              <Route index element={<DashboardPage />} />
              <Route path="radio" element={<NetxRadioPage />} />
              <Route path="live-dj" element={<LiveDJPage />} />
              <Route path="live-performances" element={<LivePerformancesPage />} />
              <Route path="library" element={<LibraryPage />} />
              <Route path="feed" element={<NetxFeedPage />} />
              <Route path="discover" element={<DiscoverPage />} />
              <Route path="uploads" element={<UploadsPage />} />
              <Route path="analytics" element={<AnalyticsPage />} />
              <Route path="refinery" element={<RefineryPage />} />
              <Route path="rewards" element={<RewardsPage />} />
              <Route path="profile" element={<ProfileEditorPage />} />
              <Route path="settings" element={<StubPage title="Settings" body="Account, notifications, audio preferences." />} />
              <Route path="notifications" element={<StubPage title="Notifications" body="Your alerts and mentions." />} />
              <Route path="help" element={<StubPage title="Help & Support" body="Guides, FAQ and direct support." />} />
              <Route path="admin" element={<AdminHomePage />} />
              <Route path="admin/users" element={<StubPage title="Admin · Users" body="Manage prospectors, catalysts and DJs." />} />
              <Route path="admin/queue" element={<StubPage title="Admin · Submission Queue" body="Approve, reject, and refine incoming uploads." />} />
            </Route>
          </Routes>
        </Layout>
      </BrowserRouter>
    </PlayerProvider>
  );
}
