const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldPath, FieldValue, Timestamp } = require('firebase-admin/firestore');
const { getDatabase } = require('firebase-admin/database');
const { getStorage } = require('firebase-admin/storage');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { beforeUserCreated } = require('firebase-functions/v2/identity');
const { setGlobalOptions } = require('firebase-functions/v2');

initializeApp();
setGlobalOptions({ region: 'us-central1', maxInstances: 10, enforceAppCheck: true });

const PROJECT_ID = process.env.GCLOUD_PROJECT || 'red-cover';
const DATABASE_ID = process.env.FIRESTORE_DATABASE_ID || 'ai-studio-redcover-ec164fd1-8554-4ddc-a224-0e1a0561d823';
const STORAGE_BUCKET = process.env.FIREBASE_STORAGE_BUCKET || 'red-cover.firebasestorage.app';
const OWNER_EMAIL = 'engeeo.io@gmail.com';
const auth = getAuth();
const db = getFirestore(undefined, DATABASE_ID);
const defaultDb = getFirestore();
const PERMISSIONS = {
  administrator: ['hq:overview', 'users:view', 'content:books', 'moderation:reports', 'health:read', 'audit:read', 'analytics:read', 'membership:read', 'support:read'],
  moderator: ['hq:overview', 'moderation:reports'],
  content_manager: ['hq:overview', 'content:books'],
  community_manager: ['hq:overview', 'community:manage', 'moderation:reports'],
  support_staff: ['hq:overview', 'support:read'],
};
const MAX_EVENT_MESSAGE = 400;
// Long enough for PDF.js range requests while remaining short-lived.
const SIGNED_READ_TTL_MS = 15 * 60 * 1000;

function fail(code, message) {
  throw new HttpsError(code, message);
}

async function principal(request, requiredPermission) {
  if (!request.auth?.uid) fail('unauthenticated', 'Sign in with the authorized Google account first.');
  const user = await auth.getUser(request.auth.uid);
  if (user.disabled) fail('permission-denied', 'This account is disabled.');
  const claims = user.customClaims || {};
  const role = claims.hqRole || null;
  const permissions = Array.isArray(claims.hqPermissions) ? claims.hqPermissions : [];
  const isOwner = role === 'owner';
  if (!isOwner && (!requiredPermission || !permissions.includes(requiredPermission))) {
    await db.collection('hqSecurityEvents').add({
      uid: user.uid, attemptedPermission: safeText(requiredPermission, 60), role: role || 'none',
      createdAt: FieldValue.serverTimestamp(), outcome: 'denied',
    }).catch(() => {});
    fail('permission-denied', 'Your Headquarters role does not allow this action.');
  }
  return { uid: user.uid, email: user.email || '', displayName: user.displayName || '', role: role || 'staff', permissions, isOwner };
}

function safeText(value, max = MAX_EVENT_MESSAGE) {
  return String(value || '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/https?:\/\/\S+/gi, '[url]')
    .replace(/(token|authorization|password|secret|api[_-]?key)[=: ]+\S+/gi, '$1=[redacted]')
    .trim().slice(0, max);
}

function safeId(value) {
  return safeText(value, 128).replace(/[^a-zA-Z0-9_\-]/g, '');
}

function storageObjectPathFromRecord(value, allowedFolders) {
  if (typeof value !== 'string' || !value.trim() || value.length > 6000) return '';
  const bucket = getStorage().bucket(STORAGE_BUCKET);
  let path = '';
  if (value.startsWith('gs://')) {
    const match = value.match(/^gs:\/\/([^/]+)\/(.+)$/);
    if (!match || match[1] !== bucket.name) return '';
    path = match[2];
  } else if (/^https?:\/\//i.test(value)) {
    let url;
    try { url = new URL(value); } catch { return ''; }
    if (url.hostname === 'firebasestorage.googleapis.com') {
      const match = url.pathname.match(/^\/v0\/b\/([^/]+)\/o\/(.+)$/);
      if (!match || match[1] !== bucket.name) return '';
      try { path = decodeURIComponent(match[2]); } catch { return ''; }
    } else if (url.hostname === 'storage.googleapis.com') {
      const match = url.pathname.match(/^\/([^/]+)\/(.+)$/);
      if (!match || match[1] !== bucket.name) return '';
      try { path = decodeURIComponent(match[2]); } catch { return ''; }
    } else {
      return '';
    }
  } else {
    path = value.replace(/^\/+/, '').split(/[?#]/, 1)[0];
  }
  if (!path || path.includes('..') || path.includes('\\') || path.includes('//')) return '';
  const folder = path.split('/')[0];
  return allowedFolders.includes(folder) ? path : '';
}

async function createShortLivedReadUrl(objectPath) {
  const bucket = getStorage().bucket(STORAGE_BUCKET);
  const file = bucket.file(objectPath);
  const [exists] = await file.exists();
  if (!exists) fail('not-found', 'The stored file is unavailable.');
  const [metadata] = await file.getMetadata();
  const expiresAtMs = Date.now() + SIGNED_READ_TTL_MS;
  const [url] = await file.getSignedUrl({
    version: 'v4', action: 'read', expires: expiresAtMs,
    responseDisposition: metadata.contentType === 'application/pdf' ? 'inline' : undefined,
  });
  return { url, expiresAt: new Date(expiresAtMs).toISOString() };
}

function redactStorageTokens(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const safe = { ...value };
  for (const key of ['fileURL', 'pdfURL', 'downloadURL', 'coverURL', 'photoURL']) {
    if (typeof safe[key] === 'string' && /[?&]token=/i.test(safe[key])) safe[key] = '[private storage reference]';
  }
  return safe;
}

function safeBrandAssetUrl(value) {
  if (typeof value !== 'string' || value.length > 3000) return '';
  try {
    const url = new URL(value);
    const match = url.pathname.match(/^\/v0\/b\/([^/]+)\/o\/(.+)$/);
    if (url.protocol !== 'https:' || url.hostname !== 'firebasestorage.googleapis.com'
      || !match || match[1] !== STORAGE_BUCKET || !url.searchParams.has('token')) return '';
    const path = decodeURIComponent(match[2]);
    if (!path.startsWith('headquarters/branding/')) return '';
    return url.toString();
  } catch {
    return '';
  }
}

exports.getBookPdfAccess = onCall({ region: 'us-central1' }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) fail('unauthenticated', 'Sign in to read this book.');
  if (request.auth.token.email_verified !== true) fail('permission-denied', 'Verify your account before reading.');
  const user = await auth.getUser(uid);
  if (user.disabled) fail('permission-denied', 'This account is disabled.');
  const bookId = safeId(request.data?.bookId);
  if (!bookId) fail('invalid-argument', 'A valid book ID is required.');
  let bookSnap;
  for (const [database, collectionName] of [
    [db, 'books'], [defaultDb, 'books'], [defaultDb, 'Books'],
    [defaultDb, 'stories'], [defaultDb, 'Stories'], [defaultDb, 'pdf_books'], [defaultDb, 'ebooks'],
  ]) {
    bookSnap = await database.collection(collectionName).doc(bookId).get();
    if (bookSnap.exists) break;
  }
  if (!bookSnap.exists) fail('not-found', 'Book not found.');
  const book = bookSnap.data();
  const ownerId = book.authorId || book.userId || book.uploaderId || book.writerId;
  const owner = ownerId === uid;
  const claims = user.customClaims || {};
  const permissions = Array.isArray(claims.hqPermissions) ? claims.hqPermissions : [];
  const admin = claims.hqRole === 'owner' || permissions.includes('*') || permissions.includes('content:books');
  const accountControl = await db.collection('hqAccountControls').doc(uid).get();
  if (accountControl.get('suspended') === true) fail('permission-denied', 'This account is suspended.');
  // Legacy Firestore rules treat status-less catalog records as published.
  const isPublished = !Object.prototype.hasOwnProperty.call(book, 'status') || book.status === 'published';
  if (!isPublished && !owner && !admin) fail('permission-denied', 'This book is not published.');
  if (book.status === 'removed' && !admin) fail('permission-denied', 'This book is unavailable.');
  const objectPath = storageObjectPathFromRecord(book.fileURL, ['book_pdfs', 'book_content', 'pdfs', 'books', 'users']);
  if (!objectPath) fail('failed-precondition', 'This book does not reference a supported Redcover PDF object.');
  return createShortLivedReadUrl(objectPath);
});

exports.getChatAttachmentAccess = onCall({ region: 'us-central1' }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) fail('unauthenticated', 'Sign in to view this attachment.');
  const conversationId = safeId(request.data?.conversationId);
  const messageId = safeId(request.data?.messageId);
  const type = request.data?.conversationType === 'group' ? 'group' : 'direct';
  if (!conversationId || !messageId) fail('invalid-argument', 'A valid conversation and message are required.');
  let messageRef;
  if (type === 'group') {
    const group = await db.collection('groups').doc(conversationId).get();
    if (!group.exists || !Array.isArray(group.get('members')) || !group.get('members').includes(uid)) fail('permission-denied', 'Only current group members can access attachments.');
    messageRef = db.collection('groups').doc(conversationId).collection('messages').doc(messageId);
  } else {
    const chat = await db.collection('chats').doc(conversationId).get();
    if (!chat.exists || ![chat.get('participantA'), chat.get('participantB')].includes(uid)) fail('permission-denied', 'Only conversation participants can access attachments.');
    messageRef = db.collection('chats').doc(conversationId).collection('messages').doc(messageId);
  }
  const message = await messageRef.get();
  if (!message.exists) fail('not-found', 'Message not found.');
  const senderId = message.get('senderId');
  const match = String(message.get('text') || '').match(/^\[attachment:(?:image|file|voice):([^\]]+)\]/s);
  if (!match) fail('failed-precondition', 'This message has no supported file attachment.');
  const parts = match[1].split('|');
  const source = /^\[attachment:voice:/.test(String(message.get('text') || '')) ? parts[0] : (parts[1] || parts[0]);
  const objectPath = storageObjectPathFromRecord(source, ['chat_attachments', 'chat_media', 'chat_voice', 'chat_files', 'users']);
  if (!objectPath) fail('failed-precondition', 'This message does not reference a supported Redcover attachment.');
  // Legacy locations are accepted only when their path encodes the sender UID.
  // This prevents a participant from using a message as a proxy for another user's file.
  const pathParts = objectPath.split('/');
  const folder = pathParts[0];
  const ownerSegment = pathParts[1] || '';
  const ownerMatches = folder === 'users'
    ? ownerSegment === senderId
    : ownerSegment.startsWith(`${senderId}_`) || ownerSegment === senderId;
  if (!ownerMatches) {
    fail('permission-denied', 'The attachment owner does not match its sender.');
  }
  return createShortLivedReadUrl(objectPath);
});

