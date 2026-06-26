# NetworX — Development Timeline

Themed milestones from git history (Jan–Jun 2026). For commit-level detail run:

```bash
git log --format="%ad|%s" --date=short
```

---

## Q1 2026 — Pro-Networx and Dimension

| Period | Themes |
|--------|--------|
| **Jan–Feb** | Pro-Networx 3D directory, analytics “ears reached”, Google Sign-In fixes |
| **Mar** | Streamer approval, Discover tabs, bottom nav, Live discovery, Android package rebrand |

**Representative work:** Pro-Networx landing and directory, report/block feed, admin streamer approval, competition leaderboards, temperature model.

---

## Q2 2026 — Radio reliability and parity

| Period | Themes |
|--------|--------|
| **Apr–May** | Radio sync parity, background audio, crossfade removal, FFT visualizer |
| **Jun** | Hard device sync, WebView 3D hero, album covers 2D, Pro-Networx resume/message gates, v1.0.12 |

---

## June 2026 detail (by week)

### Week of 2026-06-20

- Pro-Networx 3D directory as post-sign-in landing
- Report posts/users, block users, admin reports
- Pro-Networx radio player layout parity with Networx listen
- Google Sign-In Play Store fixes (build 12–14)
- Analytics: ears reached on dashboard; marketing stats API

### Week of 2026-06-21

- Mobile Dimension: typography, 3D hero, Top 7 voting, glass UI
- Guest radio, presence, analytics copy parity
- Live listener count fix (heartbeat RPC)
- Listens vs Ears Reached unified definition
- Remove skip controls from live radio

### Week of 2026-06-22

- Radio parity: web repeats/queue sync, mobile listen UX
- DJ Mixes station (`us-dj-mixes`)
- FFT visualizer fixes (crossOrigin, zero-signal recovery)
- Background radio on mobile web and app
- Mobile builds 1.0.1 (17) → 1.0.2 (18)
- Pro directory regression fixes, back-to-radio navigation

### Week of 2026-06-23

- 3D hero blank fixes on physical Android (iterations v1.0.4–1.0.8)
- Sign-out stuck loading fix
- Dimension hero diagnostics

### Week of 2026-06-24

- **Hard live sync** — web + mobile (v1.0.10 build 26)
- **WebView 3D hero** on physical devices
- **Album cover 2D** (v1.0.11 build 27)
- **Visualizer** dramatization and organic mobile motion
- **Pro-Networx resume** signed URL + subscription gate
- **Pro-Networx messaging** subscribe-on-click (v1.0.12 build 28)

---

## Mobile release line (Jun 2026)

| Version | Build | Highlight |
|---------|-------|-----------|
| 1.0.9 | 25 | Prior release track |
| 1.0.10 | 26 | Hard live cross-device sync |
| 1.0.11 | 27 | Album cover loads on devices |
| 1.0.12 | 28 | Pro-Networx resume/messaging subscribe gates |

Current: **`1.0.12+28`** in [`mobile/pubspec.yaml`](../../mobile/pubspec.yaml).

---

## Key commit SHAs (recent)

| SHA | Subject |
|-----|---------|
| `eafec0a` | Radio hard live sync |
| `03d28ac` | WebView 3D hero parity |
| `d0a153b` | Album cover 2D |
| `a9c1230`–`0d44aea` | Pro-Networx resume/messaging gates |
| `23df865` | Bump 1.0.12+28 |
