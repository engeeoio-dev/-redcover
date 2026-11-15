import {
  collection,
  doc,
  deleteDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebaseConfig';
import { ComicPageComment, UserProfile } from '../../models/types';
import { toIsoString } from './storageService';

const commentsRef = collection(db, 'comicPageComments');

function normalizeComment(id: string, data: Record<string, any>): ComicPageComment {
  return {
    id,
    bookId: String(data.bookId || ''),
    pageNumber: Math.max(1, Number(data.pageNumber) || 1),
    parentId: String(data.parentId || ''),
    userId: String(data.userId || ''),
    userName: String(data.userName || 'Reader'),
    userAvatar: String(data.userAvatar || ''),
    replyToUserName: String(data.replyToUserName || ''),
    text: String(data.text || ''),
    createdAt: toIsoString(data.createdAt),
    updatedAt: toIsoString(data.updatedAt),
  };
}

export function subscribeComicPageComments(
  bookId: string,
  pageNumber: number,
  parentId: string,
  onComments: (comments: ComicPageComment[]) => void,
  onError: (error: Error) => void,
  pageSize = parentId ? 10 : 50
): () => void {
  const q = query(
    commentsRef,
    where('bookId', '==', bookId),
    where('pageNumber', '==', pageNumber),
    where('parentId', '==', parentId),
    orderBy('createdAt', parentId ? 'asc' : 'desc'),
    limit(pageSize)
  );
  return onSnapshot(q, (snapshot) => {
    onComments(snapshot.docs.map((item) => normalizeComment(item.id, item.data())));
  }, (error) => onError(error));
}

export async function countComicPageReplies(bookId: string, pageNumber: number, parentId: string): Promise<number> {
  const { getCountFromServer } = await import('firebase/firestore');
  const q = query(commentsRef, where('bookId', '==', bookId), where('pageNumber', '==', pageNumber), where('parentId', '==', parentId));
  const result = await getCountFromServer(q);
  return result.data().count;
}

export async function addComicPageComment(
  bookId: string,
  pageNumber: number,
  text: string,
  user: UserProfile,
  parent?: ComicPageComment
): Promise<void> {
  const cleanText = text.trim().slice(0, 1000);
  if (!cleanText) throw new Error('Write a comment first.');
  const commentRef = doc(commentsRef);
  await setDoc(commentRef, {
    id: commentRef.id,
    bookId,
    pageNumber,
    parentId: parent?.id || '',
    userId: user.uid,
    userName: (user.displayName || user.username || 'Reader').slice(0, 100),
    userAvatar: (user.photoURL || '').slice(0, 5000),
    replyToUserName: parent?.userName || '',
    text: cleanText,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function editComicPageComment(commentId: string, text: string): Promise<void> {
  const cleanText = text.trim().slice(0, 1000);
  if (!cleanText) throw new Error('Comment cannot be empty.');
  await updateDoc(doc(db, 'comicPageComments', commentId), { text: cleanText, updatedAt: serverTimestamp() });
}

export async function deleteComicPageComment(commentId: string): Promise<void> {
  while (true) {
    const replies = await getDocs(query(commentsRef, where('parentId', '==', commentId), limit(450)));
    if (!replies.size) break;
    const batch = writeBatch(db);
    replies.docs.forEach((reply) => batch.delete(reply.ref));
    await batch.commit();
    if (replies.size < 450) break;
  }
  await deleteDoc(doc(db, 'comicPageComments', commentId));
}