async function writeAudit(actor, action, targetType, targetId, previousValue, newValue, result = 'success') {
  await db.collection('hqAuditLogs').add({
    actorUid: actor.uid,
    actorRole: actor.role,
    action: safeText(action, 80),
    targetType: safeText(targetType, 40),
    targetId: safeId(targetId),
    previousValue: previousValue ?? null,
    newValue: newValue ?? null,
    result,
    createdAt: FieldValue.serverTimestamp(),
  });
}

async function count(query) {
  const snap = await query.count().get();
  return snap.data().count;
}

function serviceHealth(status, details, checkedAt = new Date().toISOString()) {
  return { status, details, checkedAt };
}

exports.hqGetOverview = onCall({ region: 'us-central1' }, async (request) => {
  const actor = await principal(request, 'hq:overview');
  const now = Timestamp.now();
  const rangeDays = Math.min(90, Math.max(1, Number(request.data?.rangeDays) || 7));
  const requestedStart = safeText(request.data?.startDate, 10);
  const requestedEnd = safeText(request.data?.endDate, 10);
  const parsedStart = /^\d{4}-\d{2}-\d{2}$/.test(requestedStart) ? Date.parse(`${requestedStart}T00:00:00.000Z`) : NaN;
  const parsedEnd = /^\d{4}-\d{2}-\d{2}$/.test(requestedEnd) ? Date.parse(`${requestedEnd}T23:59:59.999Z`) : NaN;
  const from = Number.isFinite(parsedStart) && Number.isFinite(parsedEnd) && parsedStart <= parsedEnd
    ? Timestamp.fromMillis(parsedStart)
    : Timestamp.fromMillis(now.toMillis() - rangeDays * 86400000);
  const to = Number.isFinite(parsedStart) && Number.isFinite(parsedEnd) && parsedStart <= parsedEnd ? Timestamp.fromMillis(parsedEnd) : now;
  const collections = {
    users: db.collection('users'), books: db.collection('books'), posts: db.collection('posts'),
    comments: db.collection('postComments'), likes: db.collection('postLikes'), follows: db.collection('follows'),
    sessions: db.collection('readingSessions'), reports: db.collection('reports'), events: db.collection('hqEvents'),
  };
  const checked = {};
  const metric = async (key, query) => {
    try { const value = await count(query); checked[key] = serviceHealth('healthy', 'Live count query succeeded.'); return { available: true, value }; }
    catch (error) { checked[key] = serviceHealth('unknown', safeText(error.code || error.message)); return { available: false, value: null }; }
  };
  const [registered, books, published, drafts, posts, comments, likes, follows, sessions, reports, openReports, premium, newUsersPeriod] = await Promise.all([
    metric('firestore', collections.users), metric('firestoreBooks', collections.books), metric('firestorePublished', collections.books.where('status', '==', 'published')),
    metric('firestoreDrafts', collections.books.where('status', '==', 'draft')), metric('firestorePosts', collections.posts), metric('firestoreComments', collections.comments),
    metric('firestoreLikes', collections.likes), metric('firestoreFollows', collections.follows), metric('firestoreSessions', collections.sessions),
    metric('firestoreReports', collections.reports), metric('firestoreOpenReports', collections.reports.where('status', 'in', ['open', 'investigating'])),
    metric('firestoreMemberships', collections.users.where('membershipPlan', '==', 'premium')),
    metric('firestoreNewUsersPeriod', collections.users.where('createdAt', '>=', from).where('createdAt', '<=', to)),
  ]);

  let authHealth = serviceHealth('unknown', 'Not checked.');
  let storageHealth = serviceHealth('unknown', 'Not checked.');
  let rtdbHealth = serviceHealth('unknown', 'Not checked.');
  try { await auth.getUser(actor.uid); authHealth = serviceHealth('healthy', 'Authorized identity lookup succeeded.'); }
  catch (error) { authHealth = serviceHealth('critical', safeText(error.code || error.message)); }
  try { await getStorage().bucket(STORAGE_BUCKET).getMetadata(); storageHealth = serviceHealth('healthy', 'Bucket metadata request succeeded.'); }
  catch (error) { storageHealth = serviceHealth('warning', safeText(error.code || error.message)); }
  try { await getDatabase().ref('/status').limitToFirst(1).once('value'); rtdbHealth = serviceHealth('healthy', 'Realtime Database read probe succeeded.'); }
  catch (error) { rtdbHealth = serviceHealth('warning', safeText(error.code || error.message)); }
  checked.auth = authHealth;
  checked.storage = storageHealth;
  checked.realtimeDatabase = rtdbHealth;
  checked.functions = serviceHealth('healthy', 'This authenticated health-check function responded.');
  checked.appCheck = serviceHealth('healthy', 'This callable request passed App Check verification. Firestore, Storage and Realtime Database enforcement still depends on Firebase Console settings.');
  const scheduled = await db.collection('hqHealthChecks').doc('current').get().catch(() => null);
  checked.scheduledChecks = scheduled?.exists
    ? serviceHealth('healthy', `Last scheduled probes completed at ${scheduled.get('checkedAt')?.toDate?.().toISOString() || 'unknown time'}.`)
    : serviceHealth('unknown', 'Scheduled health checks have not run yet. Requires the Cloud Scheduler API.');

  const failures24h = await count(collections.events.where('severity', 'in', ['warning', 'critical']).where('createdAt', '>=', Timestamp.fromMillis(now.toMillis() - 86400000))).catch(() => null);
  return {
    generatedAt: new Date().toISOString(),
    metrics: {
      userProfiles: registered, books, publishedBooks: published, drafts, posts, comments, likes, followers: follows,
      readingSessions: sessions, reports, pendingModeration: openReports, premiumMemberships: premium,
      newUsersPeriod: newUsersPeriod,
      activeUsers: { available: false, value: null }, storageBytes: { available: false, value: null },
      billingEstimate: { available: false, value: null }, failedOperations24h: { available: failures24h !== null, value: failures24h },
    },
    services: checked,
    integrations: { cloudFunctions: serviceHealth('unknown', 'No separate scheduled or worker services are configured.'), cloudflare: serviceHealth('unknown', 'Cloudflare API credentials are not configured.') },
    ownerEmail: actor.isOwner ? OWNER_EMAIL : undefined,
    projectId: PROJECT_ID,
  };
});

