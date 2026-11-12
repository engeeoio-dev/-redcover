import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  runTransaction,
  writeBatch,
  serverTimestamp,
  collection,
} from 'firebase/firestore';
import { db } from './firebaseConfig';
import {
  Book,
  ReadingInvitation,
  ReadingRemoteRequest,
  ReadingSession,
  UserProfile,
} from '../../models/types';

/**
 * Creates a synchronized reading session and sends an invitation to the invitee.
 */
export async function createReadingSession(
  book: Book,
  host: UserProfile,
  invitee: UserProfile,
  personalMessage: string = ''
): Promise<{ sessionId: string; invitationId: string }> {
  const sessionId = `rsess_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const invitationId = `rinv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const leaseTimeMs = 300000; // 5 minute initial remote lease

  const sessionData: ReadingSession = {
    id: sessionId,
    bookId: book.id,
    bookTitle: book.title,
    bookCover: book.coverURL || '',
    bookFormat: book.format || 'story',
    hostId: host.uid,
    hostName: host.displayName,
    hostAvatar: host.photoURL || '',
    participantId: invitee.uid,
    participantName: invitee.displayName,
    participantAvatar: invitee.photoURL || '',
    status: 'waiting',
    currentChapter: 1,
    currentPage: 1,
    scrollPosition: 0,
    activeControllerId: host.uid,
    activeControllerName: host.displayName,
    controllerLeaseUntil: Date.now() + leaseTimeMs,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const sessionRef = doc(db, 'readingSessions', sessionId);

  // Create reading invitation
  const inviteData: ReadingInvitation = {
    id: invitationId,
    bookId: book.id,
    bookTitle: book.title,
    bookCover: book.coverURL || '',
    inviterId: host.uid,
    inviterName: host.displayName,
    inviterAvatar: host.photoURL || '',
    inviteeId: invitee.uid,
    inviteeName: invitee.displayName,
    personalMessage: personalMessage.trim().slice(0, 300),
    sessionId,
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const invitationRef = doc(db, 'readingInvitations', invitationId);
  const batch = writeBatch(db);
  batch.set(sessionRef, { ...sessionData, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  batch.set(invitationRef, { ...inviteData, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  await batch.commit();

  // Send in-app notification
  const notifId = `notif_${invitationId}`;
  await setDoc(doc(db, 'notifications', notifId), {
    id: notifId,
    recipientId: invitee.uid,
    actorId: host.uid,
    actorName: host.displayName,
    actorAvatar: host.photoURL || '',
    category: 'reading',
    type: 'reading_invite',
    title: 'Shared Reading Invitation',
    body: `${host.displayName} invited you to read "${book.title}" together!`,
    link: `/hub?tab=reading&sessionId=${sessionId}`,
    read: false,
    targetId: invitationId,
    actionState: 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }).catch(() => {});

  return { sessionId, invitationId };
}

/**
 * Accepts a reading invitation and activates the session.
 */
export async function acceptReadingInvitation(
  invitationId: string,
  sessionId: string,
  user: UserProfile
): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, 'readingInvitations', invitationId), {
    status: 'accepted',
    updatedAt: serverTimestamp(),
  });

  batch.update(doc(db, 'readingSessions', sessionId), {
    status: 'active',
    participantId: user.uid,
    participantName: user.displayName,
    participantAvatar: user.photoURL || '',
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
}

/**
 * Declines a reading invitation.
 */
export async function declineReadingInvitation(invitationId: string): Promise<void> {
  await updateDoc(doc(db, 'readingInvitations', invitationId), {
    status: 'declined',
    updatedAt: serverTimestamp(),
  });
}

/**
 * Updates reading position (pages, chapter, scroll).
 * Strictly enforces that only the current controller can change positions!
 */
export async function updateReadingPosition(
  sessionId: string,
  controllerId: string,
  currentChapter: number,
  currentPage: number,
  scrollPosition: number
): Promise<void> {
  const sessionRef = doc(db, 'readingSessions', sessionId);

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(sessionRef);
    if (!snap.exists()) throw new Error('Session not found');

    const data = snap.data() as ReadingSession;
    if (data.activeControllerId !== controllerId) {
      throw new Error('Permission denied: You do not currently hold the remote control.');
    }

    transaction.update(sessionRef, {
      currentChapter,
      currentPage,
      scrollPosition,
      updatedAt: serverTimestamp(),
    });
  });
}

/**
 * Non-controller requests the remote control.
 */
export async function requestRemoteControl(
  sessionId: string,
  requester: UserProfile
): Promise<string> {
  const reqId = `rreq_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const reqRef = doc(db, 'readingRemoteRequests', reqId);

  const expiresAt = new Date(Date.now() + 60000).toISOString(); // 60s expiration

  await setDoc(reqRef, {
    id: reqId,
    sessionId,
    requesterId: requester.uid,
    requesterName: requester.displayName,
    requesterAvatar: requester.photoURL || '',
    status: 'pending',
    createdAt: serverTimestamp(),
    expiresAt,
  });

  return reqId;
}

/**
 * Current controller approves or rejects a remote request.
 * If approved, transfers remote lease atomically!
 */
export async function respondToRemoteRequest(
  sessionId: string,
  requestId: string,
  approve: boolean,
  newControllerId?: string,
  newControllerName?: string
): Promise<void> {
  const reqRef = doc(db, 'readingRemoteRequests', requestId);
  const sessionRef = doc(db, 'readingSessions', sessionId);

  const batch = writeBatch(db);
  batch.update(reqRef, {
    status: approve ? 'approved' : 'rejected',
  });

  if (approve && newControllerId && newControllerName) {
    batch.update(sessionRef, {
      activeControllerId: newControllerId,
      activeControllerName: newControllerName,
      controllerLeaseUntil: Date.now() + 300000,
      updatedAt: serverTimestamp(),
    });
  }
  await batch.commit();
}

/**
 * Ends a shared reading session.
 */
export async function endReadingSession(sessionId: string): Promise<void> {
  await updateDoc(doc(db, 'readingSessions', sessionId), {
    status: 'ended',
    updatedAt: serverTimestamp(),
  });
}
