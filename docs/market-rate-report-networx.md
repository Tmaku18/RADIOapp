## NETWORX (RadioApp) — Contractor Pricing & Scope Report

**Generated:** 2026-04-07  
**Repo:** `RadioApp/` (NETWORX)

This document estimates **scope complexity**, **engineering effort**, and a **market-average “no online experience” contractor rate** for ongoing work on this specific codebase.

---

## 1) What this project is (and why it’s full-stack)

NETWORX is a **multi-surface full-stack product**:

- **Backend API**: NestJS + TypeScript (`backend/`)
- **Web app**: Next.js App Router + React (`web/`)
- **Pro web app**: Next.js + React (`pro-web/`)
- **Mobile app**: Flutter/Dart (`mobile/`)
- **Legacy admin app**: Next.js (`admin/`) (plus admin surfaces inside the main web app)

“Full-stack” here means you own **server code + client code + the database contract + deployments/integrations**. This repo is also **multi-stack** (Node/TypeScript + React + Flutter + Postgres/SQL).

---

## 2) Measured repo scope (this repo, not generic)

### 2.1 Core code size (approximate)

The following counts are based on code-only directories (excluding dependencies like `node_modules` and build output):

- **Backend (`backend/src`)**: ~31,558 LOC across 198 files
- **Web (`web/src`)**: ~30,986 LOC across 144 files
- **Pro web (`pro-web/src`)**: ~10,184 LOC across 70 files
- **Mobile (`mobile/lib`)**: ~21,028 LOC across 93 files
- **Legacy admin (`admin/app`)**: ~1,469 LOC across 13 files

Total “core” source is roughly **95k LOC** across multiple deployable surfaces.

**Why LOC matters for pricing:** it’s not a quality metric, but it correlates to **surface area**—the number of places a change can break and the time required to develop confidence (reading code, tracing flows, verifying behavior).

### 2.2 Backend breadth (API surface area)

From `backend/src`:

- **Controllers:** 32 (`backend/src/**/*.controller.ts`)
- **Modules:** 33 (`backend/src/**/*.module.ts`)
- **DB migrations:** 52 (`backend/supabase/migrations/*.sql`)

This is typical of a “platform API” rather than a small CRUD backend.

---

## 3) Architecture and complexity drivers (specific to NETWORX)

### 3.1 Core subsystems (what you’re maintaining)

From the project docs and structure:

- **Radio rotation system** (stateful): continuous playback, tiered selection, artist spacing, fallbacks
- **Streaming**: web playback via HLS (Hls.js) and mobile audio playback
- **Authentication**: Firebase Auth (client) + Firebase Admin verification (server), plus web SSR cookie flow fallback
- **Database & storage**: Supabase Postgres + Supabase Storage
- **Realtime features**: chat, emoji bursts, station events (Supabase Realtime)
- **Payments**: Stripe (web checkout + mobile payment sheet), webhooks, credit system
- **Admin tooling**: moderation, queue controls, approvals, platform management
- **Operations/observability**: structured logs, timeouts, caching/backoff patterns, Sentry

### 3.2 “Engineering time complexity” vs “Big‑O”

For pricing, the relevant “time complexity” is **engineering time complexity**:

- how long it takes to diagnose failures (client ↔ API ↔ DB ↔ realtime ↔ cache),
- implement changes safely across surfaces,
- verify and deploy without regressions.

Algorithmic Big‑O matters in a few hotspots (e.g., selecting the next track from a candidate list), but most runtime cost is dominated by **I/O** (DB queries, Redis operations, network calls).

### 3.3 Radio logic complexity (why it’s easy to break)

The radio algorithm is documented in `docs/radio-logic.md` and implemented in `backend/src/radio/radio.service.ts` / `backend/src/radio/radio-state.service.ts`. Highlights:

- **Mode switching** with hysteresis (free vs paid)
- **Tiered selection** (credited → trial → opt-in → free rotation stack)
- **Soft-weighted random** selection (with artist spacing constraints)
- **State persistence** in Redis (preferred) with DB fallback/checkpoints

