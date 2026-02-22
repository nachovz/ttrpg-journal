export interface BrowserStorageServiceApi {
  getString(key: string): string | null;
  setString(key: string, value: string): void;
  remove(key: string): void;
  getJson<T>(key: string): T | null;
  setJson<T>(key: string, value: T): void;
}

function normalizeStorageKey(key: unknown): string {
  return typeof key === 'string' ? key.trim() : '';
}

class BrowserStorageService implements BrowserStorageServiceApi {
  private static instance: BrowserStorageService | null = null;

  static getInstance() {
    if (!BrowserStorageService.instance) {
      BrowserStorageService.instance = new BrowserStorageService();
    }
    return BrowserStorageService.instance;
  }

  private constructor() {}

  private getStorage(): Storage | null {
    if (typeof window === 'undefined') return null;
    try {
      return window.localStorage;
    } catch {
      return null;
    }
  }

  getString(key: string): string | null {
    const normalizedKey = normalizeStorageKey(key);
    if (!normalizedKey) return null;

    const storage = this.getStorage();
    if (!storage) return null;

    try {
      const value = storage.getItem(normalizedKey);
      return typeof value === 'string' ? value : null;
    } catch {
      return null;
    }
  }

  setString(key: string, value: string) {
    const normalizedKey = normalizeStorageKey(key);
    if (!normalizedKey) return;

    const storage = this.getStorage();
    if (!storage) return;

    try {
      storage.setItem(normalizedKey, String(value));
    } catch {
      // Ignore localStorage failures (privacy mode / quota).
    }
  }

  remove(key: string) {
    const normalizedKey = normalizeStorageKey(key);
    if (!normalizedKey) return;

    const storage = this.getStorage();
    if (!storage) return;

    try {
      storage.removeItem(normalizedKey);
    } catch {
      // Ignore localStorage failures.
    }
  }

  getJson<T>(key: string): T | null {
    const rawValue = this.getString(key);
    if (!rawValue) return null;

    try {
      return JSON.parse(rawValue) as T;
    } catch {
      return null;
    }
  }

  setJson<T>(key: string, value: T) {
    try {
      this.setString(key, JSON.stringify(value));
    } catch {
      // Ignore serialization failures.
    }
  }
}

export const browserStorageService = BrowserStorageService.getInstance();

