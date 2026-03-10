import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';

let app: App;
let adminAuth: Auth;

/** Ensure PEM private_key has real newlines (env vars often store literal \n). */
function normalizeServiceAccountKey(parsed: Record<string, unknown>): Record<string, unknown> {
  const key = parsed.private_key;
  if (typeof key === 'string' && key.includes('\\n')) {
    return { ...parsed, private_key: key.replace(/\\n/g, '\n') };
  }
  return parsed;
}

function initializeFirebaseAdmin() {
  if (getApps().length > 0) {
    app = getApps()[0] as App;
    adminAuth = getAuth(app);
    return { app, adminAuth };
  }

  const serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (serviceAccountRaw && projectId) {
    try {
      const parsed = JSON.parse(serviceAccountRaw) as Record<string, unknown>;
      const normalized = normalizeServiceAccountKey(parsed);
      app = initializeApp({
        credential: cert(normalized as Parameters<typeof cert>[0]),
      });
    } catch (error) {
      // Invalid PEM (e.g. literal \n in env) or missing key — fallback so build and static generation succeed
      app = initializeApp({ projectId });
    }
  } else {
    app = initializeApp({ projectId: projectId ?? 'demo-project' });
  }

  adminAuth = getAuth(app);
  return { app, adminAuth };
}

// Initialize on module load
const { adminAuth: auth } = initializeFirebaseAdmin();

export { auth as adminAuth };
