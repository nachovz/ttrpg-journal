export type AppView = 'journal' | 'campaigns' | 'profile';

export interface AppHeaderProps {
  activeView: AppView;
  onNavigateToView: (view: AppView) => void;
}
