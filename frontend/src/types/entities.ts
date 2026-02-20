export type UserRole = 'admin' | 'user';
export type NoteVisibility = 'public' | 'private';

export interface AuthFormState {
  email: string;
  password: string;
}

export interface ProfileFormState {
  username: string;
  characterName: string;
  dndBeyondUrl: string;
  profileImageUrl: string;
}

export interface CampaignFormState {
  name: string;
}

export interface Campaign {
  id: string;
  name: string;
  joinCode: string;
  joinLink: string;
  createdAt: string;
  updatedAt?: string;
  createdBy: string;
  memberIds: string[];
}

export interface Note {
  id: string;
  userId: string;
  userEmail: string;
  userRole?: UserRole;
  username?: string;
  characterName?: string;
  dndBeyondUrl?: string;
  profileImageUrl?: string;
  campaignId: string;
  campaignName?: string;
  visibility?: NoteVisibility;
  contentHtml: string;
  entryDate: string;
  createdAt: string;
  updatedAt?: string;
}

export interface JournalDayLabel {
  id: string;
  campaignId: string;
  entryDate: string;
  title: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface SessionUser {
  uid: string;
  email: string;
  role: UserRole;
  username: string;
  characterName: string;
  dndBeyondUrl: string;
  profileImageUrl: string;
}
