import { useCallback, type Dispatch, type FormEvent, type SetStateAction } from 'react';
import { authClient, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from '../../authClient';
import type { Campaign, NoteVisibility, ProfileFormState } from '../../types/entities';
import { EMPTY_AUTH_FORM } from './defaults';
import {
  createCampaign as createCampaignRequest,
  createJournalNote,
  deleteCampaign as deleteCampaignRequest,
  joinCampaignByCode as joinCampaignByCodeRequest,
  updateProfile,
  upsertJournalDayTitle,
} from './sessionApi';

interface SessionActionsConfig {
  authMode: 'login' | 'register';
  authForm: { email: string; password: string };
  campaignNameInput: string;
  joinCodeInput: string;
  meRole: 'admin' | 'user' | undefined;
  profileForm: ProfileFormState;
  refreshSession: () => Promise<void>;
  withToken: <T>(fn: (token: string) => Promise<T>) => Promise<T>;
  setAuthForm: Dispatch<SetStateAction<{ email: string; password: string }>>;
  setCampaignNameInput: Dispatch<SetStateAction<string>>;
  setJoinCodeInput: Dispatch<SetStateAction<string>>;
  setError: Dispatch<SetStateAction<string>>;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
}

export function useSessionActions({
  authMode,
  authForm,
  campaignNameInput,
  joinCodeInput,
  meRole,
  profileForm,
  refreshSession,
  withToken,
  setAuthForm,
  setCampaignNameInput,
  setError,
  setIsLoading,
  setJoinCodeInput,
}: SessionActionsConfig) {
  const joinCampaignByCode = useCallback(
    async (joinCode: string, silentMode: boolean) => {
      const normalizedCode = String(joinCode || '').trim().toUpperCase();
      if (!normalizedCode) {
        if (!silentMode) setError('Join code is required');
        return;
      }

      try {
        await withToken((token) => joinCampaignByCodeRequest(token, normalizedCode));

        if (!silentMode) {
          setJoinCodeInput('');
        }
        await refreshSession();
      } catch (requestError) {
        if (!silentMode) {
          setError(requestError instanceof Error ? requestError.message : 'Unable to join campaign');
        }
      }
    },
    [refreshSession, setError, setJoinCodeInput, withToken]
  );

  const submitAuthForm = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      setError('');
      setIsLoading(true);

      try {
        if (authMode === 'register') {
          await createUserWithEmailAndPassword(authClient, authForm.email, authForm.password);
        } else {
          await signInWithEmailAndPassword(authClient, authForm.email, authForm.password);
        }
        setAuthForm(EMPTY_AUTH_FORM);
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : 'Authentication failed');
      } finally {
        setIsLoading(false);
      }
    },
    [authForm.email, authForm.password, authMode, setAuthForm, setError, setIsLoading]
  );

  const saveProfile = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      setError('');
      setIsLoading(true);

      try {
        await withToken((token) => updateProfile(token, profileForm));
        await refreshSession();
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : 'Unable to save profile');
      } finally {
        setIsLoading(false);
      }
    },
    [profileForm, refreshSession, setError, setIsLoading, withToken]
  );

  const joinCampaign = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      setError('');
      setIsLoading(true);
      try {
        await joinCampaignByCode(joinCodeInput, false);
      } finally {
        setIsLoading(false);
      }
    },
    [joinCampaignByCode, joinCodeInput, setError, setIsLoading]
  );

  const createCampaign = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      if (meRole !== 'admin') {
        setError('Only admins can create campaigns');
        return;
      }

      setError('');
      setIsLoading(true);

      try {
        await withToken((token) => createCampaignRequest(token, campaignNameInput));
        setCampaignNameInput('');
        await refreshSession();
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : 'Unable to create campaign');
      } finally {
        setIsLoading(false);
      }
    },
    [campaignNameInput, meRole, refreshSession, setCampaignNameInput, setError, setIsLoading, withToken]
  );

  const deleteCampaign = useCallback(
    async (campaign: Campaign) => {
      if (meRole !== 'admin') {
        setError('Only admins can delete campaigns');
        return;
      }

      const shouldDeleteCampaign = window.confirm(`Delete campaign "${campaign.name}" and all its journal entries? This cannot be undone.`);
      if (!shouldDeleteCampaign) return;

      setError('');
      setIsLoading(true);

      try {
        await withToken((token) => deleteCampaignRequest(token, campaign.id));
        await refreshSession();
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : 'Unable to delete campaign');
      } finally {
        setIsLoading(false);
      }
    },
    [meRole, refreshSession, setError, setIsLoading, withToken]
  );

  const createNote = useCallback(
    async ({ contentHtml, campaignId, visibility }: { contentHtml: string; campaignId: string; visibility?: NoteVisibility }) => {
      if (!campaignId) throw new Error('Select a campaign before saving a note');
      if (!contentHtml || contentHtml === '<p><br></p>') throw new Error('Please add note content before saving');

      await withToken((token) => createJournalNote(token, { contentHtml, campaignId, visibility }));
      await refreshSession();
    },
    [refreshSession, withToken]
  );

  const setDayGroupTitle = useCallback(
    async ({ campaignId, day, title }: { campaignId: string; day: string; title: string }) => {
      await withToken((token) => upsertJournalDayTitle(token, { campaignId, day, title }));
      await refreshSession();
    },
    [refreshSession, withToken]
  );

  const logout = useCallback(async () => {
    await signOut(authClient);
  }, []);

  return {
    createCampaign,
    createNote,
    deleteCampaign,
    joinCampaign,
    joinCampaignByCode,
    logout,
    saveProfile,
    setDayGroupTitle,
    submitAuthForm,
  };
}
