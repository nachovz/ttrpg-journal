import { useSession } from '../../context/SessionContext/SessionContext';
import type { ProfileViewProps } from './types';

export function ProfileView({ title = 'Profile' }: ProfileViewProps) {
  const { isLoading, profileForm, saveProfile, setProfileForm } = useSession();

  return (
    <section className="card">
      <h2>{title}</h2>
      <form onSubmit={saveProfile} className="form">
        <label>
          Username
          <input
            type="text"
            value={profileForm.username}
            onChange={(event) => setProfileForm((previous) => ({ ...previous, username: event.target.value }))}
            required
            maxLength={50}
          />
        </label>

        <label>
          Character Name
          <input
            type="text"
            value={profileForm.characterName}
            onChange={(event) => setProfileForm((previous) => ({ ...previous, characterName: event.target.value }))}
            maxLength={80}
          />
        </label>

        <label>
          D&D Beyond Character Sheet URL
          <input
            type="url"
            value={profileForm.dndBeyondUrl}
            onChange={(event) => setProfileForm((previous) => ({ ...previous, dndBeyondUrl: event.target.value }))}
            placeholder="https://www.dndbeyond.com/characters/..."
          />
        </label>

        <label>
          Profile Image URL
          <input
            type="url"
            value={profileForm.profileImageUrl}
            onChange={(event) => setProfileForm((previous) => ({ ...previous, profileImageUrl: event.target.value }))}
            placeholder="https://example.com/avatar.png"
          />
        </label>

        <button disabled={isLoading} type="submit">
          Save profile
        </button>
      </form>
    </section>
  );
}
