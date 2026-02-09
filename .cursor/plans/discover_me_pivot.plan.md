---
name: Discover Me Pivot
overview: Pivot the app from a radio-first product to "Discover Me"—a LinkedIn-like platform for content creators with professional profiles, discovery, a social-style Browse tab (endless scroll, like/bookmark), paywalled DMs, job board, and subscription-gated creator network. Radio becomes one tab.
todos: []
isProject: false
---

# Discover Me Pivot – LinkedIn-like Creator Platform

## 1. Rebrand and shell

- **Product name**: "Discover Me"; radio app branding updated in web, mobile, backend where appropriate.
- **Web shell**: Primary navigation is platform-first; **Radio** is one tab/section; **Browse** is a main tab (see section below).
- **Web**: Update [web/src/app/(dashboard)/layout.tsx](web/src/app/(dashboard)/layout.tsx) and app title/metadata so default entry is Discover Me (Discover feed or Browse), with Radio as a sibling route/tab.
- **Mobile**: Main tabs include Discover/Browse and Radio.

---

## 2. User types and onboarding

- **Roles** (existing: `listener`, `artist`, `admin`, `service_provider`): use for onboarding and feature gating.
- **Onboarding**: After sign-up, user picks **Listener**, **Artist**, or **Service provider**; store in `users.role`.
- **Service provider subtypes**: Service providers choose one or more **service types** (beats, mixing/mastering, photography, videography, digital design, marketing, etc.) via `service_provider_types` and `service_listings` (migration 008).

---

## 3. LinkedIn-style profiles

- **Unified profile**: Headline, summary/about (bio), skills/services, portfolio/experience, location.
- **Profile UX**: One profile page per user that adapts by role (artist vs service provider vs listener).
- Extend `users` / `service_providers` and [provider_portfolio_items](backend/supabase/migrations/008_platform_extensions_live_services_providers.sql) as needed; add headline, summary, skills, location; single profile API and page.

---

## 4. Discovery (LinkedIn-like)

- **Browse people**: Filter by service type(s) and location; search by name, headline, skills.
- **Cards/list**: Professional cards (photo, headline, services, location) linking to full profile.
- Reuse/extend live-services and artist APIs; add query params for `serviceType` and `location` and search term.

---

## 5. Browse tab – social-style endless scroll

**Goal:** A **Browse** tab where users scroll through content like Instagram or TikTok: endless vertical feed of **top service providers’ content** (portfolio items). Users can **like** and **bookmark** while browsing; content is **view/stream only—no download**.

### 5.1 Content source

- **Feed items**: Content from **top service providers**—i.e. portfolio pieces from `provider_portfolio_items` (image and audio), optionally mixed with artist highlights (e.g. approved songs or spotlight) if desired.
- **“Top” definition**: Prioritize providers/content by engagement (like count, bookmark count) and/or by featured/verified flag; optionally randomize within tiers for discovery.
- **Ordering**: Endless scroll with **random or algorithmically varied** loading (e.g. random seed per session, or “trending” + random) so each session feels fresh.

### 5.2 UX

- **Vertical endless scroll**: One primary item (or card) per viewport or per “tile”; swipe/scroll loads next batch (cursor-based or offset pagination).
- **Full-screen or card layout**: Instagram Reels / TikTok style (full-screen vertical) or Instagram feed style (card grid/list)—product choice.
- **Like**: Heart (or like) button on each item; toggle like; show like count.
- **Bookmark**: Bookmark/save button; add to “Saved” or “Bookmarks” for the user; no download.
- **No download**: No download button or link; content is streamed/displayed only (no file export).

### 5.3 Data model (additions)

- **browse_likes**: `(user_id UUID, content_id UUID, created_at)`. `content_id` references the feed item (e.g. `provider_portfolio_items.id` or a generic “browse_content” id). Unique per user per content. Use to count likes per item and to show “liked” state.
- **browse_bookmarks**: `(user_id UUID, content_id UUID, created_at)`. Same `content_id`; unique per user per content. Used for “Saved” / bookmarks list and to show “bookmarked” state.
- **Feed content**: Reuse `provider_portfolio_items` as the primary content; optionally add a view or table that joins to provider/profile for “top” ordering (e.g. by like count, featured, or random).

### 5.4 API

