# Badges and Refinery Access

**Status:** Accepted strategy (Nov 2026). Badges and invite-only access are not built.  
**Source of truth** for the badge catalog and for who may enter The Refinery.  
**Related:** [decision log](networx-decision-log.md) entries 15 and 16, [planned implementation](../planned-implementation-badges-refinery.md), [branding terminology](../branding-terminology.md).

---

## What runs today (Nov 23, 2026)

| Area | Built | Notes |
|------|-------|-------|
| Refinery submissions | Yes | Artist submits an approved song for $4.99 (Stripe on web, store purchase on mobile), with up to 10 custom questions. Free while `BETA_ALL_FREE` or `REFINERY_FREE_SUBMISSIONS` is on. |
| Review floor | Yes | Each submission targets 100 reviews by default (`refinery_min_reviews`). |
| Structured reviews | Yes | Ratings, survey, and custom answers in `refinery_reviews`. Artists see analytics, favorite reviews, and rate review quality. |
| Reviewer Yield | Yes | $0.10 per completed review into `prospector_yield`. Redemption at $5, $10, or $25. |
| Reviewer access | Open | Any signed-in user can sign up as a reviewer (`reviewers`, auto-accepted). |
| Raffle, referral, seat caps | No | Planned `refinery_membership`. |
| First 100 reviewers bench | No | Recruitment campaign not started in product. |
| Badge catalog, trophy case, name chip | No | Planned `badge_definitions`, `user_badges`. |

---

## Why

Badges are trophies people show off. They mark how someone joined, what they earned, and — when a badge has a perk — what that standing unlocks. The Refinery pays Prospectors Yield for verified review work. Open signup would put more reviewers in the room than artist submissions can fund. Access stays exclusive so payouts stay affordable, and the first bench is people artists already respect.

Two cohorts stay separate:

| Name | What it is |
|------|------------|
| **Founding 100** | Existing creator and merch cohort (Samurai Signal, limited merch). Unchanged. |
| **First 100 reviewers** | The Refinery review bench. The floor a paid submission is staffed to reach. |

---

## Badges

A **badge** is an entry in a catalog. Each badge has a name, a meaning, an earn rule, and an optional perk. A badge can be cosmetic, carry a perk, or both. New badges are added over time. Each one brings its own way to earn it. This document does not define a perk menu. Perks are decided per badge when that badge is created.

### Beta badge

Every account created while beta is open receives one badge. The award happens once, at account creation. The badge stays after beta ends. It sits in the trophy case with every badge earned later.

### Where badges show

- **Trophy case** on the profile: the full set, the date each was earned, and what it means.
- **Name chip:** the badge sits next to the display name wherever that person speaks. Refinery comments come first. Chat and other comment surfaces use the same treatment so the chip does not drift. When someone holds several badges, the name chip shows the primary one. The trophy case shows all of them.

### Earn paths (the model)

Named here so later badges follow the same shape. Not a build list.

| Path | Badge idea |
|------|------------|
| Account created while beta is open | Beta badge |
| Selected into the first 100 reviewers | Founding reviewer badge |
| Admitted to the Refinery by raffle or by referral | Refinery member badge |
| Later community and craft milestones | New catalog entries, each with its own earn rule and optional perk |

---

## Refinery access

The Refinery becomes invite-only. Open “sign up and review” is retired once membership ships; until then reviewer signup stays open.

Two ways in. Both still pass a capacity check:

1. **Raffle.** Enter for a seat when a batch opens.
2. **Referral.** Someone already inside refers you.

### Capacity

Seats open in batches, not all at once. The cap exists so Yield redemptions stay within what paid submissions can support. The public hook can talk about earning for real review work. Admission is what keeps the room small enough to pay.

### Review floor

Artists who pay for a Refinery submission are promised a review floor: **at least 100 reviewers**. That floor is why the first campaign recruits 100 people artists already respect in the music community — producers, respected listeners, scene voices — and does not open a mass signup.

Those 100 are the founding review bench (`founding_reviewer`). They staff the promise before the room grows. Later reviewers still enter by raffle or referral, and still pass the capacity check.

---

## Campaign

One story, two tracks. Visual world: **Samurai Signal** (launch posters and social art in the brand compass). That world already covers the merch Founding 100. This campaign uses the same world and does not rename that cohort.

### Track A — Scarcity

The Refinery is exclusive. You enter the raffle, or someone inside refers you. Seats are limited so payouts hold. The line is: earn Yield for verified review work, and only if you get a seat.

### Track B — Credibility

Recruit the first 100 respected reviewers so a paid submission is read by people artists trust. This track fills the review floor. It is a recruitment campaign, not an open call.

### Copy rules

Public copy stays inside the truth-safe rules in [branding terminology](../branding-terminology.md) and the blacklisted lines in the [brand compass](../networx-brand-identity-build-compass.md). No “Get Famous Fast.” No income guarantee. No promise that listening alone pays.

| Internal idea | Public line |
|---------------|-------------|
| Get paid to listen to music | Earn Yield for verified Refinery work. Seats are limited. |
| Everybody wants in | Enter the raffle, or get referred by someone already inside. |
| We will review your song | A paid Refinery submission is staffed toward at least 100 reviewers. |
| First 100 | The founding review bench: people the music community already respects. |

The internal idea is the campaign intent. The public line is what ships on the site, the app, and store listings.
