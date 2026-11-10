import {
  ref,
  set,
  get,
  update,
  onValue,
  serverTimestamp as rtdbServerTimestamp,
} from 'firebase/database';
import { rtdb } from './firebaseConfig';
import { Chat, ChatMessage, UserProfile } from '../../models/types';

function withTimeout<T>(promise: Promise<T>, ms = 2000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`RTDB timed out after ${ms}ms`)), ms)
    ),
  ]);
}

/**
 * Normalizes an RTDB ISO or numeric timestamp into an ISO string.
 */
function toRtdbIsoString(val: any): string {
  if (!val) return new Date().toISOString();
  if (typeof val === 'number') return new Date(val).toISOString();
  if (typeof val === 'string') return val;
  return new Date().toISOString();
}

/**
 * Starts or retrieves a deterministic direct conversation in Realtime Database.
 * Key: /chats/chat_{u1}_{u2} where u1 < u2
 */
export async function startOrGetRtdbChat(
  currentUser: UserProfile,
  targetUser: UserProfile
): Promise<string> {
  const [u1, u2] = [currentUser.uid, targetUser.uid].sort();
  const chatId = `chat_${u1}_${u2}`.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 120);

  if (!rtdb) return chatId;

  const chatRef = ref(rtdb, `chats/${chatId}`);
  try {
    const snap = await get(chatRef);
    if (!snap.exists()) {
      const isUser1 = currentUser.uid === u1;
      const participantAName = (isUser1 ? currentUser.displayName : targetUser.displayName).slice(0, 100);
      const participantBName = (isUser1 ? targetUser.displayName : currentUser.displayName).slice(0, 100);
      const participantAAvatar = (isUser1 ? currentUser.photoURL || '' : targetUser.photoURL || '').slice(0, 1000);
      const participantBAvatar = (isUser1 ? targetUser.photoURL || '' : currentUser.photoURL || '').slice(0, 1000);

      const now = Date.now();
      const payload: Record<string, any> = {
        id: chatId,
        participantA: u1,
        participantB: u2,
        participantAName,
        participantBName,
        participantAAvatar,
        participantBAvatar,
        lastMessage: 'Conversation started',
        lastSenderId: currentUser.uid,
        unreadCountA: 0,
        unreadCountB: 0,
        createdAt: now,
        updatedAt: now,
      };

      await set(chatRef, payload);

      // User chat index for quick lookup
      await set(ref(rtdb, `user_chats/${u1}/${chatId}`), true).catch(() => {});
      await set(ref(rtdb, `user_chats/${u2}/${chatId}`), true).catch(() => {});
    }
  } catch (err) {
    console.warn('RTDB startOrGetChat notice:', err);
  }

  return chatId;
}

/**
 * Sends a message into Realtime Database at /messages/{chatId}/{messageId}
 * and atomically updates /chats/{chatId}.
 */
