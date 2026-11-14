import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  MessageSquare,
  BookMarked,
  Users,
  History,
  Send,
  Trash2,
  Check,
  X,
  Ban,
  BookOpen,
  Star,
  UserPlus,
  Search,
  Plus,
  ArrowLeft,
  MoreVertical,
  Smile,
  Paperclip,
  Image as ImageIcon,
  FileText,
  CheckCheck,
  Clock,
  AlertCircle,
  RotateCcw,
  ExternalLink,
  Bookmark,
  Lock,
  Globe,
  UserCheck,
  UserMinus,
  Flag,
  ChevronRight,
  Loader2,
  Copy,
  Edit3,
} from 'lucide-react';
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../services/firebase/firebaseConfig';
import { toIsoString } from '../services/firebase/storageService';
import { useRedcover } from '../contexts/RedcoverContext';
import { Book, Chapter, Chat, ChatMessage, Friendship, GroupMessage, UserProfile } from '../models/types';
import { BookCover, EmptyState, UserAvatar } from '../components/common/UIPrimitives';
import { ChatView } from '../components/chat/ChatView';
import { ConversationList } from '../components/chat/ConversationList';
import { SocialHubTab } from '../components/social/SocialHubTab';
import { GroupChatView } from '../components/groups/GroupChatView';
import { CreateGroupModal } from '../components/groups/CreateGroupModal';
import { SharedReadingSessionView } from '../components/reading/SharedReadingSessionView';

interface ParsedAttachment {
  type: 'image' | 'file' | 'book';
  label: string;
  url: string;
  extra?: string;
  caption: string;
}

function parseMessageContent(rawText: string): {
  attachment: ParsedAttachment | null;
  cleanText: string;
} {
  const trimmed = (rawText || '').trim();
  const match = trimmed.match(/^\[attachment:(image|file|book):([^\]]+)\]\s*([\s\S]*)$/i);
  if (!match) {
    return { attachment: null, cleanText: rawText };
  }
  const type = match[1].toLowerCase() as 'image' | 'file' | 'book';
  const payload = match[2];
  const caption = (match[3] || '').trim();

  if (type === 'book') {
    const [bookId = '', bookTitle = 'Book', bookCover = ''] = payload.split('|');
    return {
      attachment: {
        type: 'book',
        label: bookTitle,
        url: bookId,
        extra: bookCover,
        caption,
      },
      cleanText: caption,
    };
  }

  const pipeIdx = payload.indexOf('|');
  const fileName = pipeIdx >= 0 ? payload.slice(0, pipeIdx) : 'Attachment';
  const downloadUrl = pipeIdx >= 0 ? payload.slice(pipeIdx + 1) : payload;
  return {
    attachment: {
      type,
      label: fileName,
      url: downloadUrl,
      caption,
    },
    cleanText: caption,
  };
}

function formatConversationPreview(lastMessage: string): string {
  if (!lastMessage) return 'No messages yet';
  const { attachment, cleanText } = parseMessageContent(lastMessage);
  if (attachment) {
    if (attachment.type === 'image') return cleanText ? `📷 ${cleanText}` : '📷 Photo';
    if (attachment.type === 'file') return cleanText ? `📎 ${cleanText}` : `📎 ${attachment.label}`;
    if (attachment.type === 'book') return `📚 ${attachment.label}`;
  }
  return lastMessage;
}

function formatRelativeChatTime(iso: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Now';
  if (diffMins < 60) return `${diffMins}m`;
  const isSameDay =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();
  if (isSameDay) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();
  if (isYesterday) return 'Yesterday';
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatDateSeparator(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Recent';
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();
  if (isToday) return 'Today';

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();
  if (isYesterday) return 'Yesterday';

  return date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

const QUICK_EMOJIS = [
  '😊',
  '📚',
  '🔥',
  '❤️',
  '👏',
  '✨',
  '🙌',
  '🤔',
  '🎉',
  '💡',
  '☕',
  '🌟',
  '👍',
  '😍',
  '🤩',
  '💬',
];

interface ViewedBookRecord {
  bookId: string;
  viewedAt: string;
}

export const HubPage: React.FC = () => {
  const { firebaseUser, currentUser } = useRedcover();

  if (!firebaseUser || !currentUser) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <EmptyState
          title="Sign In to Use Hub"
          description="Message readers, manage your books, and view your reading activity."
          actionLabel="Sign In"
          actionTo="/auth"
        />
      </div>
    );
  }

  return <AuthenticatedHubPage firebaseUser={firebaseUser} currentUser={currentUser} />;
};

