import { useEffect } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '../../firebase';
import { clearJoinCodeInUrl } from './defaults';

export function useThemeInitialization(setTheme: (theme: 'light' | 'dark') => void) {
  useEffect(() => {
    const storedTheme = localStorage.getItem('theme');
    const prefersDarkTheme = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    const nextTheme: 'light' | 'dark' = storedTheme === 'dark' || (!storedTheme && prefersDarkTheme) ? 'dark' : 'light';

    setTheme(nextTheme);
    document.documentElement.classList.toggle('dark', nextTheme === 'dark');
  }, [setTheme]);
}

interface AuthLifecycleConfig {
  setFirebaseUser: (user: User | null) => void;
  setIsAuthInitializing: (value: boolean) => void;
  setError: (message: string) => void;
}

export function useAuthLifecycle({ setFirebaseUser, setIsAuthInitializing, setError }: AuthLifecycleConfig) {
  useEffect(() => {
    let isMounted = true;

    const timeoutId = window.setTimeout(() => {
      if (!isMounted) return;
      setIsAuthInitializing(false);
      setError('Session check timed out. You can still log in manually.');
    }, 5000);

    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        if (!isMounted) return;
        window.clearTimeout(timeoutId);
        setFirebaseUser(user);
        setIsAuthInitializing(false);
      },
      () => {
        if (!isMounted) return;
        window.clearTimeout(timeoutId);
        setIsAuthInitializing(false);
        setError('Unable to verify session. Please log in again.');
      }
    );

    return () => {
      isMounted = false;
      window.clearTimeout(timeoutId);
      unsubscribe();
    };
  }, [setError, setFirebaseUser, setIsAuthInitializing]);
}

interface AutoJoinConfig {
  autoJoinAttempted: boolean;
  autoJoinCode: string;
  firebaseUser: User | null;
  setAutoJoinAttempted: (value: boolean) => void;
  joinByCode: (joinCode: string, silentMode: boolean) => Promise<void>;
}

export function useAutoJoinCampaign({
  autoJoinAttempted,
  autoJoinCode,
  firebaseUser,
  setAutoJoinAttempted,
  joinByCode,
}: AutoJoinConfig) {
  useEffect(() => {
    if (!firebaseUser || !autoJoinCode || autoJoinAttempted) {
      return;
    }

    setAutoJoinAttempted(true);
    joinByCode(autoJoinCode, true).finally(() => {
      clearJoinCodeInUrl();
    });
  }, [autoJoinAttempted, autoJoinCode, firebaseUser, joinByCode, setAutoJoinAttempted]);
}
