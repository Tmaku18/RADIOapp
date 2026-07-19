# NetworX — Business Decision Log

Structured ADR-style record. Each entry: **Context → Decision → Rationale → Impact**.

| # | Decision | Domain | Date | Status |
|---|----------|--------|------|--------|
| 1 | True radio, not on-demand skip | Product | 2025 | Accepted |
| 2 | Hard live sync (no mid-song hold) | Tech | 2026-06-24 | Accepted |
| 3 | Pro-Networx subscription gates networking | Monetization | 2026-06 | Accepted |
| 4 | Resume UX: always show, subscribe when locked | Product | 2026-06-24 | Accepted |
| 5 | Message UX: same as resume | Product | 2026-06-24 | Accepted |
| 6 | Private resumes bucket + signed URLs | Tech | 2026-06-24 | Accepted |
| 7 | Mobile 3D hero via WebView embed | Tech | 2026-06-24 | Accepted |
| 8 | Album art 2D, not three_js on mobile | Tech | 2026-06-24 | Accepted |
| 9 | Visualizer: web FFT, mobile simulated | Tech | 2026-06 | Accepted |
| 10 | No audio ads on live radio | Product | 2025 | Accepted |
| 11 | Monetization: credits + Pro-Networx sub | Monetization | 2025 | Accepted |
| 12 | Android package `com.discovermeradio.networxradio` | Infra | 2026-03 | Accepted |

---

## 1. True radio, not on-demand skip

**Context:** Users expect Spotify-style skip; product is positioned as live radio.  
**Decision:** Core radio has no user skip; synchronized stream across clients.  
**Rationale:** Differentiation, fairness in rotation, shared “LIVE” moment.  
**Impact:** Web/mobile player UX, backend queue authority, marketing copy.

---

## 2. Hard live sync (Jun 2026)

**Context:** Devices could play different songs mid-track when “DVR hold” kept local playback.  
**Decision:** `isServerAheadMidSong` always false; playing clients always follow server current song.  
**Rationale:** “3 songs on one station” bug broke trust in true radio.  
**Impact:** [`web/src/lib/radio-sync.ts`](../../web/src/lib/radio-sync.ts), [`mobile/lib/core/radio/radio_sync.dart`](../../mobile/lib/core/radio/radio_sync.dart).

---

## 3. Pro-Networx subscription gates networking

**Context:** Resumes and DMs expose contact info; open access increases spam risk.  
**Decision:** Active Pro-Networx subscription (or admin) required for resume PDF and messaging access.  
**Rationale:** Monetize networking; protect member contact data.  
**Impact:** `pro-networx.service.ts`, profile APIs, web + mobile paywalls.

---

## 4. Resume UX: always show, subscribe when locked

**Context:** Hiding Resume button confused users (“feature missing”).  
**Decision:** Always show Resume; `resumeLocked: true` → subscribe flow on click.  
**Rationale:** Conversion funnel clarity; consistent with freemium pattern.  
**Impact:** Web profile, mobile `ProProfileScreen`, checkout / `ProNetworkPaywallSheet`.

---

## 5. Message UX: same as resume

**Context:** Messaging was follow-to-DM or hidden for non-subscribers.  
**Decision:** Always show Message; `messagingLocked` → subscribe on click.  
**Rationale:** Parity with resume; single subscription value prop.  
**Impact:** Web messages page, mobile messages thread.

---

## 6. Private resumes bucket + signed URLs

**Context:** `users.resume_url` stored private Supabase path; raw path 404 on open.  
**Decision:** API signs path via `UploadsService.getResumeSignedUrl()` before return.  
**Rationale:** Security + working links for authorized viewers only.  
**Impact:** Pro-Networx profile endpoint, Supabase `resumes` bucket.

---

## 7. Mobile 3D hero via WebView embed

**Context:** Native `flutter_angle` / GLES failed on physical Android devices.  
**Decision:** WebView loads web `/embed/butterfly` for Dimension hero.  
**Rationale:** Parity with web Three.js scene without device GL fragility.  
**Impact:** Mobile Dimension home, web embed route.

---

## 8. Album art 2D on mobile player

**Context:** `three_js` cube failed GL init on devices; covers invisible.  
**Decision:** `Image.network` with gentle animation in `FloatingAlbumScene`.  
**Rationale:** Reliability over 3D on player bar.  
**Impact:** [`mobile/lib/features/dimension/floating_album_scene.dart`](../../mobile/lib/features/dimension/floating_album_scene.dart).

---

## 9. Visualizer strategy

**Context:** Real mic FFT breaks background playback; mobile mic permission heavy.  
**Decision:** Web uses dramatized FFT where safe; mobile uses organic simulated motion.  
**Rationale:** Visual delight without breaking radio or permissions.  
**Impact:** Web player visualizer, mobile dimension player.

---

## 10. No audio ads on live radio

**Context:** Sponsorship revenue vs listener experience.  
**Decision:** Visual sponsorship only on radio surfaces; no interrupting audio ads in stream.  
**Rationale:** Preserve “radio” feel; artist-first brand.  
**Impact:** Product policy, Venue Partner slot design.

---

## 11. Monetization stack

**Context:** Need sustainable revenue beyond credits.  
**Decision:** Artist credits for rotation + Pro-Networx subscription for networking.  
**Rationale:** Align payment with value (airtime vs professional access).  
**Impact:** Stripe products, webhook handlers, paywall UI.

---

## 12. Android package identity

**Context:** Play Console uniqueness and branding.  
**Decision:** Package `com.discovermeradio.networxradio`.  
**Rationale:** NetworX brand on store listing; separate from legacy IDs.  
**Impact:** `mobile/android`, Firebase `google-services.json`, release pipeline.
