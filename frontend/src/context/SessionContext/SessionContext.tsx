import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { User } from 'firebase/auth';
import type {
  AuthFormState,
  Campaign,
  JournalDayLabel,
  Note,
  ProfileFormState,
  SessionUser,
} from '../../types/entities';
import { EMPTY_AUTH_FORM, EMPTY_PROFILE_FORM, getAutoJoinCodeFromUrl } from './defaults';
import { fetchCampaignById as fetchCampaignByIdRequest, fetchSessionPayload } from './sessionApi';
import { useSessionActions } from './sessionActions';
import { useAuthLifecycle, useAutoJoinCampaign, useThemeInitialization } from './sessionEffects';
import type { SessionContextValue } from './types';

const SessionContext = createContext<SessionContextValue | null>(null);

interface SessionProviderProps {
  children: ReactNode;
}

export function SessionProvider({ children }: SessionProviderProps) {
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authForm, setAuthForm] = useState<AuthFormState>(EMPTY_AUTH_FORM);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [isAuthInitializing, setIsAuthInitializing] = useState(true);
  const [me, setMe] = useState<SessionUser | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [journalDayLabels, setJournalDayLabels] = useState<JournalDayLabel[]>([]);
  const [profileForm, setProfileForm] = useState<ProfileFormState>(EMPTY_PROFILE_FORM);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [campaignNameInput, setCampaignNameInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [autoJoinAttempted, setAutoJoinAttempted] = useState(false);
  const [autoJoinCode] = useState(getAutoJoinCodeFromUrl);

  const withToken = useCallback(
    async <T,>(fn: (token: string) => Promise<T>): Promise<T> => {
      if (!firebaseUser) throw new Error('Not authenticated');
      const token = await firebaseUser.getIdToken(true);
      return fn(token);
    },
    [firebaseUser]
  );

  const refreshSession = useCallback(async () => {
    if (!firebaseUser) return;

    setIsLoading(true);
    setError('');

    try {
      await withToken(async (token) => {
        const payload = await fetchSessionPayload(token);

        setMe(payload.me);
        setProfileForm({
          username: payload.me.username || '',
          characterName: payload.me.characterName || '',
          dndBeyondUrl: payload.me.dndBeyondUrl || '',
          profileImageUrl: payload.me.profileImageUrl || '',
        });
        setCampaigns(payload.campaigns);
        setNotes(payload.notes);
        setJournalDayLabels(payload.dayLabels);
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load session');
    } finally {
      setIsLoading(false);
    }
  }, [firebaseUser, withToken]);

  useThemeInitialization(setTheme);
  useAuthLifecycle({ setFirebaseUser, setIsAuthInitializing, setError });

  const {
    createCampaign,
    createNote,
    deleteCampaign,
    joinCampaign,
    joinCampaignByCode,
    logout,
    saveProfile,
    setDayGroupTitle,
    submitAuthForm,
  } = useSessionActions({
    authMode,
    authForm,
    campaignNameInput,
    joinCodeInput,
    meRole: me?.role,
    profileForm,
    refreshSession,
    withToken,
    setAuthForm,
    setCampaignNameInput,
    setError,
    setIsLoading,
    setJoinCodeInput,
  });

  const fetchCampaignById = useCallback(
    async (campaignId: string) => {
      return withToken((token) => fetchCampaignByIdRequest(token, campaignId));
    },
    [withToken]
  );

  useEffect(() => {
    if (!firebaseUser) {
      setMe(null);
      setNotes([]);
      setCampaigns([]);
      setJournalDayLabels([]);
      setAutoJoinAttempted(false);
      return;
    }

    refreshSession();
  }, [firebaseUser, refreshSession]);

  useAutoJoinCampaign({
    autoJoinAttempted,
    autoJoinCode,
    firebaseUser,
    setAutoJoinAttempted,
    joinByCode: joinCampaignByCode,
  });

  const toggleTheme = useCallback(() => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('theme', nextTheme);
    document.documentElement.classList.toggle('dark', nextTheme === 'dark');
  }, [theme]);

  const contextValue = useMemo<SessionContextValue>(
    () => ({
      authMode,
      authForm,
      firebaseUser,
      isAuthInitializing,
      me,
      notes,
      campaigns,
      journalDayLabels,
      profileForm,
      joinCodeInput,
      campaignNameInput,
      isLoading,
      error,
      theme,
      setAuthMode,
      setAuthForm,
      setProfileForm,
      setJoinCodeInput,
      setCampaignNameInput,
      setError,
      refreshSession,
      submitAuthForm,
      saveProfile,
      joinCampaign,
      createCampaign,
      deleteCampaign,
      fetchCampaignById,
      createNote,
      setDayGroupTitle,
      logout,
      toggleTheme,
    }),
    [
      authMode,
      authForm,
      campaignNameInput,
      campaigns,
      createCampaign,
      createNote,
      deleteCampaign,
      fetchCampaignById,
      error,
      firebaseUser,
      isAuthInitializing,
      isLoading,
      joinCampaign,
      joinCodeInput,
      journalDayLabels,
      logout,
      me,
      notes,
      profileForm,
      refreshSession,
      saveProfile,
      setDayGroupTitle,
      submitAuthForm,
      theme,
      toggleTheme,
    ]
  );

  return <SessionContext.Provider value={contextValue}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used inside SessionProvider');
  }
  return context;
}
