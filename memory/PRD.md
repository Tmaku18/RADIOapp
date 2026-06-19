# Networx Radio — 3D Animated Marketing & Listening Experience

## Original Problem Statement
> "Www.networxradio.com is my website and I want to make it have 3d animations"

## User Choices (gathered via ask_human)
- Source: rebuilt in /app based on live www.networxradio.com (no upload received)
- 3D types: hero rotating object + ambient 3D background + interactive 3D scene + floating album art
- Pages: Home, Live Radio, Artists, Schedule, About, Contact
- No live radio stream (visual player only)
- Vibe: dark/neon cyberpunk

## Architecture / Tech Stack
- React 19 + react-router-dom 7
- @react-three/fiber 9 + @react-three/drei 9 + three 0.160 (3D)
- TailwindCSS + custom CSS (glassmorphism, neon glow, glitch, tracing border, marquee, visualizer)
- Fonts: Unbounded (headings) + Outfit (body) + JetBrains Mono (labels)
- Lucide-react icons
- Mock data only (no backend calls) — content sourced from networxradio.com

## Implemented (2026-01-19)
- Global cyberpunk theme (CSS variables, glass utilities, glitch text, neon line, cyber-grid backdrop, cursor scrollbar)
- Persistent sticky `RadioPlayer` (bottom) with shared `PlayerContext` so queue & player stay in sync
- Nav bar with 6 routes + mobile menu, "Tune In" CTA
- Home (`/`): 3D HeroScene (Float'd torus-knot helix + wireframe shell + neon ring system + star field + cyber grid), animated headline with glitch + glow, stats, Trending Now grid (12 cards), Trending Artists marquee, 3 glossary pillars (Butterfly Effect / Metamorphosis / Mining), CTA
- Radio (`/radio`): 3D FloatingAlbum (textured rotating cube w/ PresentationControls), Control Room (play, fake visualizer, ears/ripples/heat), Live Stats panel, Up-Next queue grid (sync'd to global player)
- Artists (`/artists`): 12 artist cards with hover tilt
- Schedule (`/schedule`): 7 shows with neon timeline + Remind Me buttons
- About (`/about`): glitch hero, lore copy, 3 pillar cards (with `about-pillar-*` testids)
- Contact (`/contact`): cyberpunk terminal-styled form with "Transmitted ✓" confirmation
- Comprehensive `data-testid` coverage on all interactive + critical UI

## Testing Status (iteration_2.json)
- Frontend: 13/14 → fixed sync issue via PlayerContext → re-verified by main agent
- Hero CTA pointer-events overlap with RadioPlayer: FIXED (main pb-28, hero min-h calc)
- Queue ↔ Player sync: FIXED (shared PlayerContext) — verified: clicking queue updates bottom player title
- Zero uncaught console errors observed

## P0/P1 Backlog
- Real audio stream integration when user provides URL (HLS / Icecast / Howler.js)
- Authentication & artist upload (sign up flow → mimic real networxradio.com behavior)
- Backend with Mongo: persist Ripples (votes), temperatures, listener counts
- Replace mock data with real Networx API/Supabase the live site uses
- Real-time listener counts via WebSockets

## P2 / Polish
- Lenis smooth scroll across all pages
- Scroll-triggered reveals (Framer Motion)
- Audio-reactive visualizer using Web Audio API analyser when real audio is added
- Custom cursor in 3D zones

## Update — 2026-01-19 (Cinematic Pass)
- Added **Lenis smooth scroll** (`/app/frontend/src/components/SmoothScroll.jsx`) mounted at App root; momentum scrolling with exponential easing.
- Added **Reveal** component (`/app/frontend/src/components/Reveal.jsx`) — framer-motion `useInView` driven, animates `opacity + y + blur` on scroll-into-view; `once:true` so first reveal sticks.
- Applied staggered Reveal across all 6 pages:
  - Home: hero badge / each headline line / paragraph / CTAs / stats / section headers / 12 song cards (4-col stagger) / artists header / 3 glossary pillars / CTA
  - Radio: hero + 3D album + control room + live stats + queue items
  - Artists: 12 cards with 4-col stagger
  - Schedule: 7 rows with sequential stagger
  - About: glitch hero (split spans) + lore + 3 pillars
  - Contact: hero + form + 3 side info cards
- Tested (iteration_3.json): 100% pass — 0 React/JS errors, all reveals fire correctly, queue↔player sync, contact submit, all flows intact.