exports.hqListUsers = onCall({ region: 'us-central1' }, async (request) => {
  await principal(request, 'users:view');
  const search = safeText(request.data?.search, 100).toLowerCase();
  const statusFilter = ['active', 'suspended'].includes(request.data?.status) ? request.data.status : '';
  const roleFilter = safeText(request.data?.role, 40);
  const membershipFilter = ['free', 'premium'].includes(request.data?.membershipPlan) ? request.data.membershipPlan : '';
  const createdFromText = safeText(request.data?.createdFrom, 30);
  const createdToText = safeText(request.data?.createdTo, 30);
  const createdFrom = /^\d{4}-\d{2}-\d{2}$/.test(createdFromText) ? Date.parse(`${createdFromText}T00:00:00.000Z`) : 0;
  const createdTo = /^\d{4}-\d{2}-\d{2}$/.test(createdToText) ? Date.parse(`${createdToText}T23:59:59.999Z`) : Infinity;
  const pageToken = safeText(request.data?.pageToken, 2048) || undefined;
  const pageSize = Math.min(50, Math.max(1, Number(request.data?.pageSize) || 25));
  let authUsers = [];
  let nextPageToken;
  if (search) {
    try {
      if (search.includes('@')) authUsers = [await auth.getUserByEmail(search)];
      else if (/^[a-zA-Z0-9_-]{10,128}$/.test(search)) authUsers = [await auth.getUser(search)];
      else {
        const profiles = await Promise.all([
          db.collection('users').orderBy('username').startAt(search).endAt(`${search}\uf8ff`).limit(pageSize).get(),
          db.collection('users').orderBy('displayName').startAt(search).endAt(`${search}\uf8ff`).limit(pageSize).get(),
        ]);
        const ids = [...new Set(profiles.flatMap((snap) => snap.docs.map((d) => d.id)))];
        authUsers = await Promise.all(ids.map((uid) => auth.getUser(uid).catch(() => null)));
        authUsers = authUsers.filter(Boolean);
      }
    } catch (error) {
      if (error.code !== 'auth/user-not-found') throw new HttpsError('internal', 'User search failed.');
    }
  } else {
    const page = await auth.listUsers(pageSize, pageToken);
    authUsers = page.users;
    nextPageToken = page.pageToken;
  }
  const refs = authUsers.map((u) => db.collection('users').doc(u.uid));
  const profiles = refs.length ? await db.getAll(...refs) : [];
  const matchedUsers = authUsers.map((user, i) => {
      const profile = profiles[i]?.exists ? profiles[i].data() : {};
      return {
        uid: user.uid, email: user.email || '', displayName: profile.displayName || user.displayName || 'Redcover Reader',
        username: profile.username || '', photoURL: redactStorageTokens({ photoURL: profile.photoURL || user.photoURL || '' }).photoURL,
        createdAt: user.metadata.creationTime || '', lastSignInAt: user.metadata.lastSignInTime || '',
        disabled: Boolean(user.disabled), membershipPlan: profile.membershipPlan || 'free',
        hqRole: user.customClaims?.hqRole || null, booksCount: Number(profile.booksCount || 0),
      };
    }).filter((user) => (!statusFilter || (statusFilter === 'suspended') === user.disabled)
      && (!roleFilter || (roleFilter === 'staff' ? Boolean(user.hqRole) : user.hqRole === roleFilter))
      && (!membershipFilter || user.membershipPlan === membershipFilter)
      && (!createdFrom || Date.parse(user.createdAt) >= createdFrom)
      && (!Number.isFinite(createdTo) || Date.parse(user.createdAt) <= createdTo));
  return { users: matchedUsers, nextPageToken: nextPageToken || null };
});

exports.hqGetUserDetails = onCall({ region: 'us-central1' }, async (request) => {
  await principal(request, 'users:view');
  const uid = safeId(request.data?.uid);
  if (!uid) fail('invalid-argument', 'Choose a valid user.');
  const user = await auth.getUser(uid);
  const [profileSnap, booksSnap, postsSnap, reportedBy, targets, audit] = await Promise.all([
    db.collection('users').doc(uid).get(),
    db.collection('books').where('authorId', '==', uid).orderBy('createdAt', 'desc').limit(20).get().catch(() => null),
    db.collection('posts').where('authorId', '==', uid).orderBy('createdAt', 'desc').limit(20).get().catch(() => null),
    db.collection('reports').where('reporterId', '==', uid).orderBy('createdAt', 'desc').limit(20).get().catch(() => null),
    db.collection('reports').where('targetType', '==', 'user').where('targetId', '==', uid).orderBy('createdAt', 'desc').limit(20).get().catch(() => null),
    db.collection('hqAuditLogs').where('targetId', '==', uid).orderBy('createdAt', 'desc').limit(20).get().catch(() => null),
  ]);
  const profile = profileSnap.exists ? profileSnap.data() : {};
  const asIso = (doc) => doc.get('createdAt')?.toDate?.().toISOString() || '';
  return {
    user: { uid, email: user.email || '', displayName: profile.displayName || user.displayName || '', username: profile.username || '', photoURL: redactStorageTokens({ photoURL: profile.photoURL || user.photoURL || '' }).photoURL, createdAt: user.metadata.creationTime || '', lastSignInAt: user.metadata.lastSignInTime || '', disabled: Boolean(user.disabled), membershipPlan: profile.membershipPlan || 'free', hqRole: user.customClaims?.hqRole || null, restrictions: (await db.collection('hqAccountControls').doc(uid).get()).get('restrictions') || [] },
    books: (booksSnap?.docs || []).map((doc) => ({ id: doc.id, title: safeText(doc.get('title'), 200), status: safeText(doc.get('status'), 30), createdAt: asIso(doc) })),
    posts: (postsSnap?.docs || []).map((doc) => ({ id: doc.id, text: safeText(doc.get('text'), 300), visibility: safeText(doc.get('visibility'), 30), createdAt: asIso(doc) })),
    reports: [...(reportedBy?.docs || []), ...(targets?.docs || [])].slice(0, 20).map((doc) => ({ id: doc.id, targetTitle: safeText(doc.get('targetTitle'), 200), reason: safeText(doc.get('reason'), 120), status: safeText(doc.get('status'), 30), createdAt: asIso(doc) })),
    activity: (audit?.docs || []).map((doc) => ({ id: doc.id, action: safeText(doc.get('action'), 100), result: safeText(doc.get('result'), 30), createdAt: asIso(doc) })),
  };
});

