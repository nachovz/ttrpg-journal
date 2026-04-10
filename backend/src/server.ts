import Fastify from 'fastify';
import cors from '@fastify/cors';
import dotenv from 'dotenv';
import { auth, db, isUsingLocalFirebase, localAuthApi } from './firebase.js';

dotenv.config();

export interface AuthenticatedUser {
  uid: string;
  email: string;
  role: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    user: AuthenticatedUser | null;
  }
}

export interface Campaign {
  id: string;
  name: string;
  joinCode: string;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
  memberIds?: string[];
}

export interface Note {
  id?: string;
  userId: string;
  userEmail: string;
  userRole: string;
  username: string;
  characterName: string;
  dndBeyondUrl: string;
  profileImageUrl: string;
  campaignId: string;
  campaignName: string;
  visibility: string;
  contentHtml: string;
  entryDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface JournalDayLabel {
  id?: string;
  campaignId: string;
  entryDate: string;
  title: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface UserProfile {
  uid?: string;
  email?: string;
  role?: string;
  username?: string;
  characterName?: string;
  dndBeyondUrl?: string;
  profileImageUrl?: string;
  updatedAt?: string;
}

const app = Fastify({ logger: true });
const frontendOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
const adminEmails = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

app.register(cors, {
  origin: frontendOrigin,
  credentials: true,
});

app.get('/health', async () => ({ ok: true }));

if (isUsingLocalFirebase && localAuthApi) {
  const localApi = localAuthApi;
  app.post('/api/local-auth/register', async (request, reply) => {
    try {
      const body = request.body as Record<string, unknown>;
      const email = String(body?.email || '').trim();
      const password = String(body?.password || '');
      const result = await localApi.register({ email, password });
      return result;
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : 'Unable to register' });
    }
  });

  app.post('/api/local-auth/login', async (request, reply) => {
    try {
      const body = request.body as Record<string, unknown>;
      const email = String(body?.email || '').trim();
      const password = String(body?.password || '');
      const result = await localApi.login({ email, password });
      return result;
    } catch (error) {
      return reply.code(401).send({ error: error instanceof Error ? error.message : 'Unable to login' });
    }
  });
}

function normalizeProfileInput(body: Record<string, unknown> = {}): {
  username: string;
  characterName: string;
  dndBeyondUrl: string;
  profileImageUrl: string;
} {
  const username = String(body['username'] || '').trim();
  const characterName = String(body['characterName'] || '').trim();
  const dndBeyondUrl = String(body['dndBeyondUrl'] || '').trim();
  const profileImageUrl = String(body['profileImageUrl'] || '').trim();

  if (!username) {
    throw new Error('username is required');
  }
  if (username.length > 50) {
    throw new Error('username must be 50 characters or less');
  }
  if (characterName.length > 80) {
    throw new Error('characterName must be 80 characters or less');
  }
  if (dndBeyondUrl) {
    try {
      const parsed = new URL(dndBeyondUrl);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error('dndBeyondUrl must be a valid http/https URL');
      }
    } catch {
      throw new Error('dndBeyondUrl must be a valid URL');
    }
  }
  if (profileImageUrl) {
    try {
      const parsed = new URL(profileImageUrl);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error('profileImageUrl must be a valid http/https URL');
      }
    } catch {
      throw new Error('profileImageUrl must be a valid URL');
    }
  }

  return { username, characterName, dndBeyondUrl, profileImageUrl };
}

function normalizeCampaignInput(body: Record<string, unknown> = {}): { name: string } {
  const name = String(body['name'] || '').trim();
  if (!name) {
    throw new Error('campaign name is required');
  }
  if (name.length > 80) {
    throw new Error('campaign name must be 80 characters or less');
  }
  return { name };
}

