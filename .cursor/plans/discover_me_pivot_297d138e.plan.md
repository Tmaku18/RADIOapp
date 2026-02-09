---
name: Discover Me Pivot
overview: Pivot the app from a radio-first product to "Discover Me"—a LinkedIn-like platform for content creators (artists, service providers, listeners) with professional profiles, discovery by service/location, paywalled DMs, job board, and subscription-gated access to the creator network. Radio becomes one tab.
todos: []
isProject: false
---

# Discover Me Pivot – LinkedIn-like Creator Platform

## Direction correction

Profiles and discovery are **LinkedIn-like**: professional profiles, portfolio/resume showcase, skills, and networking—not Craigslist-style classifieds. Think polished profile pages, structured experience/skills, and professional discovery rather than ad-style listings.

---

## 1. Rebrand and shell

- **Product name**: "Discover Me" (replace radio app branding in web, mobile, backend where appropriate).
- **Web shell**: Primary navigation is platform-first; **Radio** is one tab/section (e.g. "Radio" in nav), not the home.
- **Web**: Update [web/src/app/(dashboard)/layout.tsx](web/src/app/(dashboard)/layout.tsx) and any app title/metadata so default entry is Discover Me (e.g. Discover feed or Browse), with Radio as a sibling route/tab.
- **Mobile**: Mirror structure—main tabs include Discover/Browse and Radio.

No change to repo or backend project names unless you want a full rename later.

---

## 2. User types and onboarding

- **Roles** (already in DB: `listener`, `artist`, `admin`, `service_provider`): keep and use explicitly.
- **Onboarding**: After sign-up, user picks **Listener**, **Artist**, or **Service provider**. Store in `users.role` and drive different default views and features.
- **Service provider subtypes**: Service providers choose one or more **service types** (e.g. beats, mixing/mastering, photography, videography, digital design, marketing, etc.). Already partially modeled in `service_provider_types` and `service_listings` (migration 008). Extend or formalize the list and use it for filters and profile display.

No new role value required; ensure onboarding writes `role` and, for service providers, writes to `service_providers` + `service_provider_types` (or equivalent).

---

## 3. LinkedIn-style profiles

- **Unified profile model** (conceptually like LinkedIn):
  - **Headline** (short tagline).
  - **Summary / About** (bio; you have `bio` on users and `service_providers.bio`).
  - **Skills / services**: for artists—genres, instruments; for service providers—service types (from DB) plus optional skill tags.
  - **Portfolio / experience**: for artists—tracks, releases, links; for service providers—portfolio items (you have `provider_portfolio_items`: image/audio, title, description). Consider an optional “experience” or “projects” section (e.g. “Mixed for Artist X”, “Shot video for Y”) if you want it more LinkedIn-like.
  - **Location**: use for “filter by location”; already have `service_providers.location_region` and optional lat/lng; artists may get a location field (e.g. on `users` or a small `artist_profiles` table if you split later).
- **Resume-like display**: Optional “resume” or “CV” section—e.g. downloadable link or structured roles/projects—can be a later phase; minimum is headline + summary + skills + portfolio.
- **Profile UX**: Single profile page per user that adapts by role (artist vs service provider vs listener). Listeners can have a lighter profile (photo, name, maybe short bio) or minimal.

Implementation: extend `users` and/or `service_providers` and existing portfolio/listing tables as needed; add API to get/update “profile” (headline, summary, skills, location); build one main profile page that renders differently by role.

---

## 4. Discovery (LinkedIn-like)

- **Browse people** (artists + service providers) with:
  - **Filter by service type(s)** (from service provider types and artist “services” if you add them).
  - **Filter by location** (region/city/country; use `location_region` and optional geo).
- **Search**: By name, headline, skills, service type (backend search endpoint; simple text + filters first).
- **Cards/list**: Professional cards (photo, headline, services, location) linking to full profile—no classified/ad look.

Reuse and extend existing live-services/provider APIs and any artist list APIs; add query params for `serviceType` and `location` and a simple search term.

---

## 5. Direct messaging (paywalled)

- **DM system**: 1:1 conversations between users (you have `service_messages`; consider a general `conversations` + `messages` model if you want DMs beyond “service request” context).
- **Paywall**: “Access to direct messaging” requires payment. Options:
  - **One-time fee** to unlock DMs with a user or a cap (e.g. first N messages free, then pay), or
  - **Subscription** (see below) that includes “DM access” as a benefit.
