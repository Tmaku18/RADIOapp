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

## Update — 2026-01-19 (Cinematic Pass 2: Horizontal Gallery + Metamorphosis Story)
- **Horizontal-scroll Catalysts gallery** on `/artists` — pinned 420vh section, vertical scroll drives horizontal translate of a 12-card rail. Each `ParallaxArtistCard` uses mouse-tracked `useMotionValue` + `useSpring` for 3D tilt (rotateX/Y on perspective: 900px) with twin radial-shine highlights (cyan + pink) that follow the cursor. Progress meter at the bottom + "End of Frequency" cap card.
- **Scroll-locked Metamorphosis story** on `/about` — pinned 400vh section. 3D `MetamorphosisScene` (react-three-fiber) morphs through 4 stages driven by scroll progress: Caterpillar (5 segmented spheres) → Cocoon (pink ellipsoid pulse) → Butterfly (cyan + pink extruded wings flapping) → Diamond (octahedron crystallizing). Crossfaded text panels (GEM / RIPPLE / WINGS / DIAMOND) sync to each stage with neon stage-progress rail.
- **Sticky-positioning fix**: removed `overflow-x-hidden` from Layout; replaced with `overflow-x: clip` on html/body so ancestors don't break `position: sticky`. `useTransform` for x uses numeric pixels (computed via `rail.scrollWidth - window.innerWidth` in useEffect) — the prior `calc()` string interpolation didn't work.
- **Tested (iteration_4.json): 100% pass** — 13/13 spec checks. Zero JS/React errors. Rail transform verified: matrix translate -134px at scroll=500 → -2887px at scroll=3500. Stage panel opacities: [1,0,0,0] at top → [0,1,0,0] at scroll=1500 → panel-3 emerging at deep scroll. Bottom RadioPlayer + queue sync regression-clean. Subsequently tightened panel-opacity keyframes to eliminate the minor text-overlap during stage-2↔stage-3 crossfade.

## Update — 2026-01-19 (Logo-Matched Butterfly Hero)
- Replaced the torus-knot helix with a **procedurally-built cyan Networx butterfly** that matches the user-provided logo:
  - 28 emissive audio-bar columns per wing (upper + lower halves), each bobbing with its own sine phase
  - Two prominent cyan tube arches per wing (top + bottom) built from CubicBezierCurve3
  - Cyan capsule body + tiny head sphere
  - **Wings flap** by hinging each wing group around the body axis (sin(t*4.4))
  - **Cyan particle dust** (600 additive points) drifting upward and respawning
  - **Music notes** ♪♫♬♩ as canvas-textured sprites, floating up + side-to-side, fading in/out
  - Butterfly translated to right side of hero so it doesn't overlap headline text
- Brand logo image saved to `/app/frontend/public/brand/networx-logo.png` — now used in Nav (with "THE BUTTERFLY EFFECT" tagline) and Footer.

## Update — 2026-01-19 (Butterfly Burst Interaction)
- Butterfly is now **interactive** — large invisible plane mesh acts as the hit area; cursor turns into pointer on hover.
- **Hover or click** triggers a 1.4s burst:
  - Wings throw wide open (sin-eased to ~77° beyond flap) then snap back
  - Body flashes with a +2.4 emissive boost
  - Butterfly briefly scales up ~14%
  - **NoteBurst**: 56 music-note sprites spawn radially with random tangential velocities + gentle gravity arc, fading in fast / out slow over 2.2s
- Hover is rate-limited to once / 4s, click to once / 0.6s — no spam.
- "CLICK THE BUTTERFLY" hint badge added bottom-right of hero so users discover the interaction.
- Time base unified to `performance.now() / 1000` to keep event-time and render-time comparable.

## Update — 2026-01-19 (Pro-Networx Section)
- Built **/pro** (Pro-Networx landing) and **/pro/directory** (creative directory) routes matching content scraped from www.pro-networx.com/pro-networx.
- **/pro** structure:
  - Hero (same butterfly 3D scene re-used) with split headline "THE NETWORKING APP FOR EVERY KIND OF CREATIVE" + glitch effect on "creative."
  - Stats row: 159 Catalysts · 24 Countries · 8 Disciplines · 412 Matches/mo
  - **Section 01 — Disciplines**: 8 cards (Graphic Designers, Photographers, Videographers, Illustrators, Lyricists, Beat Makers, Engineers, Stylists) with icon + active count
  - **Section 02 — Toolkit**: 6 feature cards (LinkedIn-style profile, Instagram-style feed, Services marketplace, Direct messaging, Background radio, One account both worlds)
  - **Section 03 — Subscription**: Free vs Pro pricing tiers ($4.99 first month then $9.99/mo) with gradient-bordered Pro card and checkmark perk lists
  - Closing CTA "One profile. Two universes."
