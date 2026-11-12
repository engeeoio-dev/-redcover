const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const PROJECT_ID = process.env.GCLOUD_PROJECT || 'red-cover';
const DATABASE_ID = process.env.FIRESTORE_DATABASE_ID || 'ai-studio-redcover-ec164fd1-8554-4ddc-a224-0e1a0561d823';
const OWNER_EMAIL = 'engeeo.io@gmail.com';

async function main() {
  initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
  const auth = getAuth();
  const user = await auth.getUserByEmail(OWNER_EMAIL);
  if (user.email?.toLowerCase() !== OWNER_EMAIL || !user.emailVerified) {
    throw new Error('The configured owner account must exist and have a verified email.');
  }
  const claims = { ...(user.customClaims || {}), hqRole: 'owner', hqPermissions: ['*'] };
  await auth.setCustomUserClaims(user.uid, claims);
  const db = getFirestore(undefined, DATABASE_ID);
  await db.collection('hqAuditLogs').add({
    actorUid: user.uid, actorRole: 'owner', action: 'owner.claim_provisioned', targetType: 'owner', targetId: user.uid,
    previousValue: user.customClaims?.hqRole || null, newValue: 'owner', result: 'success', createdAt: FieldValue.serverTimestamp(),
  });
  console.log(`Owner claim provisioned for ${OWNER_EMAIL} (${user.uid}). Sign out and sign back in to refresh the ID token.`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
