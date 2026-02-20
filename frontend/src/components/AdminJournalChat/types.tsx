import type { Note } from '../../types/entities';

export interface AdminDayGroup {
  day: string;
  notes: Note[];
}

export interface AdminJournalChatProps {
  campaignName: string;
  dayGroups: AdminDayGroup[];
  dayLabelByKey: Map<string, string>;
  isLoading: boolean;
  selectedCampaignId: string;
  onRenameDayGroup: (day: string) => void;
}
