# Mobile-Web Parity Acceptance Checklist (Non-Admin)

Run on a physical Android device, a physical iPhone, and the web app. Feature status lives in [docs/mobile-web-parity-matrix.md](../../docs/mobile-web-parity-matrix.md); route mapping lives in [web_mobile_parity_matrix.md](web_mobile_parity_matrix.md).

## Auth and Session

- [ ] Firebase email, Google, and Apple sign-in succeed; first-time Google/Apple sign-ins land on profile setup.
- [ ] Phone MFA asks for a text code on every sign-in and rejects a number already used by another account.
- [ ] A guest can browse radio, artist pages, and Pro-Networx, and is asked to sign in before voting, following, or messaging.
- [ ] Token refresh updates API auth headers without manual app restart.
- [ ] Deleting an account signs out; signing in again within 48 hours restores it.

## Navigation

- [ ] Centralized named routes (`app_routes.dart`) are used for primary app flows.
- [ ] Below Networx Home, the drawer follows the web sidebar order: Radio, Pro-Radio, The Chat Room, Pro-Networx, DMs, Live DJ, Live Performances, Studios, Feed, Discover, Vote (listeners), My Songs, The Refinery.
- [ ] Push taps open the right screen: player (up next / live now / on air), analytics (song played), watch live, DM thread or Requests, notifications, artist profile (new follower).
- [ ] Artist share links (`/open/artists/:id`) and Pro profile links (`/pro-networx/u/:id`) open the installed app.
- [ ] Job board is reachable from the drawer (More → Job Board) and Pro-Networx → Projects.

## Listener Experience

- [ ] Radio reopens the last station; mute stays on through song changes and station switches.
- [ ] Fire / poop votes respond on the first tap; 1–10 rating and report reasons work from the more menu.
- [ ] Live Chat and per-song Comments both load and send.
- [ ] Song stories show under the progress bar; a recorded clip posts as public, private, or hidden.
- [ ] Mobile: dragging the radio bar opens the full player on the current song; a downward swipe closes it.
- [ ] Web: mini player shows fire and poop votes.
- [ ] Discover Swipe, Artists (Popular / Most songs / Recent; mobile also Everyone / Following / Liked), and Library work.
- [ ] Search returns glass artist cards and filters by genre.
- [ ] Feed supports like, bookmark, comment, report, and pagination.
- [ ] Refinery, Rewards, Vote, and The Chat Room are reachable and functional.

## Artist and Service Provider Experience

- [ ] My Songs lists songs, sorts them, supports upload and albums, and opens Buy placements.
- [ ] Analytics screen loads backend data (listens, ears reached, new followers, regions, swipes).
- [ ] Stream settings supports apply / pending / approved / rejected states; go live works as DJ or musician.
- [ ] Pro-Networx profile, services, studio, portfolio, Share, and messaging pathways work.
- [ ] Refinery submission, review form, and review analytics work.

## Payments and Realtime

- [ ] Web completes Stripe Checkout for a placement pack.
- [ ] Android completes the same pack through Google Play; iOS completes it through the App Store.
- [ ] A store purchase whose backend call fails is retried from the pending purchase queue.
- [ ] Pro-Networx, Pro-Radio, and bundle subscriptions unlock their features on all three surfaces.
- [ ] Realtime subscriptions (chat, station events, DM typing) start and clean up safely.

## Visual Parity

- [ ] Theme tokens align with web brand values (dark-first, electric cyan accent; light mode matches Daylight Studio).
- [ ] Radio bar and player use the same lighter glass on both surfaces.
- [ ] Search and Discover artist results use glass cards on both surfaces.
- [ ] Settings, profile, player, and discovery screens are visually consistent.