This type of system is sensitive to:
- timeout mismatches,
- partially missing media URLs,
- DB overload,
- stale state,
- race conditions around “current/next” track transitions.

These are “debugger hours,” not “feature hours.”

---

## 4) Operational risk profile (what makes this harder than a basic web app)

NETWORX integrates multiple external systems that each have failure modes:

- **Supabase**: query timeouts, PostgREST overload, realtime channel health, storage permissions
- **Firebase**: token verification latency, session cookie minting edge cases
- **Stripe**: webhook retries, idempotency, eventual consistency, secret management
- **Redis**: connection/DNS availability, state correctness under failover
- **Streaming**: network variability, HLS edge cases, media file integrity

**Plain-English translation:** when something breaks, it may not be “your code is wrong,” it may be “a dependency is slow,” and you still have to keep the product usable (fallbacks, caching, backoff, retries, UI states).

---

## 5) Commit-history signal (pace and churn)

Repo activity suggests a fast iteration cycle:

- **Total commits:** 455
- **Commits since 2026‑03‑01:** 364

**Why this affects pricing:** higher churn typically means higher debugging and coordination overhead. You spend more time on:
- regressions,
- compatibility between clients,
- production verification.

---

## 6) Effort estimates (calibrated to this repo)

These estimates assume you’re working as a solo contractor doing both engineering and basic project management (scoping, communication, verification).

### 6.1 Typical work buckets

- **Diagnosis/triage:** reproducing issues, reading logs, isolating root cause (often cross-layer)
- **Implementation:** code changes (backend/web/mobile), tests where available
- **Verification:** local checks + production verification + rollback readiness
- **Deployment support:** monitoring logs/errors after deploy

### 6.2 Task sizing guide (hour ranges)

**Small fix (single surface, limited blast radius) — 4–8 hours**
- Examples: minor UI bug, a small API response fix, minor role gating bug

**Medium change (backend + web; sometimes data) — 12–25 hours**
- Examples: role resolution reliability, caching/backoff for a single area, radio UI state refinement, admin list performance

**Cross-surface feature (backend + web + mobile parity) — 30–70 hours**
- Examples: new end-to-end feature touching auth, data models, and two clients

**Stabilization sprint (production reliability focus) — 40–80 hours**
- Examples: “radio stuck loading,” DB overload mitigation, Redis wiring, deploy hardening, reducing polling pressure

---

## 7) Market-rate benchmarking (2026) for “no online experience”

You asked to use market averages for someone with **no online freelancing history** (no reviews/ratings), which is a specific pricing reality:

- Clients can’t yet verify delivery quality.
- Marketplaces increase price pressure due to global competition.
- Early contracts often trade rate for proof (first reviews).

### 7.1 Market anchors (public references)

- **Upwork guidance**: “Beginners … on average … charge $10–$25 per hour when just starting.”  
  Source: Upwork hourly rates guidance (see “What hourly rate should beginners charge on Upwork?”)  
  Link: `https://www.upwork.com/resources/upwork-hourly-rates`

- **“Rate explorer” style datasets** often show higher medians (e.g., Arc’s full-stack distribution shows median $61–$80/hr), but those are closer to “proven freelancer” cohorts rather than “brand new online profile.”  
  Source: Arc full-stack rate explorer  
  Link: `https://arc.dev/freelance-developer-rates/full-stack`

### 7.2 Interpreting the gap (why your system is worth more than beginner pricing)

NETWORX is not beginner-complexity work:
- payments + auth + realtime + shared state + streaming,
- multiple clients,
- production operations.

However, **marketplace pricing** is not purely about complexity—it’s also about **trust signals** (reviews, portfolio, badge status, prior earnings).

So the practical strategy is:
- start at a credible “new profile” rate,
- earn proof quickly,
- then raise rates to match the system’s true complexity.

---

## 8) Recommended rates for this project (no online experience, full-stack)

### 8.1 Baseline hourly rate (market-average approach)

