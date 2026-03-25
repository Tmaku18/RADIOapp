# Mobile–Web Parity Matrix (Source of Truth)

**Product:** NETWORX Radio  
**Updated:** 2026-03-24  
**Purpose:** Single checklist for feature parity between the **Next.js dashboard** (`web/src/app/(dashboard)`) and **Flutter** (`mobile/lib`), plus **Android vs iOS** behavior where it differs.

## Status legend

| Status | Meaning |
|--------|---------|
| `done` | Equivalent capability shipped on that surface |
| `partial` | Works but thinner UX, fewer edge cases, or web-only admin ergonomics |
| `missing` | Not available |
| `platform-divergent` | Same outcome, different implementation (e.g. Play Billing vs Stripe) |

## Matrix

| Feature area | Web | Mobile (Flutter) | Android | iOS | Notes |
|--------------|-----|------------------|---------|-----|--------|
| Live radio & playback | done | done | done | done | Shared backend `/radio/*` |
| Heartbeat / play reporting | done | done | done | done | |
| Song upload | done | done | done | done | |
| Song moderation | done | missing | — | — | Web admin only (by design) |
| Credits / allocate / buy plays | done | done | platform-divergent | platform-divergent | Android: Google Play consumables; iOS: Stripe Payment Sheet |
| Purchase credits | done | done | platform-divergent | platform-divergent | Same split as above |
| Creator Network subscription | done | done | platform-divergent | platform-divergent | |
| Artist studio (my songs) | done | done | done | done | |
| **Live services (promote gigs)** | done | done | done | done | Mobile: Studio → Live services |
| **Live services → Support (Discord)** | done | done | done | done | `POST /live-services/support` |
| Refinery: list / rank / survey / comment | done | done | done | done | Prospectors |
| Refinery: artist add/remove own song | done | done | done | done | Studio track actions |
| Competition / leaderboards | done | done | done | done | |
| Discovery / social map | done | done | done | done | |
| Nearby (location) | missing | done | done | done | Mobile-first |
| DMs / messages | done | done | done | done | |
| Job board / apply | done | done | done | done | |
| Pro-Networx directory & profiles | done | done | done | done | |
| Pro-Networx onboarding (web form depth) | partial | partial | done | done | Align copy/deep links over time |
| Artist livestream go/watch/donations | done | done | done | done | |
| Stream moderation | done | missing | — | — | Web-first |
| Notifications (in-app) | done | done | done | done | |
| Push (FCM) | missing | done | done | done | Mobile-only |
| The Wake (analytics) | done | done | done | done | |
| Yield / rewards | done | done | done | done | |
| Venue ads slot | done | done | done | done | |
| Admin console | done | missing | — | — | Web only (by design) |
| Session cookies (SSR) | done | missing | — | — | Web only; mobile uses bearer token |

## Implementation references

- Web IA: [web/src/app/(dashboard)/layout.tsx](../web/src/app/(dashboard)/layout.tsx), [web/src/lib/api.ts](../web/src/lib/api.ts)
- Mobile routes: [mobile/lib/core/navigation/app_router.dart](../mobile/lib/core/navigation/app_router.dart), [mobile/lib/widgets/home_screen.dart](../mobile/lib/widgets/home_screen.dart)
- Legacy narrative matrix: [system-diagram.md](./system-diagram.md), [features-summary.md](./features-summary.md)

## Acceptance checks (parity smoke)

1. **Listener:** Radio → Social → Vote → Refinery → Rewards; Messages from More.
2. **Artist / Catalyst:** Radio → Social → Studio (songs, upload, **Live services**, Refinery toggles on approved tracks) → Analytics → Pro-Networx.
3. **Support tab:** Submit requires Discord URL (`discord.com` or `discord.gg`); backend emails `SUPPORT_EMAIL` or fallback.
4. **Payments:** Android completes a consumable test purchase path; iOS completes Stripe sheet for same credit tier.
5. **Push tap:** Routes to player / watch live / analytics per [mobile/lib/main.dart](../mobile/lib/main.dart).
