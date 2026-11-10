import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { db } from './firebaseConfig';
import {
  Group,
  GroupInvitation,
  GroupMessage,
  UserProfile,
  ChatMessageReply,
  ChatMessageBookAttachment,
} from '../../models/types';
import { sanitizeId } from './storageService';

/**
 * Creates a new Group with creator as admin, and sends invitations to invitees.
 */
export async function createGroup(
  name: string,
  description: string,
  avatarURL: string,
  creator: UserProfile,
  initialInvitees: UserProfile[] = []
): Promise<string> {
  const cleanName = (name || 'New Group').trim().slice(0, 100);
  const cleanDesc = (description || '').trim().slice(0, 500);
  const groupId = `grp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const groupRef = doc(db, 'groups', groupId);

  const pendingUids = initialInvitees
    .map((u) => u.uid)
    .filter((uid) => uid && uid !== creator.uid);

  const groupData: Group = {
    id: groupId,
    name: cleanName,
    description: cleanDesc,
    avatarURL: avatarURL || '',
    creatorId: creator.uid,
    creatorName: (creator.displayName || 'Reader').slice(0, 100),
    admins: [creator.uid],
    members: [creator.uid],
    pendingInvitees: pendingUids,
    lastMessage: 'Group created',
    lastSenderId: creator.uid,
    lastMessageAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await setDoc(groupRef, {
    ...groupData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Create creator member document
  await setDoc(doc(db, 'groups', groupId, 'members', creator.uid), {
    id: creator.uid,
    groupId,
    userId: creator.uid,
    userName: creator.displayName,
    userAvatar: creator.photoURL,
    role: 'creator',
    joinedAt: serverTimestamp(),
  });

  // Create invitations for invitees
  for (const invitee of initialInvitees) {
    if (invitee.uid === creator.uid) continue;
    const inviteId = `ginv_${groupId}_${invitee.uid}`;
    await setDoc(doc(db, 'groupInvitations', inviteId), {
      id: inviteId,
      groupId,
      groupName: cleanName,
      groupAvatar: avatarURL || '',
      inviterId: creator.uid,
      inviterName: creator.displayName,
      inviteeId: invitee.uid,
      inviteeName: invitee.displayName,
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Create notification
    const notifId = `notif_grp_${inviteId}`;
    await setDoc(doc(db, 'notifications', notifId), {
      id: notifId,
      recipientId: invitee.uid,
      actorId: creator.uid,
      actorName: creator.displayName,
      actorAvatar: creator.photoURL || '',
      category: 'groups',
      type: 'group_invite',
      title: 'Group Invitation',
      body: `${creator.displayName} invited you to join the group "${cleanName}"`,
      link: `/hub?tab=groups&groupId=${groupId}`,
      read: false,
      targetId: inviteId,
      actionState: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }).catch(() => {});
  }

  return groupId;
}

/**
 * Invites a user to an existing group.
 */
export async function inviteUserToGroup(
  groupId: string,
  groupName: string,
  groupAvatar: string,
  targetUser: UserProfile,
  currentUser: UserProfile
): Promise<void> {
  const groupRef = doc(db, 'groups', groupId);
  await updateDoc(groupRef, {
    pendingInvitees: arrayUnion(targetUser.uid),
    updatedAt: serverTimestamp(),
  });

  const inviteId = `ginv_${groupId}_${targetUser.uid}`;
  await setDoc(doc(db, 'groupInvitations', inviteId), {
    id: inviteId,
    groupId,
    groupName,
    groupAvatar,
    inviterId: currentUser.uid,
    inviterName: currentUser.displayName,
    inviteeId: targetUser.uid,
    inviteeName: targetUser.displayName,
    status: 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const notifId = `notif_grp_${inviteId}`;
  await setDoc(doc(db, 'notifications', notifId), {
    id: notifId,
    recipientId: targetUser.uid,
    actorId: currentUser.uid,
    actorName: currentUser.displayName,
    actorAvatar: currentUser.photoURL || '',
    category: 'groups',
    type: 'group_invite',
    title: 'Group Invitation',
    body: `${currentUser.displayName} invited you to join "${groupName}"`,
    link: `/hub?tab=groups&groupId=${groupId}`,
    read: false,
    targetId: inviteId,
    actionState: 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }).catch(() => {});
}

/**
 * Accepts a group invitation.
 */
export async function acceptGroupInvitation(
  invitationId: string,
  groupId: string,
  user: UserProfile
): Promise<void> {
  const groupRef = doc(db, 'groups', groupId);
  const inviteRef = doc(db, 'groupInvitations', invitationId);

  await updateDoc(groupRef, {
    members: arrayUnion(user.uid),
    pendingInvitees: arrayRemove(user.uid),
    updatedAt: serverTimestamp(),
  });

  await updateDoc(inviteRef, {
    status: 'accepted',
    updatedAt: serverTimestamp(),
  });

  await setDoc(doc(db, 'groups', groupId, 'members', user.uid), {
    id: user.uid,
    groupId,
    userId: user.uid,
    userName: user.displayName,
    userAvatar: user.photoURL,
    role: 'member',
    joinedAt: serverTimestamp(),
  });
}

/**
 * Declines a group invitation.
 */
export async function declineGroupInvitation(
  invitationId: string,
  groupId: string,
  userId: string
): Promise<void> {
  const groupRef = doc(db, 'groups', groupId);
  const inviteRef = doc(db, 'groupInvitations', invitationId);

  await updateDoc(groupRef, {
    pendingInvitees: arrayRemove(userId),
    updatedAt: serverTimestamp(),
  });

  await updateDoc(inviteRef, {
    status: 'declined',
    updatedAt: serverTimestamp(),
  });
}

/**
 * Leaves a group.
 */
export async function leaveGroup(groupId: string, userId: string): Promise<void> {
  const groupRef = doc(db, 'groups', groupId);
  await updateDoc(groupRef, {
    members: arrayRemove(userId),
    admins: arrayRemove(userId),
    updatedAt: serverTimestamp(),
  });
  await deleteDoc(doc(db, 'groups', groupId, 'members', userId));
}

/**
 * Removes a member from a group (Admin only).
 */
export async function removeGroupMember(
  groupId: string,
  memberId: string
): Promise<void> {
  const groupRef = doc(db, 'groups', groupId);
  await updateDoc(groupRef, {
    members: arrayRemove(memberId),
    admins: arrayRemove(memberId),
    updatedAt: serverTimestamp(),
  });
  await deleteDoc(doc(db, 'groups', groupId, 'members', memberId));
}

/**
 * Sends a message in a group.
 */
export async function sendGroupMessage(
  groupId: string,
  sender: UserProfile,
  text: string,
  options?: {
    replyTo?: ChatMessageReply;
    attachmentType?: 'none' | 'image' | 'file' | 'book' | 'redcode';
    bookAttachment?: ChatMessageBookAttachment;
    isForwarded?: boolean;
    forwardedFrom?: string;
  }
): Promise<string> {
  const msgId = `gmsg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const msgRef = doc(db, 'groups', groupId, 'messages', msgId);

  const cleanText = (text || '').trim().slice(0, 3000);

  const payload: any = {
    id: msgId,
    groupId,
    senderId: sender.uid,
    senderName: sender.displayName.slice(0, 100),
    senderAvatar: sender.photoURL || '',
    text: cleanText,
    createdAt: serverTimestamp(),
  };

  if (options?.replyTo && options.replyTo.id) {
    payload.replyTo = {
      id: String(options.replyTo.id || ''),
      text: String(options.replyTo.text || 'Message').slice(0, 500),
      senderName: String(options.replyTo.senderName || 'Reader').slice(0, 100),
      senderId: String(options.replyTo.senderId || '').slice(0, 128),
    };
  }
  if (options?.attachmentType && options.attachmentType !== 'none') {
    payload.attachmentType = options.attachmentType;
  }
  if (options?.bookAttachment) {
    payload.bookAttachment = options.bookAttachment;
  }
  if (options?.isForwarded) {
    payload.isForwarded = true;
    payload.forwardedFrom = options.forwardedFrom || '';
  }

  await setDoc(msgRef, payload);

  let preview = cleanText;
  if (options?.bookAttachment) {
    preview = `📚 Shared book: ${options.bookAttachment.title}`;
  }

  await updateDoc(doc(db, 'groups', groupId), {
    lastMessage: preview.slice(0, 200),
    lastSenderId: sender.uid,
    lastMessageAt: new Date().toISOString(),
    updatedAt: serverTimestamp(),
  });

  return msgId;
}

/**
 * Toggles an emoji reaction on a group message.
 */
export async function reactToGroupMessage(
  groupId: string,
  messageId: string,
  userId: string,
  emoji: string
): Promise<void> {
  if (!groupId || !messageId || !userId || !emoji) return;
  const msgRef = doc(db, 'groups', groupId, 'messages', messageId);
  const snap = await getDoc(msgRef);
  if (!snap.exists()) return;
  const currentReactions: Record<string, string[]> = snap.data().reactions || {};
  const currentList = Array.isArray(currentReactions[emoji]) ? currentReactions[emoji] : [];
  let nextList: string[];
  if (currentList.includes(userId)) {
    nextList = currentList.filter((u) => u !== userId);
  } else {
    nextList = [...currentList, userId];
  }
  const nextReactions = { ...currentReactions, [emoji]: nextList };
  await updateDoc(msgRef, { reactions: nextReactions });
}
