import type { User } from 'firebase/auth';
import type { Dispatch, FormEvent, SetStateAction } from 'react';
import type {
  AuthFormState,
  Campaign,
  JournalDayLabel,
  Note,
  NoteVisibility,
  ProfileFormState,
  SessionUser,
} from '../../types/entities';

export interface SessionContextValue {
  authMode: 'login' | 'register';
  authForm: AuthFormState;
  firebaseUser: User | null;
  isAuthInitializing: boolean;
  me: SessionUser | null;
  notes: Note[];
  campaigns: Campaign[];
  journalDayLabels: JournalDayLabel[];
  selectedCampaignId: string;
  profileForm: ProfileFormState;
  joinCodeInput: string;
  campaignNameInput: string;
  isLoading: boolean;
  error: string;
  theme: 'light' | 'dark';
  setAuthMode: (mode: 'login' | 'register') => void;
  setAuthForm: Dispatch<SetStateAction<AuthFormState>>;
  setSelectedCampaignId: Dispatch<SetStateAction<string>>;
  setProfileForm: Dispatch<SetStateAction<ProfileFormState>>;
  setJoinCodeInput: Dispatch<SetStateAction<string>>;
  setCampaignNameInput: Dispatch<SetStateAction<string>>;
  setError: Dispatch<SetStateAction<string>>;
  refreshSession: () => Promise<void>;
  submitAuthForm: (event: FormEvent) => Promise<void>;
  saveProfile: (event: FormEvent) => Promise<void>;
  joinCampaign: (event: FormEvent) => Promise<void>;
  createCampaign: (event: FormEvent) => Promise<void>;
  deleteCampaign: (campaign: Campaign) => Promise<void>;
  createNote: (params: { contentHtml: string; campaignId: string; visibility?: NoteVisibility }) => Promise<void>;
  setDayGroupTitle: (params: { campaignId: string; day: string; title: string }) => Promise<void>;
  logout: () => Promise<void>;
  toggleTheme: () => void;
}
