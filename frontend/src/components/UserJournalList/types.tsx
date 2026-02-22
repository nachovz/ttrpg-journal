import type { Note } from '../../types/entities';

export interface UserCampaignGroup {
  campaignId: string;
  campaignName: string;
  notes: Note[];
}

export interface UserJournalListProps {
  groups: UserCampaignGroup[];
  dayLabelByKey: Map<string, string>;
  currentUserId: string;
}
