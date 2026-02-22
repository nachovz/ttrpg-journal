import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const dataFilePath = process.env.LOCAL_FIREBASE_DATA_FILE
  ? path.resolve(process.env.LOCAL_FIREBASE_DATA_FILE)
  : path.resolve(process.cwd(), '.local-firebase-data.json');

function createEmptyState() {
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

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function ensureDirForFile(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function loadState() {
  try {
    if (!fs.existsSync(dataFilePath)) return createEmptyState();
    const parsed = JSON.parse(fs.readFileSync(dataFilePath, 'utf8'));
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

function persistState() {
  ensureDirForFile(dataFilePath);
  fs.writeFileSync(dataFilePath, JSON.stringify(state, null, 2));
}

function randomId() {
  return crypto.randomBytes(10).toString('hex');
}

function shallowMerge(existing, update) {
  return { ...(existing || {}), ...(update || {}) };
}

class LocalDocumentSnapshot {
  constructor(id, data) {
    this.id = id;
    this._data = data;
    this.exists = data !== undefined;
  }

  data() {
    return this.exists ? clone(this._data) : undefined;
  }
}

class LocalQueryDocumentSnapshot extends LocalDocumentSnapshot {
  constructor(collectionName, id, data) {
    super(id, data);
    this.ref = new LocalDocumentReference(collectionName, id);
  }
}

class LocalQuerySnapshot {
  constructor(docs) {
    this.docs = docs;
    this.size = docs.length;
    this.empty = docs.length === 0;
  }
}

class LocalDocumentReference {
  constructor(collectionName, id) {
    this._collectionName = collectionName;
    this.id = id;
  }

  async get() {
    const collection = state.collections[this._collectionName] || {};
    const raw = collection[this.id];
    return new LocalDocumentSnapshot(this.id, raw === undefined ? undefined : raw);
  }

  async set(data, options = {}) {
    const collection = state.collections[this._collectionName] || (state.collections[this._collectionName] = {});
    collection[this.id] = options.merge ? shallowMerge(collection[this.id], clone(data)) : clone(data);
    persistState();
  }

  async update(updateData) {
    const collection = state.collections[this._collectionName] || (state.collections[this._collectionName] = {});
    const existing = collection[this.id] || {};
    collection[this.id] = shallowMerge(existing, clone(updateData));
    persistState();
  }

  async delete() {
    const collection = state.collections[this._collectionName] || {};
    delete collection[this.id];
    persistState();
  }
}

function applyWhere(row, clause) {
  const value = row?.data?.[clause.field];
  if (clause.op === '==') {
    return value === clause.value;
  }
  if (clause.op === 'array-contains') {
    return Array.isArray(value) && value.includes(clause.value);
  }
  throw new Error(`Unsupported where operator in local db: ${clause.op}`);
}

class LocalQuery {
  constructor(collectionName, clauses = []) {
    this._collectionName = collectionName;
    this._clauses = clauses;
  }

  where(field, op, value) {
    return new LocalQuery(this._collectionName, [...this._clauses, { type: 'where', field, op, value }]);
  }

  orderBy(field, direction = 'asc') {
    return new LocalQuery(this._collectionName, [...this._clauses, { type: 'orderBy', field, direction }]);
  }

  limit(count) {
    return new LocalQuery(this._collectionName, [...this._clauses, { type: 'limit', count }]);
  }

  async get() {
    const collection = state.collections[this._collectionName] || {};
    let rows = Object.entries(collection).map(([id, data]) => ({ id, data: clone(data) }));

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

    const limitClause = this._clauses.find((clause) => clause.type === 'limit');
    if (limitClause) {
      rows = rows.slice(0, limitClause.count);
    }

    return new LocalQuerySnapshot(rows.map((row) => new LocalQueryDocumentSnapshot(this._collectionName, row.id, row.data)));
  }
}

class LocalCollectionReference extends LocalQuery {
  constructor(collectionName) {
    super(collectionName);
    this.id = collectionName;
    this._collectionName = collectionName;
  }

  doc(id) {
    return new LocalDocumentReference(this._collectionName, id);
  }

  async add(data) {
    const id = randomId();
    const ref = this.doc(id);
    await ref.set(data);
    return ref;
  }
}

class LocalWriteBatch {
  constructor() {
    this._ops = [];
  }

  delete(ref) {
    this._ops.push({ type: 'delete', ref });
  }

  async commit() {
    for (const op of this._ops) {
      if (op.type === 'delete') {
        const collection = state.collections[op.ref._collectionName] || {};
        delete collection[op.ref.id];
      }
    }
    persistState();
  }
}

class LocalTransaction {
  async get(docRef) {
    return docRef.get();
  }

  update(docRef, data) {
    const collection = state.collections[docRef._collectionName] || (state.collections[docRef._collectionName] = {});
    collection[docRef.id] = shallowMerge(collection[docRef.id] || {}, clone(data));
  }
}

export const db = {
  collection(name) {
    if (!state.collections[name]) state.collections[name] = {};
    return new LocalCollectionReference(name);
  },
  batch() {
    return new LocalWriteBatch();
  },
  async runTransaction(handler) {
    const tx = new LocalTransaction();
    const result = await handler(tx);
    persistState();
    return result;
  },
};

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function findAuthUserByEmail(email) {
  const target = normalizeEmail(email);
  return Object.values(state.authUsers).find((user) => normalizeEmail(user.email) === target) || null;
}

function createTokenForUser(user) {
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
  async getUser(uid) {
    const user = state.authUsers[uid];
    if (!user) {
      throw new Error('User not found');
    }
    return clone(user);
  },
  async setCustomUserClaims(uid, claims) {
    const existing = state.authUsers[uid];
    if (!existing) {
      throw new Error('User not found');
    }
    existing.customClaims = { ...(existing.customClaims || {}), ...(claims || {}) };
    persistState();
  },
  async verifyIdToken(token) {
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
      role: user.customClaims?.role,
    };
  },
};

export function localAuthApi() {
  return {
    async register({ email, password }) {
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
    async login({ email, password }) {
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

