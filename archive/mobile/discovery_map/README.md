# Archived: Discovery "Map" tab (mobile)

Archived on 2026-06-13. The **Map** tab was removed from the mobile Discovery
screen (`mobile/lib/features/discovery/discovery_screen.dart`). The code is kept
here so it can be restored later without digging through git history.

The Map tab showed artist "area heat", geographic clusters, and the artists
within a selected cluster. It was backed by the backend endpoints
`GET /discovery/map/heat`, `/discovery/map/clusters`, and `/discovery/map/artists`
(those backend routes were left untouched).

## Files in this folder

| File | Original location |
| --- | --- |
| `discovery_map_models.dart` | `mobile/lib/core/models/discovery_map_models.dart` |
| `discovery_map_service.dart` | `mobile/lib/core/services/discovery_map_service.dart` |
| `discovery_map_tab.dart` | inline `_MapTab` / `_MapTabState` inside `discovery_screen.dart` |

## How to restore

1. Copy `discovery_map_models.dart` back to `mobile/lib/core/models/`.
2. Copy `discovery_map_service.dart` back to `mobile/lib/core/services/`.
3. Re-add the Map tab in `mobile/lib/features/discovery/discovery_screen.dart`:
   - Re-add the imports for `discovery_map_models.dart` and
     `discovery_map_service.dart`.
   - Bump the `DefaultTabController(length: 4)` back to `length: 5`.
   - Re-add `Tab(text: 'Map')` to the `TabBar.tabs` list (between `Artists` and
     `Library`).
   - Re-add the matching child to the `TabBarView.children` list (between the
     swipe/grid tab and `_LibraryTab`). Either paste the `_MapTab` widget back
     in, or drop `discovery_map_tab.dart` into
     `mobile/lib/features/discovery/` and use `const DiscoveryMapTab()`.
