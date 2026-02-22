import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

const useFirebaseEmulators = String(import.meta.env.VITE_FIREBASE_USE_EMULATORS || '').toLowerCase() === 'true';
if (useFirebaseEmulators) {
  const authEmulatorUrl = import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_URL || 'http://127.0.0.1:9099';
  if (!auth.emulatorConfig) {
    connectAuthEmulator(auth, authEmulatorUrl, { disableWarnings: true });
  }
}
