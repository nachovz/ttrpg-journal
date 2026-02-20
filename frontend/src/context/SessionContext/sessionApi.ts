import { apiRequest } from '../../api';
import type {
  Campaign,
  JournalDayLabel,
  Note,
  NoteVisibility,
  ProfileFormState,
  SessionUser,
} from '../../types/entities';

export interface SessionPayload {
  me: SessionUser;
  campaigns: Campaign[];
  notes: Note[];
  dayLabels: JournalDayLabel[];
}

export async function fetchSessionPayload(token: string): Promise<SessionPayload> {
  const [meData, campaignsData, notesData, labelsData] = await Promise.all([
    apiRequest('/api/me', token),
    apiRequest('/api/campaigns', token),
    apiRequest('/api/notes', token),
    apiRequest('/api/journal-day-labels', token),
  ]);

  return {
    me: meData as SessionUser,
    campaigns: campaignsData as Campaign[],
    notes: notesData as Note[],
    dayLabels: labelsData as JournalDayLabel[],
  };
}

export async function updateProfile(token: string, profile: ProfileFormState) {
  await apiRequest('/api/profile', token, {
    method: 'PUT',
    body: JSON.stringify(profile),
  });
}

export async function joinCampaignByCode(token: string, joinCode: string) {
  await apiRequest('/api/campaigns/join', token, {
    method: 'POST',
    body: JSON.stringify({ joinCode }),
  });
}

export async function createCampaign(token: string, campaignName: string) {
  await apiRequest('/api/campaigns', token, {
    method: 'POST',
    body: JSON.stringify({ name: campaignName }),
  });
}

export async function deleteCampaign(token: string, campaignId: string) {
  await apiRequest(`/api/campaigns/${campaignId}`, token, {
    method: 'DELETE',
  });
}

export async function createJournalNote(token: string, params: { contentHtml: string; campaignId: string; visibility?: NoteVisibility }) {
  await apiRequest('/api/notes', token, {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function upsertJournalDayTitle(token: string, params: { campaignId: string; day: string; title: string }) {
  await apiRequest(`/api/journal-day-labels/${encodeURIComponent(params.campaignId)}/${encodeURIComponent(params.day)}`, token, {
    method: 'PUT',
    body: JSON.stringify({ title: params.title }),
  });
}