const AuthenticatedHubPage: React.FC<{
  firebaseUser: NonNullable<ReturnType<typeof useRedcover>['firebaseUser']>;
  currentUser: UserProfile;
}> = ({ firebaseUser, currentUser }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    isAdmin,
    books,
    users,
    reviews,
    readingProgress,
    savedBooks,
    follows,
    friendships,
    chats,
    groups,
    groupInvitations,
    readingSessions,
    readingInvitations,
    addToast,
    toggleSaveBook,
    deleteBook,
    updateUserProfile,
    toggleFollowUser,
    sendFriendRequest,
    updateFriendshipStatus,
    cancelFriendRequest,
    removeFriendship,
    blockUser,
    startOrGetChat,
    clearChatUnreadCount,
    deleteChat,
    setChatNickname,
    sendChatMessage,
    reactToChatMessage,
    editChatMessage,
    unsendChatMessage,
    deleteMessageForMe,
    submitReport,
    acceptedFriends,
    createGroup,
    inviteUserToGroup,
    acceptGroupInvitation,
    declineGroupInvitation,
    leaveGroup,
    removeGroupMember,
    sendGroupMessage,
    reactToGroupMessage,
    forwardChatMessage,
    inviteToReadTogether,
  } = useRedcover();

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState<boolean>(false);

  const myGroups = useMemo(() => {
    if (!currentUser) return [];
    return groups.filter(
      (g) => g.creatorId === currentUser.uid || g.members?.includes(currentUser.uid)
    );
  }, [groups, currentUser]);

  const activeGroup = useMemo(
    () => myGroups.find((g) => g.id === selectedGroupId) || (myGroups.length > 0 ? myGroups[0] : null),
    [myGroups, selectedGroupId]
  );

  const activeReadingSession = useMemo(() => {
    const sessionId = searchParams.get('sessionId');
    if (sessionId) return readingSessions.find((s) => s.id === sessionId) || null;
    return readingSessions.find((s) => s.status === 'active') || null;
  }, [readingSessions, searchParams]);

  const [groupMessages, setGroupMessages] = useState<GroupMessage[]>([]);
  useEffect(() => {
    if (!activeGroup) {
      setGroupMessages([]);
      return;
    }
    const q = query(collection(db, 'groups', activeGroup.id, 'messages'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: GroupMessage[] = snap.docs
          .map((d) => ({
            id: d.id,
            groupId: activeGroup.id,
            senderId: String(d.data().senderId || ''),
            senderName: String(d.data().senderName || 'Reader'),
            senderAvatar: String(d.data().senderAvatar || ''),
            text: String(d.data().text || ''),
            reactions: d.data().reactions || {},
            replyTo: d.data().replyTo,
            attachmentType: d.data().attachmentType,
            bookAttachment: d.data().bookAttachment,
            isForwarded: Boolean(d.data().isForwarded),
            forwardedFrom: d.data().forwardedFrom,
            createdAt: toIsoString(d.data().createdAt),
          }))
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        setGroupMessages(list);
      },
      () => setGroupMessages([])
    );
    return () => unsub();
  }, [activeGroup?.id]);

  const [sessionChapters, setSessionChapters] = useState<Chapter[]>([]);
  useEffect(() => {
    if (!activeReadingSession) {
      setSessionChapters([]);
      return;
    }
    const unsub = onSnapshot(
      collection(db, 'books', activeReadingSession.bookId, 'chapters'),
      (snap) => {
        const list: Chapter[] = snap.docs
          .map((d) => ({
            id: d.id,
            bookId: activeReadingSession.bookId,
            authorId: String(d.data().authorId || ''),
            bookStatus: (d.data().bookStatus || 'published') as any,
            chapterNumber: Number(d.data().chapterNumber || d.data().order || 1),
            title: String(d.data().title || `Chapter ${d.data().chapterNumber || d.data().order || 1}`),
            content: String(d.data().content || ''),
            createdAt: toIsoString(d.data().createdAt),
            updatedAt: toIsoString(d.data().updatedAt || d.data().createdAt),
          }))
          .sort((a, b) => a.chapterNumber - b.chapterNumber);
        setSessionChapters(list);
      },
      () => setSessionChapters([])
    );
    return () => unsub();
  }, [activeReadingSession?.bookId]);

  const activeHubSection = useMemo(() => {
    if (location.pathname.includes('/hub/groups')) return 'groups';
    if (location.pathname.includes('/hub/reading')) return 'reading';
    if (location.pathname.includes('/hub/books')) return 'books';
    if (location.pathname.includes('/hub/social')) return 'social';
    if (location.pathname.includes('/hub/history')) return 'history';
    return 'chats';
  }, [location.pathname]);

  // Sub-navigation states
  const [booksSubTab, setBooksSubTab] = useState<
    'uploads' | 'saved' | 'reviewed' | 'drafts' | 'published'
  >('uploads');
  const [booksSearchQuery, setBooksSearchQuery] = useState('');

  const [socialSubTab, setSocialSubTab] = useState<
    'friends' | 'requests' | 'sent' | 'followers' | 'following' | 'blocked'
  >('friends');
  const [socialSearchQuery, setSocialSearchQuery] = useState('');

  const [historySubTab, setHistorySubTab] = useState<
    'recently_read' | 'recently_viewed' | 'reading_activity'
  >('recently_read');
  const [historySearchQuery, setHistorySearchQuery] = useState('');

  // Direct Chats states
  const [selectedChatId, setSelectedChatId] = useState<string | null>(
    searchParams.get('chatId')
  );
  const [mobileChatView, setMobileChatView] = useState<'list' | 'chat'>(
    searchParams.get('chatId') ? 'chat' : 'list'
  );
  const [chatFilter, setChatFilter] = useState<'all' | 'unread' | 'friends'>('all');
  const [conversationSearch, setConversationSearch] = useState('');
  const [visibleChatsCount, setVisibleChatsCount] = useState(25);

  // Active Chat Messages & Composer states
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [visibleMessagesCount, setVisibleMessagesCount] = useState(40);
  const [firstUnreadMessageId, setFirstUnreadMessageId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [failedMessageText, setFailedMessageText] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showBookShareModal, setShowBookShareModal] = useState(false);
  const [bookShareSearch, setBookShareSearch] = useState('');
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<{
    type: 'image' | 'file' | 'book';
    label: string;
    url: string;
    extra?: string;
  } | null>(null);
  const [showChatMoreMenu, setShowChatMoreMenu] = useState(false);
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);

  // Nickname & Delete Chat Modal states
  const [nicknameModal, setNicknameModal] = useState<{
    chatId: string;
    partnerUid: string;
    partnerName: string;
    currentNickname: string;
  } | null>(null);
  const [nicknameInput, setNicknameInput] = useState('');
  const [deleteConfirmChat, setDeleteConfirmChat] = useState<{
    chatId: string;
    partnerName: string;
  } | null>(null);
  const [activeCardMenuId, setActiveCardMenuId] = useState<string | null>(null);

  // New Chat Modal states
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [newChatSearchQuery, setNewChatSearchQuery] = useState('');
  const [startingChatWithUid, setStartingChatWithUid] = useState<string | null>(null);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Sync URL `chatId` param with selected chat
  useEffect(() => {
    const paramId = searchParams.get('chatId');
    if (paramId) {
      setSelectedChatId(paramId);
      setMobileChatView('chat');
    } else {
      // If URL does not have chatId, only revert on mobile if user explicitly cleared it
      setMobileChatView('list');
    }
  }, [searchParams]);

  // Set default chat for desktop/tablet dual-pane mode when conversations load
  useEffect(() => {
    if (!selectedChatId && chats.length > 0) {
      setSelectedChatId(chats[0].id);
    }
  }, [chats, selectedChatId]);

  const activeChat = useMemo(() => {
    if (!selectedChatId) return null;
    const directMatch = chats.find((c) => c.id === selectedChatId);
    if (directMatch) return directMatch;

    // Check participant match (e.g. if selectedChatId is chat_uidA_uidB or user id)
    const participantMatch = chats.find((c) => {
      if (selectedChatId.startsWith('chat_')) {
        return (
          selectedChatId.includes(c.participantA) &&
          selectedChatId.includes(c.participantB)
        );
      }
      return (
        c.participantA === selectedChatId || c.participantB === selectedChatId
      );
    });
    if (participantMatch) return participantMatch;

    // Synthetic fallback chat if selectedChatId is a deterministically formatted chat or user id
    if (currentUser && selectedChatId.startsWith('chat_')) {
      const parts = selectedChatId.replace('chat_', '').split('_');
      if (parts.length >= 2) {
        const partnerUid = parts[0] === currentUser.uid ? parts[1] : parts[0];
        const partnerUser = users.find((u) => u.uid === partnerUid);
        return {
          id: selectedChatId,
          participantA: currentUser.uid,
          participantB: partnerUid,
          participantAName: currentUser.displayName,
          participantBName: partnerUser?.displayName || 'Reader',
          participantAAvatar: currentUser.photoURL || '',
          participantBAvatar: partnerUser?.photoURL || '',
          lastMessage: 'Conversation started',
          lastSenderId: currentUser.uid,
          unreadCountA: 0,
          unreadCountB: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as Chat;
      }
    }
    return null;
  }, [chats, selectedChatId, currentUser, users]);

  // Reset pagination & popovers when switching conversations
  useEffect(() => {
    setVisibleMessagesCount(40);
    setFirstUnreadMessageId(null);
    setShowEmojiPicker(false);
    setShowAttachMenu(false);
    setShowChatMoreMenu(false);
  }, [activeChat?.id]);

  // Instantly clear unread whenever active chat receives messages while viewing
  useEffect(() => {
    if (!firebaseUser || !activeChat) return;
    const isA = activeChat.participantA === firebaseUser.uid;
    const currentUnread = isA ? (activeChat.unreadCountA || 0) : (activeChat.unreadCountB || 0);
    if (currentUnread > 0) {
      clearChatUnreadCount(activeChat.id);
    }
  }, [firebaseUser?.uid, activeChat, clearChatUnreadCount]);

  // Also clear unread whenever new messages arrive in the active view
  useEffect(() => {
    if (!firebaseUser || !activeChat?.id || messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg && lastMsg.senderId !== firebaseUser.uid) {
      clearChatUnreadCount(activeChat.id);
    }
  }, [firebaseUser?.uid, activeChat?.id, messages, clearChatUnreadCount]);

  // Authoritative real-time messages listener for the active chat
  useEffect(() => {
    if (!firebaseUser || !activeChat) {
      setMessages([]);
      setMessagesLoading(false);
      return;
    }

    const currentChatId = activeChat.id;
    const cacheKey = `rc_chat_msgs_${currentChatId}`;
    let cachedList: ChatMessage[] = [];
    try {
      const raw = localStorage.getItem(cacheKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          // Strictly isolate: only include messages that belong to this chat
          cachedList = parsed.filter(
            (m) => m.chatId === currentChatId && !m.id?.startsWith('msg_opt_')
          );
        }
      }
    } catch {}

    // Immediately isolate message state to this conversation
    setMessages(cachedList);
    setMessagesLoading(cachedList.length === 0);

    // Merge the Firestore messages with the local cache without flickering.
    const mergeIncomingMessages = (incomingList: ChatMessage[]) => {
      if (!incomingList || incomingList.length === 0) return;
      const validIncoming = incomingList.filter((m) => m.chatId === currentChatId);
      if (validIncoming.length === 0) return;

      setMessages((prev) => {
        const map = new Map<string, ChatMessage>();
        // Only keep messages belonging to this current chat
        for (const m of prev) {
          if (m.chatId === currentChatId) {
            map.set(m.id, m);
          }
        }
        for (const m of validIncoming) {
          const existing = map.get(m.id);
          if (existing) {
            map.set(m.id, {
              ...existing,
              ...m,
              reactions:
                m.reactions && Object.keys(m.reactions).length > 0
                  ? m.reactions
                  : existing.reactions,
              replyTo: m.replyTo || existing.replyTo,
              status: m.status !== 'sending' ? m.status : existing.status,
            });
          } else {
            map.set(m.id, m);
          }
        }
         const merged = Array.from(map.values()).sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        try {
           localStorage.setItem(cacheKey, JSON.stringify(merged.slice(-100)));
        } catch {}
         return merged.slice(-100);
      });
      setMessagesLoading(false);
    };

    // Keep list queries constrained to the signed-in participant so Firestore
    // security rules can authorize each query without treating rules as filters.
    const mapMessages = (snap: any): ChatMessage[] => snap.docs.map((d: any) => {
      const raw = d.data();
      return {
        id: d.id,
        chatId: String(raw.chatId || currentChatId),
        senderId: String(raw.senderId || ''),
        receiverId: String(raw.receiverId || ''),
        text: String(raw.text || ''),
        status: (raw.status as ChatMessage['status']) || 'sent',
        reactions: raw.reactions || {},
        replyTo: raw.replyTo,
        bookAttachment: raw.bookAttachment,
        redCode: raw.redCode,
        isForwarded: Boolean(raw.isForwarded),
        isEdited: Boolean(raw.isEdited),
        editedAt: raw.editedAt ? toIsoString(raw.editedAt) : undefined,
        isDeleted: Boolean(raw.isDeleted),
        deletedAt: raw.deletedAt ? toIsoString(raw.deletedAt) : undefined,
        deletedForUsers: raw.deletedForUsers || [],
        createdAt: toIsoString(raw.createdAt),
      };
    });
    const handleMessageError = (err: unknown) => {
      console.warn('Firestore chat subscription notice for', currentChatId, err);
      setMessagesLoading(false);
    };
    const handleSentMessages = (snap: any) => {
      mergeIncomingMessages(mapMessages(snap));
      setMessagesLoading(false);
    };
    const handleReceivedMessages = (snap: any) => {
      const received = mapMessages(snap);
      mergeIncomingMessages(received);
      setMessagesLoading(false);
      const firstUnread = received.find((m) => m.status !== 'read');
      if (firstUnread) setFirstUnreadMessageId((prev) => prev || firstUnread.id);

      snap.docs.forEach((d: any) => {
        if (d.data().status !== 'read') {
          updateDoc(doc(db, 'chats', currentChatId, 'messages', d.id), {
            status: 'read',
          }).catch(() => {});
        }
      });
    };

    const messagesRef = collection(db, 'chats', currentChatId, 'messages');
    const unsubSent = onSnapshot(
      query(messagesRef, where('senderId', '==', firebaseUser.uid), orderBy('createdAt', 'desc'), limit(100)),
      handleSentMessages,
      handleMessageError
    );
    const unsubReceived = onSnapshot(
      query(messagesRef, where('receiverId', '==', firebaseUser.uid), orderBy('createdAt', 'desc'), limit(100)),
      handleReceivedMessages,
      handleMessageError
    );

    return () => {
      unsubSent();
      unsubReceived();
      setMessages([]);
    };
  }, [firebaseUser?.uid, activeChat?.id]);

  // Auto-scroll to latest message when new messages arrive
  useEffect(() => {
    if (!messages.length) return;
    const timer = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 50);
    return () => clearTimeout(timer);
  }, [messages.length, activeChat?.id]);

  // Viewed books for History -> Recently Viewed
  const viewedBookRecords = useMemo<ViewedBookRecord[]>(() => {
    if (!firebaseUser) return [];
    try {
      const raw = localStorage.getItem(`rc_viewed_books_${firebaseUser.uid}`);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [firebaseUser, readingProgress.length, books.length]);

  if (!firebaseUser || !currentUser) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <EmptyState
          title="Sign In to Use Hub"
          description="Message readers, manage your books, and view your reading activity."
          actionLabel="Sign In"
          actionTo="/auth"
        />
      </div>
    );
  }

  // Relationship Sets
  const savedSet = new Set(savedBooks.map((s) => s.bookId));
  const followingIds = new Set(
    follows.filter((f) => f.followerId === currentUser.uid).map((f) => f.followingId)
  );
  const followerIds = new Set(
    follows.filter((f) => f.followingId === currentUser.uid).map((f) => f.followerId)
  );

  const acceptedFriendships = friendships.filter((f) => f.status === 'accepted');
  const friendUidSet = new Set(
    acceptedFriendships.map((f) =>
      f.requesterId === currentUser.uid ? f.receiverId : f.requesterId
    )
  );
  const incomingRequests = friendships.filter(
    (f) => f.status === 'pending' && f.receiverId === currentUser.uid
  );
  const sentRequests = friendships.filter(
    (f) => f.status === 'pending' && f.requesterId === currentUser.uid
  );
  const blockedRelationships = friendships.filter((f) => f.status === 'blocked');
  const blockedByMeSet = new Set(
    blockedRelationships
      .filter((f) => f.requesterId === currentUser.uid)
      .map((f) => f.receiverId)
  );
  const blockedMeSet = new Set(
    blockedRelationships
      .filter((f) => f.receiverId === currentUser.uid)
      .map((f) => f.requesterId)
  );

  const getChatPartner = (chat: Chat): {
    uid: string;
    displayName: string;
    nickname: string;
    originalName: string;
    username: string;
    photoURL: string;
    bio: string;
    isOnline: boolean;
    showOnlineStatus: boolean;
    userObj: UserProfile | null;
  } => {
    const isA = chat.participantA === currentUser.uid;
    const partnerId = isA ? chat.participantB : chat.participantA;
    const fallbackName = isA ? chat.participantBName : chat.participantAName;
    const fallbackAvatar = isA ? chat.participantBAvatar : chat.participantAAvatar;
    const foundUser = users.find((u) => u.uid === partnerId) || null;
    const baseDisplayName = foundUser?.displayName || fallbackName || 'Redcover Reader';
    const username =
      foundUser?.username ||
      baseDisplayName.toLowerCase().replace(/[^a-z0-9]/g, '') ||
      'reader';
    const photoURL = foundUser?.photoURL || fallbackAvatar || '';
    const bio = foundUser?.bio || '';
    const isOnline = Boolean(foundUser?.isOnline && foundUser.showOnlineStatus !== false);

    // Nickname support (per-user custom alias)
    const localNick = currentUser ? localStorage.getItem(`rc_nick_${currentUser.uid}_${partnerId}`) : null;
    const remoteNick = (chat as any).nicknames?.[currentUser.uid];
    const nickname = (localNick || remoteNick || '').trim();
    const effectiveDisplayName = nickname || baseDisplayName;

    return {
      uid: partnerId,
      displayName: effectiveDisplayName,
      nickname,
      originalName: baseDisplayName,
      username,
      photoURL,
      bio,
      isOnline,
      showOnlineStatus: foundUser?.showOnlineStatus ?? true,
      userObj: foundUser
        ? { ...foundUser, displayName: effectiveDisplayName }
        : {
            uid: partnerId,
            displayName: effectiveDisplayName,
            username,
            photoURL,
            coverURL: '',
            bio,
            role: 'user',
            membershipPlan: 'free',
            followersCount: 0,
            followingCount: 0,
            booksCount: 0,
            streakDays: 0,
            points: 0,
            isOnline,
            showOnlineStatus: true,
            publicActivity: true,
            createdAt: chat.updatedAt,
            updatedAt: chat.updatedAt,
          },
    };
  };

  const getUserRelationship = (targetUid: string): {
    friendship: Friendship | undefined;
    isFriend: boolean;
    isIncomingPending: boolean;
    isSentPending: boolean;
    isBlockedByMe: boolean;
    hasBlockedMe: boolean;
    isFollowing: boolean;
    followsMe: boolean;
  } => {
    const friendship = friendships.find(
      (f) =>
        (f.requesterId === currentUser.uid && f.receiverId === targetUid) ||
        (f.requesterId === targetUid && f.receiverId === currentUser.uid)
    );
    return {
      friendship,
      isFriend: friendship?.status === 'accepted',
      isIncomingPending:
        friendship?.status === 'pending' && friendship.receiverId === currentUser.uid,
      isSentPending:
        friendship?.status === 'pending' && friendship.requesterId === currentUser.uid,
      isBlockedByMe: blockedByMeSet.has(targetUid),
      hasBlockedMe: blockedMeSet.has(targetUid),
      isFollowing: followingIds.has(targetUid),
      followsMe: followerIds.has(targetUid),
    };
  };

  const activePartner = activeChat ? getChatPartner(activeChat) : null;
  const activePartnerRel = activePartner ? getUserRelationship(activePartner.uid) : null;

  const deduplicatedChats = useMemo(() => {
    const map = new Map<string, Chat>();
    const sorted = [...chats].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
    sorted.forEach((c) => {
      const partner = getChatPartner(c);
      // Strict friend check: If not an accepted friend, exclude from conversation list
      if (!friendUidSet.has(partner.uid)) return;

      if (!map.has(partner.uid)) {
        // Clone object to safely mutate in useMemo without touching raw state
        map.set(partner.uid, { ...c });
      } else {
        const existing = map.get(partner.uid)!;
        const isA = c.participantA === currentUser.uid;
        const unread = isA ? c.unreadCountA : c.unreadCountB;
        if (unread > 0) {
          const exIsA = existing.participantA === currentUser.uid;
          if (exIsA) existing.unreadCountA += unread;
          else existing.unreadCountB += unread;
        }
      }
    });
    return Array.from(map.values());
  }, [chats, users, currentUser?.uid, friendUidSet]);

  const totalUnreadChats = useMemo(() => {
    return deduplicatedChats.reduce((acc, c) => {
      const partner = getChatPartner(c);
      // Never count unread from the currently active conversation!
      if (activePartner && partner.uid === activePartner.uid) return acc;
      if (activeChat && c.id === activeChat.id) return acc;
      const unread = c.participantA === currentUser.uid ? c.unreadCountA : c.unreadCountB;
      return acc + (unread > 0 ? 1 : 0);
    }, 0);
  }, [deduplicatedChats, activePartner, activeChat, currentUser.uid]);

  const filteredChats = useMemo(() => {
    const q = conversationSearch.trim().toLowerCase();
    return deduplicatedChats.filter((chat) => {
      const partner = getChatPartner(chat);
      const isCurrentlyOpen = activePartner && partner.uid === activePartner.uid;
      const rawUnread =
        chat.participantA === currentUser.uid ? chat.unreadCountA : chat.unreadCountB;
      const unread = isCurrentlyOpen ? 0 : rawUnread;
      if (chatFilter === 'unread' && unread <= 0) return false;
      if (chatFilter === 'friends' && !friendUidSet.has(partner.uid)) return false;
      if (!q) return true;
      return (
        partner.displayName.toLowerCase().includes(q) ||
        partner.username.toLowerCase().includes(q) ||
        (chat.lastMessage || '').toLowerCase().includes(q)
      );
    });
  }, [deduplicatedChats, conversationSearch, chatFilter, friendUidSet, activePartner, currentUser.uid]);

  const displayedChats = filteredChats.slice(0, visibleChatsCount);

  const newChatUsers = useMemo(() => {
    const q = newChatSearchQuery.trim().toLowerCase();
    // Strictly friends only for starting new direct conversations
    const friendUsers = users.filter((u) => u.uid !== currentUser.uid && friendUidSet.has(u.uid));
    const sorted = [...friendUsers].sort((a, b) => (b.followersCount || 0) - (a.followersCount || 0));
    if (!q) return sorted.slice(0, 30);
    return sorted.filter(
      (u) =>
        u.displayName.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q)
    );
  }, [users, currentUser.uid, newChatSearchQuery, friendUidSet]);

  const handleSelectConversation = (chatId: string) => {
    setSelectedChatId(chatId);
    setMobileChatView('chat');
    setSearchParams({ chatId });
    clearChatUnreadCount(chatId);
  };

  const handleStartConversationWithUser = async (targetUser: UserProfile) => {
    const rel = getUserRelationship(targetUser.uid);
    if (rel.isBlockedByMe) {
      addToast('Unblock this user first to start a chat.', 'info');
      return;
    }
    if (rel.hasBlockedMe) {
      addToast('Cannot message this user.', 'error');
      return;
    }
    setStartingChatWithUid(targetUser.uid);
    try {
      const chatId = await startOrGetChat(targetUser);
      if (chatId) {
        setShowNewChatModal(false);
        setNewChatSearchQuery('');
        handleSelectConversation(chatId);
      }
    } catch (err: any) {
      addToast(err?.message || 'Could not start chat.', 'error');
    } finally {
      setStartingChatWithUid(null);
    }
  };

  const handleFileSelected = async (
    e: React.ChangeEvent<HTMLInputElement>,
    attachmentType: 'image' | 'file'
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !activeChat) return;

    const maxBytes = 10 * 1024 * 1024;
    if (file.size > maxBytes) {
      addToast('Maximum file size is 10MB.', 'error');
      return;
    }
    if (attachmentType === 'image' && !file.type.startsWith('image/')) {
      addToast('Please select a valid image file.', 'error');
      return;
    }

    setUploadingAttachment(true);
    setShowAttachMenu(false);
    try {
      const { uploadFileToRedcoverStorage } = await import('../services/firebase/storageService');
      const downloadUrl = await uploadFileToRedcoverStorage(
        'chat_attachments',
        activeChat.id,
        file
      );

      setPendingAttachment({
        type: attachmentType,
        label: file.name,
        url: downloadUrl,
      });
      textareaRef.current?.focus();
    } catch {
      addToast('Upload failed.', 'error');
    } finally {
      setUploadingAttachment(false);
    }
  };

  const handleSendMessage = async (overrideText?: string) => {
    if (!activeChat || sendingMessage) return;

    if (activePartnerRel?.isBlockedByMe || activePartnerRel?.hasBlockedMe) {
      addToast('Messaging is unavailable for this conversation.', 'error');
      return;
    }

    const baseText = (overrideText !== undefined ? overrideText : messageInput).trim();
    if (!baseText && !pendingAttachment) return;

    let composedPayload = baseText;
    if (pendingAttachment) {
      if (pendingAttachment.type === 'book') {
        composedPayload = `[attachment:book:${pendingAttachment.url}|${pendingAttachment.label}|${pendingAttachment.extra || ''}] ${baseText}`.trim();
      } else {
        composedPayload = `[attachment:${pendingAttachment.type}:${pendingAttachment.label}|${pendingAttachment.url}] ${baseText}`.trim();
      }
    }

    if (composedPayload.length > 1950) {
      composedPayload = composedPayload.slice(0, 1950);
    }

    setSendingMessage(true);
    setFailedMessageText(null);
    if (overrideText === undefined) setMessageInput('');
    const previousAttachment = pendingAttachment;
    setPendingAttachment(null);
    setShowEmojiPicker(false);

    try {
      await sendChatMessage(activeChat, composedPayload);
    } catch {
      setFailedMessageText(composedPayload);
      if (previousAttachment) setPendingAttachment(previousAttachment);
    } finally {
      setSendingMessage(false);
    }
  };

  const handleComposerKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleDeleteMessage = async (msg: ChatMessage) => {
    if (!activeChat) return;
    if (!isAdmin && msg.senderId !== currentUser.uid) return;
    try {
      await deleteDoc(doc(db, 'chats', activeChat.id, 'messages', msg.id));
    } catch {
      addToast('Cannot delete message.', 'info');
    }
  };

  // Books Data
  const myUploadedBooks = useMemo(
    () => books.filter((b) => b.authorId === currentUser.uid),
    [books, currentUser.uid]
  );
  const myDraftBooks = useMemo(
    () => myUploadedBooks.filter((b) => b.status === 'draft'),
    [myUploadedBooks]
  );
  const myPublishedBooks = useMemo(
    () => myUploadedBooks.filter((b) => b.status === 'published'),
    [myUploadedBooks]
  );
  const mySavedBookObjects = useMemo(
    () => books.filter((b) => savedSet.has(b.id)),
    [books, savedBooks]
  );
  const myReviews = useMemo(
    () => reviews.filter((r) => r.userId === currentUser.uid),
    [reviews, currentUser.uid]
  );

  const progressByBookId = useMemo(() => {
    const map = new Map<string, (typeof readingProgress)[number]>();
    readingProgress.forEach((p) => map.set(p.bookId, p));
    return map;
  }, [readingProgress]);

  // History Data
  const recentlyReadItems = useMemo(() => {
    return [...readingProgress]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .map((prog) => {
        const book = books.find((b) => b.id === prog.bookId);
        return book ? { book, progress: prog, accessedAt: prog.updatedAt } : null;
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
  }, [readingProgress, books]);

  const recentlyViewedItems = useMemo(() => {
    const seen = new Set<string>();
    const combined: {
      book: Book;
      progress?: (typeof readingProgress)[number];
      accessedAt: string;
    }[] = [];

    viewedBookRecords.forEach((rec) => {
      const book = books.find((b) => b.id === rec.bookId);
      if (book && !seen.has(book.id)) {
        seen.add(book.id);
        combined.push({
          book,
          progress: progressByBookId.get(book.id),
          accessedAt: rec.viewedAt,
        });
      }
    });

    recentlyReadItems.forEach((item) => {
      if (!seen.has(item.book.id)) {
        seen.add(item.book.id);
        combined.push(item);
      }
    });

    return combined.sort(
      (a, b) => new Date(b.accessedAt).getTime() - new Date(a.accessedAt).getTime()
    );
  }, [viewedBookRecords, recentlyReadItems, books, progressByBookId]);

  const visibleMessages = useMemo(
    () => messages.slice(Math.max(0, messages.length - visibleMessagesCount)),
    [messages, visibleMessagesCount]
  );

  return (
    <div className="flex-1 min-h-0 w-full max-w-[1440px] mx-auto flex flex-col overflow-hidden bg-white dark:bg-[#16161A] md:border-x border-[#DDDDE3] dark:border-[#2C2C35]">
      {/* =====================================================================
          A. COMPACT FIXED HUB NAVIGATION BAR (h-12, shrink-0)
      ===================================================================== */}
      <div
        className={`h-12 shrink-0 px-3 sm:px-5 border-b border-[#DDDDE3] dark:border-[#2C2C35] bg-white dark:bg-[#16161A] items-center justify-between gap-2 ${
          activeHubSection === 'chats' && mobileChatView === 'chat' ? 'hidden md:flex' : 'flex'
        }`}
      >
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {[
            {
              id: 'chats',
              to: '/hub/chats',
              label: 'Direct Chats',
              icon: MessageSquare,
              badge: totalUnreadChats > 0 ? totalUnreadChats : null,
            },
            {
              id: 'groups',
              to: '/hub/groups',
              label: 'Groups',
              icon: Users,
              badge: groupInvitations.filter((g) => g.status === 'pending').length || null,
            },
            {
              id: 'social',
              to: '/hub/social',
              label: 'Social & Discovery',
              icon: UserPlus,
              badge: incomingRequests.length > 0 ? incomingRequests.length : null,
            },
            ...(activeReadingSession
              ? [
                  {
                    id: 'reading',
                    to: `/hub/reading?sessionId=${activeReadingSession.id}`,
                    label: 'Co-Reading',
                    icon: BookOpen,
                    badge: 'LIVE',
                  },
                ]
              : []),
            {
              id: 'books',
              to: '/hub/books',
              label: 'Your Books',
              icon: BookMarked,
              badge: null,
            },
            {
              id: 'history',
              to: '/hub/history',
              label: 'History',
              icon: History,
              badge: null,
            },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeHubSection === tab.id;
            return (
              <Link
                key={tab.id}
                to={tab.to}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-[#E43136] text-white'
                    : 'text-[#6E6E77] dark:text-[#9E9EA8] hover:text-[#202020] dark:hover:text-white hover:bg-[#FAFAFB] dark:hover:bg-[#1E1E24]'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{tab.label}</span>
                {tab.badge !== null && (
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none ${
                      isActive ? 'bg-white/25 text-white' : 'bg-[#E43136] text-white'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {activeHubSection === 'chats' && (
          <button
            type="button"
            onClick={() => setShowNewChatModal(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#E43136] hover:bg-[#C8282D] text-white text-xs font-semibold shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New Chat</span>
          </button>
        )}
        {activeHubSection === 'groups' && (
          <button
            type="button"
            onClick={() => setShowCreateGroupModal(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#E43136] hover:bg-[#C8282D] text-white text-xs font-semibold shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New Group</span>
          </button>
        )}
        {activeHubSection === 'books' && (
          <Link
            to="/create"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#E43136] hover:bg-[#C8282D] text-white text-xs font-semibold shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Book</span>
          </Link>
        )}
      </div>

      {/* =====================================================================
          B. FIXED WORKSPACE CONTENT AREA (flex-1 min-h-0 overflow-hidden)
      ===================================================================== */}

      {/* 1. DIRECT CHATS (Two-Panel Instagram Web DM Layout) */}
      {activeHubSection === 'chats' && (
        <div className="flex-1 min-h-0 flex overflow-hidden">
          {/* LEFT PANEL: Responsive conversation list (Compact tablet, full-screen mobile, fixed desktop) */}
          <div
            className={`w-full md:w-[35%] md:min-w-[260px] md:max-w-[320px] lg:w-[30%] lg:min-w-[290px] lg:max-w-[360px] border-r border-[#DDDDE3] dark:border-[#2C2C35] flex-col min-h-0 overflow-hidden bg-white dark:bg-[#16161A] ${
              mobileChatView === 'chat' ? 'hidden md:flex' : 'flex'
            }`}
          >
            {/* Fixed Left Controls */}
            <div className="p-3 border-b border-[#DDDDE3] dark:border-[#2C2C35] space-y-2 shrink-0">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#6E6E77] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={conversationSearch}
                  onChange={(e) => setConversationSearch(e.target.value)}
                  placeholder="Search conversations..."
                  className="w-full pl-8 pr-7 py-1.5 rounded-lg bg-[#FAFAFB] dark:bg-[#0F0F12] border border-[#DDDDE3] dark:border-[#2C2C35] text-xs text-[#202020] dark:text-[#F4F4F6] focus:outline-none focus:border-[#E43136]"
                />
                {conversationSearch && (
                  <button
                    type="button"
                    onClick={() => setConversationSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[#6E6E77]"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'unread', label: 'Unread' },
                  { id: 'friends', label: 'Friends' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setChatFilter(tab.id as typeof chatFilter)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                      chatFilter === tab.id
                        ? 'bg-[#202020] dark:bg-white text-white dark:text-[#202020]'
                        : 'text-[#6E6E77] hover:bg-[#FAFAFB] dark:hover:bg-[#1E1E24]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Independently Scrollable Conversation List */}
            <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-[#F1F1F4] dark:divide-[#2C2C35]">
              {displayedChats.length === 0 ? (
                <div className="p-6 text-center space-y-2.5">
                  <p className="text-xs font-semibold text-[#202020] dark:text-[#F4F4F6]">
                    No conversations found
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowNewChatModal(true)}
                    className="px-3 py-1.5 rounded-lg bg-[#E43136] text-white text-xs font-semibold cursor-pointer"
                  >
                    Start New Chat
                  </button>
                </div>
              ) : (
                <>
                  {displayedChats.map((chat) => {
                    const partner = getChatPartner(chat);
                    const isSelected = Boolean(
                      activeChat && (activeChat.id === chat.id || (activePartner && partner.uid === activePartner.uid))
                    );
                    const rawUnread =
                      chat.participantA === currentUser.uid
                        ? chat.unreadCountA
                        : chat.unreadCountB;
                    const unread = isSelected ? 0 : rawUnread;
                    const previewText = formatConversationPreview(chat.lastMessage);
                    const isFromMe = chat.lastSenderId === currentUser.uid;

                    return (
                      <div
                        key={chat.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => handleSelectConversation(chat.id)}
                        className={`group relative w-full px-2.5 py-2 sm:px-3.5 sm:py-2.5 flex items-center gap-2.5 sm:gap-3 text-left transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-[#FFF3F4] dark:bg-[#E43136]/15 border-l-3 border-l-[#E43136]'
                            : 'hover:bg-[#FAFAFB] dark:hover:bg-[#1E1E24]'
                        }`}
                      >
                        <div className="shrink-0">
                          <UserAvatar
                            user={{
                              uid: partner.uid,
                              displayName: partner.displayName,
                              photoURL: partner.photoURL,
                              isOnline: partner.isOnline,
                              showOnlineStatus: partner.showOnlineStatus,
                            }}
                            size="sm"
                            showPresence
                          />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <div className="flex items-center gap-1.5 min-w-0 truncate">
                              <span
                                className={`text-xs sm:text-sm truncate ${
                                  unread > 0
                                    ? 'font-bold text-[#202020] dark:text-white'
                                    : 'font-semibold text-[#202020] dark:text-[#F4F4F6]'
                                }`}
                                style={partner.userObj?.nameColor ? { color: partner.userObj.nameColor } : undefined}
                              >
                                {partner.displayName}
                              </span>
                              {partner.nickname && (
                                <span className="text-[10px] text-[#8E8E98] truncate shrink-0">
                                  ({partner.originalName})
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <span className="text-[10px] text-[#6E6E77]">
                                {formatRelativeChatTime(chat.updatedAt)}
                              </span>

                              {/* 3-dots actions menu button */}
                              <div className="relative">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveCardMenuId(activeCardMenuId === chat.id ? null : chat.id);
                                  }}
                                  className="p-1 rounded-md text-[#8E8E98] hover:text-[#202020] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                                  title="Chat options"
                                >
                                  <MoreVertical className="w-3.5 h-3.5" />
                                </button>

                                {activeCardMenuId === chat.id && (
                                  <>
                                    <div
                                      className="fixed inset-0 z-30"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveCardMenuId(null);
                                      }}
                                    />
                                    <div
                                      className="absolute right-0 top-6 w-36 rounded-xl bg-white dark:bg-[#1A1A22] border border-[#DDDDE3] dark:border-[#2A2A36] shadow-xl py-1 z-40 text-xs"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setActiveCardMenuId(null);
                                          setNicknameModal({
                                            chatId: chat.id,
                                            partnerUid: partner.uid,
                                            partnerName: partner.originalName,
                                            currentNickname: partner.nickname,
                                          });
                                          setNicknameInput(partner.nickname);
                                        }}
                                        className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-[#FFF3F4] dark:hover:bg-[#252530] text-[#202020] dark:text-white cursor-pointer"
                                      >
                                        <Edit3 className="w-3.5 h-3.5 text-[#E43136]" />
                                        <span>{partner.nickname ? 'Edit Nickname' : 'Set Nickname'}</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setActiveCardMenuId(null);
                                          setDeleteConfirmChat({
                                            chatId: chat.id,
                                            partnerName: partner.displayName,
                                          });
                                        }}
                                        className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-red-50 dark:hover:bg-red-950/20 text-red-600 dark:text-red-400 cursor-pointer"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        <span>Delete Chat</span>
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-2 mt-0.5">
                            <p
                              className={`text-xs truncate ${
                                unread > 0
                                  ? 'font-semibold text-[#202020] dark:text-[#F4F4F6]'
                                  : 'text-[#6E6E77] dark:text-[#9E9EA8]'
                              }`}
                            >
                              {isFromMe && chat.lastMessage ? 'You: ' : ''}
                              {previewText}
                            </p>
                            {unread > 0 && (
                              <span className="px-1.5 py-0.5 rounded-full bg-[#E43136] text-white text-[10px] font-bold leading-none shrink-0">
                                {unread}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {filteredChats.length > visibleChatsCount && (
                    <div className="p-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => setVisibleChatsCount((prev) => prev + 25)}
                        className="text-xs font-semibold text-[#E43136] hover:underline cursor-pointer"
                      >
                        Load more
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* RIGHT PANEL: Dedicated full-screen chat on mobile (fixed inset-0 like WhatsApp/Instagram), fluid compact right column on tablet & desktop */}
          <div
            className={`min-h-0 overflow-hidden bg-white dark:bg-[#16161A] ${
              mobileChatView === 'list'
                ? 'hidden md:flex md:flex-1 md:flex-col'
                : 'fixed inset-0 z-50 flex flex-col w-full h-full md:relative md:inset-auto md:z-auto md:flex-1'
            }`}
          >
            {activeChat && activePartner ? (
              <ChatView
                chat={activeChat}
                messages={messages}
                currentUserId={currentUser.uid}
                otherUser={activePartner.userObj || undefined}
                allBooks={books}
                allFriends={acceptedFriends}
                isFriend={activePartnerRel?.isFriend ?? false}
                friendship={activePartnerRel?.friendship}
                onBack={() => {
                  setMobileChatView('list');
                  setSearchParams({});
                }}
                onSendMessage={async (text, options) => {
                  if (!currentUser || !activePartner || !activeChat) return;
                  const stableMsgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                  const optMsg: ChatMessage = {
                    id: stableMsgId,
                    chatId: activeChat.id,
                    senderId: currentUser.uid,
                    receiverId: activePartner.uid,
                    text: text.trim(),
                    status: 'sending',
                    reactions: {},
                    replyTo: options?.replyTo,
                    bookAttachment: options?.bookAttachment,
                    redCode: options?.redCode,
                    createdAt: new Date().toISOString(),
                  };
                  setMessages((prev) => {
                    if (prev.some((m) => m.id === stableMsgId)) return prev;
                    return [...prev, optMsg];
                  });

                  try {
                    await sendChatMessage(activeChat, text, {
                      ...options,
                      messageId: stableMsgId,
                    });
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === stableMsgId ? { ...m, status: 'sent' } : m
                      )
                    );
                  } catch (err) {
                    console.error('Chat send error:', err);
                    const cacheKey = `rc_chat_msgs_${activeChat.id}`;
                    setMessages((prev) => {
                      const rolledBack = prev.filter((message) => message.id !== stableMsgId);
                      try { localStorage.setItem(cacheKey, JSON.stringify(rolledBack.slice(-100))); } catch {}
                      return rolledBack;
                    });
                  }
                }}
                partnerNickname={activePartner.nickname}
                onEditNickname={() => {
                  setNicknameModal({
                    chatId: activeChat.id,
                    partnerUid: activePartner.uid,
                    partnerName: activePartner.originalName,
                    currentNickname: activePartner.nickname,
                  });
                  setNicknameInput(activePartner.nickname);
                }}
                onDeleteChat={() => {
                  setDeleteConfirmChat({
                    chatId: activeChat.id,
                    partnerName: activePartner.displayName,
                  });
                }}
                onSendFriendRequest={async (targetUser) => {
                  await sendFriendRequest(targetUser);
                }}
                onAcceptFriendRequest={async (friendshipId) => {
                  await updateFriendshipStatus(friendshipId, 'accepted');
                }}
                onReactToMessage={async (messageId, emoji) => {
                  await reactToChatMessage(activeChat.id, messageId, emoji);
                }}
                onEditMessage={async (messageId, newText) => {
                  await editChatMessage(activeChat.id, messageId, newText);
                }}
                onUnsendMessage={async (messageId) => {
                  await unsendChatMessage(activeChat.id, messageId);
                }}
                onDeleteForMeMessage={async (messageId) => {
                  await deleteMessageForMe(activeChat.id, messageId);
                }}
                onForwardMessage={async (text, recipientUids) => {
                  await forwardChatMessage(text, recipientUids);
                  addToast('Message forwarded', 'success');
                }}
                onSubmitReport={async (reason, details, targetId) => {
                  await submitReport('user', targetId, 'Chat Message', `${reason}: ${details}`);
                  addToast('Report submitted for review', 'info');
                }}
                onInviteToRead={async (book) => {
                  if (!activePartner) return;
                  if (!activePartner.isOnline) {
                    addToast(`${activePartner.displayName} is currently offline. You can invite them to read together when they come online.`, 'info');
                    return;
                  }
                  try {
                    await inviteToReadTogether(
                      book,
                      (activePartner.userObj || {
                        uid: activePartner.uid,
                        displayName: activePartner.displayName,
                        photoURL: activePartner.photoURL,
                        username: activePartner.username,
                        coverURL: '',
                        bio: '',
                        role: 'user',
                        membershipPlan: 'free',
                        followersCount: 0,
                        followingCount: 0,
                        booksCount: 0,
                        streakDays: 0,
                        points: 0,
                        isOnline: false,
                        showOnlineStatus: true,
                        publicActivity: true,
                        createdAt: '',
                        updatedAt: '',
                      }) as UserProfile,
                      `Let's read "${book.title}" together!`
                    );
                  } catch (err: any) {
                    addToast(err?.message || 'Could not send reading invitation.', 'error');
                  }
                }}
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                <MessageSquare className="w-8 h-8 text-[#E43136] mb-2" />
                <p className="text-sm font-bold text-[#202020] dark:text-[#F4F4F6]">
                  Your Messages
                </p>
                <p className="text-xs text-[#6E6E77] mt-0.5 mb-3">
                  Select a conversation or start a new chat.
                </p>
                <button
                  type="button"
                  onClick={() => setShowNewChatModal(true)}
                  className="px-3.5 py-2 rounded-xl bg-[#E43136] text-white text-xs font-semibold cursor-pointer"
                >
                  New Chat
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          2. YOUR BOOKS (Dedicated Fixed Panel + Scrollable Book Grid)
      ===================================================================== */}
      {activeHubSection === 'books' && (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {/* Fixed Sub-Toolbar */}
          <div className="px-3 sm:px-5 py-2.5 border-b border-[#DDDDE3] dark:border-[#2C2C35] bg-[#FAFAFB] dark:bg-[#141418] flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
              {[
                { id: 'uploads', label: 'My Uploads', count: myUploadedBooks.length },
                { id: 'saved', label: 'Saved & Marked', count: mySavedBookObjects.length },
                { id: 'reviewed', label: 'Reviewed', count: myReviews.length },
                { id: 'drafts', label: 'Drafts', count: myDraftBooks.length },
                { id: 'published', label: 'Published', count: myPublishedBooks.length },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setBooksSubTab(tab.id as typeof booksSubTab)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                    booksSubTab === tab.id
                      ? 'bg-[#202020] dark:bg-white text-white dark:text-[#202020]'
                      : 'text-[#6E6E77] hover:text-[#202020] dark:hover:text-white'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className="text-[10px] opacity-80">({tab.count})</span>
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-56">
              <Search className="w-3.5 h-3.5 text-[#6E6E77] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={booksSearchQuery}
                onChange={(e) => setBooksSearchQuery(e.target.value)}
                placeholder="Filter books..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white dark:bg-[#1E1E24] border border-[#DDDDE3] dark:border-[#2C2C35] text-xs"
              />
            </div>
          </div>

          {/* Independently Scrollable Books Area */}
          <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-5">
            {booksSubTab === 'reviewed' ? (
              myReviews.length === 0 ? (
                <EmptyState
                  title="No Reviews Yet"
                  description="Books you review will appear here."
                  actionLabel="Explore Books"
                  actionTo="/explore"
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {myReviews.map((rev) => {
                    const book = books.find((b) => b.id === rev.bookId);
                    return (
                      <div
                        key={rev.id}
                        className="p-3.5 rounded-xl border border-[#DDDDE3] dark:border-[#2C2C35] flex gap-3 bg-white dark:bg-[#1E1E24]"
                      >
                        {book && (
                          <Link
                            to={`/book/${book.id}`}
                            className="w-14 h-20 rounded-lg overflow-hidden shrink-0"
                          >
                            <BookCover book={book} className="w-full h-full" />
                          </Link>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <Link
                              to={book ? `/book/${book.id}` : '/explore'}
                              className="font-bold text-xs sm:text-sm truncate hover:text-[#E43136]"
                            >
                              {book?.title || rev.bookTitle || 'Book'}
                            </Link>
                            <span className="inline-flex items-center gap-0.5 text-xs font-bold text-[#D97706] shrink-0">
                              <Star className="w-3 h-3 fill-[#D97706]" />
                              {rev.rating}
                            </span>
                          </div>
                          <p className="text-xs text-[#6E6E77] line-clamp-2 mt-1">
                            {rev.text}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            ) : (
              (() => {
                const sourceList =
                  booksSubTab === 'uploads'
                    ? myUploadedBooks
                    : booksSubTab === 'saved'
                    ? mySavedBookObjects
                    : booksSubTab === 'drafts'
                    ? myDraftBooks
                    : myPublishedBooks;

                const filtered = sourceList.filter((b) => {
                  if (!booksSearchQuery.trim()) return true;
                  const q = booksSearchQuery.toLowerCase();
                  return (
                    b.title.toLowerCase().includes(q) ||
                    b.authorName.toLowerCase().includes(q)
                  );
                });

                if (filtered.length === 0) {
                  return (
                    <EmptyState
                      title="No Books Found"
                      description={
                        booksSubTab === 'saved'
                          ? 'Save books while browsing to see them here.'
                          : 'Create a book in the Author Studio.'
                      }
                      actionLabel={booksSubTab === 'saved' ? 'Explore' : 'Create Book'}
                      actionTo={booksSubTab === 'saved' ? '/explore' : '/create'}
                    />
                  );
                }

                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    {filtered.map((book) => {
                      const isOwner = book.authorId === currentUser.uid;
                      const isSaved = savedSet.has(book.id);
                      return (
                        <div
                          key={book.id}
                          className="p-3 rounded-xl border border-[#DDDDE3] dark:border-[#2C2C35] flex gap-3 bg-white dark:bg-[#1E1E24]"
                        >
                          <Link
                            to={`/book/${book.id}`}
                            className="w-16 h-24 rounded-lg overflow-hidden shrink-0"
                          >
                            <BookCover book={book} className="w-full h-full" />
                          </Link>

                          <div className="flex-1 min-w-0 flex flex-col justify-between">
                            <div>
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-[10px] font-bold text-[#E43136] truncate">
                                  {book.category}
                                </span>
                                <span className="text-[10px] uppercase font-semibold text-[#6E6E77]">
                                  {book.status}
                                </span>
                              </div>
                              <Link
                                to={`/book/${book.id}`}
                                className="block font-bold text-xs sm:text-sm truncate hover:text-[#E43136] mt-0.5"
                              >
                                {book.title}
                              </Link>
                              <p className="text-[11px] text-[#6E6E77] truncate">
                                {book.authorName}
                              </p>
                            </div>

                            <div className="flex items-center gap-1.5 pt-2">
                              <Link
                                to={`/read/${book.id}`}
                                className="px-2.5 py-1 rounded-md bg-[#E43136] text-white text-[11px] font-semibold"
                              >
                                Read
                              </Link>
                              {isOwner ? (
                                <>
                                  <Link
                                    to={`/create?edit=${book.id}`}
                                    className="px-2.5 py-1 rounded-md border border-[#DDDDE3] dark:border-[#2C2C35] text-[11px] font-semibold"
                                  >
                                    Edit
                                  </Link>
                                  <button
                                    type="button"
                                    onClick={() => deleteBook(book.id)}
                                    className="p-1 text-[#DC3545] ml-auto cursor-pointer"
                                    title="Delete"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => toggleSaveBook(book)}
                                  className="px-2.5 py-1 rounded-md border border-[#DDDDE3] dark:border-[#2C2C35] text-[11px] font-semibold cursor-pointer"
                                >
                                  {isSaved ? 'Saved' : 'Save'}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          3. SOCIAL & DISCOVERY (Dedicated Friend Management & Recommendations)
      ===================================================================== */}
      {activeHubSection === 'social' && (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <SocialHubTab
            currentUserId={currentUser.uid}
            currentUser={currentUser}
            allUsers={users}
            friendships={friendships}
            allBooks={books}
            onSendFriendRequest={async (target) => {
              await sendFriendRequest(target);
            }}
            onAcceptFriendRequest={async (friendshipId) => {
              await updateFriendshipStatus(friendshipId, 'accepted');
            }}
            onDeclineFriendRequest={async (friendshipId) => {
              await updateFriendshipStatus(friendshipId, 'rejected');
            }}
            onCancelFriendRequest={async (friendshipId) => {
              await cancelFriendRequest(friendshipId);
            }}
            onRemoveFriendship={async (friendshipId) => {
              await removeFriendship(friendshipId);
            }}
            onStartChat={async (target) => {
              const cId = await startOrGetChat(target);
              if (cId) navigate(`/hub/chats?chatId=${cId}`);
            }}
          />
        </div>
      )}

      {/* =====================================================================
          4. GROUPS (Two-panel layout: Groups List + GroupChatView)
      ===================================================================== */}
      {activeHubSection === 'groups' && (
        <div className="flex-1 min-h-0 flex overflow-hidden">
          {/* LEFT PANEL: Group list + Invitations */}
          <div
            className={`w-full lg:w-[31%] lg:min-w-[290px] lg:max-w-[380px] border-r border-[#DDDDE3] dark:border-[#2C2C35] flex flex-col min-h-0 overflow-hidden bg-white dark:bg-[#16161A] ${
              selectedGroupId ? 'hidden lg:flex' : 'flex'
            }`}
          >
            {/* Top Toolbar */}
            <div className="p-3 border-b border-[#DDDDE3] dark:border-[#2C2C35] flex items-center justify-between gap-2 shrink-0">
              <div>
                <h2 className="font-bold text-sm text-[#202020] dark:text-[#F4F4F6]">Reading Groups</h2>
                <p className="text-[11px] text-[#6E6E77]">{myGroups.length} groups joined</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateGroupModal(true)}
                className="px-2.5 py-1.5 rounded-lg bg-[#E43136] hover:bg-[#C8282D] text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New</span>
              </button>
            </div>

            {/* Pending Invitations Banner */}
            {groupInvitations.filter((gi) => gi.status === 'pending').length > 0 && (
              <div className="p-2.5 bg-[#FFF3F4] dark:bg-[#E43136]/10 border-b border-[#E43136]/20 shrink-0 space-y-2">
                <p className="text-xs font-bold text-[#E43136]">Pending Group Invitations</p>
                {groupInvitations
                  .filter((gi) => gi.status === 'pending')
                  .map((inv) => (
                    <div
                      key={inv.id}
                      className="p-2 bg-white dark:bg-[#1E1E24] rounded-lg border border-[#DDDDE3] dark:border-[#2C2C35] flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-xs text-[#202020] dark:text-[#F4F4F6] truncate">
                          {inv.groupName}
                        </p>
                        <p className="text-[10px] text-[#6E6E77] truncate">From {inv.inviterName}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={async () => {
                            await acceptGroupInvitation(inv.id, inv.groupId);
                            setSelectedGroupId(inv.groupId);
                            addToast(`Joined group "${inv.groupName}"!`, 'success');
                          }}
                          className="px-2 py-1 rounded bg-[#198754] text-white text-[11px] font-semibold cursor-pointer"
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await declineGroupInvitation(inv.id, inv.groupId);
                            addToast('Declined invitation', 'info');
                          }}
                          className="px-2 py-1 rounded border border-[#DDDDE3] text-[#6E6E77] text-[11px] font-semibold cursor-pointer"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {/* Scrollable Groups List */}
            <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-[#F1F1F4] dark:divide-[#2C2C35]">
              {myGroups.length === 0 ? (
                <div className="p-6 text-center space-y-2.5">
                  <div className="w-10 h-10 rounded-full bg-[#FFF3F4] dark:bg-[#E43136]/15 flex items-center justify-center mx-auto text-[#E43136]">
                    <Users className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-semibold text-[#202020] dark:text-[#F4F4F6]">
                    No Reading Groups Yet
                  </p>
                  <p className="text-[11px] text-[#6E6E77]">
                    Create a group to discuss books, share reading goals, and connect with other readers.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowCreateGroupModal(true)}
                    className="px-3.5 py-1.5 rounded-lg bg-[#E43136] text-white text-xs font-semibold cursor-pointer"
                  >
                    Create a Group
                  </button>
                </div>
              ) : (
                myGroups.map((group) => {
                  const isSelected = activeGroup?.id === group.id;
                  const memberCount = group.members?.length || 1;
                  return (
                    <button
                      key={group.id}
                      type="button"
                      onClick={() => setSelectedGroupId(group.id)}
                      className={`w-full px-3.5 py-3 flex items-center gap-3 text-left transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-[#FFF3F4] dark:bg-[#E43136]/15 border-l-3 border-l-[#E43136]'
                          : 'hover:bg-[#FAFAFB] dark:hover:bg-[#1E1E24]'
                      }`}
                    >
                      {group.avatarURL ? (
                        <img
                          src={group.avatarURL}
                          alt={group.name}
                          className="w-10 h-10 rounded-full object-cover shrink-0 border border-[#DDDDE3] dark:border-[#2C2C35]"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-[#E43136]/10 text-[#E43136] font-bold flex items-center justify-center shrink-0 border border-[#E43136]/20 text-sm">
                          {group.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs sm:text-sm font-bold text-[#202020] dark:text-[#F4F4F6] truncate">
                            {group.name}
                          </span>
                          <span className="text-[10px] text-[#6E6E77] shrink-0">
                            {formatRelativeChatTime(group.lastMessageAt || group.updatedAt)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-0.5">
                          <p className="text-xs text-[#6E6E77] truncate">
                            {group.lastMessage || 'No messages yet'}
                          </p>
                          <span className="text-[10px] text-[#6E6E77] shrink-0">
                            {memberCount} {memberCount === 1 ? 'member' : 'members'}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* RIGHT PANEL: Active Group Chat or Empty State */}
          <div
            className={`flex-1 flex flex-col min-h-0 overflow-hidden bg-white dark:bg-[#16161A] ${
              !selectedGroupId && myGroups.length > 0 ? 'hidden lg:flex' : 'flex'
            }`}
          >
            {activeGroup ? (
              <GroupChatView
                group={activeGroup}
                messages={groupMessages}
                currentUserId={currentUser.uid}
                allUsers={users}
                allBooks={books}
                allFriends={acceptedFriends}
                onBack={() => setSelectedGroupId(null)}
                onSendMessage={async (text, options) => {
                  await sendGroupMessage(activeGroup.id, text, options);
                }}
                onReactToMessage={async (groupId, messageId, emoji) => {
                  await reactToGroupMessage(groupId, messageId, emoji);
                }}
                onInviteMember={async (targetUser) => {
                  await inviteUserToGroup(
                    activeGroup.id,
                    activeGroup.name,
                    activeGroup.avatarURL,
                    targetUser
                  );
                  addToast(`Invited ${targetUser.displayName} to group`, 'success');
                }}
                onRemoveMember={async (memberId) => {
                  await removeGroupMember(activeGroup.id, memberId);
                  addToast('Member removed from group', 'info');
                }}
                onLeaveGroup={async () => {
                  await leaveGroup(activeGroup.id);
                  setSelectedGroupId(null);
                  addToast('Left group', 'info');
                }}
                onForwardMessage={async (text, recipientUids) => {
                  await forwardChatMessage(text, recipientUids);
                  addToast('Message forwarded', 'success');
                }}
                onSubmitReport={async (reason, details, targetId) => {
                  await submitReport('user', targetId, 'Group Message', `${reason}: ${details}`);
                  addToast('Report submitted for review', 'info');
                }}
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-3">
                <div className="w-14 h-14 rounded-full bg-[#FFF3F4] dark:bg-[#E43136]/15 flex items-center justify-center text-[#E43136]">
                  <Users className="w-7 h-7" />
                </div>
                <h3 className="text-sm font-bold text-[#202020] dark:text-[#F4F4F6]">
                  Select a Group
                </h3>
                <p className="text-xs text-[#6E6E77] max-w-sm">
                  Choose a reading group from the list or create a new group to read together and discuss books.
                </p>
                <button
                  type="button"
                  onClick={() => setShowCreateGroupModal(true)}
                  className="px-4 py-2 rounded-xl bg-[#E43136] text-white text-xs font-semibold cursor-pointer shadow-sm hover:bg-[#C8282D]"
                >
                  Create New Group
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          5. CO-READING (Synchronized live reader + remote control + discussion)
      ===================================================================== */}
      {activeHubSection === 'reading' && (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {activeReadingSession ? (
            <SharedReadingSessionView
              session={activeReadingSession}
              book={books.find((b) => b.id === activeReadingSession.bookId) || books[0]}
              chapters={sessionChapters}
              currentUser={currentUser}
              remoteUser={users.find(
                (u) =>
                  u.uid ===
                  (activeReadingSession.hostId === currentUser.uid
                    ? activeReadingSession.participantId
                    : activeReadingSession.hostId)
              )}
              onExitSession={() => navigate('/hub/chats')}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center p-6">
              <EmptyState
                title="No Active Co-Reading Session"
                description="Invite a friend to read a book together with synchronized page turning and real-time discussion!"
                actionLabel="Explore Books"
                actionTo="/explore"
              />
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          4. HISTORY (Dedicated Fixed Panel + Scrollable Compact Rows)
      ===================================================================== */}
      {activeHubSection === 'history' && (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {/* Fixed Sub-Toolbar */}
          <div className="px-3 sm:px-5 py-2.5 border-b border-[#DDDDE3] dark:border-[#2C2C35] bg-[#FAFAFB] dark:bg-[#141418] flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
              {[
                { id: 'recently_read', label: 'Recently Read', count: recentlyReadItems.length },
                { id: 'recently_viewed', label: 'Recently Viewed', count: recentlyViewedItems.length },
                {
                  id: 'reading_activity',
                  label: 'Reading Activity',
                  count: recentlyReadItems.filter((i) => i.progress.percentage < 100).length,
                },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setHistorySubTab(tab.id as typeof historySubTab)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1 ${
                    historySubTab === tab.id
                      ? 'bg-[#202020] dark:bg-white text-white dark:text-[#202020]'
                      : 'text-[#6E6E77] hover:text-[#202020] dark:hover:text-white'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className="text-[10px] opacity-80">({tab.count})</span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  updateUserProfile({ publicActivity: !currentUser.publicActivity })
                }
                className="px-2.5 py-1.5 rounded-lg border border-[#DDDDE3] dark:border-[#2C2C35] bg-white dark:bg-[#1E1E24] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                {currentUser.publicActivity ? (
                  <>
                    <Globe className="w-3.5 h-3.5 text-[#198754]" /> Public
                  </>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5 text-[#6E6E77]" /> Private
                  </>
                )}
              </button>

              <div className="relative w-44 sm:w-52">
                <Search className="w-3.5 h-3.5 text-[#6E6E77] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={historySearchQuery}
                  onChange={(e) => setHistorySearchQuery(e.target.value)}
                  placeholder="Filter history..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white dark:bg-[#1E1E24] border border-[#DDDDE3] dark:border-[#2C2C35] text-xs"
                />
              </div>
            </div>
          </div>

          {/* Independently Scrollable History List */}
          <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-5">
            {(() => {
              const rawItems =
                historySubTab === 'recently_read'
                  ? recentlyReadItems
                  : historySubTab === 'reading_activity'
                  ? recentlyReadItems.filter((i) => i.progress.percentage < 100)
                  : recentlyViewedItems;

              const filtered = rawItems.filter((item) => {
                if (!historySearchQuery.trim()) return true;
                const q = historySearchQuery.toLowerCase();
                return (
                  item.book.title.toLowerCase().includes(q) ||
                  item.book.authorName.toLowerCase().includes(q)
                );
              });

              if (filtered.length === 0) {
                return (
                  <EmptyState
                    title="No History Yet"
                    description="Books you read or open will appear here."
                    actionLabel="Explore"
                    actionTo="/explore"
                  />
                );
              }

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filtered.map(({ book, progress, accessedAt }) => {
                    const pct = progress?.percentage ?? 0;
                    return (
                      <div
                        key={`${book.id}-${accessedAt}`}
                        className="p-3 rounded-xl border border-[#DDDDE3] dark:border-[#2C2C35] bg-white dark:bg-[#1E1E24] flex items-center gap-3"
                      >
                        <Link
                          to={`/book/${book.id}`}
                          className="w-12 h-16 rounded-lg overflow-hidden shrink-0"
                        >
                          <BookCover book={book} className="w-full h-full" />
                        </Link>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <Link
                              to={`/book/${book.id}`}
                              className="font-bold text-xs sm:text-sm truncate hover:text-[#E43136]"
                            >
                              {book.title}
                            </Link>
                            <span className="text-[10px] text-[#6E6E77] shrink-0">
                              {formatRelativeChatTime(accessedAt)}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#6E6E77] truncate">
                            {book.authorName}
                          </p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <div className="flex-1 h-1.5 bg-[#FAFAFB] dark:bg-[#141418] rounded-full overflow-hidden">
                              <div
                                className="h-full bg-[#E43136] rounded-full"
                                style={{ width: `${Math.min(100, pct)}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-bold text-[#E43136] tabular-nums">
                              {pct}%
                            </span>
                          </div>
                        </div>

                        <Link
                          to={`/read/${book.id}`}
                          className="px-3 py-1.5 rounded-lg bg-[#E43136] text-white text-xs font-semibold shrink-0"
                        >
                          Read
                        </Link>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 1: NEW CHAT USER SEARCH
      ===================================================================== */}
      {showNewChatModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1E1E24] rounded-2xl border border-[#DDDDE3] dark:border-[#2C2C35] w-full max-w-md overflow-hidden shadow-xl flex flex-col max-h-[75vh]">
            <div className="p-3.5 border-b border-[#DDDDE3] dark:border-[#2C2C35] flex items-center justify-between">
              <h3 className="font-bold text-sm text-[#202020] dark:text-[#F4F4F6]">
                New Message
              </h3>
              <button
                type="button"
                onClick={() => setShowNewChatModal(false)}
                className="p-1 text-[#6E6E77] hover:text-[#202020] dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 border-b border-[#DDDDE3] dark:border-[#2C2C35]">
              <input
                type="text"
                autoFocus
                value={newChatSearchQuery}
                onChange={(e) => setNewChatSearchQuery(e.target.value)}
                placeholder="Search by name or @username..."
                className="w-full px-3 py-2 rounded-lg bg-[#FAFAFB] dark:bg-[#141418] border border-[#DDDDE3] dark:border-[#2C2C35] text-xs focus:outline-none focus:border-[#E43136]"
              />
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-[#F1F1F4] dark:divide-[#2C2C35]">
              {newChatUsers.map((u) => {
                const rel = getUserRelationship(u.uid);
                const isDisabled = rel.isBlockedByMe || rel.hasBlockedMe;
                return (
                  <div
                    key={u.uid}
                    onClick={() => {
                      if (!isDisabled && startingChatWithUid !== u.uid) {
                        handleStartConversationWithUser(u);
                      }
                    }}
                    className={`p-3 flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                      isDisabled
                        ? 'opacity-40 cursor-not-allowed'
                        : 'hover:bg-[#FAFAFB] dark:hover:bg-[#25252D] active:bg-[#FFF3F4] dark:active:bg-[#E43136]/15'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <UserAvatar user={u} size="sm" showPresence />
                      <div className="min-w-0">
                        <p className="font-bold text-xs text-[#202020] dark:text-[#F4F4F6] truncate">
                          {u.displayName}
                        </p>
                        <p className="text-[11px] text-[#6E6E77] truncate">@{u.username}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={isDisabled || startingChatWithUid === u.uid}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartConversationWithUser(u);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-[#E43136] disabled:opacity-40 text-white text-xs font-semibold shrink-0 cursor-pointer"
                    >
                      {startingChatWithUid === u.uid ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        'Chat'
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 2: SHARE BOOK IN CHAT
      ===================================================================== */}
      {showBookShareModal && activeChat && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1E1E24] rounded-2xl border border-[#DDDDE3] dark:border-[#2C2C35] w-full max-w-md overflow-hidden shadow-xl flex flex-col max-h-[75vh]">
            <div className="p-3.5 border-b border-[#DDDDE3] dark:border-[#2C2C35] flex items-center justify-between">
              <h3 className="font-bold text-sm">Share Book</h3>
              <button
                type="button"
                onClick={() => setShowBookShareModal(false)}
                className="p-1 text-[#6E6E77] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 border-b border-[#DDDDE3] dark:border-[#2C2C35]">
              <input
                type="text"
                value={bookShareSearch}
                onChange={(e) => setBookShareSearch(e.target.value)}
                placeholder="Search books..."
                className="w-full px-3 py-2 rounded-lg bg-[#FAFAFB] dark:bg-[#141418] border border-[#DDDDE3] dark:border-[#2C2C35] text-xs"
              />
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-[#F1F1F4] dark:divide-[#2C2C35]">
              {books
                .filter((b) => b.status === 'published')
                .filter((b) =>
                  !bookShareSearch.trim()
                    ? true
                    : b.title.toLowerCase().includes(bookShareSearch.toLowerCase())
                )
                .slice(0, 20)
                .map((b) => (
                  <div
                    key={b.id}
                    className="p-3 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-11 rounded overflow-hidden shrink-0">
                        <BookCover book={b} className="w-full h-full" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-xs truncate">{b.title}</p>
                        <p className="text-[11px] text-[#6E6E77] truncate">{b.authorName}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setPendingAttachment({
                          type: 'book',
                          label: b.title,
                          url: b.id,
                          extra: b.coverURL,
                        });
                        setShowBookShareModal(false);
                        textareaRef.current?.focus();
                      }}
                      className="px-2.5 py-1 rounded-lg bg-[#E43136] text-white text-xs font-semibold shrink-0 cursor-pointer"
                    >
                      Attach
                    </button>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 3: IMAGE LIGHTBOX
      ===================================================================== */}
      {lightboxImageUrl && (
        <div
          onClick={() => setLightboxImageUrl(null)}
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
        >
          <img
            src={lightboxImageUrl}
            alt="Attachment"
            className="max-w-full max-h-[85vh] rounded-xl object-contain"
          />
        </div>
      )}

      {/* =====================================================================
          MODAL 4: CREATE GROUP MODAL
      ===================================================================== */}
      <CreateGroupModal
        isOpen={showCreateGroupModal}
        onClose={() => setShowCreateGroupModal(false)}
        friends={acceptedFriends}
        allUsers={users}
        onCreateGroup={async (name, desc, avatar, invitees) => {
          const gId = await createGroup(name, desc, avatar, invitees);
          setSelectedGroupId(gId);
          addToast(`Group "${name}" created!`, 'success');
        }}
      />

      {/* =====================================================================
          MODAL 5: EDIT NICKNAME MODAL
      ===================================================================== */}
      {nicknameModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div
            className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#16161D] border border-[#DDDDE3] dark:border-[#2A2A36] p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-black/5 dark:border-white/5">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-[#E43136]" />
                <h3 className="text-sm font-bold text-[#202020] dark:text-white">
                  Set Contact Nickname
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setNicknameModal(null)}
                className="p-1 rounded-md text-[#8E8E98] hover:text-black dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#6E6E77] dark:text-[#9E9EA8] mb-3">
              Custom nickname for <strong className="text-[#202020] dark:text-white">{nicknameModal.partnerName}</strong>. Only you will see this nickname.
            </p>

            <input
              type="text"
              value={nicknameInput}
              onChange={(e) => setNicknameInput(e.target.value)}
              placeholder="e.g. Muzammil 👑 or Bestie"
              maxLength={40}
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-[#DDDDE3] dark:border-[#2A2A36] bg-[#FAFAFB] dark:bg-[#121217] text-[#202020] dark:text-white focus:outline-none focus:border-[#E43136] mb-4"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  setChatNickname(nicknameModal.chatId, nicknameModal.partnerUid, nicknameInput.trim());
                  setNicknameModal(null);
                }
              }}
            />

            <div className="flex items-center justify-between gap-2">
              {nicknameModal.currentNickname ? (
                <button
                  type="button"
                  onClick={() => {
                    setChatNickname(nicknameModal.chatId, nicknameModal.partnerUid, '');
                    setNicknameModal(null);
                  }}
                  className="text-xs text-red-500 hover:underline cursor-pointer"
                >
                  Remove Nickname
                </button>
              ) : <div />}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setNicknameModal(null)}
                  className="px-3 py-1.5 rounded-xl border border-[#DDDDE3] dark:border-[#2A2A36] text-xs font-semibold text-[#6E6E77] hover:text-black dark:hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setChatNickname(nicknameModal.chatId, nicknameModal.partnerUid, nicknameInput.trim());
                    setNicknameModal(null);
                  }}
                  className="px-4 py-1.5 rounded-xl bg-[#E43136] hover:bg-[#D92D32] text-xs font-bold text-white shadow-xs cursor-pointer"
                >
                  Save Nickname
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 6: DELETE CHAT CONFIRMATION MODAL
      ===================================================================== */}
      {deleteConfirmChat && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div
            className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#16161D] border border-red-500/30 p-5 shadow-2xl text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-10 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 mx-auto mb-3 flex items-center justify-center">
              <Trash2 className="w-5 h-5" />
            </div>

            <h3 className="text-sm font-bold text-[#202020] dark:text-white mb-1.5">
              Delete Conversation?
            </h3>

            <p className="text-xs text-[#6E6E77] dark:text-[#9E9EA8] mb-5 leading-relaxed">
              Are you sure you want to delete your conversation with <strong className="text-[#202020] dark:text-white">{deleteConfirmChat.partnerName}</strong>? All message history will be removed.
            </p>

            <div className="flex items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={() => setDeleteConfirmChat(null)}
                className="flex-1 py-2 px-3 rounded-xl border border-[#DDDDE3] dark:border-[#2A2A36] text-xs font-semibold text-[#6E6E77] hover:text-black dark:hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const targetId = deleteConfirmChat.chatId;
                  setDeleteConfirmChat(null);
                  await deleteChat(targetId);
                  if (selectedChatId === targetId) {
                    setSelectedChatId(null);
                  }
                }}
                className="flex-1 py-2 px-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                Delete Chat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
