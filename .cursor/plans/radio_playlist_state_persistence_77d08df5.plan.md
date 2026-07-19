---
name: Radio Playlist State Persistence
overview: Production-ready hybrid storage system using Supabase for persistence and Redis for runtime, with hysteresis to prevent threshold flickering, periodic checkpoints to survive crashes, and optimized JSONB writes.
todos:
  - id: create-db-table
    content: Create radio_playlist_state table in Supabase via MCP migration (with stack_version_hash)
    status: completed
  - id: update-config
    content: Add THRESHOLD_ENTER_PAID (5) and THRESHOLD_EXIT_PAID (3) constants for hysteresis
    status: completed
  - id: add-persistence-methods
    content: Add checkpoint and full-state persistence methods to RadioStateService
    status: completed
  - id: add-playlist-type-tracking
    content: Add getCurrentPlaylistType() and setCurrentPlaylistType() with Redis caching
    status: completed
  - id: implement-hysteresis
    content: Implement hysteresis logic in getNextTrack() to prevent threshold flickering
    status: completed
  - id: implement-checkpoints
    content: Add periodic checkpoint saves (every 5 songs) to survive server crashes
    status: completed
  - id: implement-switch-logic
    content: Implement handlePlaylistSwitch() to save/restore positions when crossing thresholds
    status: completed
  - id: optimize-jsonb-writes
    content: Only write full fallback_stack when content changes (use stack_version_hash)
    status: completed
  - id: refactor-getnexttrack
    content: Refactor getNextTrack() to use new playlist switching flow with hysteresis
    status: completed
isProject: false
---

