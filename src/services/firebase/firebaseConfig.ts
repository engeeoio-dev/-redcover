import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getDatabase } from 'firebase/database';
import { getFunctions } from 'firebase/functions';
import firebaseConfig from '../../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const defaultDb = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, 'us-central1');

let rtdbInstance: ReturnType<typeof getDatabase> | null = null;
try {
  const rtdbUrl =
    (firebaseConfig as any).databaseURL ||
    `https://${firebaseConfig.projectId}-default-rtdb.firebaseio.com`;
  rtdbInstance = getDatabase(app, rtdbUrl);
} catch {
  try {
    rtdbInstance = getDatabase(app);
  } catch (err) {
    console.warn('Realtime Database initialization warning:', err);
    rtdbInstance = null;
  }
}
export const rtdb = rtdbInstance;

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const FIREBASE_PROJECT_INFO = {
  projectId: firebaseConfig.projectId,
  appId: firebaseConfig.appId,
  firestoreDatabaseId: firebaseConfig.firestoreDatabaseId,
  storageBucket: firebaseConfig.storageBucket,
  authDomain: firebaseConfig.authDomain,
  messagingSenderId: firebaseConfig.messagingSenderId,
};

export let firestoreConnectionVerified = false;
export let firestoreConnectionError: string | null = null;

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    firestoreConnectionVerified = true;
    firestoreConnectionError = null;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      firestoreConnectionError = 'Client is offline. Please check your Firebase configuration.';
      console.error('Please check your Firebase configuration.');
    } else {
      // A permission-denied on test/connection still proves online connectivity to the Firestore server
      firestoreConnectionVerified = true;
      firestoreConnectionError = null;
    }
  }
}

testConnection();
