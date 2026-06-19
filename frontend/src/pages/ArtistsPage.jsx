import React, { useRef, useEffect, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { trendingArtists } from "@/data/mockData";
import ParallaxArtistCard from "@/components/ParallaxArtistCard";
import Reveal from "@/components/Reveal";

export default function ArtistsPage() {
  const sectionRef = useRef(null);
  const railRef = useRef(null);
  const [travel, setTravel] = useState(2000);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  useEffect(() => {
    const measure = () => {
      if (railRef.current) {
        const rail = railRef.current.scrollWidth;
        const vw = window.innerWidth;
        setTravel(Math.max(0, rail - vw));
      }
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const x = useTransform(scrollYProgress, [0, 1], [0, -travel]);
  const railWidth = useTransform(scrollYProgress, (v) => `${v * 100}%`);

  return (
    <div className="relative" data-testid="artists-page">
      {/* Intro */}
      <section className="relative pt-28 pb-12">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <Reveal>
            <div className="font-mono text-[10px] tracking-[0.3em] text-pink-400 mb-2">
              ◤ CATALYSTS
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <h1 className="font-unbounded font-black tracking-tighter uppercase text-5xl md:text-7xl">
              The <span className="text-glow-pink text-pink-400">Gems</span>
            </h1>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="text-white/60 mt-3 max-w-xl">
              Hidden talent refined under pressure. Scroll down to drift through the
              vault — every card tilts to your gaze.
            </p>
          </Reveal>
          <Reveal delay={0.3}>
            <div className="mt-6 inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.3em] text-cyan-300">
              <span className="w-6 h-px bg-cyan-400" />
              SCROLL ▾ TO DRIFT
              <span className="w-6 h-px bg-cyan-400" />
            </div>
          </Reveal>
        </div>
      </section>

      {/* Pinned horizontal-scroll section */}
      <section
        ref={sectionRef}
        className="relative h-[420vh]"
        data-testid="catalysts-scroll-section"
      >
        <div className="sticky top-0 h-screen w-full flex items-center overflow-hidden">
          {/* Background streak */}
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[60%] pointer-events-none">
            <div className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-cyan-500/10 to-transparent blur-3xl" />
            <div className="absolute inset-y-0 right-0 w-1/3 bg-gradient-to-l from-pink-500/10 to-transparent blur-3xl" />
          </div>

          {/* The horizontal rail */}
          <motion.div
            ref={railRef}
            style={{ x }}
            className="flex items-center gap-6 pl-[10vw] pr-[10vw] will-change-transform"
          >
            {trendingArtists.map((a, i) => (
              <ParallaxArtistCard key={a.name} artist={a} index={i} />
            ))}
            {/* End cap */}
            <div className="shrink-0 w-[280px] md:w-[340px] h-[440px] md:h-[520px] rounded-2xl border border-dashed border-white/15 flex flex-col items-center justify-center text-center p-6">
              <div className="font-mono text-[10px] tracking-[0.3em] text-cyan-300 mb-3">
                / END OF FREQUENCY /
              </div>
              <div className="font-unbounded font-black text-2xl mb-2">
                Be the next gem.
              </div>
              <p className="text-white/50 text-sm">
                Apply to be a Catalyst on Networx.
              </p>
            </div>
          </motion.div>

          {/* Bottom progress meter */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-[70vw] max-w-2xl">
            <div className="flex items-center justify-between font-mono text-[10px] tracking-[0.3em] text-white/60 mb-2">
              <span data-testid="catalysts-counter">
                / {trendingArtists.length} CATALYSTS
              </span>
              <span>DRIFTING THROUGH THE VAULT</span>
            </div>
            <div className="h-px bg-white/10 relative overflow-hidden">
              <motion.div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyan-400 to-pink-500"
                style={{ width: railWidth }}
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