- **/pro/directory**:
  - Hero "HIRE A CATALYST."
  - Search input + role filter chips (All, Graphic Designer, Photographer, …)
  - Live filter (12 mock catalysts → search/filter combine) with empty-state card
  - 4-col grid of verified catalyst cards with rate, location, skills chips, DM + SAVE actions
  - Footer CTA to create profile
- Added **'PRO'** nav link + Footer Pro/Directory links (now with `footer-link-*` testids).
- Tailwind safelist added for dynamic `text-{color}-300/400` permutations used by ProPage.
- Tested (iteration_5.json): **100% — 18/18** assertions. Zero console errors across all 8 routes. Search 'lagos' → 1 catalyst (Nova Lyra). Photographer filter → 2 catalysts. Regression-clean on all existing routes.

## Update — 2026-01-20 (Logged-In App Shells)
### Pro-Networx App (/pro/app)
- 5-tab shell with collapsible sidebar (lg) / icon-only rail (sm): **Feed**, **Explore**, **Services**, **Messages**, **Profile**
- **Feed** — Instagram-style scrollable cards with like/comment/save/Ripples count, right-rail with own profile stats + suggested catalysts to follow
- **Explore** — Pinterest-style asymmetric tile grid (28 mock posts; tall/wide/square spans), search filter, hover reveals @handle + likes + view count
- **Services** — Marketplace cards with role chip, verified badge, hour rate, ETA, perk tags, Hire CTA + category tab filter (All/Design/Photo/Video/Audio/Words) + "List a service" button
- **Messages** — 2-pane DM: conversations list (online dots, unread badges, last preview, time) + chat pane (typing indicators, cyan vs glass bubble styles, send a message updates state live)
- **Profile editor** — Banner + avatar with edit buttons, Pro badge, editable headline/about, skill chip add+remove, experience CRUD (add/edit/delete), resume PDF panel, socials grid (IG/X/Behance/Web), "The Wake" stats grid, sticky Save bar with "Saved · HH:MM" feedback

### Networx Radio App (/networx/app)
- Matches user-supplied screenshot exactly: full sidebar with circular icon buttons + text labels, NETWORX RADIO logo card at top, Tanaka/Admin user card, Support + Sign out at bottom, collapsible "More" and "Admin" sections, sidebar collapse toggle.
- Top bar: cyan **Upload** CTA + bell with **9+** badge + avatar.
- **Dashboard** (`/networx/app`): hero with big butterfly logo + "Hey Tanaka. Mine the frequency.", stats row (Songs/Members/Ripples/Heat), Quick Actions grid, Trending Tonight list.
- **Radio** (`/networx/app/radio`): big now-playing card with album art + play button + Up Next queue (syncs with global PlayerContext).
- **Live DJ** (`/live-dj`): 4 DJ cards with ON AIR badges + listener counts.
- **Live Performances** (`/live-performances`): show cards with venue, date, ticket-progress bar + "Tickets" CTA.
- **Library**, **Feed**, **Discover** — landing tabs with appropriate copy.
- **My Uploaded Songs** (`/uploads`): table with song, plays, ripples, heat, status (live/review/draft) chip, view/edit/delete actions.
- **Analytics** (`/analytics`): "The Wake" — totals row (5,244 plays · 532 ripples · 1,735 ears) + 7-day daily-plays bar chart.
- **The Refinery** (`/refinery`): rate-1-to-5 song queue with $1.25-per-song earnings flow.
- **Rewards** (`/rewards`): gradient available-balance card ($248.75), pending, total earned + "Recent Yield" history feed.
- **Admin** (`/admin`) Mission Control: members/pending-uploads/reports stats; sub-tabs Users + Submission Queue (stub pages).
- **Settings / Notifications / Help & Support** — stub pages with "Coming online soon" cards.
- Routes all wired in App.js using nested `<Route>` with `<NetworxAppShell />` parent.

### Plumbing
- Added "Dashboard" CTA in top-nav (alongside Tune In) → `/networx/app`.
- Profile editor reused across both Pro-App and Networx-App `/networx/app/profile`.
- All new pages use `Reveal` for scroll-in animations and existing Lenis smooth scroll.

All routes hand-verified via screenshot tool. Bottom RadioPlayer + queue sync remain intact across both app shells. Zero new console errors.