exports.hqListStaff = onCall({ region: 'us-central1' }, async (request) => {
  await principal(request, 'staff:manage');
  const snap = await db.collection('hqStaff').orderBy('updatedAt', 'desc').limit(100).get();
  return { staff: snap.docs.map((doc) => redactStorageTokens(doc.data())) };
});

exports.hqSetStaffRole = onCall({ region: 'us-central1' }, async (request) => {
  const actor = await principal(request, 'staff:manage');
  const uid = safeId(request.data?.uid);
  const role = request.data?.role === null ? null : safeText(request.data?.role, 40);
  if (!uid) fail('invalid-argument', 'Choose a valid user.');
  const target = await auth.getUser(uid);
  if (target.customClaims?.hqRole === 'owner' || target.email?.toLowerCase() === OWNER_EMAIL) fail('failed-precondition', 'The owner role cannot be changed from Staff Management.');
  if (role && !Object.hasOwn(PERMISSIONS, role)) fail('invalid-argument', 'Choose a supported staff role.');
  const claims = { ...(target.customClaims || {}) };
  if (role) { claims.hqRole = role; claims.hqPermissions = PERMISSIONS[role]; }
  else { delete claims.hqRole; delete claims.hqPermissions; }
  await auth.setCustomUserClaims(uid, claims);
  const ref = db.collection('hqStaff').doc(uid);
  if (!role) {
    await ref.delete();
    await db.collection('hqStaffProfiles').doc(uid).delete();
  } else {
    const staffRecord = {
      uid, email: target.email || '', displayName: target.displayName || 'Redcover Staff', role,
      permissions: PERMISSIONS[role], photoURL: target.photoURL || '', active: true,
      updatedAt: FieldValue.serverTimestamp(), createdBy: actor.uid,
    };
    const existing = await ref.get();
    if (!existing.exists) staffRecord.createdAt = FieldValue.serverTimestamp();
    await ref.set(staffRecord, { merge: true });
    await db.collection('hqStaffProfiles').doc(uid).set({ uid, displayName: staffRecord.displayName, role, photoURL: staffRecord.photoURL, verifiedStaff: true, updatedAt: FieldValue.serverTimestamp() });
  }
  await writeAudit(actor, role ? 'staff.role_changed' : 'staff.access_revoked', 'staff', uid, target.customClaims?.hqRole || null, role);
  return { ok: true, uid, role, permissions: role ? PERMISSIONS[role] : [] };
});

exports.hqSetAccountStatus = onCall({ region: 'us-central1' }, async (request) => {
  const actor = await principal(request, 'users:manage');
  const uid = safeId(request.data?.uid);
  const suspended = request.data?.suspended === true;
  if (!uid || uid === actor.uid) fail('invalid-argument', 'Choose another valid account.');
  const target = await auth.getUser(uid);
  if (target.customClaims?.hqRole === 'owner' || target.email?.toLowerCase() === OWNER_EMAIL) fail('failed-precondition', 'Owner account cannot be suspended here.');
  await auth.updateUser(uid, { disabled: suspended });
  await auth.revokeRefreshTokens(uid);
  await db.collection('hqAccountControls').doc(uid).set({ suspended, updatedAt: FieldValue.serverTimestamp(), updatedBy: actor.uid });
  await writeAudit(actor, suspended ? 'user.suspended' : 'user.restored', 'user', uid, { disabled: Boolean(target.disabled) }, { disabled: suspended });
  return { ok: true, uid, suspended };
});