function randomJoinCode(): string {
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

async function createUniqueJoinCode(): Promise<string> {
  for (let i = 0; i < 10; i += 1) {
    const joinCode = randomJoinCode();
    const existing = await db.collection('campaigns').where('joinCode', '==', joinCode).limit(1).get();
    if (existing.empty) {
      return joinCode;
    }
  }
  throw new Error('Unable to generate unique join code');
}

async function getCampaignByJoinCode(joinCode: string): Promise<(Campaign & Record<string, unknown>) | null> {
  const snapshot = await db
    .collection('campaigns')
    .where('joinCode', '==', joinCode)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  const campaignDoc = snapshot.docs[0];
  return { id: campaignDoc.id, ...(campaignDoc.data() as Omit<Campaign, 'id'>) };
}

async function getCampaignById(campaignId: string): Promise<(Campaign & Record<string, unknown>) | null> {
  const campaignDoc = await db.collection('campaigns').doc(campaignId).get();
  if (!campaignDoc.exists) {
    return null;
  }
  return { id: campaignDoc.id, ...(campaignDoc.data() as Omit<Campaign, 'id'>) };
}

async function deleteNotesByCampaignId(campaignId: string): Promise<number> {
  const notesCollection = db.collection('notes');
  let deletedCount = 0;

  while (true) {
    const snapshot = await notesCollection.where('campaignId', '==', campaignId).limit(400).get();
    if (snapshot.empty) {
      break;
    }

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      batch.delete(doc.ref as any);
    });

    await batch.commit();
    deletedCount += snapshot.size;
  }

  return deletedCount;
}

async function deleteJournalDayLabelsByCampaignId(campaignId: string): Promise<void> {
  const labelsCollection = db.collection('journalDayLabels');

  while (true) {
    const snapshot = await labelsCollection.where('campaignId', '==', campaignId).limit(400).get();
    if (snapshot.empty) {
      break;
    }

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      batch.delete(doc.ref as any);
    });
    await batch.commit();
  }
}

function ensureCampaignMember(campaign: Record<string, unknown>, uid: string): boolean {
  const memberIds = Array.isArray(campaign['memberIds']) ? (campaign['memberIds'] as string[]) : [];
  return memberIds.includes(uid);
}

function isAdminEmail(email: unknown): boolean {
  return adminEmails.includes(String(email || '').toLowerCase());
}

function isAdminNote(note: Record<string, unknown> = {}): boolean {
  if (note['userRole'] === 'admin') return true;
  return isAdminEmail(note['userEmail']);
}

function resolveNoteVisibility(note: Record<string, unknown> = {}): 'public' | 'private' {
  const explicitVisibility = String(note['visibility'] || '').toLowerCase();
  if (explicitVisibility === 'public' || explicitVisibility === 'private') {
    return explicitVisibility;
  }
  return isAdminNote(note) ? 'private' : 'public';
}

function campaignToResponse(campaign: Campaign & Record<string, unknown>): Record<string, unknown> {
  return {
    id: campaign.id,
    name: campaign.name,
    joinCode: campaign.joinCode,
    joinLink: `${frontendOrigin}/?join=${encodeURIComponent(campaign.joinCode)}`,
    createdAt: campaign.createdAt,
    updatedAt: campaign.updatedAt || campaign.createdAt,
    createdBy: campaign.createdBy,
    memberIds: campaign.memberIds || [],
  };
}

function isNoteVisibleToUser(note: Record<string, unknown>, requestUser: AuthenticatedUser): boolean {
  if (requestUser.role === 'admin') return true;
  if (note['userId'] === requestUser.uid) return true;
  return resolveNoteVisibility(note) === 'public';
}

async function getUsersByIds(userIds: unknown[]): Promise<Map<string, Record<string, unknown>>> {
  const uniqueIds = [
    ...new Set((userIds || []).map((value) => String(value || '').trim()).filter(Boolean)),
  ];
  if (uniqueIds.length === 0) return new Map();

  const docs = await Promise.all(uniqueIds.map((userId) => db.collection('users').doc(userId).get()));
  const usersById = new Map<string, Record<string, unknown>>();
  for (const doc of docs) {
    if (!doc.exists) continue;
    usersById.set(doc.id, doc.data() || {});
  }
  return usersById;
}

