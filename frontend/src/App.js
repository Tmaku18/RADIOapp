import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "@/App.css";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import RadioPlayer from "@/components/RadioPlayer";
import Home from "@/pages/Home";
import RadioPage from "@/pages/RadioPage";
import ArtistsPage from "@/pages/ArtistsPage";
import SchedulePage from "@/pages/SchedulePage";
import AboutPage from "@/pages/AboutPage";
import ContactPage from "@/pages/ContactPage";

function Layout({ children }) {
  return (
    <div className="relative min-h-screen bg-black text-white overflow-x-hidden" data-testid="app-shell">
      {/* Static cyber grid backdrop visible on all pages */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 cyber-grid opacity-30" />
        <div className="absolute inset-0 bg-gradient-radial from-transparent via-black/40 to-black" />
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-cyan-500/10 blur-[120px]" />
        <div className="absolute top-1/3 -right-40 w-[600px] h-[600px] rounded-full bg-pink-500/10 blur-[140px]" />
        <div className="absolute bottom-0 left-1/3 w-[500px] h-[500px] rounded-full bg-yellow-500/5 blur-[120px]" />
      </div>
      <Nav />
      <main className="relative z-10">{children}</main>
      <Footer />
      <RadioPlayer />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/radio" element={<RadioPage />} />
          <Route path="/artists" element={<ArtistsPage />} />
          <Route path="/schedule" element={<SchedulePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