exports.hqSetUserRestrictions = onCall({ region: 'us-central1' }, async (request) => {
  const actor = await principal(request, 'users:manage');
  const uid = safeId(request.data?.uid);
  const restrictions = request.data?.restrictions;
  if (!actor.isOwner) fail('permission-denied', 'Only the owner can change account restrictions.');
  if (!uid || !Array.isArray(restrictions) || restrictions.some((item) => !['publish', 'community', 'chat'].includes(item))) fail('invalid-argument', 'Choose valid account restrictions.');
  const target = await auth.getUser(uid);
  if (target.customClaims?.hqRole === 'owner' || target.email?.toLowerCase() === OWNER_EMAIL) fail('failed-precondition', 'Owner account restrictions cannot be changed here.');
  const ref = db.collection('hqAccountControls').doc(uid);
  const before = await ref.get();
  await ref.set({ restrictions: [...new Set(restrictions)], updatedBy: actor.uid, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  await writeAudit(actor, 'user.restrictions_changed', 'user', uid, before.get('restrictions') || [], [...new Set(restrictions)]);
  return { ok: true, restrictions: [...new Set(restrictions)] };
});

exports.hqPrepareUserDeletion = onCall({ region: 'us-central1' }, async (request) => {
  const actor = await principal(request, 'users:manage');
  if (!actor.isOwner) fail('permission-denied', 'Only the owner can prepare account deletion.');
  const uid = safeId(request.data?.uid);
  if (!uid || uid === actor.uid) fail('invalid-argument', 'Choose another valid account.');
  const target = await auth.getUser(uid);
  if (target.customClaims?.hqRole === 'owner' || target.email?.toLowerCase() === OWNER_EMAIL) fail('failed-precondition', 'The owner account cannot be deleted here.');
  const [books, posts] = await Promise.all([count(db.collection('books').where('authorId', '==', uid)), count(db.collection('posts').where('authorId', '==', uid))]);
  const token = require('crypto').randomBytes(32).toString('hex');
  await db.collection('hqDeletionRequests').doc(uid).set({ tokenHash: require('crypto').createHash('sha256').update(token).digest('hex'), actorUid: actor.uid, expiresAt: Date.now() + 300000, consumed: false, createdAt: FieldValue.serverTimestamp() });
  return { token, preview: { books, posts, email: target.email || '' }, expiresInSeconds: 300 };
});

exports.hqDeleteUserAccount = onCall({ region: 'us-central1' }, async (request) => {
  const actor = await principal(request, 'users:manage');
  if (!actor.isOwner) fail('permission-denied', 'Only the owner can delete an account.');
  const uid = safeId(request.data?.uid);
  const token = safeText(request.data?.token, 100);
  if (!uid || !token || uid === actor.uid) fail('invalid-argument', 'Deletion confirmation is invalid.');
  const requestRef = db.collection('hqDeletionRequests').doc(uid);
  const tokenHash = require('crypto').createHash('sha256').update(token).digest('hex');
  const deletionPhase = await db.runTransaction(async (tx) => {
    const snap = await tx.get(requestRef);
    if (!snap.exists || snap.get('expiresAt') < Date.now() || snap.get('tokenHash') !== tokenHash || snap.get('actorUid') !== actor.uid) fail('failed-precondition', 'Deletion confirmation expired. Prepare it again.');
    if (snap.get('phase') === 'complete') return 'complete';
    if (snap.get('consumed') !== true) tx.update(requestRef, { consumed: true, phase: 'in_progress', consumedAt: FieldValue.serverTimestamp() });
    return 'in_progress';
  });
  if (deletionPhase === 'complete') return { ok: true, authoredContentPreserved: true };
  const target = await auth.getUser(uid).catch((error) => error.code === 'auth/user-not-found' ? null : Promise.reject(error));
  if (target && (target.customClaims?.hqRole === 'owner' || target.email?.toLowerCase() === OWNER_EMAIL)) fail('failed-precondition', 'The owner account cannot be deleted here.');
  if (target) await auth.deleteUser(uid);
  await db.collection('users').doc(uid).collection('private').doc('info').delete().catch(() => {});
  await db.collection('users').doc(uid).delete();
  await db.collection('hqStaff').doc(uid).delete().catch(() => {});
  await db.collection('hqStaffProfiles').doc(uid).delete().catch(() => {});
  // Keep a suspended tombstone so an already-issued client token cannot recreate or mutate the profile.
  await db.collection('hqAccountControls').doc(uid).set({ suspended: true, deleted: true, restrictions: [], updatedBy: actor.uid, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  await requestRef.set({ phase: 'complete', completedAt: FieldValue.serverTimestamp() }, { merge: true });
  await writeAudit(actor, 'user.account_deleted_content_preserved', 'user', uid, { email: target?.email || '' }, { authAccount: 'deleted', profile: 'deleted', authoredContent: 'preserved' });
  return { ok: true, authoredContentPreserved: true };
});

exports.hqListReports = onCall({ region: 'us-central1' }, async (request) => {
  await principal(request, 'moderation:reports');
  const status = ['open', 'resolved', 'dismissed'].includes(request.data?.status) ? request.data.status : 'open';
  let query = db.collection('reports').where('status', '==', status);
  if (status === 'open') query = db.collection('reports').where('status', 'in', ['open', 'investigating']);
  const snap = await query.orderBy('createdAt', 'desc').limit(100).get();
  return { reports: snap.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: d.get('createdAt')?.toDate?.().toISOString() || '' })) };
});

exports.hqListBooks = onCall({ region: 'us-central1' }, async (request) => {
  await principal(request, 'content:books');
  const status = safeText(request.data?.status, 20);
  const search = safeText(request.data?.search, 120).toLowerCase();
  const pageToken = safeText(request.data?.pageToken, 128);
  const pageSize = Math.min(50, Math.max(1, Number(request.data?.pageSize) || 25));
  if (search && /^[a-zA-Z0-9_\-]{4,128}$/.test(search)) {
    const exact = await db.collection('books').doc(search).get();
    if (exact.exists && (!['draft', 'published', 'pending', 'removed'].includes(status) || exact.get('status') === status)) {
      return { books: [{ id: exact.id, ...redactStorageTokens(exact.data()), createdAt: exact.get('createdAt')?.toDate?.().toISOString() || '' }], nextPageToken: null };
    }
  }
  if (search) {
    const [byTitle, byAuthor] = await Promise.all([
      db.collection('books').orderBy('title').startAt(search).endAt(`${search}\uf8ff`).limit(pageSize).get(),
      db.collection('books').orderBy('authorName').startAt(search).endAt(`${search}\uf8ff`).limit(pageSize).get(),
    ]);
    const merged = new Map();
    [...byTitle.docs, ...byAuthor.docs].forEach((d) => {
      if (!status || !['draft', 'published', 'pending', 'removed'].includes(status) || d.get('status') === status) merged.set(d.id, d);
    });
    const docs = Array.from(merged.values()).slice(0, pageSize);
    return { books: docs.map((d) => ({ id: d.id, ...redactStorageTokens(d.data()), createdAt: d.get('createdAt')?.toDate?.().toISOString() || '' })), nextPageToken: null };
  }
  let query = db.collection('books').orderBy('createdAt', 'desc');
  if (['draft', 'published', 'pending', 'removed'].includes(status)) query = db.collection('books').where('status', '==', status).orderBy('createdAt', 'desc');
  if (pageToken) {
    const cursor = await db.collection('books').doc(pageToken).get();
    if (cursor.exists) query = query.startAfter(cursor);
  }
  const snap = await query.limit(pageSize).get();
  return { books: snap.docs.map((d) => ({ id: d.id, ...redactStorageTokens(d.data()), createdAt: d.get('createdAt')?.toDate?.().toISOString() || '' })), nextPageToken: snap.size === pageSize ? snap.docs[snap.size - 1].id : null };
});

exports.hqUpdateBookStatus = onCall({ region: 'us-central1' }, async (request) => {
  const actor = await principal(request, 'content:books');
  const id = safeId(request.data?.id);
  const status = ['draft', 'published', 'pending', 'removed'].includes(request.data?.status) ? request.data.status : null;
  if (!id || !status) fail('invalid-argument', 'Choose a book and a valid status.');
  const ref = db.collection('books').doc(id);
  const snap = await ref.get();
  if (!snap.exists) fail('not-found', 'Book not found.');
  const book = snap.data();
  if (status === 'published' && !actor.isOwner) {
    const platform = await db.collection('hqConfig').doc('platform').get();
    if (platform.get('allowBookPublishing') === false) fail('failed-precondition', 'Book publishing is paused by the owner.');
  }
  if (status === 'published') {
    if (!String(book.title || '').trim() || !String(book.description || '').trim()) fail('failed-precondition', 'A title and synopsis are required before publishing.');
    const modes = Array.isArray(book.availableModes) ? book.availableModes : [];
    if (modes.includes('pdf') && !String(book.fileURL || '').trim()) fail('failed-precondition', 'This book is set to PDF mode but has no PDF file.');
  }
  await ref.update({ status, updatedAt: FieldValue.serverTimestamp() });
  await writeAudit(actor, 'content.book_status_changed', 'book', id, { status: book.status }, { status });
  return { ok: true, id, status };
});

exports.hqListModerationContent = onCall({ region: 'us-central1' }, async (request) => {
  await principal(request, 'content:books');
  const kind = ['posts', 'reviews', 'comments'].includes(request.data?.kind) ? request.data.kind : null;
  if (!kind) fail('invalid-argument', 'Choose a supported content type.');
  const collection = kind === 'posts' ? 'posts' : kind === 'reviews' ? 'reviews' : 'postComments';
  const snap = await db.collection(collection).orderBy('createdAt', 'desc').limit(100).get();
  const items = snap.docs.map((doc) => ({
    id: doc.id, kind,
    ownerId: safeId(doc.get(kind === 'posts' ? 'authorId' : 'userId')),
    authorName: safeText(doc.get(kind === 'posts' ? 'authorName' : 'userName'), 100),
    title: safeText(doc.get(kind === 'reviews' ? 'bookTitle' : ''), 200),
    text: safeText(doc.get('text'), 600),
    status: kind === 'comments' ? (doc.get('moderationHidden') === true ? 'hidden' : 'visible') : safeText(doc.get('visibility') || 'public', 30),
    createdAt: doc.get('createdAt')?.toDate?.().toISOString() || '',
  }));
  return { items };
});

exports.hqSetModerationContentStatus = onCall({ region: 'us-central1' }, async (request) => {
  const actor = await principal(request, 'content:books');
  const id = safeId(request.data?.id);
  const kind = ['posts', 'reviews', 'comments'].includes(request.data?.kind) ? request.data.kind : null;
  const status = ['hidden', 'public'].includes(request.data?.status) ? request.data.status : null;
  if (!id || !kind || !status) fail('invalid-argument', 'Choose valid content and a status.');
  const collection = kind === 'posts' ? 'posts' : kind === 'reviews' ? 'reviews' : 'postComments';
  const ref = db.collection(collection).doc(id);
  const old = await ref.get();
  if (!old.exists) fail('not-found', 'Content was not found.');
  const previous = kind === 'comments' ? (old.get('moderationHidden') === true ? 'hidden' : 'public') : (old.get('visibility') || 'public');
  await ref.update(kind === 'comments' ? { moderationHidden: status === 'hidden' } : { visibility: status, updatedAt: FieldValue.serverTimestamp() });
  await writeAudit(actor, 'content.moderation_status_changed', kind, id, { status: previous }, { status });
  return { ok: true, status };
});

exports.hqResolveReport = onCall({ region: 'us-central1' }, async (request) => {
  const actor = await principal(request, 'moderation:reports');
  const id = safeId(request.data?.id);
  const status = ['resolved', 'dismissed', 'investigating'].includes(request.data?.status) ? request.data.status : null;
  if (!id || !status) fail('invalid-argument', 'Choose a report and resolution status.');
  const ref = db.collection('reports').doc(id);
  const old = await ref.get();
  if (!old.exists) fail('not-found', 'Report not found.');
  await ref.update({ status, assignedModerator: actor.uid, resolutionNotes: safeText(request.data?.notes, 1000), updatedAt: FieldValue.serverTimestamp() });
  await writeAudit(actor, 'moderation.report_updated', 'report', id, { status: old.get('status') }, { status });
  return { ok: true };
});

exports.hqListEvents = onCall({ region: 'us-central1' }, async (request) => {
  await principal(request, 'health:read');
  const status = safeText(request.data?.status, 20);
  let query = db.collection('hqEvents').orderBy('createdAt', 'desc');
  if (['new', 'investigating', 'resolved', 'ignored'].includes(status)) query = db.collection('hqEvents').where('status', '==', status).orderBy('createdAt', 'desc');
  const snap = await query.limit(100).get();
  return { events: snap.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: d.get('createdAt')?.toDate?.().toISOString() || '' })) };
});

