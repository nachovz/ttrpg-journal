import admin from 'firebase-admin';
import dotenv from 'dotenv';
import {
  auth as localAuth,
  db as localDb,
  isUsingLocalFirebase as localModeEnabled,
  localAuthApi as createLocalAuthApi,
} from './firebase.local.js';

dotenv.config();

const useLocalFirebase = String(process.env.FIREBASE_USE_LOCAL || '').toLowerCase() === 'true';
const useFirebaseEmulators = String(process.env.FIREBASE_USE_EMULATORS || '').toLowerCase() === 'true';

if (useFirebaseEmulators) {
  process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
  process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
  process.env.FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'demo-bards-journal';
}

if (!useLocalFirebase && !admin.apps.length) {
  if (useFirebaseEmulators) {
    admin.initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID,
    });
  } else {
    const requiredEnv = ['FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY'];
    for (const key of requiredEnv) {
      if (!process.env[key]) {
        throw new Error(`Missing required env var: ${key}`);
      }
    }

    const privateKey = (process.env.FIREBASE_PRIVATE_KEY as string).replace(/\\n/g, '\n');

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey,
      }),
    });
  }
}

export const auth = useLocalFirebase ? localAuth : admin.auth();
export const db = useLocalFirebase ? localDb : admin.firestore();
export const isUsingFirebaseEmulators = useFirebaseEmulators;
export const isUsingLocalFirebase = useLocalFirebase && localModeEnabled;
export const localAuthApi = useLocalFirebase ? createLocalAuthApi() : null;
