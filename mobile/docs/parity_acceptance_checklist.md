# Mobile-Web Parity Acceptance Checklist (Non-Admin)

## Auth and Session

- [ ] Firebase email, Google, and Apple sign-in succeed on mobile.
- [ ] Token refresh updates API auth headers without manual app restart.
- [ ] Unauthorized API responses trigger safe sign-out/session recovery behavior.

## Navigation

- [ ] Centralized named routes are used for primary app flows.
- [ ] Push notifications navigate correctly to analytics, player, and watch-live screens.
- [ ] Job board is reachable from at least one in-app navigation path.

## Listener Experience

- [ ] Radio playback controls, chat, votes, and artist deep-linking work.
- [ ] Discovery feed supports like, bookmark, report, and pagination.
- [ ] Refinery, Yield, Competition, and Room are reachable and functional.

## Artist and Service Provider Experience

- [ ] Studio lists songs, supports upload, and opens buy-plays flow.
- [ ] Credits and analytics screens load backend data.
- [ ] Stream settings supports apply/pending/approved/rejected states.
- [ ] Pro directory/profile/edit profile and messaging pathways work.

## Payments and Realtime

- [ ] PaymentSheet credit purchase works in app.
- [ ] Buy-plays flow supports in-app intent and web checkout fallback.
- [ ] Realtime subscriptions are started and cleaned up safely.
- [ ] Like realtime events increment feed items without crashes.

## Visual Parity

- [ ] Theme tokens align with web brand values (dark-first, cyan + cobalt).
- [ ] Core surfaces/components match web hierarchy and contrast.
- [ ] Settings, profile, player, and discovery screens are visually consistent.