exports.hqUpdateEvent = onCall({ region: 'us-central1' }, async (request) => {
  const actor = await principal(request, 'health:read');
  const id = safeId(request.data?.id);
  const status = ['investigating', 'resolved', 'ignored'].includes(request.data?.status) ? request.data.status : null;
  if (!id || !status) fail('invalid-argument', 'Choose an issue and a valid status.');
  const ref = db.collection('hqEvents').doc(id);
  const event = await ref.get();
  if (!event.exists) fail('not-found', 'Issue not found.');
  await ref.update({ status, resolutionNotes: safeText(request.data?.notes, 1000), updatedAt: FieldValue.serverTimestamp(), updatedBy: actor.uid });
  await writeAudit(actor, 'health.event_updated', 'hqEvent', id, { status: event.get('status') }, { status });
  return { ok: true };
});

exports.hqGetAuditLogs = onCall({ region: 'us-central1' }, async (request) => {
  await principal(request, 'audit:read');
  const snap = await db.collection('hqAuditLogs').orderBy('createdAt', 'desc').limit(100).get();
  return { entries: snap.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: d.get('createdAt')?.toDate?.().toISOString() || '' })) };
});

exports.hqReportClientEvent = onCall({ region: 'us-central1' }, async (request) => {
  const uid = request.auth?.uid || '';
  const severity = ['info', 'warning', 'critical'].includes(request.data?.severity) ? request.data.severity : 'warning';
  const service = ['auth', 'firestore', 'storage', 'realtimeDatabase', 'functions', 'network'].includes(request.data?.service) ? request.data.service : 'network';
  const category = safeText(request.data?.category, 50);
  const operation = safeText(request.data?.operation, 50);
  const anonymousRuntime = !uid && service === 'functions' && category === 'frontend_runtime'
    && ['uncaught_exception', 'unhandled_rejection'].includes(operation);
  if (!uid && !anonymousRuntime) fail('unauthenticated', 'Sign in to report this operation.');
  const now = Date.now();
  const ip = request.rawRequest?.ip || 'unknown';
  const anonymousKey = require('crypto').createHash('sha256').update(ip).digest('hex').slice(0, 32);
  const rateRef = db.collection('hqRateLimits').doc(uid || `runtime_${anonymousKey}`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(rateRef);
    const old = snap.exists ? snap.data() : {};
    const count = old.windowStart > now - 60000 ? Number(old.count || 0) + 1 : 1;
    if (count > (anonymousRuntime ? 5 : 40)) fail('resource-exhausted', 'Too many diagnostic events.');
    tx.set(rateRef, { windowStart: count === 1 ? now : old.windowStart, count, updatedAt: FieldValue.serverTimestamp() });
  });
  const errorCode = safeText(request.data?.errorCode, 100);
  const message = anonymousRuntime ? 'An uncaught browser runtime error occurred.' : safeText(request.data?.message, MAX_EVENT_MESSAGE);
  if (!category || !operation) fail('invalid-argument', 'Diagnostic category and operation are required.');
  // Allocate IDs server-side so a client cannot overwrite or spoof an existing event.
  const eventRef = db.collection('hqEvents').doc();
  const id = eventRef.id;
  await eventRef.create({
    id, service, category, operation, severity, errorCode, message,
    actorUid: uid || 'anonymous', relatedId: anonymousRuntime ? '' : safeId(request.data?.relatedId), fileCategory: anonymousRuntime ? '' : safeText(request.data?.fileCategory, 40),
    fileName: anonymousRuntime ? '' : safeText(request.data?.fileName, 100), storagePath: anonymousRuntime ? '' : safeText(request.data?.storagePath, 200),
    retryStatus: operation === 'retry' ? 'attempted' : operation === 'completed' ? 'succeeded' : operation === 'failed' ? 'failed' : 'not_attempted',
    status: 'new', createdAt: FieldValue.serverTimestamp(),
  });
  return { ok: true, eventId: id };
});

