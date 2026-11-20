# Planned Implementation: Badges and Invite-only Refinery

**Status:** Planned. Not in implementation. No migration in this document.

Product rules live in [`docs/business/badges-and-refinery-access.md`](business/badges-and-refinery-access.md). Decisions 15 and 16 in [`docs/business/networx-decision-log.md`](business/networx-decision-log.md). This file is the build sketch: tables, surfaces, membership, and campaign phases.

The merch **Founding 100** is a different cohort. Do not reuse that name for reviewers.

---

## Badges

A catalog. Each badge has its own earn rule. A badge may be cosmetic, carry a perk, or both. Perks are defined on the badge row when that badge is added. There is no shared perk menu to design up front.

### Tables (sketch)

`badge_definitions`

| Column | Role |
|--------|------|
| `id` | Stable key (`beta`, `founding_reviewer`, `refinery_member`, later keys) |
| `name` | User-facing name |
| `description` | What it means, shown in the trophy case |
| `earn_rule` | How it is awarded (beta window, founding bench, membership source, later rules) |
| `perk` | Optional. Null when the badge is a trophy only |
| `is_primary_eligible` | Whether it may be the name chip |
| `sort_order` | Trophy-case order |

`user_badges`

| Column | Role |
|--------|------|
| `user_id` | Holder |
| `badge_id` | Catalog key |
| `awarded_at` | Shown in the trophy case |
| `source` | Why it was awarded (beta join, staff grant, membership, later earn events) |

One row per user per badge. Awards are permanent unless a later decision says otherwise. The beta badge is awarded once, at account creation, while beta is open, and is not removed when beta ends.

### Surfaces

1. **Profile trophy case.** Full set, earned date, description, perk if any. Web profile and mobile profile.
2. **Name chip.** The primary badge sits next to the display name. Refinery comments first. Chat and other comment surfaces use the same chip so it does not drift. If the person holds several eligible badges, the chip shows the primary one. The trophy case still shows all of them.
3. **Admin.** Grant or inspect a catalog badge. Needed for the founding reviewer badge, which is a selection, not an automatic signup.

### First catalog entries

| Key | Who gets it | Perk |
|-----|-------------|------|
| `beta` | Account created while beta is open | None at launch. Optional later |
| `founding_reviewer` | Selected into the first 100 reviewers | None at launch. Optional later |
| `refinery_member` | Admitted by raffle or referral | None at launch. Optional later |

Later community and craft badges are new rows. They do not need a new display system.

---

## Refinery membership

Open “sign up and review” is retired. Listening, ranking, surveying, and commenting in the Refinery require a membership row that is inside the current cap.

### Table (sketch)

`refinery_membership`

| Column | Role |
|--------|------|
| `user_id` | Member |
| `source` | `raffle`, `referral`, or `founding_reviewer` |
| `referred_by` | Set when `source` is `referral` |
| `admitted_at` | When the seat was granted |
| `status` | `active` or `waitlist` |

Both raffle wins and referrals pass a capacity check before `status` becomes `active`. Seats open in batches. Waitlist holds people who entered and did not get a seat in the current batch.

`founding_reviewer` is staffed by recruitment, not by the public raffle. Those rows count toward the same cap and toward the review floor.

### Review floor

A paid Refinery submission is staffed toward **at least 100 reviewers**. The founding bench is how that floor exists before the room grows. The product does not open the Refinery to everyone to hit the number.

### Existing Refinery behavior

Song flags (`songs.in_refinery`), comments (`refinery_comments`), rank, survey, and Yield accrual stay. Membership is a gate in front of them. This plan does not change payout amounts.

---

## Campaign phases

Visual world: **Samurai Signal**. Public copy follows the truth-safe lines in the strategy doc. The internal idea “get paid to listen” does not ship as a slogan.

1. **Credibility.** Recruit the first 100 respected reviewers. Grant `founding_reviewer` membership and the matching badge. This phase staffs the review floor.
2. **Scarcity.** Announce invite-only access. Raffle for a batch of seats, plus referral from someone already inside. Both still hit the cap. Admit winners, award `refinery_member`, leave the rest on the waitlist until the next batch.
3. **Beta badge.** Award `beta` to accounts created while beta is open, including people who never enter the Refinery. It is a platform trophy, not a Refinery seat.
4. **Later badges.** Add catalog rows with new earn rules and optional perks. Reuse the trophy case and the name chip.

---

## Out of scope for the first build

- A perk economy or a menu of perks
- Automatic earning beyond the beta window, the founding bench, and Refinery admission
- Changing Yield rates, redemption thresholds, or artist submission price
- Renaming or rebuilding the merch Founding 100
- Store-listing or homepage copy that promises pay for listening alone
