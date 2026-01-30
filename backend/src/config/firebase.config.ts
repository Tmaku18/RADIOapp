import { initializeApp, cert, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { ConfigService } from '@nestjs/config';

let firebaseApp: App;

export const initializeFirebase = (configService: ConfigService): App => {
  if (!firebaseApp) {
    const projectId = configService.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = configService.get<string>('FIREBASE_CLIENT_EMAIL');
    let privateKey = configService.get<string>('FIREBASE_PRIVATE_KEY');

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error(
        'Firebase configuration missing. Please set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY in your .env file.',
      );
    }

    // Handle different formats of the private key
    // Replace escaped newlines with actual newlines
    privateKey = privateKey.replace(/\\n/g, '\n');

    // If the key doesn't start with -----BEGIN, it might need the header/footer
    if (!privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
      throw new Error(
        'FIREBASE_PRIVATE_KEY appears to be invalid. It should start with "-----BEGIN PRIVATE KEY-----"',
      );
    }

    try {
      firebaseApp = initializeApp({
        credential: cert({
          projectId,
          privateKey,
          clientEmail,
        }),
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to initialize Firebase: ${errorMessage}. Please check your FIREBASE_PRIVATE_KEY format in .env file.`,
      );
    }
  }
  return firebaseApp;
};

export const getFirebaseAuth = (): ReturnType<typeof getAuth> => {
  if (!firebaseApp) {
    throw new Error('Firebase not initialized');
  }
  return getAuth(firebaseApp);
};