function getCampaignMemberCharacterNames(
  campaign: Campaign & Record<string, unknown>,
  usersById: Map<string, Record<string, unknown>>
): string[] {
  const memberIds = Array.isArray(campaign['memberIds']) ? (campaign['memberIds'] as string[]) : [];
  const names = new Set<string>();

  for (const memberId of memberIds) {
    const userData = usersById.get(memberId);
    const characterName = String(userData?.['characterName'] || '').trim();
    if (characterName) {
      names.add(characterName);
    }
  }

  return [...names].sort((a, b) => a.localeCompare(b));
}

async function enrichCampaignResponses(
  campaigns: Array<Campaign & Record<string, unknown>>,
  requestUser: AuthenticatedUser
): Promise<Array<Record<string, unknown>>> {
  if (!Array.isArray(campaigns) || campaigns.length === 0) {
    return [];
  }

  try {
    const allMemberIds = campaigns.flatMap((campaign) =>
      Array.isArray(campaign['memberIds']) ? (campaign['memberIds'] as unknown[]) : []
    );
    const usersById = await getUsersByIds(allMemberIds);

    const noteSnapshots = await Promise.all(
      campaigns.map((campaign) => db.collection('notes').where('campaignId', '==', campaign.id).get())
    );

    return campaigns.map((campaign, index) => {
      const notes = noteSnapshots[index].docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }));
      const entryCount = notes.filter((note) => isNoteVisibleToUser(note, requestUser)).length;

      return {
        ...campaignToResponse(campaign),
        entryCount,
        memberCharacterNames: getCampaignMemberCharacterNames(campaign, usersById),
      };
    });
  } catch (error) {
    app.log.error({ error }, 'Failed to enrich campaign responses');
    return campaigns.map((campaign) => ({
      ...campaignToResponse(campaign),
      entryCount: 0,
      memberCharacterNames: [],
    }));
  }
}

async function ensureRoleFromEmail(user: {
  uid: string;
  email?: string;
  customClaims?: Record<string, unknown>;
}): Promise<string> {
  const role = isAdminEmail(user.email) ? 'admin' : 'user';
  if (user.customClaims?.['role'] !== role) {
    await auth.setCustomUserClaims(user.uid, { ...(user.customClaims || {}), role });
  }
  return role;
}

async function verifyAuthToken(
  request: import('fastify').FastifyRequest,
  reply: import('fastify').FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    await reply.code(401).send({ error: 'Missing Bearer token' });
    return;
  }

  const token = authHeader.slice('Bearer '.length);
  try {
    const decoded = await auth.verifyIdToken(token, true);
    const decodedRecord = decoded as Record<string, unknown>;
    const role =
      (decodedRecord['role'] as string | undefined) ||
      (isAdminEmail(decodedRecord['email']) ? 'admin' : 'user');

    request.user = {
      uid: String(decodedRecord['uid'] || ''),
      email: String(decodedRecord['email'] || ''),
      role,
    };
  } catch {
    await reply.code(401).send({ error: 'Invalid token' });
  }
}

app.decorateRequest('user', null);

