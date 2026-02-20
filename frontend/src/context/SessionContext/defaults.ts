import type { AuthFormState, ProfileFormState } from '../../types/entities';

export const EMPTY_AUTH_FORM: AuthFormState = { email: '', password: '' };

export const EMPTY_PROFILE_FORM: ProfileFormState = {
  username: '',
  characterName: '',
  dndBeyondUrl: '',
  profileImageUrl: '',
};

export function getAutoJoinCodeFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return (params.get('join') || '').trim().toUpperCase();
}

export function clearJoinCodeInUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete('join');
  window.history.replaceState({}, '', `${url.pathname}${url.search}`);
}
