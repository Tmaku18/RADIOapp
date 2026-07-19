# NetworX — Executive Brief

**Product:** NetworX (NETWORX Radio: The Butterfly Effect)  
**Tagline:** By artists, for artists.  
**Status (Jun 2026):** Active development; Android **1.0.12 (28)** on Play Store track  
**Package:** `com.discovermeradio.networxradio`

---

## What NetworX is

NetworX is a full-stack **live radio platform** and **creator network** for independent artists. Everyone hears the same synchronized stream—not on-demand skip playback. Artists upload tracks, buy credits for airtime, and get real-time exposure. **Prospectors** (listeners) discover music through the stream, Ripples, chat, and community tools. **Pro-Networx** adds professional networking: directory, DMs, resumes, and service listings behind a subscription.

---

## Who we serve

| Audience | Value |
|----------|-------|
| **Artists** | Uploads, credits, rotation, analytics, live stream, Pro-Networx profile |
| **Prospectors** | Continuous discovery, Ripples, Yield rewards, live chat |
| **Catalysts** | Service providers in Pro-Networx directory |
| **Admins** | Moderation, rotation, streamer approval, reports |

---

## Business model

1. **Artist credits** — Pay for radio airtime and play packs.
2. **Pro-Networx subscription** — Gates DMs, contact info on services, and resume PDFs (Stripe).
3. **Visual sponsorship** — Venue Partner and similar slots; **no audio ads** on the live radio stream.

---

## Current status (Jun 2026)

### Shipped recently

- Hard **true-radio sync** across devices (no multi-song drift).
- **Pro-Networx gates:** Resume and Message always visible; non-subscribers go to subscribe.
- Resume **signed URLs** from private storage.
- Mobile **3D hero** via WebView; **album art** as reliable 2D.
- Visualizer improvements (web FFT; mobile organic motion).

### Surfaces

| Surface | Role |
|---------|------|
| **Web** | Marketing, listen, dashboard, Pro-Networx, admin |
| **Mobile (Flutter)** | Listen, Dimension, Pro-Networx, messages |
| **Backend (NestJS)** | Radio state (Redis), auth, payments, Pro-Networx API |

---

## Top risks

| Risk | Mitigation |
|------|------------|
| Sync drift on edge networks | Hard sync policy; heartbeat + server authority |
| Subscription confusion (Resume vs Message) | Always-visible CTAs with clear paywall |
| Play Store review / policy | CSAE page, package identity, release notes discipline |
| 3D / WebView perf on low-end Android | WebView embed path; 2D fallbacks for album art |

---

## Next milestones

1. Stabilize Pro-Networx conversion funnel (subscribe from profile DMs/resume).
2. Continue radio reliability (background tab, station switch).
3. Expand doc + Notion OS for business/engineering alignment.
4. Policy pages before broad public launch (copyright, DMCA, refunds).

---

## Links

- **Repo:** [RADIOapp on GitHub](https://github.com/TMAK-Tech/RADIOapp) (local path: this monorepo)
- **Notion OS:** See [`docs/notion/networx-workspace.md`](../notion/networx-workspace.md)
- **Archive (legacy RadioApp Notion):** [`docs/notion/notion-workspace-created.md`](../notion/notion-workspace-created.md)