app.get('/api/me', { preHandler: verifyAuthToken }, async (request) => {
  const firebaseUser = await auth.getUser((request.user as AuthenticatedUser).uid);
  const firebaseUserRecord = firebaseUser as unknown as Record<string, unknown>;
  const role = await ensureRoleFromEmail({
    uid: String(firebaseUserRecord['uid'] || ''),
    email: firebaseUserRecord['email'] as string | undefined,
    customClaims: firebaseUserRecord['customClaims'] as Record<string, unknown> | undefined,
  });
  const userRef = db.collection('users').doc(String(firebaseUserRecord['uid'] || ''));
  const userDoc = await userRef.get();
  const userData = (userDoc.exists ? userDoc.data() : {}) as Record<string, unknown>;

  const me = {
    uid: String(firebaseUserRecord['uid'] || ''),
    email: String(firebaseUserRecord['email'] || ''),
    role,
    username: String(userData['username'] || ''),
    characterName: String(userData['characterName'] || ''),
    dndBeyondUrl: String(userData['dndBeyondUrl'] || ''),
    profileImageUrl: String(userData['profileImageUrl'] || ''),
  };

  await userRef.set(
    {
      email: me.email,
      role: me.role,
      username: me.username,
      characterName: me.characterName,
      dndBeyondUrl: me.dndBeyondUrl,
      profileImageUrl: me.profileImageUrl,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );

  return me;
});

app.put('/api/profile', { preHandler: verifyAuthToken }, async (request, reply) => {
  const requestUser = request.user as AuthenticatedUser;
  let profile: ReturnType<typeof normalizeProfileInput>;
  try {
    profile = normalizeProfileInput(request.body as Record<string, unknown>);
  } catch (error) {
    return reply.code(400).send({ error: (error as Error).message });
  }

  const updatedAt = new Date().toISOString();
  await db.collection('users').doc(requestUser.uid).set(
    {
      ...profile,
      email: requestUser.email,
      role: requestUser.role,
      updatedAt,
    },
    { merge: true }
  );

  return { ...profile, updatedAt };
});

app.get('/api/campaigns', { preHandler: verifyAuthToken }, async (request) => {
  const requestUser = request.user as AuthenticatedUser;
  const snapshot = await db.collection('campaigns').where('memberIds', 'array-contains', requestUser.uid).get();
  const campaigns = snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Omit<Campaign, 'id'>) }));
  const enrichedCampaigns = await enrichCampaignResponses(campaigns, requestUser);
  return enrichedCampaigns.sort((a, b) => String(a['name']).localeCompare(String(b['name'])));
});

app.get('/api/campaigns/:id', { preHandler: verifyAuthToken }, async (request, reply) => {
  const requestUser = request.user as AuthenticatedUser;
  const params = request.params as Record<string, unknown>;
  const campaignId = String(params?.['id'] || '').trim();
  if (!campaignId) {
    return reply.code(400).send({ error: 'campaign id is required' });
  }

  const campaign = await getCampaignById(campaignId);
  if (!campaign) {
    return reply.code(404).send({ error: 'Campaign not found' });
  }

  if (!ensureCampaignMember(campaign, requestUser.uid)) {
    return reply.code(403).send({ error: 'You are not a member of this campaign' });
  }

  const [enrichedCampaign] = await enrichCampaignResponses([campaign], requestUser);
  return enrichedCampaign;
});

app.post('/api/campaigns', { preHandler: verifyAuthToken }, async (request, reply) => {
  const requestUser = request.user as AuthenticatedUser;
  if (requestUser.role !== 'admin') {
    return reply.code(403).send({ error: 'Only admins can create campaigns' });
  }

  let payload: ReturnType<typeof normalizeCampaignInput>;
  try {
    payload = normalizeCampaignInput(request.body as Record<string, unknown>);
  } catch (error) {
    return reply.code(400).send({ error: (error as Error).message });
  }

  const joinCode = await createUniqueJoinCode();
  const now = new Date().toISOString();

  const campaign: Omit<Campaign, 'id'> = {
    name: payload.name,
    joinCode,
    createdBy: requestUser.uid,
    createdAt: now,
    updatedAt: now,
    memberIds: [requestUser.uid],
  };

  const ref = await db.collection('campaigns').add(campaign as Record<string, unknown>);
  const [enrichedCampaign] = await enrichCampaignResponses(
    [{ id: ref.id, ...campaign }],
    requestUser
  );
  return enrichedCampaign;
});