- **GET /api/browse/feed** (or `/api/browse`): Cursor- or page-based list of feed items. Query: `cursor` (or `page`, `limit`), optional `seed` for random. Response: list of items (id, type image/audio, file_url, title, description, provider info, like_count, bookmark_count, user’s liked/bookmarked flags).
- **POST /api/browse/feed/:contentId/like**: Toggle like for current user.
- **DELETE /api/browse/feed/:contentId/like**: Remove like (or use single toggle endpoint).
- **POST /api/browse/feed/:contentId/bookmark**: Add bookmark.
- **DELETE /api/browse/feed/:contentId/bookmark**: Remove bookmark.
- **GET /api/browse/bookmarks**: List current user’s bookmarked items (for “Saved” screen).

### 5.5 Frontend

- **Browse tab**: New route (e.g. `/(dashboard)/browse` or `/browse`) with infinite scroll (e.g. `useInfiniteQuery` or equivalent), loading next page when near bottom.
- **Item component**: Media (image or audio player), provider name/avatar, like and bookmark buttons, like count; no download control.
- **Saved/Bookmarks**: Optional separate route or modal listing bookmarked items (same view-only, no download).

---

## 6. Direct messaging (paywalled)

- **DM system**: 1:1 conversations; extend `service_messages` or add `conversations` + `messages`.
- **Paywall**: Access to direct messaging requires one-time fee or **Creator network / Pro subscription** (see Subscriptions).
- **Notifications**: In-app and push when user receives a message (see Notifications section).

---

## 7. Notifications

- **In-app**: New message, job application (if added), optionally “someone liked your content” on Browse.
- **Push**: Reuse [backend push-notifications](backend/src/push-notifications) for new message and high-priority events.
- **Email**: Optional for messages/digest; hook into existing email service.

---

## 8. Job board (artists post, providers browse)

- **Job requests**: Artists create requests (`service_requests`); list as job board with filters (service type, location).
- **Browsing**: Service providers browse open jobs; apply or express interest (add applications table or link messages to request).
- **Flow**: Artist posts → providers see in discovery/job board → apply or message (paywall may apply) → artist chooses; `service_orders` for agreed work.

---

## 9. Subscriptions and paywall

- **Creator network / Pro subscription**: Unlocks access to creator network (browse service providers, full profiles, **direct messaging**). May coexist with existing radio-credits subscription.
- **Gating**: Backend checks subscription before: listing providers in discovery, opening a conversation, sending a message. **Browse tab** can remain open to all (or optionally gate “contact” from Browse behind subscription).
- **Stripe**: New product/entitlement for “creator network access”; extend `subscriptions` or add entitlement flags.

---

## 10. Data model summary (existing + additions)


| Area            | Existing                                           | Add/change                                                                 |
| --------------- | -------------------------------------------------- | -------------------------------------------------------------------------- |
| Roles           | listener, artist, admin, service_provider          | Use in onboarding and UI                                                   |
| Profiles        | users, service_providers, provider_portfolio_items | Headline, location for artists                                             |
| Discovery       | service_listings, service_providers                | Filters: service_type, location; search                                    |
| **Browse feed** | provider_portfolio_items                           | **browse_likes**, **browse_bookmarks**; feed API with “top” + random order |
| DMs             | service_messages                                   | Optional conversations; paywall check                                      |
| Jobs            | service_requests, service_orders                   | Job board API; applications table                                          |
| Notifications   | notifications, push                                | Types: new_message, job_application, content_liked                         |
| Payments        | subscriptions, Stripe                              | Product: creator network / DM access                                       |


---

## 11. Implementation order (suggested)

1. ~~Rebrand + shell: Name, nav (Radio + **Browse** as main tabs), default route.~~ **Done**
2. ~~**Browse tab (MVP)**: Feed API from provider_portfolio_items (top + random), endless scroll UI, like and bookmark (tables + endpoints), no download.~~ **Done**
3. ~~Onboarding: Role selection; service provider subtypes.~~ **Done** (service_provider added)
4. ~~Profile model + API: Headline, summary, skills, location; one profile page by role.~~ **Done** (headline, locationRegion on users + profile form)
5. Discovery: List providers/artists with filters (service, location) and search.
6. Subscription product: Creator network entitlement; gate DMs (and optionally discovery).
7. DMs: Conversations + messages; paywall; notifications.
8. Job board: List/filter service_requests; applications.
9. Notifications: New message (and optionally job, like) in-app and push.

---

## 12. Out of scope for this plan

- Full Stripe Customer Portal or multiple plan tiers beyond one creator-network upgrade.
- Resume/CV uploads or parsing.
- “People you may know” recommendations.
- Download or export of Browse content (explicitly not included).
- Mobile-specific UI details (structure same; implement when building mobile).

