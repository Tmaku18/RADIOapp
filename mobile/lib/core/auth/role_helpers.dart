/// Role helpers aligned with web [roles.ts].
bool hasListenerCapability(String? role) {
  if (role == null || role.isEmpty) return false;
  const capable = {
    'listener',
    'artist',
    'admin',
    'service_provider',
    'venue',
  };
  return capable.contains(role);
}

bool isProspectorRole(String? role) => role == 'listener';
