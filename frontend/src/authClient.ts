import {
  createUserWithEmailAndPassword as firebaseCreateUserWithEmailAndPassword,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  signInWithEmailAndPassword as firebaseSignInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import { auth as firebaseAuth } from './firebase';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const useLocalAuth = String(import.meta.env.VITE_LOCAL_AUTH_MODE || '').toLowerCase() === 'true';

const LOCAL_TOKEN_KEY = 'bards_journal_local_token';
const LOCAL_USER_KEY = 'bards_journal_local_user';

export type AuthUser = Pick<FirebaseUser, 'uid' | 'email' | 'getIdToken'>;

interface LocalStoredUser {
  uid: string;
  email: string;
}

class LocalAuthUserImpl {
  uid;
  email;
  #token;

  constructor(user, token) {
    this.uid = user.uid;
    this.email = user.email;
    this.#token = token;
  }

  async getIdToken() {
    return this.#token;
  }
}

const localState = {
  currentUser: null,
  listeners: new Set(),
};

function loadLocalUserFromStorage() {
  const token = localStorage.getItem(LOCAL_TOKEN_KEY);
  const rawUser = localStorage.getItem(LOCAL_USER_KEY);
  if (!token || !rawUser) return null;
  try {
    const user = JSON.parse(rawUser);
    if (!user?.uid || !user?.email) return null;
    return new LocalAuthUserImpl(user, token);
  } catch {
    return null;
  }
}

function saveLocalAuth(user, token) {
  localStorage.setItem(LOCAL_TOKEN_KEY, token);
  localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(user));
  localState.currentUser = new LocalAuthUserImpl(user, token);
}

function clearLocalAuth() {
  localStorage.removeItem(LOCAL_TOKEN_KEY);
  localStorage.removeItem(LOCAL_USER_KEY);
  localState.currentUser = null;
}

function notifyLocalAuthListeners() {
  for (const listener of localState.listeners) {
    listener(localState.currentUser);
  }
}

async function postLocalAuth(path, email, password) {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Authentication failed');
  }
  return data;
}

export const authClient = useLocalAuth ? ({ mode: 'local' } as const) : firebaseAuth;

export async function createUserWithEmailAndPassword(_auth, email, password) {
  if (!useLocalAuth) {
    return firebaseCreateUserWithEmailAndPassword(firebaseAuth, email, password);
  }

  const data = await postLocalAuth('/api/local-auth/register', email, password);
  saveLocalAuth(data.user, data.token);
  notifyLocalAuthListeners();
  return { user: localState.currentUser };
}

export async function signInWithEmailAndPassword(_auth, email, password) {
  if (!useLocalAuth) {
    return firebaseSignInWithEmailAndPassword(firebaseAuth, email, password);
  }

  const data = await postLocalAuth('/api/local-auth/login', email, password);
  saveLocalAuth(data.user, data.token);
  notifyLocalAuthListeners();
  return { user: localState.currentUser };
}

export async function signOut(_auth) {
  if (!useLocalAuth) {
    return firebaseSignOut(firebaseAuth);
  }
  clearLocalAuth();
  notifyLocalAuthListeners();
}

export function onAuthStateChanged(_auth, next, errorCallback) {
  if (!useLocalAuth) {
    return firebaseOnAuthStateChanged(firebaseAuth, next, errorCallback);
  }

  try {
    if (!localState.currentUser) {
      localState.currentUser = loadLocalUserFromStorage();
    }
    localState.listeners.add(next);
    window.setTimeout(() => next(localState.currentUser), 0);
  } catch (error) {
    if (errorCallback) errorCallback(error);
  }

  return () => {
    localState.listeners.delete(next);
  };
}

export function isUsingLocalAuth() {
  return useLocalAuth;
}