**Recommended start:** **$25/hr**

This is:
- within “beginner online” realities,
- but high enough to avoid signaling “low quality commodity.”

**Adjustments:**
- **$20/hr**: if you need your first contract quickly (optimize for conversion).
- **$30/hr**: if you can show credible proof (demo links, strong repo familiarity, clear scope writing).

### 8.2 Urgent production incidents (same project, higher urgency)

For “radio is down / auth is broken / payments failing” style work:

- **$35/hr** (still marketplace-realistic), with guardrails:
  - **minimum 2 hours**
  - **no more than 8 hours without re-approval**

Why: incident response is paid for **speed + correctness under pressure**, not for the raw number of tasks.

---

## 9) Concrete pricing examples (so you can quote consistently)

Using **$25/hr** baseline:

- **4–8 hrs**: $100–$200
- **12–25 hrs**: $300–$625
- **30–70 hrs**: $750–$1,750
- **40–80 hrs**: $1,000–$2,000

Using **$35/hr** incident rate:

- **2–6 hrs**: $70–$210
- **6–12 hrs**: $210–$420

---

## 10) Pricing models that fit NETWORX (and reduce contractor risk)

### Option A: Hourly + weekly cap (recommended early online)

- Rate: $25/hr
- Cap: 10–15 hrs/week unless re-approved
- Benefit: clients feel safe; you avoid getting trapped in unlimited-scope debugging

### Option B: Milestone-based fixed bids (only when scope is crisp)

Good fixed bids require measurable acceptance criteria. Example milestones:

- **Milestone 1: diagnosis + plan + low-risk fixes** (6–12 hrs)
- **Milestone 2: implementation** (12–30 hrs)
- **Milestone 3: verification + deploy monitoring** (6–15 hrs)

Avoid fixed bids for “debug until it works” unless you add a timebox.

### Option C: Retainer (best long-term for a live platform)

Examples:

- 20 hrs/month @ $25/hr = $500/month
- 40 hrs/month @ $25/hr = $1,000/month
- add incident hours @ $35/hr (separate bucket)

Retainers fit NETWORX because:
- you’ll always have reliability work, small fixes, and tuning,
- context retention reduces cost for the client over time.

---

## 11) Client-facing justification (plain English + technical)

### Plain English
You’re supporting a live system where:
- people must log in reliably,
- payments must be correct,
- radio must play continuously,
- admin tools must work,
- the app must degrade gracefully during outages.

### Technical
You are responsible for cross-layer correctness across:
- multiple clients (Next.js + Flutter),
- a modular NestJS backend (32 controllers),
- a changing Postgres schema (52 migrations),
- realtime and shared-state (Supabase Realtime + Redis),
- payments (Stripe + webhooks),
- auth (Firebase + SSR/session cookie behaviors).

---

## 12) How to raise rates (the “no online experience” path)

Suggested progression:

- After **1–2 successful contracts**: move to **$30–$35/hr**
- After **3–5 contracts + strong reviews**: **$40–$55/hr**
- Once you have clear proof of reliability work on payments/auth/realtime: consider higher tiers

This matches typical marketplace dynamics: early discounts buy trust signals; trust signals unlock higher pricing.

---

## 13) Proposal text templates (NETWORX-specific)

### Short pitch (hourly)
“I’m a full‑stack developer experienced with Next.js + NestJS + Supabase + Firebase + Stripe + Redis. For this repo, I’ll prioritize stability (timeouts/retries/backoff), ship changes with clear verification steps, and keep work within an agreed weekly hour cap.”

### Scope boundary sentence (prevents runaway debugging)
“If we hit unexpected platform issues (Supabase/Stripe/Firebase), I’ll pause and provide a short options summary before exceeding the agreed timebox.”

---

## Appendix A: Repo artifacts referenced

- `README.md` (architecture overview, running instructions)
- `docs/api-spec.md` (API contract overview)
- `docs/radio-logic.md` (radio selection and persistence)
- `backend/README.md` (backend responsibilities and endpoints)