exports.hqScheduledHealthCheck = onSchedule({ schedule: 'every 15 minutes', region: 'us-central1', timeoutSeconds: 120 }, async () => {
  const probes = await Promise.all([
    (async () => { try { await auth.listUsers(1); return ['auth', serviceHealth('healthy', 'Auth listUsers probe succeeded.')]; } catch (error) { return ['auth', serviceHealth('critical', safeText(error.code || error.message))]; } })(),
    (async () => { try { await count(db.collection('users')); return ['firestore', serviceHealth('healthy', 'Authorized user collection count succeeded.')]; } catch (error) { return ['firestore', serviceHealth('critical', safeText(error.code || error.message))]; } })(),
    (async () => { try { await getStorage().bucket(STORAGE_BUCKET).getMetadata(); return ['storage', serviceHealth('healthy', 'Storage bucket metadata probe succeeded.')]; } catch (error) { return ['storage', serviceHealth('warning', safeText(error.code || error.message))]; } })(),
    (async () => { try { await getDatabase().ref('/status').limitToFirst(1).once('value'); return ['realtimeDatabase', serviceHealth('healthy', 'Realtime Database read probe succeeded.')]; } catch (error) { return ['realtimeDatabase', serviceHealth('warning', safeText(error.code || error.message))]; } })(),
  ]);
  const services = Object.fromEntries(probes);
  const currentRef = db.collection('hqHealthChecks').doc('current');
  const previous = await currentRef.get().catch(() => null);
  const previousServices = previous?.exists ? previous.get('services') || {} : {};
  const now = new Date();
  const batch = db.batch();
  batch.set(currentRef, { services, checkedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
  for (const [name, health] of probes) {
    if (health.status !== 'healthy' && previousServices[name]?.status !== health.status) {
      const ref = db.collection('hqEvents').doc();
      batch.create(ref, { id: ref.id, service: name, category: 'scheduled_health_check', operation: 'probe_failed', severity: health.status === 'critical' ? 'critical' : 'warning', errorCode: safeText(health.details, 100), message: `Scheduled ${name} health probe failed.`, actorUid: 'system', relatedId: '', fileCategory: '', fileName: '', storagePath: '', retryStatus: 'not_attempted', status: 'new', createdAt: Timestamp.fromDate(now) });
    }
  }
  await batch.commit();
});

// Owner-managed platform configuration. Client writes are denied by Firestore rules.
exports.hqGetPlatformConfig = onCall({ region: 'us-central1' }, async (request) => {
  await principal(request, 'hq:overview');
  const [platform, campaignSnap] = await Promise.all([
    db.collection('hqConfig').doc('platform').get(),
    db.collection('hqBrandCampaigns').orderBy('priority', 'desc').limit(50).get(),
  ]);
  const campaigns = campaignSnap.docs.map((doc) => ({ id: doc.id, name: safeText(doc.get('name'), 80), startAt: doc.get('startAt'), endAt: doc.get('endAt'), priority: Number(doc.get('priority') || 0), logoUrl: safeBrandAssetUrl(doc.get('logoUrl')) }));
  const now = Date.now();
  const active = campaigns.filter((item) => Date.parse(item.startAt) <= now && Date.parse(item.endAt) > now).sort((a, b) => b.priority - a.priority)[0];
  return {
    platform: platform.exists ? { registrationEnabled: true, maintenanceMode: false, allowBookPublishing: true, communityEnabled: true, announcement: '', featureFlags: {}, ...platform.data() } : { registrationEnabled: true, maintenanceMode: false, allowBookPublishing: true, communityEnabled: true, announcement: '', featureFlags: {} },
    branding: { campaigns, activeCampaignId: active?.id || '' },
  };
});

exports.hqUpdatePlatformConfig = onCall({ region: 'us-central1' }, async (request) => {
  const actor = await principal(request, 'platform:manage');
  if (!actor.isOwner) fail('permission-denied', 'Only the owner can change global settings.');
  const input = request.data || {};
  const allowed = ['maintenanceMode', 'registrationEnabled', 'allowBookPublishing', 'communityEnabled'];
  const patch = {};
  for (const key of allowed) if (typeof input[key] === 'boolean') patch[key] = input[key];
  if (input.announcement !== undefined) patch.announcement = safeText(input.announcement, 500);
  if (input.featureFlags !== undefined) {
    if (!input.featureFlags || typeof input.featureFlags !== 'object' || Array.isArray(input.featureFlags)) fail('invalid-argument', 'Feature flags must be a settings object.');
    const flags = {};
    for (const [key, value] of Object.entries(input.featureFlags)) {
      if (!/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/.test(key) || typeof value !== 'boolean') fail('invalid-argument', 'Feature flags must have valid names and boolean values.');
      flags[key] = value;
    }
    patch.featureFlags = flags;
  }
  if (!Object.keys(patch).length) fail('invalid-argument', 'No valid setting changes were provided.');
  const ref = db.collection('hqConfig').doc('platform');
  const old = await ref.get();
  await ref.set({ ...patch, updatedAt: FieldValue.serverTimestamp(), updatedBy: actor.uid }, { merge: true });
  await writeAudit(actor, 'platform.settings_changed', 'platform', 'platform', old.exists ? old.data() : {}, patch);
  return { ok: true };
});

exports.redcoverRegistrationGate = beforeUserCreated({ region: 'us-central1' }, async () => {
  const config = await db.collection('hqConfig').doc('platform').get();
  if (config.exists && config.get('registrationEnabled') === false) {
    throw new HttpsError('permission-denied', 'Redcover registration is temporarily closed.');
  }
  return {};
});

exports.hqUpdateBranding = onCall({ region: 'us-central1' }, async (request) => {
  const actor = await principal(request, 'brand:manage');
  if (!actor.isOwner) fail('permission-denied', 'Only the owner can manage branding.');
  const input = request.data || {};
  const id = safeId(input.id) || db.collection('hqBrandCampaigns').doc().id;
  const action = input.action === 'delete' ? 'delete' : 'save';
  const ref = db.collection('hqBrandCampaigns').doc(id);
  const previous = await ref.get();
  if (action === 'delete') {
    if (previous.exists && previous.get('protectedDefault')) fail('failed-precondition', 'The original Redcover branding cannot be deleted.');
    if (previous.exists) await ref.delete();
    await writeAudit(actor, 'brand.campaign_deleted', 'brandCampaign', id, previous.exists ? previous.data() : null, null);
    return { ok: true, id };
  }
  const name = safeText(input.name, 80);
  const startAt = safeText(input.startAt, 30);
  const endAt = safeText(input.endAt, 30);
  const priority = Math.max(0, Math.min(100, Number(input.priority) || 0));
  const logoUrl = safeBrandAssetUrl(input.logoUrl);
  if (!name || !Number.isFinite(Date.parse(startAt)) || !Number.isFinite(Date.parse(endAt)) || Date.parse(endAt) <= Date.parse(startAt)) fail('invalid-argument', 'Enter a name and valid campaign start/end dates.');
  if (input.logoUrl && !logoUrl) fail('invalid-argument', 'Choose a valid Redcover Headquarters brand asset.');
  const data = { id, name, startAt, endAt, priority, logoUrl, updatedAt: FieldValue.serverTimestamp(), updatedBy: actor.uid, createdAt: previous.exists ? previous.get('createdAt') : FieldValue.serverTimestamp() };
  await ref.set(data, { merge: true });
  await writeAudit(actor, 'brand.campaign_saved', 'brandCampaign', id, previous.exists ? previous.data() : null, { name, startAt, endAt, priority, logoUrl: Boolean(logoUrl) });
  return { ok: true, id };
});

exports.hqUploadBrandAsset = onCall({ region: 'us-central1', memory: '512MiB', timeoutSeconds: 60 }, async (request) => {
  const actor = await principal(request, 'brand:manage');
  if (!actor.isOwner) fail('permission-denied', 'Only the owner can upload brand assets.');
  const { base64, contentType, campaignId } = request.data || {};
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(contentType)) fail('invalid-argument', 'Choose a PNG, JPEG or WebP image.');
  if (typeof base64 !== 'string' || base64.length > 2_900_000) fail('invalid-argument', 'Brand images must be smaller than 2 MB.');
  const buffer = Buffer.from(base64, 'base64');
  if (!buffer.length || buffer.length > 2 * 1024 * 1024) fail('invalid-argument', 'Brand images must be smaller than 2 MB.');
  const validImage = contentType === 'image/png'
    ? buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    : contentType === 'image/jpeg'
      ? buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
      : buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
  if (!validImage) fail('invalid-argument', 'Image bytes do not match the selected file type.');
  const id = safeId(campaignId) || 'campaign';
  const ext = ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' })[contentType];
  const path = `headquarters/branding/${id}/${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${ext}`;
  const token = require('crypto').randomUUID();
  const file = getStorage().bucket(STORAGE_BUCKET).file(path);
  await file.save(buffer, { resumable: false, metadata: { contentType, cacheControl: 'public,max-age=31536000', metadata: { firebaseStorageDownloadTokens: token } } });
  const url = `https://firebasestorage.googleapis.com/v0/b/${file.bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
  await writeAudit(actor, 'brand.asset_uploaded', 'brandAsset', path, null, { contentType, size: buffer.length });
  return { ok: true, url, path };
});

exports.hqGetAnalytics = onCall({ region: 'us-central1' }, async (request) => {
  await principal(request, 'analytics:read');
  const days = Math.min(90, Math.max(7, Number(request.data?.rangeDays) || 30));
  const to = Date.now();
  const from = to - days * 86400000;
  const groups = { users: 'users', books: 'books', posts: 'posts', comments: 'postComments', reports: 'reports', readingSessions: 'readingSessions' };
  const series = Object.fromEntries([...Object.keys(groups), 'errors'].map((key) => [key, {}]));
  const completeness = {};
  await Promise.all(Object.entries(groups).map(async ([key, collection]) => {
    try {
      const snap = await db.collection(collection).where('createdAt', '>=', Timestamp.fromMillis(from)).where('createdAt', '<=', Timestamp.fromMillis(to)).orderBy('createdAt', 'asc').limit(1000).get();
      completeness[key] = snap.size < 1000;
      for (const doc of snap.docs) {
        const date = doc.get('createdAt')?.toDate?.().toISOString().slice(0, 10);
        if (date) series[key][date] = (series[key][date] || 0) + 1;
      }
    } catch { completeness[key] = false; }
  }));
  try {
    const events = await db.collection('hqEvents').where('severity', 'in', ['warning', 'critical']).where('createdAt', '>=', Timestamp.fromMillis(from)).where('createdAt', '<=', Timestamp.fromMillis(to)).orderBy('createdAt', 'asc').limit(1000).get();
    completeness.errors = events.size < 1000;
    for (const doc of events.docs) {
      const date = doc.get('createdAt')?.toDate?.().toISOString().slice(0, 10);
      if (date) series.errors[date] = (series.errors[date] || 0) + 1;
    }
  } catch { completeness.errors = false; }
  const membershipSnap = await db.collection('users').where('membershipPlan', '==', 'premium').limit(1000).get().catch(() => null);
  return { rangeDays: days, from: new Date(from).toISOString(), to: new Date(to).toISOString(), series, completeness, membershipProfiles: membershipSnap ? membershipSnap.size : null, membershipSampleComplete: Boolean(membershipSnap && membershipSnap.size < 1000), billing: { available: false, reason: 'Google Cloud Billing export/API is not configured.' }, cloudflare: { available: false, reason: 'Cloudflare Analytics credentials are not configured.' } };
});

exports.hqListMemberships = onCall({ region: 'us-central1' }, async (request) => {
  await principal(request, 'membership:read');
  const snap = await db.collection('users').where('membershipPlan', '==', 'premium').limit(100).get();
  const docs = snap.docs;
  return { entries: docs.map((doc) => ({ uid: doc.id, displayName: safeText(doc.get('displayName'), 100), username: safeText(doc.get('username'), 50), plan: 'premium', createdAt: doc.get('createdAt')?.toDate?.().toISOString() || '', expiry: '' })), truncated: docs.length === 100, billing: { available: false, reason: 'Payment provider and billing records are not configured.' } };
});

exports.hqListSupportTickets = onCall({ region: 'us-central1' }, async (request) => {
  await principal(request, 'support:read');
  const status = ['open', 'in_progress', 'resolved'].includes(request.data?.status) ? request.data.status : '';
  let query = db.collection('contactMessages').orderBy('createdAt', 'desc');
  if (status === 'open') query = db.collection('contactMessages').where('status', 'in', ['pending', 'open']).orderBy('createdAt', 'desc');
  else if (status) query = db.collection('contactMessages').where('status', '==', status).orderBy('createdAt', 'desc');
  const snap = await query.limit(100).get();
  return { tickets: snap.docs.map((d) => ({
    id: d.id, subject: safeText(d.get('subject'), 200), message: safeText(d.get('message'), 4000),
    requesterName: safeText(d.get('name'), 100), requesterEmail: safeText(d.get('email'), 150),
    userId: safeId(d.get('userId')), status: d.get('status') || 'open',
    assignedTo: safeId(d.get('assignedTo')), internalNote: safeText(d.get('internalNote'), 1000),
    createdAt: d.get('createdAt')?.toDate?.().toISOString() || '',
  })) };
});

exports.submitContactMessage = onCall({ region: 'us-central1' }, async (request) => {
  const input = request.data || {};
  const name = safeText(input.name, 100);
  const email = safeText(input.email, 150).toLowerCase();
  const subject = safeText(input.subject, 200);
  const message = safeText(input.message, 4000);
  if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || subject.length < 3 || message.length < 10) fail('invalid-argument', 'Enter your name, a valid email address, subject and message.');
  const ip = request.rawRequest?.ip || 'unknown';
  const key = require('crypto').createHash('sha256').update(ip).digest('hex').slice(0, 40);
  const rateRef = db.collection('hqRateLimits').doc(`contact_${key}`);
  const now = Date.now();
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(rateRef);
    const data = snap.exists ? snap.data() : {};
    const count = data.windowStart > now - 3600000 ? Number(data.count || 0) + 1 : 1;
    if (count > 5) fail('resource-exhausted', 'Please wait before sending another contact request.');
    tx.set(rateRef, { windowStart: count === 1 ? now : data.windowStart, count, updatedAt: FieldValue.serverTimestamp() });
  });
  const ref = db.collection('contactMessages').doc();
  await ref.create({ referenceId: `MSG-${ref.id.slice(0, 8).toUpperCase()}`, name, email, subject, message, status: 'pending', platform: 'web', createdAt: FieldValue.serverTimestamp() });
  return { ok: true, referenceId: `MSG-${ref.id.slice(0, 8).toUpperCase()}` };
});

exports.hqUpdateSupportTicket = onCall({ region: 'us-central1' }, async (request) => {
  const actor = await principal(request, 'support:read');
  const id = safeId(request.data?.id);
  const status = ['open', 'in_progress', 'resolved'].includes(request.data?.status) ? request.data.status : null;
  if (!id || !status) fail('invalid-argument', 'Choose a ticket and a valid status.');
  const ref = db.collection('contactMessages').doc(id);
  const old = await ref.get();
  if (!old.exists) fail('not-found', 'Support request not found.');
  const internalNote = safeText(request.data?.internalNote, 1000);
  await ref.update({ status, assignedTo: safeId(request.data?.assignedTo) || actor.uid, internalNote, updatedAt: FieldValue.serverTimestamp() });
  await writeAudit(actor, 'support.ticket_updated', 'supportTicket', id, { status: old.get('status') }, { status });
  return { ok: true };
});

exports.hqListSecurityEvents = onCall({ region: 'us-central1' }, async (request) => {
  await principal(request, 'security:read');
  const snap = await db.collection('hqSecurityEvents').orderBy('createdAt', 'desc').limit(100).get();
  const denied = await db.collection('hqSecurityEvents').count().get().catch(() => null);
  return { events: snap.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: d.get('createdAt')?.toDate?.().toISOString() || '' })), total: denied?.data().count ?? null };
});
