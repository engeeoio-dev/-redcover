import {
  ref,
  onValue,
  onDisconnect,
  set,
  serverTimestamp as rtdbServerTimestamp,
} from 'firebase/database';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { rtdb, db } from './firebaseConfig';

export interface UserPresenceState {
  state: 'online' | 'offline';
  lastChanged: number;
}

const presenceCache = new Map<string, UserPresenceState>();
const listeners = new Map<string, Set<(presence: UserPresenceState) => void>>();
const presenceUnsubs = new Map<string, () => void>();

/**
 * Initializes real-time presence monitoring using Firebase Realtime Database
 * and gracefully synchronizes with Firestore.
 */
export function initUserPresence(uid: string, showOnlineStatus: boolean = true): () => void {
  if (!rtdb || !uid) return () => {};

  const userStatusRtdbRef = ref(rtdb, `/status/${uid}`);
  const connectedRef = ref(rtdb, '.info/connected');

  const unsubConnected = onValue(connectedRef, async (snapshot) => {
    if (snapshot.val() === false) {
      return;
    }

    try {
      const disconnectRef = onDisconnect(userStatusRtdbRef);
      await disconnectRef.set({
        state: 'offline',
        lastChanged: rtdbServerTimestamp(),
      });

      await set(userStatusRtdbRef, {
        state: showOnlineStatus ? 'online' : 'offline',
        lastChanged: Date.now(),
      });

      // Synchronize to Firestore for offline queries
      updateDoc(doc(db, 'users', uid), {
        isOnline: showOnlineStatus,
        updatedAt: serverTimestamp(),
      }).catch(() => {
        // Ignore offline or transient firestore update error
      });
    } catch (e) {
      console.warn('Presence sync warning:', e);
      updateDoc(doc(db, 'users', uid), {
        isOnline: false,
        updatedAt: serverTimestamp(),
      }).catch(() => {});
    }
  });

  return () => {
    unsubConnected();
    // Set offline on cleanup
    try {
      set(userStatusRtdbRef, {
        state: 'offline',
        lastChanged: Date.now(),
      }).catch(() => {});
      updateDoc(doc(db, 'users', uid), {
        isOnline: false,
        updatedAt: serverTimestamp(),
      }).catch(() => {});
    } catch {
      // Ignore
    }
  };
}

/**
 * Subscribe to real-time presence of a specific user.
 */
export function subscribeUserPresence(
  uid: string,
  callback: (presence: UserPresenceState) => void
): () => void {
  if (!uid) return () => {};

  if (!listeners.has(uid)) {
    listeners.set(uid, new Set());
  }
  listeners.get(uid)!.add(callback);

  if (rtdb && !presenceUnsubs.has(uid)) {
    const userStatusRtdbRef = ref(rtdb, `/status/${uid}`);
    const unsubRtdb = onValue(userStatusRtdbRef, (snap) => {
      const val = snap.val();
      const state: UserPresenceState = {
        state: val?.state === 'online' ? 'online' : 'offline',
        lastChanged: typeof val?.lastChanged === 'number' ? val.lastChanged : Date.now(),
      };
      presenceCache.set(uid, state);
      listeners.get(uid)?.forEach((cb) => cb(state));
    }, (error) => {
      console.warn('RTDB presence subscription warning for', uid, error);
      const state: UserPresenceState = { state: 'offline', lastChanged: Date.now() };
      presenceCache.set(uid, state);
      listeners.get(uid)?.forEach((cb) => cb(state));
    });
    presenceUnsubs.set(uid, unsubRtdb);
  }

  return () => {
    listeners.get(uid)?.delete(callback);
    if (listeners.get(uid)?.size === 0) {
      listeners.delete(uid);
      presenceUnsubs.get(uid)?.();
      presenceUnsubs.delete(uid);
    }
  };
}

/**
 * Formats presence status string based on real-time state and user privacy preferences.
 * Examples:
 * - "Active now"
 * - "Active 5 minutes ago"
 * - "Active 2 hours ago"
 * - "Active yesterday"
 */
export function formatPresenceStatus(
  presence: UserPresenceState | null | undefined,
  fallbackIsOnline?: boolean,
  showOnlineStatus: boolean = true
): { isOnline: boolean; text: string } {
  if (!showOnlineStatus) {
    return { isOnline: false, text: '' };
  }

  const isOnline = presence?.state === 'online' || (!presence && !!fallbackIsOnline);

  if (isOnline) {
    return { isOnline: true, text: 'Active now' };
  }

  if (!presence || !presence.lastChanged) {
    return { isOnline: false, text: 'Offline' };
  }

  const now = Date.now();
  const diffMs = Math.max(0, now - presence.lastChanged);
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) {
    return { isOnline: false, text: 'Active just now' };
  }
  if (diffMinutes === 1) {
    return { isOnline: false, text: 'Active 1 minute ago' };
  }
  if (diffMinutes < 60) {
    return { isOnline: false, text: `Active ${diffMinutes} minutes ago` };
  }
  if (diffHours === 1) {
    return { isOnline: false, text: 'Active 1 hour ago' };
  }
  if (diffHours < 24) {
    return { isOnline: false, text: `Active ${diffHours} hours ago` };
  }
  if (diffDays === 1) {
    return { isOnline: false, text: 'Active yesterday' };
  }
  return { isOnline: false, text: `Active ${diffDays} days ago` };
}
