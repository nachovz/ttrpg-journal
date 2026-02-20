import { Navigate, Route, Routes } from 'react-router-dom';
import { CampaignsView } from '../../components/CampaignsView/CampaignsView';
import { JournalView } from '../../components/JournalView/JournalView';
import { ProfileView } from '../../components/ProfileView/ProfileView';
import type { AppRoutesProps } from './types';

export function AppRoutes({}: AppRoutesProps) {
  return (
    <Routes>
      <Route path="/profile" element={<ProfileView />} />
      <Route path="/campaigns" element={<CampaignsView />} />
      <Route path="/journal/*" element={<JournalView />} />
      <Route path="*" element={<Navigate replace to="/journal" />} />
    </Routes>
  );
}