export async function sendRtdbChatMessage(
  chat: Chat,
  currentSenderUid: string,
  text: string,
  options?: {
    messageId?: string;
    bookAttachment?: any;
    replyTo?: any;
    isForwarded?: boolean;
    redCode?: string;
  }
): Promise<string> {
  const cleanText = (text || '').trim().slice(0, 2000);
  const msgId =
    options?.messageId && /^[a-zA-Z0-9_-]+$/.test(options.messageId)
      ? options.messageId
      : `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  if (!rtdb) return msgId;

  const receiverId = chat.participantA === currentSenderUid ? chat.participantB : chat.participantA;
  const now = Date.now();

  let previewText = cleanText;
  if (options?.bookAttachment) {
    previewText = `📚 ${options.bookAttachment.title || 'Shared a book'}`;
  } else if (cleanText.startsWith('[attachment:image:')) {
    previewText = '📷 Sent a photo';
  } else if (cleanText.startsWith('[attachment:file:')) {
    previewText = '📎 Sent a file attachment';
  } else if (cleanText.startsWith('[attachment:book:')) {
    previewText = '📚 Shared a book recommendation';
  }

  const msgPayload: Record<string, any> = {
    id: msgId,
    chatId: chat.id,
    senderId: currentSenderUid,
    receiverId,
    text: cleanText,
    status: 'sent',
    createdAt: now,
  };

  if (options?.bookAttachment && options.bookAttachment.title) {
    msgPayload.bookAttachment = {
      id: String(options.bookAttachment.id || options.bookAttachment.bookId || ''),
      title: String(options.bookAttachment.title || '').slice(0, 200),
      author: String(options.bookAttachment.author || options.bookAttachment.authorName || 'Author').slice(0, 120),
      coverURL: String(options.bookAttachment.coverURL || '').slice(0, 5000),
      description: String(options.bookAttachment.description || options.bookAttachment.shortDescription || '').slice(0, 300),
      redCode: String(options.bookAttachment.redCode || '').slice(0, 12),
    };
  }

  if (options?.replyTo && options.replyTo.id) {
    msgPayload.replyTo = {
      id: String(options.replyTo.id || ''),
      text: String(options.replyTo.text || 'Message').slice(0, 500),
      senderName: String(options.replyTo.senderName || 'Reader').slice(0, 100),
      senderId: String(options.replyTo.senderId || '').slice(0, 128),
    };
  }
  if (options?.isForwarded) msgPayload.isForwarded = true;
  if (options?.redCode) msgPayload.redCode = String(options.redCode).slice(0, 12);

  // 1. Write message to RTDB with timeout guard
  try {
    await withTimeout(set(ref(rtdb, `messages/${chat.id}/${msgId}`), msgPayload), 2500);
  } catch (err) {
    console.warn('RTDB write notice:', err);
  }

  // 2. Update conversation metadata in RTDB
  const isSenderA = chat.participantA === currentSenderUid;
  const updates: Record<string, any> = {
    lastMessage: previewText.slice(0, 1000),
    lastSenderId: currentSenderUid,
    updatedAt: now,
  };

  if (isSenderA) {
    updates.unreadCountA = 0;
    updates.unreadCountB = (Number(chat.unreadCountB) || 0) + 1;
  } else {
    updates.unreadCountB = 0;
    updates.unreadCountA = (Number(chat.unreadCountA) || 0) + 1;
  }

  withTimeout(update(ref(rtdb, `chats/${chat.id}`), updates), 2000).catch(() => {});

  // 3. Ensure indexing
  withTimeout(set(ref(rtdb, `user_chats/${currentSenderUid}/${chat.id}`), true), 2000).catch(() => {});
  withTimeout(set(ref(rtdb, `user_chats/${receiverId}/${chat.id}`), true), 2000).catch(() => {});

  return msgId;
}

/**
 * Subscribes to real-time messages for an active conversation from RTDB.
 */
export function subscribeRtdbMessages(
  chatId: string,
  onUpdate: (messages: ChatMessage[]) => void
): () => void {
  if (!rtdb || !chatId) {
    onUpdate([]);
    return () => {};
  }

  const messagesRef = ref(rtdb, `messages/${chatId}`);

  const unsubscribe = onValue(
    messagesRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        onUpdate([]);
        return;
      }

      const list: ChatMessage[] = [];
      snapshot.forEach((childSnap) => {
        const d = childSnap.val();
        if (d && typeof d === 'object') {
          list.push({
            id: String(d.id || childSnap.key),
            chatId: String(d.chatId || chatId),
            senderId: String(d.senderId || ''),
            receiverId: String(d.receiverId || ''),
            text: String(d.text || ''),
            status: (d.status as ChatMessage['status']) || 'sent',
            reactions: d.reactions || {},
            replyTo: d.replyTo,
            bookAttachment: d.bookAttachment,
            redCode: d.redCode,
            isForwarded: Boolean(d.isForwarded),
            isEdited: Boolean(d.isEdited),
            editedAt: d.editedAt ? toRtdbIsoString(d.editedAt) : undefined,
            isDeleted: Boolean(d.isDeleted),
            deletedAt: d.deletedAt ? toRtdbIsoString(d.deletedAt) : undefined,
            deletedForUsers: d.deletedForUsers || [],
            createdAt: toRtdbIsoString(d.createdAt),
          });
        }
      });

      // Chronological sort
      list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      onUpdate(list);
    },
    (err) => {
      console.warn('RTDB messages subscription warning for', chatId, err);
    }
  );

  return () => {
    unsubscribe();
  };
}

/**
 * Explicitly clears the unread counter for a user in a given chat in RTDB.
 */
export async function clearRtdbChatUnreadCount(
  chatId: string,
  currentUserId: string
): Promise<void> {
  if (!rtdb || !chatId || !currentUserId) return;
  try {
    const chatSnap = await withTimeout(get(ref(rtdb, `chats/${chatId}`)), 2000);
    if (chatSnap.exists()) {
      const c = chatSnap.val();
      const isA = c.participantA === currentUserId;
      await withTimeout(
        update(ref(rtdb, `chats/${chatId}`), {
          [isA ? 'unreadCountA' : 'unreadCountB']: 0,
        }),
        2000
      );
    }
  } catch (e) {
    console.warn('RTDB clear unread count error:', e);
  }
}

/**
 * Marks unread messages as read in RTDB when viewed.
 */
export async function markRtdbMessagesRead(
  chatId: string,
  currentUserId: string,
  messages: ChatMessage[]
): Promise<void> {
  if (!rtdb || !chatId || !currentUserId) return;

  const updates: Record<string, any> = {};
  let hadUnread = false;

  for (const m of messages) {
    if (m.receiverId === currentUserId && m.status !== 'read') {
      updates[`messages/${chatId}/${m.id}/status`] = 'read';
      hadUnread = true;
    }
  }

  try {
    const chatSnap = await get(ref(rtdb, `chats/${chatId}`));
    if (chatSnap.exists()) {
      const c = chatSnap.val();
      if (c.participantA === currentUserId && (Number(c.unreadCountA || 0) > 0 || hadUnread)) {
        updates[`chats/${chatId}/unreadCountA`] = 0;
      }
      if (c.participantB === currentUserId && (Number(c.unreadCountB || 0) > 0 || hadUnread)) {
        updates[`chats/${chatId}/unreadCountB`] = 0;
      }
    }
    if (Object.keys(updates).length > 0) {
      await update(ref(rtdb), updates);
    }
  } catch (e) {
    console.warn('RTDB mark read notice:', e);
  }
}

/**
 * Subscribes to all user conversations from RTDB.
 */
export function subscribeRtdbUserChats(
  userId: string,
  onUpdate: (chats: Chat[]) => void
): () => void {
  if (!rtdb || !userId) {
    onUpdate([]);
    return () => {};
  }

  const chatsRef = ref(rtdb, 'chats');

  const unsubscribe = onValue(
    chatsRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        onUpdate([]);
        return;
      }

      const list: Chat[] = [];
      snapshot.forEach((childSnap) => {
        const c = childSnap.val();
        if (c && (c.participantA === userId || c.participantB === userId)) {
          list.push({
            id: String(c.id || childSnap.key),
            participantA: String(c.participantA || ''),
            participantB: String(c.participantB || ''),
            participantAName: String(c.participantAName || 'Reader'),
            participantBName: String(c.participantBName || 'Reader'),
            participantAAvatar: String(c.participantAAvatar || ''),
            participantBAvatar: String(c.participantBAvatar || ''),
            lastMessage: String(c.lastMessage || ''),
            lastSenderId: String(c.lastSenderId || ''),
            unreadCountA: Number(c.unreadCountA || 0),
            unreadCountB: Number(c.unreadCountB || 0),
            createdAt: toRtdbIsoString(c.createdAt),
            updatedAt: toRtdbIsoString(c.updatedAt),
          });
        }
      });

      // Sort by latest message
      list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      onUpdate(list);
    },
    (err) => {
      console.warn('RTDB chats subscription warning:', err);
    }
  );

  return () => {
    unsubscribe();
  };
}

/**
 * Edits a message text in RTDB.
 */
export async function editRtdbChatMessage(
  chatId: string,
  messageId: string,
  newText: string
): Promise<void> {
  if (!rtdb) return;
  await update(ref(rtdb, `messages/${chatId}/${messageId}`), {
    text: newText.trim().slice(0, 2000),
    isEdited: true,
    editedAt: Date.now(),
  });
}

/**
 * Unsends a message in RTDB.
 */
export async function unsendRtdbChatMessage(
  chatId: string,
  messageId: string
): Promise<void> {
  if (!rtdb) return;
  await update(ref(rtdb, `messages/${chatId}/${messageId}`), {
    isDeleted: true,
    isDeletedForEveryone: true,
    text: 'This message was unsent',
    deletedAt: Date.now(),
  });
}

/**
 * Reacts to a message with an emoji in RTDB.
 */
export async function reactToRtdbChatMessage(
  chatId: string,
  messageId: string,
  userId: string,
  emoji: string
): Promise<void> {
  if (!rtdb) return;
  const msgRef = ref(rtdb, `messages/${chatId}/${messageId}`);
  const snap = await get(msgRef);
  if (!snap.exists()) return;

  const currentReactions: Record<string, string[]> = snap.val()?.reactions || {};
  const currentList = Array.isArray(currentReactions[emoji]) ? currentReactions[emoji] : [];

  let nextList: string[];
  if (currentList.includes(userId)) {
    nextList = currentList.filter((uid) => uid !== userId);
  } else {
    nextList = [...currentList, userId];
  }

  const nextReactions = { ...currentReactions, [emoji]: nextList };
  await update(msgRef, { reactions: nextReactions });
}

/**
 * Deletes a message for the current user in RTDB.
 */
export async function deleteRtdbMessageForMe(
  chatId: string,
  messageId: string,
  userId: string
): Promise<void> {
  if (!rtdb) return;
  const msgRef = ref(rtdb, `messages/${chatId}/${messageId}`);
  const snap = await get(msgRef);
  if (!snap.exists()) return;

  const currentDeleted: string[] = snap.val()?.deletedForUsers || [];
  if (!currentDeleted.includes(userId)) {
    await update(msgRef, { deletedForUsers: [...currentDeleted, userId] });
  }
}
