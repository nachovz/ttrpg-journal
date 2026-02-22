import type { Note } from '../../types/entities';

export interface AdminDayGroup {
  day: string;
  notes: Note[];
}

export interface AdminJournalChatProps {
  campaignName: string;
  currentUserId: string;
  dayGroups: AdminDayGroup[];
  dayLabelByKey: Map<string, string>;
  isLoading: boolean;
  selectedCampaignId: string;
  onExportDayGroup: (day: string) => void;
  onRenameDayGroup: (day: string) => void;
}
