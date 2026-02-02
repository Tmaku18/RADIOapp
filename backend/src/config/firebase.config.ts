import { initializeApp, cert, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getMessaging } from 'firebase-admin/messaging';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { resolve } from 'path';

let firebaseApp: App;

export const initializeFirebase = (configService: ConfigService): App => {
  if (!firebaseApp) {
    const jsonPath = configService.get<string>('FIREBASE_SERVICE_ACCOUNT_PATH');

    if (jsonPath) {
      try {
        const resolved = resolve(jsonPath);
        const serviceAccount = JSON.parse(readFileSync(resolved, 'utf8'));
        firebaseApp = initializeApp({ credential: cert(serviceAccount) });
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        throw new Error(
          `Firebase: failed to load service account from FIREBASE_SERVICE_ACCOUNT_PATH: ${msg}`,
        );
      }
      return firebaseApp;
    }

    const projectId = configService.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = configService.get<string>('FIREBASE_CLIENT_EMAIL');
    let privateKey = configService.get<string>('FIREBASE_PRIVATE_KEY');

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error(
        'Firebase configuration missing. Set FIREBASE_SERVICE_ACCOUNT_PATH (path to JSON in home dir) or FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY in .env.',
      );
    }

    privateKey = privateKey.replace(/\\n/g, '\n');
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
      const errorMessage = error instanceof Error ? error.message : String(error);
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

export const getFirebaseAdmin = (): typeof admin => {
  if (!firebaseApp) {
    throw new Error('Firebase not initialized');
  }
  return admin;
};

export const getFirebaseMessaging = (): ReturnType<typeof getMessaging> => {
  if (!firebaseApp) {
    throw new Error('Firebase not initialized');
  }
  return getMessaging(firebaseApp);
};
