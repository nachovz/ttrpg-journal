import Fastify from 'fastify';
import cors from '@fastify/cors';
import dotenv from 'dotenv';
import { auth, db } from './firebase.js';

dotenv.config();

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

function normalizeProfileInput(body = {}) {
  const username = String(body.username || '').trim();
  const characterName = String(body.characterName || '').trim();
  const dndBeyondUrl = String(body.dndBeyondUrl || '').trim();
  const profileImageUrl = String(body.profileImageUrl || '').trim();

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

function normalizeCampaignInput(body = {}) {
  const name = String(body.name || '').trim();
  if (!name) {
    throw new Error('campaign name is required');
  }
  if (name.length > 80) {
    throw new Error('campaign name must be 80 characters or less');
  }
  return { name };
}

function randomJoinCode() {
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

async function createUniqueJoinCode() {
  for (let i = 0; i < 10; i += 1) {
    const joinCode = randomJoinCode();
    const existing = await db.collection('campaigns').where('joinCode', '==', joinCode).limit(1).get();
    if (existing.empty) {
      return joinCode;
    }
  }
  throw new Error('Unable to generate unique join code');
}

async function getCampaignByJoinCode(joinCode) {
  const snapshot = await db
    .collection('campaigns')
    .where('joinCode', '==', joinCode)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  const campaignDoc = snapshot.docs[0];
  return { id: campaignDoc.id, ...campaignDoc.data() };
}

async function getCampaignById(campaignId) {
  const campaignDoc = await db.collection('campaigns').doc(campaignId).get();
  if (!campaignDoc.exists) {
    return null;
  }
  return { id: campaignDoc.id, ...campaignDoc.data() };
}

function ensureCampaignMember(campaign, uid) {
  const memberIds = Array.isArray(campaign.memberIds) ? campaign.memberIds : [];
  return memberIds.includes(uid);
}

function campaignToResponse(campaign) {
  return {
    id: campaign.id,
    name: campaign.name,
    joinCode: campaign.joinCode,
    joinLink: `${frontendOrigin}/?join=${encodeURIComponent(campaign.joinCode)}`,
    createdAt: campaign.createdAt,
    createdBy: campaign.createdBy,
    memberIds: campaign.memberIds || [],
  };
}

async function ensureRoleFromEmail(user) {
  const role = adminEmails.includes((user.email || '').toLowerCase()) ? 'admin' : 'user';
  if (user.customClaims?.role !== role) {
    await auth.setCustomUserClaims(user.uid, { ...(user.customClaims || {}), role });
  }
  return role;
}

async function verifyAuthToken(request, reply) {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return reply.code(401).send({ error: 'Missing Bearer token' });
  }

  const token = authHeader.slice('Bearer '.length);
  try {
    const decoded = await auth.verifyIdToken(token, true);
    const role = decoded.role || (adminEmails.includes((decoded.email || '').toLowerCase()) ? 'admin' : 'user');

    request.user = {
      uid: decoded.uid,
      email: decoded.email || '',
      role,
    };
  } catch {
    return reply.code(401).send({ error: 'Invalid token' });
  }
}

app.decorateRequest('user', null);

app.get('/api/me', { preHandler: verifyAuthToken }, async (request) => {
  const firebaseUser = await auth.getUser(request.user.uid);
  const role = await ensureRoleFromEmail(firebaseUser);
  const userRef = db.collection('users').doc(firebaseUser.uid);
  const userDoc = await userRef.get();
  const userData = userDoc.exists ? userDoc.data() : {};

  const me = {
    uid: firebaseUser.uid,
    email: firebaseUser.email || '',
    role,
    username: userData.username || '',
    characterName: userData.characterName || '',
    dndBeyondUrl: userData.dndBeyondUrl || '',
    profileImageUrl: userData.profileImageUrl || '',
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
  let profile;
  try {
    profile = normalizeProfileInput(request.body);
  } catch (error) {
    return reply.code(400).send({ error: error.message });
  }

  const updatedAt = new Date().toISOString();
  await db.collection('users').doc(request.user.uid).set(
    {
      ...profile,
      email: request.user.email,
      role: request.user.role,
      updatedAt,
    },
    { merge: true }
  );

  return { ...profile, updatedAt };
});

app.get('/api/campaigns', { preHandler: verifyAuthToken }, async (request) => {
  const snapshot = await db.collection('campaigns').where('memberIds', 'array-contains', request.user.uid).get();
  return snapshot.docs
    .map((doc) => campaignToResponse({ id: doc.id, ...doc.data() }))
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
});

app.post('/api/campaigns', { preHandler: verifyAuthToken }, async (request, reply) => {
  if (request.user.role !== 'admin') {
    return reply.code(403).send({ error: 'Only admins can create campaigns' });
  }

  let payload;
  try {
    payload = normalizeCampaignInput(request.body);
  } catch (error) {
    return reply.code(400).send({ error: error.message });
  }

  const joinCode = await createUniqueJoinCode();
  const now = new Date().toISOString();

  const campaign = {
    name: payload.name,
    joinCode,
    createdBy: request.user.uid,
    createdAt: now,
    memberIds: [request.user.uid],
  };

  const ref = await db.collection('campaigns').add(campaign);
  return campaignToResponse({ id: ref.id, ...campaign });
});

app.post('/api/campaigns/join', { preHandler: verifyAuthToken }, async (request, reply) => {
  const joinCode = String(request.body?.joinCode || '').trim().toUpperCase();
  if (!joinCode) {
    return reply.code(400).send({ error: 'joinCode is required' });
  }

  const campaign = await getCampaignByJoinCode(joinCode);
  if (!campaign) {
    return reply.code(404).send({ error: 'Campaign join code not found' });
  }

  const campaignRef = db.collection('campaigns').doc(campaign.id);
  await db.runTransaction(async (transaction) => {
    const currentDoc = await transaction.get(campaignRef);
    const currentData = currentDoc.data() || {};
    const currentMemberIds = Array.isArray(currentData.memberIds) ? currentData.memberIds : [];
    if (!currentMemberIds.includes(request.user.uid)) {
      transaction.update(campaignRef, {
        memberIds: [...currentMemberIds, request.user.uid],
      });
    }
  });

  const updatedCampaign = await getCampaignById(campaign.id);
  return campaignToResponse(updatedCampaign);
});

app.post('/api/notes', { preHandler: verifyAuthToken }, async (request, reply) => {
  const { contentHtml, campaignId } = request.body || {};
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

  if (!ensureCampaignMember(campaign, request.user.uid)) {
    return reply.code(403).send({ error: 'You are not a member of this campaign' });
  }

  const userDoc = await db.collection('users').doc(request.user.uid).get();
  const userData = userDoc.exists ? userDoc.data() : {};

  const now = new Date();
  const note = {
    userId: request.user.uid,
    userEmail: request.user.email,
    username: userData.username || '',
    characterName: userData.characterName || '',
    dndBeyondUrl: userData.dndBeyondUrl || '',
    profileImageUrl: userData.profileImageUrl || '',
    campaignId: campaign.id,
    campaignName: campaign.name,
    contentHtml,
    entryDate: now.toISOString().split('T')[0],
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  const ref = await db.collection('notes').add(note);
  return { id: ref.id, ...note };
});

app.put('/api/notes/:id', { preHandler: verifyAuthToken }, async (request, reply) => {
  if (request.user.role !== 'admin') {
    return reply.code(403).send({ error: 'Only admins can edit journal entries' });
  }

  const noteId = request.params.id;
  const contentHtml = String(request.body?.contentHtml || '').trim();
  if (!contentHtml) {
    return reply.code(400).send({ error: 'contentHtml is required' });
  }

  const noteRef = db.collection('notes').doc(noteId);
  const noteDoc = await noteRef.get();
  if (!noteDoc.exists) {
    return reply.code(404).send({ error: 'Note not found' });
  }

  const existing = noteDoc.data() || {};
  const update = {
    contentHtml,
    updatedAt: new Date().toISOString(),
  };

  await noteRef.set(update, { merge: true });
  return { id: noteId, ...existing, ...update };
});

app.get('/api/notes', { preHandler: verifyAuthToken }, async (request) => {
  if (request.user.role === 'admin') {
    const snapshot = await db.collection('notes').orderBy('createdAt', 'desc').get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  const campaignsSnapshot = await db
    .collection('campaigns')
    .where('memberIds', 'array-contains', request.user.uid)
    .get();

  const campaignIds = campaignsSnapshot.docs.map((doc) => doc.id);
  if (campaignIds.length === 0) {
    return [];
  }

  const noteSnapshots = await Promise.all(
    campaignIds.map((campaignId) => db.collection('notes').where('campaignId', '==', campaignId).get())
  );

  return noteSnapshots
    .flatMap((snapshot) => snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
});

const port = Number(process.env.PORT || 4000);
app.listen({ port, host: '0.0.0.0' }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
