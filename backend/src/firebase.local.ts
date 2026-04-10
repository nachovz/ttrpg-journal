import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export interface AuthUser {
  uid: string;
  email: string;
  password: string;
  customClaims?: Record<string, unknown>;
}

export interface AuthToken {
  uid: string;
  email: string;
  issuedAt: string;
}

interface CollectionMap {
  [collectionName: string]: Record<string, unknown>;
}

export interface LocalState {
  authUsers: Record<string, AuthUser>;
  authTokens: Record<string, AuthToken>;
  collections: CollectionMap;
}

type WhereOperator = '==' | 'array-contains';

interface WhereClause {
  type: 'where';
  field: string;
  op: WhereOperator;
  value: unknown;
}

interface OrderByClause {
  type: 'orderBy';
  field: string;
  direction: 'asc' | 'desc';
}

interface LimitClause {
  type: 'limit';
  count: number;
}

type QueryClause = WhereClause | OrderByClause | LimitClause;

interface RowEntry {
  id: string;
  data: Record<string, unknown>;
}

const dataFilePath = process.env.LOCAL_FIREBASE_DATA_FILE
  ? path.resolve(process.env.LOCAL_FIREBASE_DATA_FILE)
  : path.resolve(process.cwd(), '.local-firebase-data.json');

function createEmptyState(): LocalState {
  return {
    authUsers: {},
    authTokens: {},
    collections: {
      users: {},
      campaigns: {},
      notes: {},
      journalDayLabels: {},
    },
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function ensureDirForFile(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function loadState(): LocalState {
  try {
    if (!fs.existsSync(dataFilePath)) return createEmptyState();
    const parsed = JSON.parse(fs.readFileSync(dataFilePath, 'utf8')) as Partial<LocalState>;
    return {
      ...createEmptyState(),
      ...parsed,
      collections: {
        ...createEmptyState().collections,
        ...(parsed.collections || {}),
      },
    };
  } catch {
    return createEmptyState();
  }
}

let state = loadState();

function persistState(): void {
  ensureDirForFile(dataFilePath);
  fs.writeFileSync(dataFilePath, JSON.stringify(state, null, 2));
}

function randomId(): string {
  return crypto.randomBytes(10).toString('hex');
}

function shallowMerge(
  existing: Record<string, unknown> | undefined,
  update: Record<string, unknown> | undefined
): Record<string, unknown> {
  return { ...(existing || {}), ...(update || {}) };
}

export class LocalDocumentSnapshot {
  id: string;
  _data: unknown;
  exists: boolean;

  constructor(id: string, data: unknown) {
    this.id = id;
    this._data = data;
    this.exists = data !== undefined;
  }

  data(): Record<string, unknown> | undefined {
    return this.exists ? clone(this._data as Record<string, unknown>) : undefined;
  }
}

export class LocalQueryDocumentSnapshot extends LocalDocumentSnapshot {
  ref: LocalDocumentReference;

  constructor(collectionName: string, id: string, data: unknown) {
    super(id, data);
    this.ref = new LocalDocumentReference(collectionName, id);
  }
}

export class LocalQuerySnapshot {
  docs: LocalQueryDocumentSnapshot[];
  size: number;
  empty: boolean;

  constructor(docs: LocalQueryDocumentSnapshot[]) {
    this.docs = docs;
    this.size = docs.length;
    this.empty = docs.length === 0;
  }
}

class LocalDocumentReference {
  _collectionName: string;
  id: string;

  constructor(collectionName: string, id: string) {
    this._collectionName = collectionName;
    this.id = id;
  }

  async get(): Promise<LocalDocumentSnapshot> {
    const collection = (state.collections[this._collectionName] || {}) as Record<string, unknown>;
    const raw = collection[this.id];
    return new LocalDocumentSnapshot(this.id, raw === undefined ? undefined : raw);
  }

  async set(data: Record<string, unknown>, options: { merge?: boolean } = {}): Promise<void> {
    const collection = state.collections[this._collectionName] || (state.collections[this._collectionName] = {});
    (collection as Record<string, unknown>)[this.id] = options.merge
      ? shallowMerge((collection as Record<string, unknown>)[this.id] as Record<string, unknown>, clone(data))
      : clone(data);
    persistState();
  }

  async update(updateData: Record<string, unknown>): Promise<void> {
    const collection = state.collections[this._collectionName] || (state.collections[this._collectionName] = {});
    const existing = (collection as Record<string, unknown>)[this.id] as Record<string, unknown> | undefined;
    (collection as Record<string, unknown>)[this.id] = shallowMerge(existing || {}, clone(updateData));
    persistState();
  }

  async delete(): Promise<void> {
    const collection = state.collections[this._collectionName] || {};
    delete (collection as Record<string, unknown>)[this.id];
    persistState();
  }
}

function applyWhere(row: RowEntry, clause: WhereClause): boolean {
  const value = (row?.data as Record<string, unknown>)?.[clause.field];
  if (clause.op === '==') {
    return value === clause.value;
  }
  if (clause.op === 'array-contains') {
    return Array.isArray(value) && value.includes(clause.value);
  }
  throw new Error(`Unsupported where operator in local db: ${clause.op}`);
}

export class LocalQuery {
  _collectionName: string;
  _clauses: QueryClause[];

  constructor(collectionName: string, clauses: QueryClause[] = []) {
    this._collectionName = collectionName;
    this._clauses = clauses;
  }

  where(field: string, op: WhereOperator, value: unknown): LocalQuery {
    return new LocalQuery(this._collectionName, [...this._clauses, { type: 'where', field, op, value }]);
  }

  orderBy(field: string, direction: 'asc' | 'desc' = 'asc'): LocalQuery {
    return new LocalQuery(this._collectionName, [...this._clauses, { type: 'orderBy', field, direction }]);
  }

  limit(count: number): LocalQuery {
    return new LocalQuery(this._collectionName, [...this._clauses, { type: 'limit', count }]);
  }

  async get(): Promise<LocalQuerySnapshot> {
    const collection = (state.collections[this._collectionName] || {}) as Record<string, unknown>;
    let rows: RowEntry[] = Object.entries(collection).map(([id, data]) => ({
      id,
      data: clone(data as Record<string, unknown>),
    }));

    for (const clause of this._clauses) {
      if (clause.type === 'where') {
        rows = rows.filter((row) => applyWhere(row, clause));
      }
    }

    for (const clause of this._clauses) {
      if (clause.type === 'orderBy') {
        const multiplier = clause.direction === 'desc' ? -1 : 1;
        rows.sort((a, b) => {
          const left = a.data?.[clause.field];
          const right = b.data?.[clause.field];
          return String(left ?? '').localeCompare(String(right ?? '')) * multiplier;
        });
      }
    }

    const limitClause = this._clauses.find((clause): clause is LimitClause => clause.type === 'limit');
    if (limitClause) {
      rows = rows.slice(0, limitClause.count);
    }

    return new LocalQuerySnapshot(
      rows.map((row) => new LocalQueryDocumentSnapshot(this._collectionName, row.id, row.data))
    );
  }
}

class LocalCollectionReference extends LocalQuery {
  constructor(collectionName: string) {
    super(collectionName);
    this.id = collectionName;
    this._collectionName = collectionName;
  }

  id: string;

  doc(id: string): LocalDocumentReference {
    return new LocalDocumentReference(this._collectionName, id);
  }

  async add(data: Record<string, unknown>): Promise<LocalDocumentReference> {
    const id = randomId();
    const ref = this.doc(id);
    await ref.set(data);
    return ref;
  }
}

interface BatchOp {
  type: 'delete';
  ref: LocalDocumentReference;
}

class LocalWriteBatch {
  _ops: BatchOp[];

  constructor() {
    this._ops = [];
  }

  delete(ref: LocalDocumentReference): void {
    this._ops.push({ type: 'delete', ref });
  }

  async commit(): Promise<void> {
    for (const op of this._ops) {
      if (op.type === 'delete') {
        const collection = state.collections[op.ref._collectionName] || {};
        delete (collection as Record<string, unknown>)[op.ref.id];
      }
    }
    persistState();
  }
}

class LocalTransaction {
  async get(docRef: LocalDocumentReference): Promise<LocalDocumentSnapshot> {
    return docRef.get();
  }

  update(docRef: LocalDocumentReference, data: Record<string, unknown>): void {
    const collection =
      state.collections[docRef._collectionName] || (state.collections[docRef._collectionName] = {});
    (collection as Record<string, unknown>)[docRef.id] = shallowMerge(
      ((collection as Record<string, unknown>)[docRef.id] as Record<string, unknown>) || {},
      clone(data)
    );
  }
}

export const db = {
  collection(name: string): LocalCollectionReference {
    if (!state.collections[name]) state.collections[name] = {};
    return new LocalCollectionReference(name);
  },
  batch(): LocalWriteBatch {
    return new LocalWriteBatch();
  },
  async runTransaction<T>(handler: (tx: LocalTransaction) => Promise<T>): Promise<T> {
    const tx = new LocalTransaction();
    const result = await handler(tx);
    persistState();
    return result;
  },
};

function normalizeEmail(email: unknown): string {
  return String(email || '').trim().toLowerCase();
}

function findAuthUserByEmail(email: string): AuthUser | null {
  const target = normalizeEmail(email);
  return Object.values(state.authUsers).find((user) => normalizeEmail(user.email) === target) || null;
}

function createTokenForUser(user: AuthUser): string {
  const token = `local.${crypto.randomBytes(24).toString('hex')}`;
  state.authTokens[token] = {
    uid: user.uid,
    email: user.email,
    issuedAt: new Date().toISOString(),
  };
  persistState();
  return token;
}

export const auth = {
  async getUser(uid: string): Promise<AuthUser> {
    const user = state.authUsers[uid];
    if (!user) {
      throw new Error('User not found');
    }
    return clone(user);
  },
  async setCustomUserClaims(uid: string, claims: Record<string, unknown>): Promise<void> {
    const existing = state.authUsers[uid];
    if (!existing) {
      throw new Error('User not found');
    }
    existing.customClaims = { ...(existing.customClaims || {}), ...(claims || {}) };
    persistState();
  },
  async verifyIdToken(token: unknown): Promise<{ uid: string; email: string; role: unknown }> {
    const tokenData = state.authTokens[String(token || '')];
    if (!tokenData) {
      throw new Error('Invalid token');
    }
    const user = state.authUsers[tokenData.uid];
    if (!user) {
      throw new Error('User not found');
    }
    return {
      uid: user.uid,
      email: user.email,
      role: user.customClaims?.['role'],
    };
  },
};

interface AuthResult {
  token: string;
  user: { uid: string; email: string };
}

export function localAuthApi(): {
  register(opts: { email: string; password: string }): Promise<AuthResult>;
  login(opts: { email: string; password: string }): Promise<AuthResult>;
} {
  return {
    async register({ email, password }: { email: string; password: string }): Promise<AuthResult> {
      const normalizedEmail = normalizeEmail(email);
      if (!normalizedEmail) throw new Error('email is required');
      if (!password || String(password).length < 6) throw new Error('password must be at least 6 characters');
      if (findAuthUserByEmail(normalizedEmail)) throw new Error('Email already in use');

      const uid = randomId();
      state.authUsers[uid] = {
        uid,
        email: normalizedEmail,
        password: String(password),
        customClaims: {},
      };
      persistState();
      const token = createTokenForUser(state.authUsers[uid]);
      return {
        token,
        user: {
          uid,
          email: normalizedEmail,
        },
      };
    },
    async login({ email, password }: { email: string; password: string }): Promise<AuthResult> {
      const user = findAuthUserByEmail(email);
      if (!user || user.password !== String(password)) {
        throw new Error('Invalid email or password');
      }
      const token = createTokenForUser(user);
      return {
        token,
        user: {
          uid: user.uid,
          email: user.email,
        },
      };
    },
  };
}

export const isUsingLocalFirebase = true;