app.post('/api/campaigns/join', { preHandler: verifyAuthToken }, async (request, reply) => {
  const requestUser = request.user as AuthenticatedUser;
  const body = request.body as Record<string, unknown>;
  const joinCode = String(body?.['joinCode'] || '').trim().toUpperCase();
  if (!joinCode) {
    return reply.code(400).send({ error: 'joinCode is required' });
  }

  const campaign = await getCampaignByJoinCode(joinCode);
  if (!campaign) {
    return reply.code(404).send({ error: 'Campaign join code not found' });
  }

  const campaignRef = db.collection('campaigns').doc(campaign.id);
  await db.runTransaction(async (transaction) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const currentDoc = await transaction.get(campaignRef as any) as { data(): Record<string, unknown> | undefined };
    const currentData = (currentDoc.data() || {}) as Record<string, unknown>;
    const currentMemberIds = Array.isArray(currentData['memberIds'])
      ? (currentData['memberIds'] as string[])
      : [];
    if (!currentMemberIds.includes(requestUser.uid)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      transaction.update(campaignRef as any, {
        memberIds: [...currentMemberIds, requestUser.uid],
        updatedAt: new Date().toISOString(),
      });
    }
  });

  const updatedCampaign = await getCampaignById(campaign.id);
  if (!updatedCampaign) {
    return reply.code(404).send({ error: 'Campaign not found after join' });
  }
  const [enrichedCampaign] = await enrichCampaignResponses([updatedCampaign], requestUser);
  return enrichedCampaign;
});

app.delete('/api/campaigns/:id', { preHandler: verifyAuthToken }, async (request, reply) => {
  const requestUser = request.user as AuthenticatedUser;
  if (requestUser.role !== 'admin') {
    return reply.code(403).send({ error: 'Only admins can delete campaigns' });
  }

  const params = request.params as Record<string, unknown>;
  const campaignId = String(params?.['id'] || '').trim();
  if (!campaignId) {
    return reply.code(400).send({ error: 'campaign id is required' });
  }

  const campaignRef = db.collection('campaigns').doc(campaignId);
  const campaignDoc = await campaignRef.get();
  if (!campaignDoc.exists) {
    return reply.code(404).send({ error: 'Campaign not found' });
  }

  const deletedNotes = await deleteNotesByCampaignId(campaignId);
  await deleteJournalDayLabelsByCampaignId(campaignId);
  await campaignRef.delete();

  return { success: true, campaignId, deletedNotes };
});

app.get('/api/journal-day-labels', { preHandler: verifyAuthToken }, async (request) => {
  const requestUser = request.user as AuthenticatedUser;
  const campaignsSnapshot = await db
    .collection('campaigns')
    .where('memberIds', 'array-contains', requestUser.uid)
    .get();
  const campaignIds = campaignsSnapshot.docs.map((doc) => doc.id);
  if (campaignIds.length === 0) {
    return [];
  }

  const labelSnapshots = await Promise.all(
    campaignIds.map((campaignId) => db.collection('journalDayLabels').where('campaignId', '==', campaignId).get())
  );

  return labelSnapshots
    .flatMap((snapshot) =>
      snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) } as Record<string, unknown>))
    )
    .sort((a, b) => String(a['entryDate']).localeCompare(String(b['entryDate'])));
});

app.put(
  '/api/journal-day-labels/:campaignId/:entryDate',
  { preHandler: verifyAuthToken },
  async (request, reply) => {
    const requestUser = request.user as AuthenticatedUser;
    if (requestUser.role !== 'admin') {
      return reply.code(403).send({ error: 'Only admins can name journal day groups' });
    }

    const params = request.params as Record<string, unknown>;
    const body = request.body as Record<string, unknown>;
    const campaignId = String(params?.['campaignId'] || '').trim();
    const entryDate = String(params?.['entryDate'] || '').trim();
    const title = String(body?.['title'] || '').trim();
    const normalizedEntryDate = /^\d{4}-\d{2}-\d{2}$/.test(entryDate) ? entryDate : '';

    if (!campaignId) {
      return reply.code(400).send({ error: 'campaignId is required' });
    }
    if (!normalizedEntryDate) {
      return reply.code(400).send({ error: 'entryDate must be in YYYY-MM-DD format' });
    }
    if (title.length > 120) {
      return reply.code(400).send({ error: 'title must be 120 characters or less' });
    }

    const campaign = await getCampaignById(campaignId);
    if (!campaign) {
      return reply.code(404).send({ error: 'Campaign not found' });
    }
    if (!ensureCampaignMember(campaign, requestUser.uid)) {
      return reply.code(403).send({ error: 'You are not a member of this campaign' });
    }

    const docId = `${campaignId}_${normalizedEntryDate}`;
    const labelRef = db.collection('journalDayLabels').doc(docId);

    if (!title) {
      await labelRef.delete();
      return { id: docId, campaignId, entryDate: normalizedEntryDate, title: '' };
    }

    const payload = {
      campaignId,
      entryDate: normalizedEntryDate,
      title,
      updatedAt: new Date().toISOString(),
      updatedBy: requestUser.uid,
    };
    await labelRef.set(payload, { merge: true });
    return { id: docId, ...payload };
  }
);

