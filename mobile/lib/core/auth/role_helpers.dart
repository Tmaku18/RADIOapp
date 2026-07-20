/// Role helpers aligned with web [roles.ts].

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

/// Gem capabilities: upload, credits, live services, artist studio.
/// Includes Catalyst (`service_provider`) and admin — web `hasArtistCapability`.
bool hasArtistCapability(String? role) {
  if (role == null || role.isEmpty) return false;
  return role == 'artist' ||
      role == 'service_provider' ||
      role == 'admin';
}

/// Catalyst capabilities: offer ProNetworx services.
bool hasServiceProviderCapability(String? role) {
  if (role == null || role.isEmpty) return false;
  return role == 'service_provider' || role == 'admin';
}

bool isProspectorRole(String? role) => role == 'listener';

bool isAdminRole(String? role) => role == 'admin';
