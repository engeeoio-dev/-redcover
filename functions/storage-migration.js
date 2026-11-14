// Read-only by default. Run with trusted Application Default Credentials.
// `node storage-migration.js report [report.json]`
// `node storage-migration.js apply` and `node storage-migration.js rollback` are explicit mutations.
const crypto = require('node:crypto');
const fs = require('node:fs');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');

const app = initializeApp();
const DATABASE_ID = process.env.FIRESTORE_DATABASE_ID || 'ai-studio-redcover-ec164fd1-8554-4ddc-a224-0e1a0561d823';
const STORAGE_BUCKET = process.env.FIREBASE_STORAGE_BUCKET || 'red-cover.firebasestorage.app';
const db = getFirestore(undefined, DATABASE_ID);
const defaultDb = getFirestore();
const bucket = getStorage().bucket(STORAGE_BUCKET);
const ledger = db.collection('_storageMigrationLedger'); // Firestore catch-all denies client access.

function getObjectPath(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  if (value.startsWith('gs://')) {
    const m = value.match(/^gs:\/\/([^/]+)\/(.+)$/);
    return m?.[1] === bucket.name ? m[2] : '';
  }
  if (/^https?:\/\//i.test(value)) {
    try {
      const u = new URL(value);
      if (u.hostname === 'firebasestorage.googleapis.com') {
        const m = u.pathname.match(/^\/v0\/b\/([^/]+)\/o\/(.+)$/);
        return m?.[1] === bucket.name ? decodeURIComponent(m[2]) : '';
      }
      if (u.hostname === 'storage.googleapis.com') {
        const m = u.pathname.match(/^\/([^/]+)\/(.+)$/);
        return m?.[1] === bucket.name ? decodeURIComponent(m[2]) : '';
      }
      return '';
    } catch { return ''; }
  }
  return value.replace(/^\/+/, '').split(/[?#]/, 1)[0];
}

function kindOf(value, path) {
  if (!path) return 'external-or-unrecognized';
  return /[?&]token=/i.test(value) ? 'firebase-download-url-with-token' : (/^https?:\/\//i.test(value) ? 'storage-url' : 'raw-storage-path');
}

function storageRefs(collection, doc, data, databaseId = DATABASE_ID, recordCollection = collection) {
  const refs = [];
  const push = (field, value) => {
    if (typeof value !== 'string' || !value) return;
    const path = getObjectPath(value);
    if (path && !path.includes('..') && !path.includes('\\')) refs.push({ collection, recordCollection, docId: doc.id, field, value, path, databaseId });
  };
  if (collection === 'books') {
    push('fileURL', data.fileURL);
    push('coverURL', data.coverURL);
  } else if (collection === 'users') {
    push('photoURL', data.photoURL);
    push('coverURL', data.coverURL);
  } else if (collection === 'messages') {
    const text = String(data.text || '');
    const m = text.match(/^\[attachment:(?:image|file|voice):([^\]]+)\]/s);
    if (m) {
      const parts = m[1].split('|');
      const value = /^\[attachment:voice:/.test(text) ? parts[0] : (parts[1] || parts[0]);
      const path = getObjectPath(value);
      if (path) {
        const newValue = text.replace(value, path);
        const senderId = String(data.senderId || '');
        const parts = path.split('/');
        const ownerPathMatchesSender = parts[0] === 'users'
          ? parts[1] === senderId
          : ['chat_attachments', 'chat_media', 'chat_voice', 'chat_files'].includes(parts[0])
            && (parts[1] === senderId || parts[1]?.startsWith(`${senderId}_`));
        refs.push({ collection, recordCollection, docId: doc.id, field: 'text', value: text, newValue, path, databaseId, senderId, ownerPathMatchesSender });
      }
    }
  }
  return refs;
}

async function scan() {
  const found = [];
  const addTop = async (database, databaseId, collection) => {
    const snap = await database.collection(collection).get();
    for (const doc of snap.docs) found.push(...storageRefs(collection, doc, doc.data(), databaseId));
    return snap.size;
  };
  const namedBookCount = await addTop(db, DATABASE_ID, 'books');
  const namedUserCount = await addTop(db, DATABASE_ID, 'users');
  let legacyBookCount = 0;
  for (const collectionName of ['Books', 'stories', 'Stories', 'pdf_books', 'ebooks']) {
    const snap = await defaultDb.collection(collectionName).get();
    legacyBookCount += snap.size;
    for (const doc of snap.docs) found.push(...storageRefs('books', doc, doc.data(), '(default)', collectionName));
  }
  let legacyUserCount = 0;
  for (const collectionName of ['Users', 'authors']) {
    const snap = await defaultDb.collection(collectionName).get();
    legacyUserCount += snap.size;
    for (const doc of snap.docs) found.push(...storageRefs('users', doc, doc.data(), '(default)', collectionName));
  }
  const defaultBooks = await defaultDb.collection('books').get();
  for (const doc of defaultBooks.docs) found.push(...storageRefs('books', doc, doc.data(), '(default)'));
  const defaultUsers = await defaultDb.collection('users').get();
  for (const doc of defaultUsers.docs) found.push(...storageRefs('users', doc, doc.data(), '(default)'));
  const counts = { books: namedBookCount + defaultBooks.size + legacyBookCount, users: namedUserCount + defaultUsers.size + legacyUserCount, directChats: 0, groups: 0, messages: 0 };
  for (const collection of ['chats', 'groups']) {
    const convs = await db.collection(collection).get();
    if (collection === 'chats') counts.directChats = convs.size; else counts.groups = convs.size;
    for (const conv of convs.docs) {
      const msgs = await conv.ref.collection('messages').get();
      counts.messages += msgs.size;
      for (const msg of msgs.docs) found.push(...storageRefs('messages', msg, msg.data(), DATABASE_ID).map((ref) => ({ ...ref, conversationId: conv.id, conversationType: collection === 'groups' ? 'group' : 'direct' })));
    }
  }
  for (const ref of found) {
    const [exists] = await bucket.file(ref.path).exists().catch(() => [false]);
    ref.exists = exists;
    ref.referenceKind = kindOf(ref.value, ref.path);
    const privateFile = ref.collection === 'messages' || ref.field === 'fileURL';
    const supportedRoot = ['book_pdfs', 'book_content', 'pdfs', 'books', 'users', 'chat_attachments', 'chat_media', 'chat_voice', 'chat_files'].includes(ref.path.split('/')[0]);
    ref.action = !exists ? 'repair stale reference after owner review' : (ref.collection === 'messages' && !ref.ownerPathMatchesSender ? 'manual review; attachment path owner cannot be matched to sender' : (!supportedRoot ? 'manual review; resolver does not allow this Storage root' : (privateFile && ref.referenceKind === 'firebase-download-url-with-token' ? 'replace reference with raw path and rotate legacy download token' : 'retain; existing cover/profile URL is not changed')));
  }
  return { projectId: app.options.projectId || process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || '(ADC project)', databaseId: DATABASE_ID, bucket: bucket.name, scannedRecords: counts, affectedRecords: found.length, byFolder: found.reduce((acc, row) => { const k = row.path.split('/')[0]; acc[k] = (acc[k] || 0) + 1; return acc; }, {}), records: found };
}

function ledgerId(path) { return crypto.createHash('sha256').update(`${bucket.name}/${path}`).digest('hex'); }
function referenceDoc(ref) {
  const database = ref.databaseId === '(default)' ? defaultDb : db;
  if (ref.collection === 'messages') {
    return database.collection(ref.conversationType === 'group' ? 'groups' : 'chats').doc(ref.conversationId).collection('messages').doc(ref.docId);
  }
  return database.collection(ref.recordCollection || ref.collection).doc(ref.docId);
}

async function applyMigration(report) {
  const groups = new Map();
  for (const ref of report.records.filter((item) => item.exists && (item.field === 'fileURL' || (item.collection === 'messages' && item.ownerPathMatchesSender)) && ['book_pdfs', 'book_content', 'pdfs', 'books', 'users', 'chat_attachments', 'chat_media', 'chat_voice', 'chat_files'].includes(item.path.split('/')[0]))) {
    const list = groups.get(ref.path) || [];
    list.push(ref);
    groups.set(ref.path, list);
  }
  for (const [path, refs] of groups) {
    const ref = ledger.doc(ledgerId(path));
    let snap = await ref.get();
    let entry = snap.exists ? snap.data() : null;
    if (entry?.status === 'applied' || entry?.status === 'rolled_back') continue;
    if (!entry) {
      const file = bucket.file(path);
      const [meta] = await file.getMetadata();
      const oldTokens = meta.metadata?.firebaseStorageDownloadTokens || '';
      const rotate = oldTokens && refs.some((item) => item.collection === 'messages' || item.field === 'fileURL');
      const newToken = rotate ? crypto.randomUUID() : oldTokens;
      const references = refs.map((item) => ({ ...item, newValue: item.newValue || item.path }));
      entry = { objectPath: path, bucket: bucket.name, status: 'prepared', oldTokens, newToken, rotated: !!rotate, references, createdAt: new Date().toISOString() };
      await ref.create(entry);
    }
    const file = bucket.file(path);
    if (entry.rotated) {
      const [meta] = await file.getMetadata();
      await file.setMetadata({ metadata: { ...(meta.metadata || {}), firebaseStorageDownloadTokens: entry.newToken } });
    }
    for (const item of entry.references) {
      const docRef = referenceDoc(item);
      const current = await docRef.get();
      if (!current.exists) continue;
      const value = current.get(item.field);
      if (value === item.value) await docRef.update(item.field, item.newValue);
      else if (value !== item.newValue) throw new Error(`Reference changed since report: ${item.collection}/${item.docId}/${item.field}`);
    }
    await ref.update({ status: 'applied', appliedAt: new Date().toISOString() });
  }
}

async function rollbackMigration() {
  const snap = await ledger.where('status', 'in', ['applied', 'rolling_back']).get();
  for (const doc of snap.docs) {
    const entry = doc.data();
    await doc.ref.update({ status: 'rolling_back' });
    for (const item of entry.references) {
      const target = referenceDoc(item);
      const current = await target.get();
      if (!current.exists) continue;
      const value = current.get(item.field);
      if (value === item.newValue) await target.update(item.field, item.value);
      else if (value !== item.value) throw new Error(`Rollback stopped; reference changed: ${item.collection}/${item.docId}/${item.field}`);
    }
    if (entry.rotated) {
      const file = bucket.file(entry.objectPath);
      const [meta] = await file.getMetadata();
      const metadata = { ...(meta.metadata || {}) };
      if (entry.oldTokens) metadata.firebaseStorageDownloadTokens = entry.oldTokens;
      else delete metadata.firebaseStorageDownloadTokens;
      await file.setMetadata({ metadata });
    }
    await doc.ref.update({ status: 'rolled_back', rolledBackAt: new Date().toISOString() });
  }
}

async function main() {
  const [mode = 'report', outputPath] = process.argv.slice(2);
  if (mode === 'report') {
    const report = await scan();
    const safeReport = {
      ...report,
      records: report.records.map(({ value, newValue, ...item }) => item),
    };
    const json = JSON.stringify(safeReport, null, 2);
    if (outputPath) fs.writeFileSync(outputPath, json, { flag: 'wx' });
    console.log(JSON.stringify({ projectId: report.projectId, scannedRecords: report.scannedRecords, affectedRecords: report.affectedRecords, byFolder: report.byFolder, reportFile: outputPath || null }, null, 2));
  } else if (mode === 'apply') {
    const report = await scan();
    await applyMigration(report);
    console.log(`Migration applied for ${report.affectedRecords} references. Full report contains private URLs; keep it local and access-controlled.`);
  } else if (mode === 'rollback') {
    await rollbackMigration();
    console.log('Rollback completed for all applied storage migrations.');
  } else {
    throw new Error('Use report [new-report.json], apply, or rollback. report is read-only by default.');
  }
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