app.post('/api/notes', { preHandler: verifyAuthToken }, async (request, reply) => {
  const requestUser = request.user as AuthenticatedUser;
  const body = request.body as Record<string, unknown>;
  const { contentHtml, campaignId, visibility: requestedVisibility } = body || {};
  if (!contentHtml || typeof contentHtml !== 'string') {
    return reply.code(400).send({ error: 'contentHtml is required' });
  }
  if (!campaignId || typeof campaignId !== 'string') {
    return reply.code(400).send({ error: 'campaignId is required' });
  }

  const campaign = await getCampaignById(campaignId);
  if (!campaign) {
    return reply.code(404).send({ error: 'Campaign not found' });
  }

  if (!ensureCampaignMember(campaign, requestUser.uid)) {
    return reply.code(403).send({ error: 'You are not a member of this campaign' });
  }

  const userDoc = await db.collection('users').doc(requestUser.uid).get();
  const userData = (userDoc.exists ? userDoc.data() : {}) as Record<string, unknown>;

  const now = new Date();
  const visibilityDefault = requestUser.role === 'admin' ? 'private' : 'public';
  const visibility = String(requestedVisibility || visibilityDefault).toLowerCase();
  if (!['public', 'private'].includes(visibility)) {
    return reply.code(400).send({ error: 'visibility must be public or private' });
  }

  const note: Note = {
    userId: requestUser.uid,
    userEmail: requestUser.email,
    userRole: requestUser.role,
    username: String(userData['username'] || ''),
    characterName: String(userData['characterName'] || ''),
    dndBeyondUrl: String(userData['dndBeyondUrl'] || ''),
    profileImageUrl: String(userData['profileImageUrl'] || ''),
    campaignId: campaign.id,
    campaignName: campaign.name,
    visibility,
    contentHtml,
    entryDate: now.toISOString().split('T')[0],
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  const ref = await db.collection('notes').add(note as unknown as Record<string, unknown>);
  return { id: ref.id, ...note };
});

app.get('/api/notes', { preHandler: verifyAuthToken }, async (request) => {
  const requestUser = request.user as AuthenticatedUser;
  if (requestUser.role === 'admin') {
    const snapshot = await db.collection('notes').orderBy('createdAt', 'desc').get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }));
  }

  const campaignsSnapshot = await db
    .collection('campaigns')
    .where('memberIds', 'array-contains', requestUser.uid)
    .get();

  const campaignIds = campaignsSnapshot.docs.map((doc) => doc.id);
  if (campaignIds.length === 0) {
    return [];
  }

  const noteSnapshots = await Promise.all(
    campaignIds.map((campaignId) => db.collection('notes').where('campaignId', '==', campaignId).get())
  );

  return noteSnapshots
    .flatMap((snapshot) =>
      snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) } as Record<string, unknown>))
    )
    .filter((note) => {
      if (note['userId'] === requestUser.uid) {
        return true;
      }
      return resolveNoteVisibility(note) === 'public';
    })
    .sort((a, b) => String(b['createdAt']).localeCompare(String(a['createdAt'])));
});

const port = Number(process.env.PORT || 4000);
app.listen({ port, host: '0.0.0.0' }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
