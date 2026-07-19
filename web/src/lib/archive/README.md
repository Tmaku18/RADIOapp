# Archived web playback utilities

Code moved here is **not imported by the app**. It is kept for reference only.

## `radio-crossfade.ts`

Volume-ramped crossfade between radio tracks (6s overlap, dual `HTMLAudioElement` slots).

**Removed:** 2026 — caused song repeats on background tabs and peek prefetch; radio now uses hard cuts (`loadTrackImmediate`) or instant background handoff.