- **Who can message whom**: Define clearly (e.g. any registered user can request to message; recipient must have “allowed DMs” or only paid users can initiate). Recommended: only users with an active “creator network” (or “pro”) subscription can start DMs; recipients get notifications and can reply (optionally restrict replies to paid users only for consistency).

Implementation: reuse or extend `service_messages`; add a `conversations` (or thread) table if needed; backend checks subscription/entitlement before creating a conversation or sending a message; frontend shows “Upgrade to message” when not entitled.

---

## 6. Notifications

- **In-app**: When user receives a DM (and optionally when someone views profile, applies to job, etc.). Use existing `notifications` table and [backend/src/notifications](backend/src/notifications); add types like `new_message`, `new_job_application` (if you add applications).
- **Push**: Reuse [backend push-notifications](backend/src/push-notifications) for “new message” and other high-priority events.
- **Email**: Optional digest or instant for messages; hook into existing [backend email](backend/src/email) if present.

---

## 7. Job board (artists post, providers browse)

- **Job requests**: Artists create “job requests” (you have `service_requests`: title, description, service_type, status). Expose as a **job board**: list open requests, filter by service type and location (if you add location to requests).
- **Browsing**: Service providers (and optionally artists) browse open jobs; can apply or “express interest” (add `service_request_applications` or link messages to `request_id`).
- **Flow**: Artist posts request → providers see it in discovery/job board → provider applies or sends message (paywall may apply for DM) → artist chooses and orders (you have `service_orders`).

Add or extend APIs: list `service_requests` with filters; create application or “interest” and optionally link first message to request.

---

## 8. Subscriptions and paywall

- **Current**: You have `subscriptions` (artist_id, plan_type monthly/yearly, credits) and Stripe; credits are for radio plays.
- **New**: Introduce an **“Artist plan” upgrade** or **“Creator network” / “Pro” subscription** that:
  - Unlocks **access to the creator network**: browse service providers, view full profiles, and **use direct messaging**.
  - May still grant radio credits as today, or separate “radio” vs “network” plans—your choice.
- **Gating**: Backend checks subscription (and optionally role) before: listing service providers in discovery, opening a conversation, sending a message, or viewing full profile. Frontend shows upgrade CTA when not subscribed.

Implementation: extend `subscriptions` or add a `plan_entitlements` / product-type (e.g. `radio_credits` vs `creator_network`) so one Stripe product can grant “creator network access”; middleware or guard checks entitlement on DM and discovery endpoints.

---

## 9. Data model summary (existing + small extensions)


| Area          | Existing                                                       | Add/change                                                             |
| ------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Roles         | listener, artist, admin, service_provider                      | Use in onboarding and UI only                                          |
| Profiles      | users (bio, etc.), service_providers, provider_portfolio_items | Headline, optional location for artists; optional “experience” later   |
| Discovery     | service_listings, service_providers                            | Filters: service_type, location_region; search by name/headline/skills |
| DMs           | service_messages                                               | Optional conversations table; paywall check                            |
| Jobs          | service_requests, service_orders                               | Job board API; applications or “interest” table                        |
| Notifications | notifications, push                                            | Types: new_message, job_application, etc.                              |
| Payments      | subscriptions, Stripe                                          | New product/entitlement: “creator network” / DM access                 |


---

## 10. Implementation order (suggested)

1. **Rebrand + shell**: Name, nav (Radio as tab), default route = Discover.
2. **Onboarding**: Role selection (listener / artist / service provider); service provider subtypes.
3. **Profile model + API**: Headline, summary, skills, location; one profile page by role (LinkedIn-style).
4. **Discovery**: List providers/artists with filters (service, location) and simple search.
5. **Subscription product**: “Creator network” entitlement; gate discovery and DMs.
6. **DMs**: Conversations + messages (or extend service_messages); paywall; notifications.
7. **Job board**: List and filter `service_requests`; applications or interest.
8. **Notifications**: New message (and optionally job) events in-app and push.

---

## 11. Out of scope for this plan

- Full Stripe Customer Portal or multiple plan tiers (beyond one “creator network” upgrade).
- Detailed resume/CV uploads or parsing.
- Recommendations or “people you may know” (can be added later).
- Mobile-specific UI details (follow same structure; implement when building mobile).

This keeps the pivot focused on **LinkedIn-like profiles and discovery**, **paywalled DMs**, **job board**, and **subscription-gated creator network**, with Radio as one tab.