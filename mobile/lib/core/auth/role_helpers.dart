// Role helpers aligned with web roles.ts.

/// Prospector (listener) capabilities: listen, vote, follow, yield, refinery.
bool hasListenerCapability(String? role) {
  if (role == null || role.isEmpty) return false;
  const capable = {
    'listener',
    'artist',
    'admin',
    'service_provider',
    'dj',
    'musician',
    'venue',
  };
  return capable.contains(role);
}

/// Upload / studio capability: everyone except listeners.
bool hasArtistCapability(String? role) {
  if (role == null || role.isEmpty) return false;
  return role != 'listener';
}

/// Producer (service_provider) capabilities: offer ProNetworx services.
bool hasServiceProviderCapability(String? role) {
  if (role == null || role.isEmpty) return false;
  return role == 'service_provider' || role == 'admin';
}

bool isProspectorRole(String? role) => role == 'listener';

bool isAdminRole(String? role) => role == 'admin';

/// User-facing role label. DB values stay `artist` / `service_provider`.
String roleDisplayLabel(String? role) {
  switch (role) {
    case 'admin':
      return 'Admin';
    case 'service_provider':
      return 'Producer';
    case 'artist':
      return 'Artist';
    case 'dj':
      return 'DJ';
    case 'musician':
      return 'Musician';
    case 'listener':
    default:
      return 'Listener';
  }
}

/// Compact nav badge label.
String roleBadgeLabel(String? role) {
  switch (role) {
    case 'admin':
      return 'ADMIN';
    case 'service_provider':
      return 'PRODUCER';
    case 'artist':
      return 'ARTIST';
    case 'dj':
      return 'DJ';
    case 'musician':
      return 'MUSICIAN';
    case 'listener':
    default:
      return 'LISTENER';
  }
}
