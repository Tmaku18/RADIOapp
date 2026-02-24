import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';

let app: App;
let adminAuth: Auth;

function initializeFirebaseAdmin() {
  if (getApps().length === 0) {
    // Use service account credentials from environment variable
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    
    if (serviceAccount) {
      try {
        const parsedServiceAccount = JSON.parse(serviceAccount);
        app = initializeApp({
          credential: cert(parsedServiceAccount),
        });
      } catch (error) {
        console.error('Failed to parse Firebase service account:', error);
        // Fallback to default credentials (for local development)
        app = initializeApp({
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        });
      }
    } else {
      // Fallback for development - uses Application Default Credentials
      app = initializeApp({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      });
    }
  } else {
    app = getApps()[0];
  }
  
  adminAuth = getAuth(app);
  return { app, adminAuth };
}

// Initialize on module load
const { adminAuth: auth } = initializeFirebaseAdmin();

export { auth as adminAuth };
