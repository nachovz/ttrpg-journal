import type { Note } from '../types/entities';

const PLAYER_TINT_HUES = [18, 32, 48, 84, 124, 168, 202, 224, 258, 292, 328];
const DM_TINT_HUE = 12;

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function getNoteTintHue(note: Pick<Note, 'userId' | 'userRole'>) {
  if (note.userRole === 'admin') return DM_TINT_HUE;
  if (!note.userId) return PLAYER_TINT_HUES[0];
  const hueIndex = hashString(note.userId) % PLAYER_TINT_HUES.length;
  return PLAYER_TINT_HUES[hueIndex];
}
