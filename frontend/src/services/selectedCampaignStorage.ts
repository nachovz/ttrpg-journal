import { browserStorageService } from './browserStorageService';

const STORAGE_KEY = 'bards_journal.selected_campaign_id';

function normalizeCampaignId(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

class SelectedCampaignStorage {
  private static instance: SelectedCampaignStorage | null = null;

  static getInstance() {
    if (!SelectedCampaignStorage.instance) {
      SelectedCampaignStorage.instance = new SelectedCampaignStorage();
    }
    return SelectedCampaignStorage.instance;
  }

  private constructor() {}

  getSelectedCampaignId(): string | null {
    const campaignId = normalizeCampaignId(browserStorageService.getString(STORAGE_KEY));
    return campaignId || null;
  }

  setSelectedCampaignId(campaignId: string) {
    const normalizedCampaignId = normalizeCampaignId(campaignId);
    if (!normalizedCampaignId) return;
    browserStorageService.setString(STORAGE_KEY, normalizedCampaignId);
  }

  clearSelectedCampaignId() {
    browserStorageService.remove(STORAGE_KEY);
  }
}

export const selectedCampaignStorage = SelectedCampaignStorage.getInstance();
