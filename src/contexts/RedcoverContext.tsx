import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut as firebaseSignOut,
  updateProfile as updateFirebaseAuthProfile,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  increment,
  arrayUnion,
  arrayRemove,
  writeBatch,
} from 'firebase/firestore';
import { ref as rtdbRef, onValue } from 'firebase/database';
import { auth, db, defaultDb, rtdb, googleProvider } from '../services/firebase/firebaseConfig';
import { handleFirestoreError, OperationType } from '../services/firebase/errorHandler';
import {
  encodeCommentReplyText,
  normalizeBookDoc,
  normalizeChapterDoc,
  normalizePostCommentDoc,
  normalizeProgressDoc,
  normalizeReviewDoc,
  normalizeSocialPostDoc,
  normalizeUserDoc,
  toIsoString,
} from '../services/firebase/storageService';
import {
  AppTheme,
  Book,
  BookLike,
  Chapter,
  Chat,
  ChatMessage,
  ChatMessageReply,
  ChatMessageBookAttachment,
  Follow,
  Friendship,
  FriendshipStatus,
  Group,
  GroupInvitation,
  GroupMember,
  GroupMessage,
  NotificationItem,
  PostComment,
  PostLike,
  ReadingInvitation,
  ReadingProgress,
  ReadingRemoteRequest,
  ReadingSession,
  ReportItem,
  Review,
  SavedBook,
  SocialPost,
  SocialPostType,
  UserPrivateInfo,
  UserProfile,
  isSystemAccount,
} from '../models/types';
import { initUserPresence } from '../services/firebase/presenceService';
import { assignUniqueRedCodeToBook as assignUniqueRedCodeService } from '../services/firebase/redCodeService';
import { getBookPdfAccessUrl } from '../services/firebase/storageAccessService';
import {
  createGroup as createGroupService,
  inviteUserToGroup as inviteUserToGroupService,
  acceptGroupInvitation as acceptGroupInvitationService,
  declineGroupInvitation as declineGroupInvitationService,
  leaveGroup as leaveGroupService,
  removeGroupMember as removeGroupMemberService,
  sendGroupMessage as sendGroupMessageService,
} from '../services/firebase/groupService';
import {
  createReadingSession as createReadingSessionService,
  acceptReadingInvitation as acceptReadingInvitationService,
  declineReadingInvitation as declineReadingInvitationService,
  requestRemoteControl as requestRemoteControlService,
  respondToRemoteRequest as respondToRemoteRequestService,
  endReadingSession as endReadingSessionService,
} from '../services/firebase/readingSessionService';

const DEMO_BOOK_IDS = new Set([
  'rc-book-crimson-letters',
  'rc-book-compounding-mind',
  'rc-book-monk-protocol',
  'rc-book-zero-to-scale',
  'rc-book-stoic-compass',
  'rc-book-velvet-cipher',
]);
const DEMO_USER_IDS = new Set(['author-arjun-mehta', 'author-elena-vance', 'author-kabir-sen']);

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  text: string;
}

export interface FirebaseSourceStats {
  appletDbBooks: number;
  appletDbUsers: number;
  defaultDbBooks: number;
  defaultDbUsers: number;
  rtdbBooks: number;
  rtdbUsers: number;
  defaultDbError: string | null;
}

interface RedcoverContextValue {
  firebaseUser: FirebaseUser | null;
  currentUser: UserProfile | null;
  privateInfo: UserPrivateInfo | null;
  authLoading: boolean;
  isAdmin: boolean;
  books: Book[];
  users: UserProfile[];
  reviews: Review[];
  readingProgress: ReadingProgress[];
  publicReadingProgress: ReadingProgress[];
  socialPosts: SocialPost[];
  postLikes: PostLike[];
  postComments: PostComment[];
  savedBooks: SavedBook[];
  likedBooks: BookLike[];
  follows: Follow[];
  friendships: Friendship[];
  chats: Chat[];
  groups: Group[];
  groupInvitations: GroupInvitation[];
  readingSessions: ReadingSession[];
  readingInvitations: ReadingInvitation[];
  notifications: NotificationItem[];
  reports: ReportItem[];
  booksLoading: boolean;
  realtimeSyncCount: number;
  lastSyncedAt: string;
  defaultDbCount: number;
  sourceStats: FirebaseSourceStats;
  toasts: ToastMessage[];
  theme: AppTheme;
  recentSearches: string[];
  addToast: (text: string, type?: 'success' | 'error' | 'info') => void;
  dismissToast: (id: string) => void;
  setTheme: (theme: AppTheme) => Promise<void>;
  addRecentSearch: (term: string) => void;
  clearRecentSearches: () => void;
  loginWithGoogle: () => Promise<void>;
  hqRole: string | null;
  hqPermissions: string[];
  refreshHqClaims: () => Promise<void>;
  hasHqPermission: (permission: string) => boolean;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  registerWithEmail: (email: string, pass: string, displayName: string, username: string) => Promise<void>;
  sendResetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  toggleSaveBook: (book: Book) => Promise<void>;
  toggleLikeBook: (book: Book) => Promise<void>;
  incrementBookView: (book: Book) => Promise<void>;
  incrementPostView: (postId: string) => Promise<void>;
  getBookChapters: (bookId: string) => Promise<Chapter[]>;
  saveReadingProgress: (
    book: Book,
    currentChapter: number,
    totalChapters: number,
    percentage: number,
    isBookmarked?: boolean,
    bookmarkNote?: string
  ) => Promise<void>;
  submitReview: (book: Book, rating: number, text: string) => Promise<void>;
  createSocialPost: (input: {
    postType: SocialPostType;
    text: string;
    book?: Book | null;
    rating?: number;
    progressPercentage?: number;
    chapterNumber?: number;
  }) => Promise<void>;
  deleteSocialPost: (postId: string) => Promise<void>;
  toggleLikePost: (
    postId: string,
    backingPost?: SocialPost | null,
    options?: {
      targetAuthorId?: string;
      targetTitle?: string;
      bookForSync?: Book | null;
      link?: string;
    }
  ) => Promise<void>;
  toggleLikeComment: (comment: PostComment, postLink?: string) => Promise<void>;
  addPostComment: (
    postId: string,
    text: string,
    backingPost?: SocialPost | null,
    options?: {
      parentId?: string;
      replyToUsername?: string;
      targetAuthorId?: string;
      targetTitle?: string;
      link?: string;
    }
  ) => Promise<void>;
  editPostComment: (
    commentId: string,
    newText: string,
    parentId?: string,
    replyToUsername?: string
  ) => Promise<void>;
  deletePostComment: (commentId: string, postId: string, backingPost?: SocialPost | null) => Promise<void>;
  publishOrSaveBook: (
    bookInput: Omit<Book, 'id' | 'authorId' | 'authorName' | 'authorUsername' | 'authorAvatar' | 'rating' | 'reviewsCount' | 'views' | 'likes' | 'saves' | 'createdAt' | 'updatedAt'> & { id?: string },
    chaptersInput: { id?: string; chapterNumber: number; title: string; content: string }[]
  ) => Promise<string>;
  deleteBook: (bookId: string) => Promise<void>;
  updateBookStatusAdmin: (bookId: string, status: Book['status']) => Promise<void>;
  updateUserProfile: (updates: Partial<Pick<UserProfile, 'displayName' | 'username' | 'bio' | 'photoURL' | 'coverURL' | 'showOnlineStatus' | 'publicActivity' | 'nameColor'>>) => Promise<void>;
  updatePrivateSettings: (updates: Partial<Pick<UserPrivateInfo, 'readingReminders' | 'notificationSettings' | 'theme'>>) => Promise<void>;
  upgradeMembership: (plan: 'free' | 'premium') => Promise<void>;
  toggleFollowUser: (targetUser: UserProfile) => Promise<void>;
  sendFriendRequest: (targetUser: UserProfile) => Promise<void>;
  updateFriendshipStatus: (friendshipId: string, status: FriendshipStatus) => Promise<void>;
  cancelFriendRequest: (friendshipId: string) => Promise<void>;
  removeFriendship: (friendshipId: string) => Promise<void>;
  blockUser: (targetUser: UserProfile) => Promise<void>;
  isFriend: (targetUserId: string) => boolean;
  acceptedFriends: UserProfile[];
  startOrGetChat: (targetUser: UserProfile) => Promise<string>;
  clearChatUnreadCount: (chatId: string) => Promise<void>;
  deleteChat: (chatId: string) => Promise<void>;
  setChatNickname: (chatId: string, partnerUid: string, nickname: string) => Promise<void>;
  sendChatMessage: (chat: Chat, text: string, options?: any) => Promise<void>;
  editChatMessage: (chatId: string, messageId: string, newText: string) => Promise<void>;
  unsendChatMessage: (chatId: string, messageId: string) => Promise<void>;
  deleteMessageForMe: (chatId: string, messageId: string) => Promise<void>;
  reactToChatMessage: (chatId: string, messageId: string, emoji: string) => Promise<void>;
  forwardChatMessage: (text: string, recipientUids: string[]) => Promise<void>;
  createGroup: (name: string, description: string, avatarURL: string, initialInvitees: UserProfile[]) => Promise<string>;
  inviteUserToGroup: (groupId: string, groupName: string, groupAvatar: string, targetUser: UserProfile) => Promise<void>;
  acceptGroupInvitation: (invitationId: string, groupId: string) => Promise<void>;
  declineGroupInvitation: (invitationId: string, groupId: string) => Promise<void>;
  leaveGroup: (groupId: string) => Promise<void>;
  removeGroupMember: (groupId: string, memberId: string) => Promise<void>;
  sendGroupMessage: (groupId: string, text: string, options?: any) => Promise<string>;
  reactToGroupMessage: (groupId: string, messageId: string, emoji: string) => Promise<void>;
  assignUniqueRedCodeToBook: (bookId: string, bookTitle: string) => Promise<string>;
  shareBookToFriends: (book: Book, recipientUids: string[], personalMessage?: string) => Promise<void>;
  inviteToReadTogether: (book: Book, targetUser: UserProfile, personalMessage: string) => Promise<{ sessionId: string; invitationId: string }>;
  acceptReadingInvitation: (invitationId: string, sessionId: string) => Promise<void>;
  declineReadingInvitation: (invitationId: string) => Promise<void>;
  markNotificationRead: (notificationId: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  submitReport: (targetType: 'book' | 'user' | 'comment', targetId: string, targetTitle: string, reason: string) => Promise<void>;
  resolveReportAdmin: (reportId: string, status: 'resolved' | 'dismissed') => Promise<void>;
  executeMasterWipe: (secretPassphrase: string) => Promise<boolean>;
}

const RedcoverContext = createContext<RedcoverContextValue | null>(null);

export const RedcoverProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [privateInfo, setPrivateInfo] = useState<UserPrivateInfo | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [hqRole, setHqRole] = useState<string | null>(null);
  const [hqPermissions, setHqPermissions] = useState<string[]>([]);

  const [firestoreBooks, setFirestoreBooks] = useState<Book[]>([]);
  const [myAuthoredBooks, setMyAuthoredBooks] = useState<Book[]>([]);
  const [defaultDbBooks, setDefaultDbBooks] = useState<Book[]>([]);
  const [rtdbBooks, setRtdbBooks] = useState<Book[]>([]);

  const [firestoreUsers, setFirestoreUsers] = useState<UserProfile[]>([]);
  const [defaultDbUsers, setDefaultDbUsers] = useState<UserProfile[]>([]);
  const [rtdbUsers, setRtdbUsers] = useState<UserProfile[]>([]);
  const [defaultDbError, setDefaultDbError] = useState<string | null>(null);

  const [reviews, setReviews] = useState<Review[]>([]);
  const [readingProgress, setReadingProgress] = useState<ReadingProgress[]>([]);
  const [publicReadingProgress, setPublicReadingProgress] = useState<ReadingProgress[]>([]);
  const [socialPosts, setSocialPosts] = useState<SocialPost[]>([]);
  const [postLikes, setPostLikes] = useState<PostLike[]>([]);
  const [firestorePostComments, setFirestorePostComments] = useState<PostComment[]>([]);
  const [defaultDbPostComments, setDefaultDbPostComments] = useState<PostComment[]>([]);
  const [localPostComments, setLocalPostComments] = useState<PostComment[]>(() => {
    try {
      const raw = localStorage.getItem('rc_local_post_comments_v1');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [deletedCommentIds, setDeletedCommentIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('rc_deleted_comment_ids_v1');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [savedBooks, setSavedBooks] = useState<SavedBook[]>([]);
  const [likedBooks, setLikedBooks] = useState<BookLike[]>([]);
  const [follows, setFollows] = useState<Follow[]>([]);
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupInvitations, setGroupInvitations] = useState<GroupInvitation[]>([]);
  const [readingSessions, setReadingSessions] = useState<ReadingSession[]>([]);
  const [readingInvitations, setReadingInvitations] = useState<ReadingInvitation[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);

  const [booksLoading, setBooksLoading] = useState<boolean>(true);
  const [realtimeSyncCount, setRealtimeSyncCount] = useState<number>(0);
  // Strict in-memory session sets to guarantee exactly 1 view per user per book & per post in this runtime
  const sessionBookViewsRef = useRef<Set<string>>(new Set());
  const sessionPostViewsRef = useRef<Set<string>>(new Set());
  const [lastSyncedAt, setLastSyncedAt] = useState<string>(new Date().toISOString());
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [theme, setThemeState] = useState<AppTheme>(() => {
    const saved = localStorage.getItem('rc_theme');
    return saved === 'dark' ? 'dark' : 'light';
  });
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('rc_recent_searches');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const addToast = useCallback((text: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    document.getElementById('rc-custom-theme-styles')?.remove();
    localStorage.setItem('rc_theme', theme);
    localStorage.removeItem('rc_custom_theme');
  }, [theme]);

  const bumpSync = useCallback(() => {
    setRealtimeSyncCount((c) => c + 1);
    setLastSyncedAt(new Date().toISOString());
  }, []);

  const sanitizeId = useCallback((raw: string, fallback = 'item'): string => {
    const cleaned = String(raw || '')
      .trim()
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 128);
    return cleaned || `${fallback}_${Date.now()}`;
  }, []);

  // Ensure user document exists on sign in (and check if Android profile exists in defaultDb!)
  const ensureUserProfile = useCallback(async (fbUser: FirebaseUser) => {
    const userRef = doc(db, 'users', fbUser.uid);
    const privRef = doc(db, 'users', fbUser.uid, 'private', 'info');
    try {
      // First check if an existing profile exists in `(default)` DB from the Android app
      let androidUserData: Record<string, any> | null = null;
      try {
        const defSnap = await getDoc(doc(defaultDb, 'users', fbUser.uid));
        if (defSnap.exists()) {
          androidUserData = defSnap.data();
        } else {
          const defSnap2 = await getDoc(doc(defaultDb, 'Users', fbUser.uid));
          if (defSnap2.exists()) androidUserData = defSnap2.data();
        }
      } catch {
        // Ignore if defaultDb is not accessible
      }

      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        const mappedAndroid = androidUserData ? normalizeUserDoc(fbUser.uid, androidUserData) : null;
        const cleanHandle = (
          mappedAndroid?.username ||
          (fbUser.email ? fbUser.email.split('@')[0] : fbUser.displayName || 'reader')
        )
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, '')
          .slice(0, 30) || `user_${fbUser.uid.slice(0, 6)}`;

        const rawPhoto = mappedAndroid?.photoURL || fbUser.photoURL || '';
        const rawCover = mappedAndroid?.coverURL || '';

        const newProfile = {
          uid: fbUser.uid,
          username: cleanHandle.length >= 2 ? cleanHandle : `rc_${cleanHandle}`,
          displayName: (mappedAndroid?.displayName || fbUser.displayName || cleanHandle || 'Redcover Member').trim().slice(0, 100) || 'Redcover Member',
          photoURL: rawPhoto.length <= 5000 ? rawPhoto : (fbUser.photoURL || '').slice(0, 5000),
          coverURL: rawCover.length <= 5000 ? rawCover : '',
          bio: (mappedAndroid?.bio || 'Reading, writing, and connecting on Redcover.').slice(0, 1000),
          followersCount: Math.max(0, Math.round(Number(mappedAndroid?.followersCount) || 0)),
          followingCount: Math.max(0, Math.round(Number(mappedAndroid?.followingCount) || 0)),
          booksCount: Math.max(0, Math.round(Number(mappedAndroid?.booksCount) || 0)),
          streakDays: Math.max(0, Math.round(Number(mappedAndroid?.streakDays) || 0)),
          points: Math.max(0, Math.round(Number(mappedAndroid?.points) || 0)),
          membershipPlan: mappedAndroid?.membershipPlan === 'premium' ? ('premium' as const) : ('free' as const),
          isOnline: false,
          showOnlineStatus: true,
          publicActivity: true,
          role: 'author' as const,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        await setDoc(userRef, newProfile);
      }

      const privSnap = await getDoc(privRef);
      if (!privSnap.exists()) {
        const savedLocalTheme = localStorage.getItem('rc_theme');
        const initTheme: AppTheme = savedLocalTheme === 'dark' ? 'dark' : 'light';
        await setDoc(privRef, {
          uid: fbUser.uid,
          email: (fbUser.email || '').slice(0, 254),
          readingReminders: true,
          notificationSettings: 'all',
          theme: initTheme,
          subscriptionExpiry: '',
          updatedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      console.warn('Profile initialization check:', error);
    }
  }, []);

  const syncPrivateInfoDoc = useCallback(
    async (
      fbUser: FirebaseUser,
      updates: Partial<Pick<UserPrivateInfo, 'email' | 'readingReminders' | 'notificationSettings' | 'theme' | 'subscriptionExpiry'>>
    ) => {
      await ensureUserProfile(fbUser);
      const privRef = doc(db, 'users', fbUser.uid, 'private', 'info');
      const privSnap = await getDoc(privRef);
      if (!privSnap.exists()) {
        const savedLocalTheme = localStorage.getItem('rc_theme');
        const defaultTheme: AppTheme = savedLocalTheme === 'dark' ? 'dark' : 'light';
        await setDoc(privRef, {
          uid: fbUser.uid,
          email: (updates.email ?? fbUser.email ?? '').slice(0, 254),
          readingReminders: updates.readingReminders ?? true,
          notificationSettings: updates.notificationSettings ?? 'all',
          theme: updates.theme ?? defaultTheme,
          subscriptionExpiry: (updates.subscriptionExpiry ?? '').slice(0, 64),
          updatedAt: serverTimestamp(),
        });
      } else {
        const payload: Record<string, any> = {
          updatedAt: serverTimestamp(),
        };
        if (updates.email !== undefined) payload.email = updates.email.slice(0, 254);
        if (updates.readingReminders !== undefined) payload.readingReminders = updates.readingReminders;
        if (updates.notificationSettings !== undefined) payload.notificationSettings = updates.notificationSettings;
        if (updates.theme !== undefined) payload.theme = updates.theme;
        if (updates.subscriptionExpiry !== undefined) payload.subscriptionExpiry = updates.subscriptionExpiry.slice(0, 64);
        await updateDoc(privRef, payload);
      }
    },
    [ensureUserProfile]
  );

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        const token = await fbUser.getIdTokenResult().catch(() => null);
        setHqRole(typeof token?.claims.hqRole === 'string' ? token.claims.hqRole : null);
        setHqPermissions(Array.isArray(token?.claims.hqPermissions) ? token.claims.hqPermissions as string[] : []);
        await ensureUserProfile(fbUser);
      } else {
        setHqRole(null);
        setHqPermissions([]);
        setCurrentUser(null);
        setPrivateInfo(null);
      }
      setAuthLoading(false);
    });
    return () => unsub();
  }, [ensureUserProfile]);

  const refreshHqClaims = useCallback(async () => {
    if (!firebaseUser) {
      setHqRole(null);
      setHqPermissions([]);
      return;
    }
    await firebaseUser.getIdToken(true);
    const token = await firebaseUser.getIdTokenResult();
    setHqRole(typeof token.claims.hqRole === 'string' ? token.claims.hqRole : null);
    setHqPermissions(Array.isArray(token.claims.hqPermissions) ? token.claims.hqPermissions as string[] : []);
  }, [firebaseUser]);
  const hasHqPermission = useCallback(
    (permission: string) => hqRole === 'owner' || hqPermissions.includes('*') || hqPermissions.includes(permission),
    [hqRole, hqPermissions]
  );

  // Listen to currentUser profile in both `db` and `defaultDb`
  useEffect(() => {
    if (!firebaseUser) return;
    const userRef = doc(db, 'users', firebaseUser.uid);
    const privRef = doc(db, 'users', firebaseUser.uid, 'private', 'info');

    // Check for cached profile in localStorage
    const savedPlan = (localStorage.getItem('rc_member_plan') as 'free' | 'premium' | null) || 'free';
    let cachedProfile: UserProfile | null = null;
    try {
      const raw = localStorage.getItem(`rc_cached_user_${firebaseUser.uid}`);
      if (raw) cachedProfile = JSON.parse(raw);
    } catch {}

    const unsubUser = onSnapshot(
      userRef,
      (snap) => {
        if (snap.exists()) {
          const docData = normalizeUserDoc(snap.id, snap.data());
          // Respect savedPlan if set in this browser session
          const finalProfile: UserProfile = {
            ...docData,
            membershipPlan: savedPlan === 'premium' ? 'premium' : docData.membershipPlan,
          };
          setCurrentUser(finalProfile);
          try {
            localStorage.setItem(`rc_cached_user_${firebaseUser.uid}`, JSON.stringify(finalProfile));
          } catch {}
          bumpSync();
        } else {
          // Fallback to cached or Firebase Auth profile
          const baseProfile: UserProfile = cachedProfile || {
            uid: firebaseUser.uid,
            username: (firebaseUser.email?.split('@')[0] || 'reader').replace(/[^a-zA-Z0-9_]/g, ''),
            displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Redcover User',
            photoURL: firebaseUser.photoURL || '',
            coverURL: '',
            bio: 'Connected via Redcover Firebase Auth',
            followersCount: 0,
            followingCount: 0,
            booksCount: 0,
            streakDays: 0,
            points: 0,
            membershipPlan: savedPlan,
            isOnline: false,
            showOnlineStatus: true,
            publicActivity: true,
            role: 'author',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          setCurrentUser(baseProfile);
        }
      },
      (error) => {
        console.warn('User profile listener notice:', error);
        if (cachedProfile) {
          setCurrentUser(cachedProfile);
        }
      }
    );

    const unsubPriv = onSnapshot(
      privRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          const savedLocalTheme = localStorage.getItem('rc_theme');
          const validThemes: AppTheme[] = ['light', 'dark'];
          const resolvedTheme: AppTheme =
            data.theme === 'dark' || savedLocalTheme === 'dark' ? 'dark' : 'light';
          const info: UserPrivateInfo = {
            uid: String(data.uid || firebaseUser.uid),
            email: String(data.email || firebaseUser.email || ''),
            readingReminders: Boolean(data.readingReminders ?? true),
            notificationSettings:
              data.notificationSettings === 'important' || data.notificationSettings === 'none'
                ? data.notificationSettings
                : 'all',
            theme: resolvedTheme,
            subscriptionExpiry: String(data.subscriptionExpiry || ''),
            updatedAt: toIsoString(data.updatedAt),
          };
          setPrivateInfo(info);
          setThemeState(resolvedTheme);
          bumpSync();
        }
      },
      () => {}
    );

    return () => {
      unsubUser();
      unsubPriv();
    };
  }, [firebaseUser, bumpSync]);

  // Real-time listeners for `db` (Provisioned Firestore Database in `red-cover`)
  // Re-subscribes when authLoading or firebaseUser changes!
  useEffect(() => {
    if (authLoading) return;

    const isOwnerAdmin = hqRole === 'owner';
    const qBooks = isOwnerAdmin
      ? query(
          collection(db, 'books'),
          where('status', 'in', ['draft', 'published', 'pending', 'removed'])
        )
      : query(collection(db, 'books'), where('status', '==', 'published'));

    const unsubBooks = onSnapshot(
      qBooks,
      (snap) => {
        const list = snap.docs.map((d) => normalizeBookDoc(d.id, d.data(), 'applet'));
        setFirestoreBooks(list);
        setBooksLoading(false);
        bumpSync();
      },
      (error) => {
        setBooksLoading(false);
        handleFirestoreError(error, OperationType.LIST, 'books');
      }
    );

    const qUsers = query(
      collection(db, 'users'),
      where('role', 'in', ['user', 'author', 'admin'])
    );
    const unsubUsers = onSnapshot(
      qUsers,
      (snap) => {
        const list = snap.docs.map((d) => normalizeUserDoc(d.id, d.data()));
        setFirestoreUsers(list);
        bumpSync();
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'users');
      }
    );

    const qReviews = query(collection(db, 'reviews'), where('visibility', '==', 'public'));
    const unsubReviews = onSnapshot(
      qReviews,
      (snap) => {
        const list = snap.docs.map((d) => normalizeReviewDoc(d.id, d.data()));
        setReviews(list);
        bumpSync();
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'reviews');
      }
    );

    const qPublicProgress = query(collection(db, 'readingProgress'), where('isPublic', '==', true));
    const unsubPublicProgress = onSnapshot(
      qPublicProgress,
      (snap) => {
        const list = snap.docs
          .map((d) => normalizeProgressDoc(d.id, d.data()))
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        setPublicReadingProgress(list);
        bumpSync();
      },
      () => {}
    );

    const qPosts = query(collection(db, 'posts'), where('visibility', '==', 'public'));
    const unsubPosts = onSnapshot(
      qPosts,
      (snap) => {
        const list = snap.docs
          .map((d) => normalizeSocialPostDoc(d.id, d.data()))
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setSocialPosts(list);
        bumpSync();
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'posts');
      }
    );

    const qPostLikes = query(collection(db, 'postLikes'), where('postId', '>=', ''));
    const unsubPostLikes = onSnapshot(
      qPostLikes,
      (snap) => {
        setPostLikes(
          snap.docs.map((d) => ({
            id: d.id,
            postId: String(d.data().postId || ''),
            userId: String(d.data().userId || ''),
            createdAt: toIsoString(d.data().createdAt),
          }))
        );
        bumpSync();
      },
      () => {}
    );

    const qPostComments = query(collection(db, 'postComments'), where('postId', '>=', ''));
    const unsubPostComments = onSnapshot(
      qPostComments,
      (snap) => {
        const list = snap.docs
          .map((d) => normalizePostCommentDoc(d.id, d.data()))
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        setFirestorePostComments(list);
        bumpSync();
      },
      (err) => {
        console.warn('postComments listener warning:', err);
      }
    );

    return () => {
      unsubBooks();
      unsubUsers();
      unsubReviews();
      unsubPublicProgress();
      unsubPosts();
      unsubPostLikes();
      unsubPostComments();
    };
  }, [authLoading, firebaseUser, hqRole, bumpSync]);

  // Real-time listeners for `(default)` Firestore database in `red-cover` (Android App DB)
  // Re-runs whenever `firebaseUser` changes so authenticated rules (`request.auth != null`) succeed!
  useEffect(() => {
    if (authLoading) return;

    const unsubs: (() => void)[] = [];
    const bookCollections = ['books', 'Books', 'stories', 'Stories', 'pdf_books', 'ebooks'];
    const userCollections = ['users', 'Users', 'authors'];
    const bookMap = new Map<string, Book>();
    const userMap = new Map<string, UserProfile>();

    const updateDefaultBooks = () => {
      setDefaultDbBooks(Array.from(bookMap.values()));
      bumpSync();
    };
    const updateDefaultUsers = () => {
      setDefaultDbUsers(Array.from(userMap.values()));
      bumpSync();
    };

    for (const colName of bookCollections) {
      try {
        const unsub = onSnapshot(
          collection(defaultDb, colName),
          (snap) => {
            setDefaultDbError(null);
            snap.docs.forEach((d) => {
              bookMap.set(d.id, normalizeBookDoc(d.id, d.data(), 'default'));
            });
            if (!snap.empty) updateDefaultBooks();
          },
          (err) => {
            if (colName === 'books') {
              setDefaultDbError(err.message);
            }
          }
        );
        unsubs.push(unsub);
      } catch {
        // Ignore
      }
    }

    for (const colName of userCollections) {
      try {
        const unsub = onSnapshot(
          collection(defaultDb, colName),
          (snap) => {
            snap.docs.forEach((d) => {
              userMap.set(d.id, normalizeUserDoc(d.id, d.data()));
            });
            if (!snap.empty) updateDefaultUsers();
          },
          () => {}
        );
        unsubs.push(unsub);
      } catch {
        // Ignore
      }
    }

    try {
      const unsubDefComments = onSnapshot(
        collection(defaultDb, 'postComments'),
        (snap) => {
          const list = snap.docs
            .map((d) => normalizePostCommentDoc(d.id, d.data()))
            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
          setDefaultDbPostComments(list);
          bumpSync();
        },
        () => {}
      );
      unsubs.push(unsubDefComments);
    } catch {
      // Ignore
    }

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [authLoading, firebaseUser, bumpSync]);

  // Also listen to Firebase Realtime Database (`rtdb`) in `red-cover` if Android uses RTDB
  useEffect(() => {
    if (authLoading || !rtdb) return;
    const unsubs: (() => void)[] = [];
    const rtdbBookPaths = ['books', 'Books', 'stories', 'pdf_books'];
    const rtdbUserPaths = ['users', 'Users'];
    const rBooks = new Map<string, Book>();
    const rUsers = new Map<string, UserProfile>();

    for (const path of rtdbBookPaths) {
      try {
        const r = rtdbRef(rtdb, path);
        const unsub = onValue(
          r,
          (snap) => {
            if (snap.exists() && typeof snap.val() === 'object') {
              const val = snap.val() as Record<string, any>;
              Object.entries(val).forEach(([k, v]) => {
                if (v && typeof v === 'object') {
                  rBooks.set(k, normalizeBookDoc(k, v, 'default'));
                }
              });
              setRtdbBooks(Array.from(rBooks.values()));
              bumpSync();
            }
          },
          () => {}
        );
        unsubs.push(unsub);
      } catch {
        // Ignore
      }
    }

    for (const path of rtdbUserPaths) {
      try {
        const r = rtdbRef(rtdb, path);
        const unsub = onValue(
          r,
          (snap) => {
            if (snap.exists() && typeof snap.val() === 'object') {
              const val = snap.val() as Record<string, any>;
              Object.entries(val).forEach(([k, v]) => {
                if (v && typeof v === 'object') {
                  rUsers.set(k, normalizeUserDoc(k, v));
                }
              });
              setRtdbUsers(Array.from(rUsers.values()));
              bumpSync();
            }
          },
          () => {}
        );
        unsubs.push(unsub);
      } catch {
        // Ignore
      }
    }

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [authLoading, firebaseUser, bumpSync]);

  // Authenticated User Real-Time Listeners
  useEffect(() => {
    if (!firebaseUser) {
      setMyAuthoredBooks([]);
      setReadingProgress([]);
      setSavedBooks([]);
      setLikedBooks([]);
      setFollows([]);
      setFriendships([]);
      setChats([]);
      setGroups([]);
      setGroupInvitations([]);
      setReadingSessions([]);
      setReadingInvitations([]);
      setNotifications([]);
      setReports([]);
      return;
    }

    const uid = firebaseUser.uid;
    const isOwnerAdmin = hqRole === 'owner';

    const qMyBooks = query(collection(db, 'books'), where('authorId', '==', uid));
    const unsubMyBooks = onSnapshot(
      qMyBooks,
      (snap) => {
        setMyAuthoredBooks(snap.docs.map((d) => normalizeBookDoc(d.id, d.data(), 'applet')));
        bumpSync();
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'books')
    );

    const qProgress = query(collection(db, 'readingProgress'), where('userId', '==', uid));
    const unsubProgress = onSnapshot(
      qProgress,
      (snap) => {
        setReadingProgress(snap.docs.map((d) => normalizeProgressDoc(d.id, d.data())));
        bumpSync();
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'readingProgress')
    );

    const qSaves = query(collection(db, 'saves'), where('userId', '==', uid));
    const unsubSaves = onSnapshot(
      qSaves,
      (snap) => {
        setSavedBooks(
          snap.docs.map((d) => ({
            id: d.id,
            userId: String(d.data().userId || uid),
            bookId: String(d.data().bookId || ''),
            createdAt: toIsoString(d.data().createdAt),
          }))
        );
        bumpSync();
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'saves')
    );

    const qLikes = query(collection(db, 'likes'), where('userId', '==', uid));
    const unsubLikes = onSnapshot(
      qLikes,
      (snap) => {
        setLikedBooks(
          snap.docs.map((d) => ({
            id: d.id,
            userId: String(d.data().userId || uid),
            bookId: String(d.data().bookId || ''),
            targetAuthorId: String(d.data().targetAuthorId || ''),
            createdAt: toIsoString(d.data().createdAt),
          }))
        );
        bumpSync();
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'likes')
    );

    const qFollowsOut = query(collection(db, 'follows'), where('followerId', '==', uid));
    const qFollowsIn = query(collection(db, 'follows'), where('followingId', '==', uid));
    let outFollows: Follow[] = [];
    let inFollows: Follow[] = [];
    const mergeFollows = () => {
      const map = new Map<string, Follow>();
      [...outFollows, ...inFollows].forEach((f) => map.set(f.id, f));
      setFollows(Array.from(map.values()));
    };
    const unsubFollowsOut = onSnapshot(
      qFollowsOut,
      (snap) => {
        outFollows = snap.docs.map((d) => ({
          id: d.id,
          followerId: String(d.data().followerId),
          followingId: String(d.data().followingId),
          followerName: String(d.data().followerName || ''),
          followingName: String(d.data().followingName || ''),
          createdAt: toIsoString(d.data().createdAt),
        }));
        mergeFollows();
        bumpSync();
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'follows')
    );
    const unsubFollowsIn = onSnapshot(
      qFollowsIn,
      (snap) => {
        inFollows = snap.docs.map((d) => ({
          id: d.id,
          followerId: String(d.data().followerId),
          followingId: String(d.data().followingId),
          followerName: String(d.data().followerName || ''),
          followingName: String(d.data().followingName || ''),
          createdAt: toIsoString(d.data().createdAt),
        }));
        mergeFollows();
        bumpSync();
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'follows')
    );

    const qFriendReq = query(collection(db, 'friendships'), where('requesterId', '==', uid));
    const qFriendRec = query(collection(db, 'friendships'), where('receiverId', '==', uid));
    let reqFriends: Friendship[] = [];
    let recFriends: Friendship[] = [];
    const mergeFriendships = () => {
      const map = new Map<string, Friendship>();
      [...reqFriends, ...recFriends].forEach((f) => map.set(f.id, f));
      setFriendships(Array.from(map.values()));
    };
    const unsubFriendReq = onSnapshot(
      qFriendReq,
      (snap) => {
        reqFriends = snap.docs.map((d) => ({
          id: d.id,
          requesterId: String(d.data().requesterId),
          receiverId: String(d.data().receiverId),
          requesterName: String(d.data().requesterName || ''),
          receiverName: String(d.data().receiverName || ''),
          requesterAvatar: String(d.data().requesterAvatar || ''),
          receiverAvatar: String(d.data().receiverAvatar || ''),
          status: d.data().status as FriendshipStatus,
          createdAt: toIsoString(d.data().createdAt),
          updatedAt: toIsoString(d.data().updatedAt),
        }));
        mergeFriendships();
        bumpSync();
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'friendships')
    );
    const unsubFriendRec = onSnapshot(
      qFriendRec,
      (snap) => {
        recFriends = snap.docs.map((d) => ({
          id: d.id,
          requesterId: String(d.data().requesterId),
          receiverId: String(d.data().receiverId),
          requesterName: String(d.data().requesterName || ''),
          receiverName: String(d.data().receiverName || ''),
          requesterAvatar: String(d.data().requesterAvatar || ''),
          receiverAvatar: String(d.data().receiverAvatar || ''),
          status: d.data().status as FriendshipStatus,
          createdAt: toIsoString(d.data().createdAt),
          updatedAt: toIsoString(d.data().updatedAt),
        }));
        mergeFriendships();
        bumpSync();
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'friendships')
    );

    const qChatsA = query(collection(db, 'chats'), where('participantA', '==', uid));
    const qChatsB = query(collection(db, 'chats'), where('participantB', '==', uid));
    let chatsA: Chat[] = [];
    let chatsB: Chat[] = [];

    const mergeChatRecord = (existing: Chat | undefined, incoming: Chat): Chat => {
      if (!existing) return incoming;
      const existingTime = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
      const incomingTime = incoming.updatedAt ? new Date(incoming.updatedAt).getTime() : 0;

      // If existing is distinctly newer than incoming (by more than 800ms), don't revert lastMessage/updatedAt
      if (existingTime > incomingTime + 800) {
        return {
          ...incoming,
          lastMessage: existing.lastMessage,
          lastSenderId: existing.lastSenderId,
          updatedAt: existing.updatedAt,
          unreadCountA: existing.unreadCountA === 0 ? 0 : incoming.unreadCountA,
          unreadCountB: existing.unreadCountB === 0 ? 0 : incoming.unreadCountB,
        };
      }

      return {
        ...existing,
        ...incoming,
        unreadCountA: (existing.unreadCountA === 0 && incomingTime <= existingTime) ? 0 : incoming.unreadCountA,
        unreadCountB: (existing.unreadCountB === 0 && incomingTime <= existingTime) ? 0 : incoming.unreadCountB,
      };
    };

    const mergeChats = () => {
      setChats((prev) => {
        const incoming = [...chatsA, ...chatsB];
        let changed = false;
        const map = new Map<string, Chat>();
        prev.forEach((c) => map.set(c.id, c));
        for (const c of incoming) {
          const existing = map.get(c.id);
          const merged = mergeChatRecord(existing, c);
          if (
            !existing ||
            existing.lastMessage !== merged.lastMessage ||
            existing.unreadCountA !== merged.unreadCountA ||
            existing.unreadCountB !== merged.unreadCountB ||
            existing.lastSenderId !== merged.lastSenderId ||
            existing.updatedAt !== merged.updatedAt
          ) {
            map.set(c.id, merged);
            changed = true;
          }
        }
        if (!changed && map.size === prev.length) return prev;
        return Array.from(map.values()).sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
      });
    };
    const mapChatDoc = (id: string, raw: Record<string, any>): Chat => ({
      id,
      participantA: String(raw.participantA),
      participantB: String(raw.participantB),
      participantAName: String(raw.participantAName || 'Reader'),
      participantBName: String(raw.participantBName || 'Reader'),
      participantAAvatar: String(raw.participantAAvatar || ''),
      participantBAvatar: String(raw.participantBAvatar || ''),
      lastMessage: String(raw.lastMessage || ''),
      lastSenderId: String(raw.lastSenderId || ''),
      unreadCountA: Number(raw.unreadCountA ?? 0),
      unreadCountB: Number(raw.unreadCountB ?? 0),
      hiddenFor: Array.isArray(raw.hiddenFor) ? raw.hiddenFor.map(String) : [],
      createdAt: toIsoString(raw.createdAt),
      updatedAt: toIsoString(raw.updatedAt),
    });

    const unsubChatsA = onSnapshot(
      qChatsA,
      (snap) => {
        chatsA = snap.docs.map((d) => mapChatDoc(d.id, d.data())).filter((chat) => !chat.hiddenFor?.includes(uid));
        mergeChats();
        bumpSync();
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'chats')
    );
    const unsubChatsB = onSnapshot(
      qChatsB,
      (snap) => {
        chatsB = snap.docs.map((d) => mapChatDoc(d.id, d.data())).filter((chat) => !chat.hiddenFor?.includes(uid));
        mergeChats();
        bumpSync();
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'chats')
    );

    const qNotifs = query(collection(db, 'notifications'), where('recipientId', '==', uid));
    const unsubNotifs = onSnapshot(
      qNotifs,
      (snap) => {
        const list = snap.docs
          .map((d) => ({
            id: d.id,
            recipientId: String(d.data().recipientId),
            actorId: String(d.data().actorId),
            actorName: String(d.data().actorName || 'Redcover'),
            category: d.data().category as NotificationItem['category'],
            title: String(d.data().title || ''),
            body: String(d.data().body || ''),
            link: String(d.data().link || '/'),
            read: Boolean(d.data().read),
            createdAt: toIsoString(d.data().createdAt),
            updatedAt: toIsoString(d.data().updatedAt),
          }))
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setNotifications(list);
        bumpSync();
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'notifications')
    );

    const qReports = isOwnerAdmin
      ? query(collection(db, 'reports'), where('status', 'in', ['open', 'resolved', 'dismissed']))
      : query(collection(db, 'reports'), where('reporterId', '==', uid));
    const unsubReports = onSnapshot(
      qReports,
      (snap) => {
        setReports(
          snap.docs.map((d) => ({
            id: d.id,
            reporterId: String(d.data().reporterId),
            targetType: d.data().targetType === 'user' ? 'user' : 'book',
            targetId: String(d.data().targetId),
            targetTitle: String(d.data().targetTitle || ''),
            reason: String(d.data().reason || ''),
            status:
              d.data().status === 'resolved' || d.data().status === 'dismissed'
                ? d.data().status
                : 'open',
            createdAt: toIsoString(d.data().createdAt),
            updatedAt: toIsoString(d.data().updatedAt),
          }))
        );
        bumpSync();
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'reports')
    );

    const qGroups = query(collection(db, 'groups'), where('members', 'array-contains', uid));
    const unsubGroups = onSnapshot(
      qGroups,
      (snap) => {
        setGroups(
          snap.docs.map((d) => ({
            id: d.id,
            name: String(d.data().name || 'Group'),
            description: String(d.data().description || ''),
            avatarURL: String(d.data().avatarURL || ''),
            creatorId: String(d.data().creatorId || ''),
            creatorName: String(d.data().creatorName || 'Member'),
            admins: Array.isArray(d.data().admins) ? d.data().admins : [],
            members: Array.isArray(d.data().members) ? d.data().members : [],
            pendingInvitees: Array.isArray(d.data().pendingInvitees) ? d.data().pendingInvitees : [],
            lastMessage: d.data().lastMessage ? String(d.data().lastMessage) : undefined,
            lastSenderId: d.data().lastSenderId ? String(d.data().lastSenderId) : undefined,
            lastMessageAt: d.data().lastMessageAt ? toIsoString(d.data().lastMessageAt) : undefined,
            createdAt: toIsoString(d.data().createdAt),
            updatedAt: toIsoString(d.data().updatedAt),
          }))
        );
        bumpSync();
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'groups')
    );

    const qGroupInvs = query(collection(db, 'groupInvitations'), where('inviteeId', '==', uid));
    const unsubGroupInvs = onSnapshot(
      qGroupInvs,
      (snap) => {
        setGroupInvitations(
          snap.docs.map((d) => ({
            id: d.id,
            groupId: String(d.data().groupId),
            groupName: String(d.data().groupName || 'Group'),
            groupAvatar: String(d.data().groupAvatar || ''),
            inviterId: String(d.data().inviterId),
            inviterName: String(d.data().inviterName || 'Reader'),
            inviteeId: String(d.data().inviteeId),
            inviteeName: String(d.data().inviteeName || 'Reader'),
            status: (d.data().status as GroupInvitation['status']) || 'pending',
            createdAt: toIsoString(d.data().createdAt),
            updatedAt: toIsoString(d.data().updatedAt),
          }))
        );
        bumpSync();
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'groupInvitations')
    );

    const qReadingHost = query(collection(db, 'readingSessions'), where('hostId', '==', uid));
    const qReadingPart = query(collection(db, 'readingSessions'), where('participantId', '==', uid));
    let hostSessions: ReadingSession[] = [];
    let partSessions: ReadingSession[] = [];
    const mergeReadingSessions = () => {
      const map = new Map<string, ReadingSession>();
      [...hostSessions, ...partSessions].forEach((s) => map.set(s.id, s));
      setReadingSessions(Array.from(map.values()));
    };

    const mapReadingSession = (d: any): ReadingSession => ({
      id: d.id,
      bookId: String(d.data().bookId || ''),
      bookTitle: String(d.data().bookTitle || 'Book'),
      bookCover: String(d.data().bookCover || ''),
      bookFormat: (d.data().bookFormat as any) || 'story',
      hostId: String(d.data().hostId || ''),
      hostName: String(d.data().hostName || 'Host'),
      hostAvatar: String(d.data().hostAvatar || ''),
      participantId: d.data().participantId ? String(d.data().participantId) : undefined,
      participantName: d.data().participantName ? String(d.data().participantName) : undefined,
      participantAvatar: d.data().participantAvatar ? String(d.data().participantAvatar) : undefined,
      status: (d.data().status as ReadingSession['status']) || 'waiting',
      currentChapter: Number(d.data().currentChapter || 1),
      currentPage: Number(d.data().currentPage || 1),
      scrollPosition: Number(d.data().scrollPosition || 0),
      activeControllerId: String(d.data().activeControllerId || ''),
      activeControllerName: String(d.data().activeControllerName || 'Reader'),
      controllerLeaseUntil: Number(d.data().controllerLeaseUntil || 0),
      createdAt: toIsoString(d.data().createdAt),
      updatedAt: toIsoString(d.data().updatedAt),
    });

    const unsubReadingHost = onSnapshot(
      qReadingHost,
      (snap) => {
        hostSessions = snap.docs.map(mapReadingSession);
        mergeReadingSessions();
        bumpSync();
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'readingSessions')
    );
    const unsubReadingPart = onSnapshot(
      qReadingPart,
      (snap) => {
        partSessions = snap.docs.map(mapReadingSession);
        mergeReadingSessions();
        bumpSync();
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'readingSessions')
    );

    const qReadingInvs = query(collection(db, 'readingInvitations'), where('inviteeId', '==', uid));
    const unsubReadingInvs = onSnapshot(
      qReadingInvs,
      (snap) => {
        setReadingInvitations(
          snap.docs.map((d) => ({
            id: d.id,
            sessionId: String(d.data().sessionId || ''),
            bookId: String(d.data().bookId || ''),
            bookTitle: String(d.data().bookTitle || 'Book'),
            bookCover: String(d.data().bookCover || ''),
            inviterId: String(d.data().inviterId || ''),
            inviterName: String(d.data().inviterName || 'Reader'),
            inviterAvatar: String(d.data().inviterAvatar || ''),
            inviteeId: String(d.data().inviteeId || ''),
            inviteeName: String(d.data().inviteeName || 'Reader'),
            personalMessage: String(d.data().personalMessage || ''),
            status: (d.data().status as ReadingInvitation['status']) || 'pending',
            createdAt: toIsoString(d.data().createdAt),
            updatedAt: toIsoString(d.data().updatedAt),
          }))
        );
        bumpSync();
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'readingInvitations')
    );

    return () => {
      unsubMyBooks();
      unsubProgress();
      unsubSaves();
      unsubLikes();
      unsubFollowsOut();
      unsubFollowsIn();
      unsubFriendReq();
      unsubFriendRec();
      unsubChatsA();
      unsubChatsB();
      unsubGroups();
      unsubGroupInvs();
      unsubReadingHost();
      unsubReadingPart();
      unsubReadingInvs();
      unsubNotifs();
      unsubReports();
    };
  }, [firebaseUser, hqRole, bumpSync]);

  // Combine ONLY real Firebase books from `rtdb`, `defaultDb` (Android DB), and `db` (Web DB)
  // Never allow an empty coverURL/fileURL/authorAvatar in `db` to overwrite a valid cover from `defaultDb` or `rtdb`.
  const books = useMemo(() => {
    const map = new Map<string, Book>();
    const mergeIntoMap = (b: Book) => {
      const existing = map.get(b.id);
      if (!existing) {
        map.set(b.id, b);
        return;
      }
      map.set(b.id, {
        ...existing,
        ...b,
        coverURL: b.coverURL || existing.coverURL || '',
        fileURL: b.fileURL || existing.fileURL || '',
        authorAvatar: b.authorAvatar || existing.authorAvatar || '',
        description:
          b.description && b.description !== 'No description provided.'
            ? b.description
            : existing.description || b.description,
        shortDescription: b.shortDescription || existing.shortDescription || '',
        views: Math.max(b.views, existing.views),
        likes: Math.max(b.likes, existing.likes),
        saves: Math.max(b.saves, existing.saves),
        reviewsCount: Math.max(b.reviewsCount, existing.reviewsCount),
      });
    };

    rtdbBooks.forEach(mergeIntoMap);
    defaultDbBooks.forEach(mergeIntoMap);
    firestoreBooks.forEach(mergeIntoMap);
    myAuthoredBooks.forEach(mergeIntoMap);

    return Array.from(map.values())
      .filter((book) => !DEMO_BOOK_IDS.has(book.id))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [rtdbBooks, defaultDbBooks, firestoreBooks, myAuthoredBooks]);

  // Self-heal any book in `db` that was previously mirrored with an empty coverURL when `defaultDb` or `rtdb` has the real coverURL
  useEffect(() => {
    if (!firebaseUser) return;
    const isOwnerAdmin = hqRole === 'owner';
    const externalBooks = [...defaultDbBooks, ...rtdbBooks];
    externalBooks.forEach((extBook) => {
      if (!extBook.coverURL || extBook.coverURL.length > 5000) return;
      const appletMatch = firestoreBooks.find((fb) => fb.id === extBook.id);
      if (appletMatch && !appletMatch.coverURL && (isOwnerAdmin || appletMatch.authorId === firebaseUser.uid)) {
        updateDoc(doc(db, 'books', extBook.id), {
          coverURL: extBook.coverURL,
          updatedAt: serverTimestamp(),
        }).catch(() => {});
      }
    });
  }, [firebaseUser, hqRole, defaultDbBooks, rtdbBooks, firestoreBooks]);

  // Real-time presence monitoring with Firebase RTDB .info/connected & Firestore sync
  useEffect(() => {
    if (!firebaseUser) return;
    const showOnline = currentUser?.showOnlineStatus ?? true;
    const cleanupPresence = initUserPresence(firebaseUser.uid, showOnline);
    return () => {
      cleanupPresence();
    };
  }, [firebaseUser, currentUser?.showOnlineStatus]);

  // Combine ONLY real Firebase users from `rtdb`, `defaultDb` (Android DB), and `db` (Web DB)
  // Protected system account (engeeo.io@gmail.com) is strictly excluded from public directory!
  const users = useMemo(() => {
    const map = new Map<string, UserProfile>();
    const mergeUser = (u: UserProfile) => {
      if (isSystemAccount(u)) return;
      const existing = map.get(u.uid);
      if (!existing) {
        map.set(u.uid, u);
        return;
      }
      map.set(u.uid, {
        ...existing,
        ...u,
        photoURL: u.photoURL || existing.photoURL || '',
        coverURL: u.coverURL || existing.coverURL || '',
        followersCount: Math.max(u.followersCount, existing.followersCount),
        booksCount: Math.max(u.booksCount, existing.booksCount),
      });
    };
    rtdbUsers.forEach(mergeUser);
    defaultDbUsers.forEach(mergeUser);
    firestoreUsers.forEach(mergeUser);
    if (currentUser && !isSystemAccount(currentUser)) mergeUser(currentUser);
    return Array.from(map.values()).filter((user) => !DEMO_USER_IDS.has(user.uid));
  }, [rtdbUsers, defaultDbUsers, firestoreUsers, currentUser]);

  // Merge starter book/chapter/paragraph discussions, bridged reviews, defaultDb comments, Firestore comments, and optimistic local comments
  const postComments = useMemo(() => {
    const deletedSet = new Set(deletedCommentIds);
    const map = new Map<string, PostComment>();

    // 1. Bridge existing book reviews into the book's main discussion thread so existing feedback is visible
    reviews.forEach((rev) => {
      const cleanBookId = rev.bookId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
      const bookPostId = `book_pub_${cleanBookId}`.slice(0, 80);
      const cmtId = `rev_cmt_${rev.id}`;
      if (!deletedSet.has(cmtId)) {
        map.set(cmtId, {
          id: cmtId,
          postId: bookPostId,
          userId: rev.userId,
          userName: rev.userName || 'Reader',
          userUsername: (rev.userName || 'reader').toLowerCase().replace(/[^a-z0-9_]/g, '') || 'reader',
          userAvatar: rev.userAvatar || '',
          text: `⭐ ${rev.rating}/5 — ${rev.text}`,
          createdAt: rev.createdAt,
          updatedAt: rev.updatedAt,
        });
      }
    });

    // Merge real Firestore comments from `defaultDb`, `db`, and optimistic `localPostComments`
    defaultDbPostComments.forEach((c) => {
      if (!deletedSet.has(c.id)) map.set(c.id, c);
    });
    firestorePostComments.forEach((c) => {
      if (!deletedSet.has(c.id)) map.set(c.id, c);
    });
    localPostComments.forEach((c) => {
      if (!deletedSet.has(c.id)) map.set(c.id, c);
    });

    return Array.from(map.values())
      .filter((comment) => comment.moderationHidden !== true)
      .filter((comment) => !comment.id.startsWith('seed_'))
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [
    books,
    reviews,
    defaultDbPostComments,
    firestorePostComments,
    localPostComments,
    deletedCommentIds,
  ]);

  const isAdmin = useMemo(() => {
    if (!firebaseUser) return false;
    return hqRole === 'owner';
  }, [firebaseUser, hqRole]);

  const sourceStats: FirebaseSourceStats = useMemo(
    () => ({
      appletDbBooks: firestoreBooks.length,
      appletDbUsers: firestoreUsers.length,
      defaultDbBooks: defaultDbBooks.length,
      defaultDbUsers: defaultDbUsers.length,
      rtdbBooks: rtdbBooks.length,
      rtdbUsers: rtdbUsers.length,
      defaultDbError,
    }),
    [firestoreBooks.length, firestoreUsers.length, defaultDbBooks.length, defaultDbUsers.length, rtdbBooks.length, rtdbUsers.length, defaultDbError]
  );

  // Ensure a book exists in `db` before writing relational records, and also mirror to `defaultDb` if possible
  const ensureBookInFirestore = useCallback(
    async (book: Book) => {
      if (!firebaseUser) return;
      await ensureUserProfile(firebaseUser);
      const safeBookId = sanitizeId(book.id, 'book');
      const bookRef = doc(db, 'books', safeBookId);
      const snap = await getDoc(bookRef);
      if (!snap.exists()) {
        const validBookAuthorId =
          isAdmin && book.authorId && /^[a-zA-Z0-9_-]{1,128}$/.test(book.authorId)
            ? book.authorId
            : firebaseUser.uid;
        const safeTitle = (book.title || 'Untitled Book').trim().slice(0, 200) || 'Untitled Book';
        const safeDesc = (book.description || book.shortDescription || safeTitle).trim().slice(0, 5000);
        const safeShortDesc = (book.shortDescription || safeDesc).trim().slice(0, 400);
        const safeAuthorName = (book.authorName || 'Independent Author').trim().slice(0, 120) || 'Independent Author';
        const safeAuthorUsername = (book.authorUsername || 'author').trim().slice(0, 80) || 'author';
        const safeCategory = (book.category || 'Fiction').trim().slice(0, 80) || 'Fiction';
        const safeLanguage = (book.language || 'English').trim().slice(0, 60) || 'English';
        const safeReviewsCount = Math.max(0, Math.round(Number(book.reviewsCount) || 0));
        const safeRating = safeReviewsCount > 0 && Number.isFinite(Number(book.rating))
          ? Math.min(5, Math.max(0, Number(book.rating)))
          : 0;

        const payload = {
          id: safeBookId,
          title: safeTitle,
          description: safeDesc,
          shortDescription: safeShortDesc,
          authorId: validBookAuthorId,
          authorName: safeAuthorName,
          authorUsername: safeAuthorUsername,
          authorAvatar: book.authorAvatar && book.authorAvatar.length <= 5000 ? book.authorAvatar : '',
          coverURL: book.coverURL && book.coverURL.length <= 5000 ? book.coverURL : '',
          fileURL: book.fileURL && book.fileURL.length <= 5000 ? book.fileURL : '',
          format: book.format === 'pdf' ? ('pdf' as const) : ('story' as const),
          availableModes: book.availableModes,
          category: safeCategory,
          language: safeLanguage,
          rating: safeRating,
          reviewsCount: safeReviewsCount,
          views: Math.max(0, Math.round(Number(book.views) || 0)),
          likes: Math.max(0, Math.round(Number(book.likes) || 0)),
          saves: Math.max(0, Math.round(Number(book.saves) || 0)),
          chaptersCount: Math.max(0, Math.round(Number(book.chaptersCount) || 1)),
          featured: Boolean(book.featured),
          status: 'published' as const,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        await setDoc(bookRef, payload);

        try {
          await setDoc(doc(defaultDb, 'books', safeBookId), payload, { merge: true });
        } catch {
          // Optional mirror to defaultDb
        }

      } else {
        const existingData = snap.data();
        if (
          !existingData.coverURL &&
          book.coverURL &&
          book.coverURL.length <= 5000 &&
          (isAdmin || existingData.authorId === firebaseUser.uid)
        ) {
          await updateDoc(bookRef, {
            coverURL: book.coverURL,
            updatedAt: serverTimestamp(),
          }).catch(() => {});
        }
      }
    },
    [firebaseUser, isAdmin, ensureUserProfile, sanitizeId]
  );

  const loginWithGoogle = useCallback(async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      addToast('Connected to your Redcover account!', 'success');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Google Sign-In failed.';
      addToast(msg, 'error');
      throw error;
    }
  }, [addToast]);

  const loginWithEmail = useCallback(
    async (email: string, pass: string) => {
      try {
        await signInWithEmailAndPassword(auth, email.trim(), pass);
        addToast('Signed in to red-cover!', 'success');
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Sign-In failed.';
        addToast(msg, 'error');
        throw error;
      }
    },
    [addToast]
  );

  const registerWithEmail = useCallback(
    async (email: string, pass: string, displayName: string, username: string) => {
      try {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), pass);
        await updateFirebaseAuthProfile(cred.user, { displayName: displayName.trim() });
        const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 40) || 'reader';
        await setDoc(doc(db, 'users', cred.user.uid), {
          uid: cred.user.uid,
          username: cleanUsername.length >= 2 ? cleanUsername : `rc_${cleanUsername}`,
          displayName: displayName.trim().slice(0, 100),
          photoURL: '',
          coverURL: '',
          bio: 'New reader & writer on Redcover.',
          followersCount: 0,
          followingCount: 0,
          booksCount: 0,
          streakDays: 0,
          points: 0,
          membershipPlan: 'free',
          isOnline: false,
          showOnlineStatus: true,
          publicActivity: true,
          role: 'author',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        addToast('Redcover account created!', 'success');
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Registration failed.';
        addToast(msg, 'error');
        throw error;
      }
    },
    [addToast]
  );

  const sendResetPassword = useCallback(
    async (email: string) => {
      try {
        await sendPasswordResetEmail(auth, email.trim());
        addToast('Password reset link sent to your email.', 'success');
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Could not send reset email.';
        addToast(msg, 'error');
        throw error;
      }
    },
    [addToast]
  );

  const logout = useCallback(async () => {
    await firebaseSignOut(auth);
    addToast('Signed out of Redcover.', 'info');
  }, [addToast]);

  const setTheme = useCallback(
    async (newTheme: AppTheme) => {
      setThemeState(newTheme);
      try {
        localStorage.setItem('rc_theme', newTheme);
      } catch {}

      addToast(`Theme set to ${newTheme.charAt(0).toUpperCase() + newTheme.slice(1)}.`, 'info');

      if (firebaseUser) {
        try {
          await syncPrivateInfoDoc(firebaseUser, { theme: newTheme });
        } catch (err) {
          console.warn('Theme sync notice:', err);
        }
      }
    },
    [firebaseUser, syncPrivateInfoDoc, addToast]
  );

  const addRecentSearch = useCallback((term: string) => {
    const clean = term.trim();
    if (!clean) return;
    setRecentSearches((prev) => {
      const next = [clean, ...prev.filter((i) => i.toLowerCase() !== clean.toLowerCase())].slice(0, 8);
      localStorage.setItem('rc_recent_searches', JSON.stringify(next));
      return next;
    });
  }, []);

  const clearRecentSearches = useCallback(() => {
    setRecentSearches([]);
    localStorage.removeItem('rc_recent_searches');
  }, []);

  const toggleSaveBook = useCallback(
    async (book: Book) => {
      if (!firebaseUser) {
        addToast('Please sign in to save books to your personal library.', 'info');
        return;
      }
      const safeBookId = sanitizeId(book.id, 'book');
      const saveId = sanitizeId(`${firebaseUser.uid}_${safeBookId}`, 'save');
      const existingSave = savedBooks.find((s) => s.id === saveId || s.bookId === safeBookId || s.bookId === book.id);
      const bookRef = doc(db, 'books', safeBookId);

      try {
        await ensureBookInFirestore(book);
        if (existingSave) {
          await deleteDoc(doc(db, 'saves', existingSave.id));
          const nextSaves = Math.max(0, Math.round(Number(book.saves) || 1) - 1);
          await updateDoc(bookRef, {
            saves: nextSaves,
            updatedAt: serverTimestamp(),
          }).catch(() => {});
          try {
            await updateDoc(doc(defaultDb, 'books', book.id), { saves: nextSaves });
          } catch {}
          addToast(`Removed "${book.title}" from Saved Library.`, 'info');
        } else {
          await setDoc(doc(db, 'saves', saveId), {
            id: saveId,
            userId: firebaseUser.uid,
            bookId: safeBookId,
            createdAt: serverTimestamp(),
          });
          const nextSaves = Math.max(0, Math.round(Number(book.saves) || 0)) + 1;
          await updateDoc(bookRef, {
            saves: nextSaves,
            updatedAt: serverTimestamp(),
          }).catch(() => {});
          try {
            await updateDoc(doc(defaultDb, 'books', book.id), { saves: nextSaves });
          } catch {}
          addToast(`Saved "${book.title}" to your library.`, 'success');
        }
      } catch (error) {
        addToast('Could not update saved library. Please verify your account login.', 'error');
        handleFirestoreError(error, OperationType.WRITE, `saves/${saveId}`);
      }
    },
    [firebaseUser, savedBooks, ensureBookInFirestore, sanitizeId, addToast]
  );

  const toggleLikeBook = useCallback(
    async (book: Book) => {
      if (!firebaseUser) {
        addToast('Please sign in to like books.', 'info');
        return;
      }
      const safeBookId = sanitizeId(book.id, 'book');
      const likeId = sanitizeId(`${firebaseUser.uid}_${safeBookId}`, 'like');
      const existingLike = likedBooks.find(
        (l) => (l.userId === firebaseUser.uid && (l.bookId === safeBookId || l.bookId === book.id)) || l.id === likeId
      );
      const bookRef = doc(db, 'books', safeBookId);
      const feedPostKey = `book_pub_${safeBookId}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
      const feedPostLikeId = `${firebaseUser.uid}_${feedPostKey}`.slice(0, 128);
      const existingFeedLike = postLikes.find(
        (l) => l.id === feedPostLikeId || (l.postId === feedPostKey && l.userId === firebaseUser.uid)
      );

      try {
        await ensureBookInFirestore(book);
        if (existingLike) {
          // Strictly toggle off: remove like
          await deleteDoc(doc(db, 'likes', existingLike.id));
          if (existingFeedLike) {
            await deleteDoc(doc(db, 'postLikes', existingFeedLike.id)).catch(() => {});
          }
          const nextLikes = Math.max(0, Math.round(Number(book.likes) || 1) - 1);
          await updateDoc(bookRef, {
            likes: increment(-1),
            updatedAt: serverTimestamp(),
          }).catch(async () => {
            await updateDoc(bookRef, { likes: nextLikes, updatedAt: serverTimestamp() });
          });
          try {
            await updateDoc(doc(defaultDb, 'books', book.id), { likes: nextLikes });
          } catch {}
          addToast(`Removed like from "${book.title}".`, 'info');
        } else {
          // Strictly toggle on: 1 like per user
          const safeAuthorId = sanitizeId(book.authorId || firebaseUser.uid, 'author');
          await setDoc(doc(db, 'likes', likeId), {
            id: likeId,
            userId: firebaseUser.uid,
            bookId: safeBookId,
            targetAuthorId: safeAuthorId,
            createdAt: serverTimestamp(),
          });
          if (!existingFeedLike) {
            await setDoc(doc(db, 'postLikes', feedPostLikeId), {
              id: feedPostLikeId,
              postId: feedPostKey,
              userId: firebaseUser.uid,
              createdAt: serverTimestamp(),
            }).catch(() => {});
          }
          const nextLikes = Math.max(0, Math.round(Number(book.likes) || 0)) + 1;
          await updateDoc(bookRef, {
            likes: increment(1),
            updatedAt: serverTimestamp(),
          }).catch(async () => {
            await updateDoc(bookRef, { likes: nextLikes, updatedAt: serverTimestamp() });
          });
          try {
            await updateDoc(doc(defaultDb, 'books', book.id), { likes: nextLikes });
          } catch {}
          addToast(`Liked "${book.title}"!`, 'success');
        }
      } catch (error) {
        addToast('Could not like book. Please verify your account login.', 'error');
        handleFirestoreError(error, OperationType.WRITE, `likes/${likeId}`);
      }
    },
    [firebaseUser, likedBooks, postLikes, ensureBookInFirestore, sanitizeId, addToast]
  );

  const incrementBookView = useCallback(
    async (book: Book) => {
      if (!book || !book.id) return;
      const safeBookId = sanitizeId(book.id, 'book');
      const uid = firebaseUser?.uid;

      // 1. Consistent visitor identifier for logged-in or guest users
      let visitorId: string = uid || '';
      if (!visitorId) {
        try {
          const stored = localStorage.getItem('rc_visitor_id');
          if (stored) {
            visitorId = stored;
          } else {
            visitorId = `guest_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
            localStorage.setItem('rc_visitor_id', visitorId);
          }
        } catch {
          visitorId = 'guest_user';
        }
      }

      const sessionKey = `${visitorId}_${safeBookId}`;
      const localViewKey = `rc_viewed_${visitorId}_${safeBookId}`;
      const genericLocalKey = `rc_viewed_book_${safeBookId}`;

      // 2. Strict in-memory session check: if already triggered in this session, return immediately
      if (sessionBookViewsRef.current.has(sessionKey)) {
        return;
      }

      // 3. Client-side localStorage check: verify if this user or browser already viewed this book
      try {
        if (
          localStorage.getItem(localViewKey) ||
          localStorage.getItem(genericLocalKey) ||
          (uid && localStorage.getItem(`rc_viewed_${uid}_${safeBookId}`))
        ) {
          sessionBookViewsRef.current.add(sessionKey);
          return;
        }
      } catch {}

      // 4. In-memory Book object check: if this user's UID is already in the book.viewers array, return
      if (uid && Array.isArray(book.viewers) && book.viewers.includes(uid)) {
        sessionBookViewsRef.current.add(sessionKey);
        try {
          localStorage.setItem(localViewKey, '1');
          localStorage.setItem(genericLocalKey, '1');
        } catch {}
        return;
      }

      // 5. Authoritative Firestore check for logged-in user:
      // Check if 'bookViews' collection already has this user's record
      if (uid) {
        try {
          const viewDocId = `${uid}_${safeBookId}`;
          const viewDocRef = doc(db, 'bookViews', viewDocId);
          const viewSnap = await getDoc(viewDocRef);
          if (viewSnap.exists()) {
            sessionBookViewsRef.current.add(sessionKey);
            try {
              localStorage.setItem(localViewKey, '1');
              localStorage.setItem(genericLocalKey, '1');
            } catch {}
            return; // Already counted in database for this user!
          }
        } catch {
          // If Firestore read fails (e.g. offline or rule block), mark in memory and DO NOT blindly increment
          sessionBookViewsRef.current.add(sessionKey);
          try {
            localStorage.setItem(localViewKey, '1');
            localStorage.setItem(genericLocalKey, '1');
          } catch {}
          return;
        }
      }

      // 6. Lock in session & local storage immediately to prevent concurrent duplicate increments
      sessionBookViewsRef.current.add(sessionKey);
      try {
        localStorage.setItem(localViewKey, '1');
        localStorage.setItem(genericLocalKey, '1');
      } catch {}

      // 7. Record unique view document in Firestore for logged-in user
      if (uid) {
        try {
          const viewDocId = `${uid}_${safeBookId}`;
          await setDoc(doc(db, 'bookViews', viewDocId), {
            id: viewDocId,
            userId: uid,
            bookId: safeBookId,
            bookTitle: book.title || '',
            authorId: book.authorId || '',
            createdAt: serverTimestamp(),
          });
        } catch (err) {
          console.warn('Could not record bookViews doc:', err);
        }
      }

      // 8. Atomically increment book views counter and append user to viewers array exactly once
      try {
        await ensureBookInFirestore(book);
        const nextViews = Math.max(0, Math.round(Number(book.views) || 0)) + 1;
        const updatePayload: Record<string, any> = {
          views: increment(1),
          updatedAt: serverTimestamp(),
        };
        if (uid) {
          updatePayload.viewers = arrayUnion(uid);
        }

        await updateDoc(doc(db, 'books', safeBookId), updatePayload).catch(async () => {
          await updateDoc(doc(db, 'books', safeBookId), {
            views: nextViews,
            ...(uid ? { viewers: arrayUnion(uid) } : {}),
            updatedAt: serverTimestamp(),
          });
        });
        try {
          await updateDoc(doc(defaultDb, 'books', safeBookId), { views: nextViews });
        } catch {}
      } catch (err) {
        console.warn('Book view increment non-blocking error:', err);
      }

      // 9. Update in-memory React state so the UI reflects the new view count and viewers immediately
      setFirestoreBooks((prev: Book[]) =>
        prev.map((b: Book) =>
          b.id === book.id || b.id === safeBookId
            ? {
                ...b,
                views: (b.views || 0) + 1,
                viewers: uid ? Array.from(new Set([...(b.viewers || []), uid])) : b.viewers,
              }
            : b
        )
      );
      bumpSync();
    },
    [firebaseUser, ensureBookInFirestore, sanitizeId, bumpSync]
  );

  const incrementPostView = useCallback(
    async (postId: string) => {
      if (!postId) return;
      const cleanPostId = postId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
      const userKey = firebaseUser ? firebaseUser.uid : 'guest';
      const sessionKey = `${userKey}_${cleanPostId}`;
      const localViewKey = `rc_post_viewed_${userKey}_${cleanPostId}`;

      // 1. In-memory session deduplication
      if (sessionPostViewsRef.current.has(sessionKey)) {
        return;
      }

      // 2. Fast client-side deduplication: exactly 1 view per user
      try {
        if (localStorage.getItem(localViewKey)) {
          sessionPostViewsRef.current.add(sessionKey);
          return;
        }
      } catch {}

      // 3. Authoritative Firestore check for logged in user: 1 view per user in 'postViews' collection
      if (firebaseUser) {
        try {
          const viewDocId = `${firebaseUser.uid}_${cleanPostId}`;
          const viewDocRef = doc(db, 'postViews', viewDocId);
          const viewSnap = await getDoc(viewDocRef);
          if (viewSnap.exists()) {
            sessionPostViewsRef.current.add(sessionKey);
            try {
              localStorage.setItem(localViewKey, '1');
            } catch {}
            return;
          }

          await setDoc(viewDocRef, {
            id: viewDocId,
            userId: firebaseUser.uid,
            postId: cleanPostId,
            createdAt: serverTimestamp(),
          });
          try {
            localStorage.setItem(localViewKey, '1');
          } catch {}
        } catch (err) {
          console.warn('Post view check error:', err);
          sessionPostViewsRef.current.add(sessionKey);
          try {
            localStorage.setItem(localViewKey, '1');
          } catch {}
          return;
        }
      } else {
        try {
          localStorage.setItem(localViewKey, '1');
        } catch {}
      }

      sessionPostViewsRef.current.add(sessionKey);

      // 4. Atomically increment post viewsCount exactly once
      try {
        await updateDoc(doc(db, 'socialPosts', cleanPostId), {
          viewsCount: increment(1),
          updatedAt: serverTimestamp(),
        }).catch(() => {});
      } catch {}

      setSocialPosts((prev) =>
        prev.map((p) =>
          p.id === cleanPostId ? { ...p, viewsCount: (p.viewsCount || 0) + 1 } : p
        )
      );
    },
    [firebaseUser]
  );

  const getBookChapters = useCallback(
    async (bookId: string): Promise<Chapter[]> => {
      try {
        const qChaps = query(
          collection(db, 'books', bookId, 'chapters'),
          where('bookStatus', '==', 'published')
        );
        const snap = await getDocs(qChaps);
        if (!snap.empty) {
          return snap.docs
            .map((d) => normalizeChapterDoc(d.id, d.data()))
            .sort((a, b) => a.chapterNumber - b.chapterNumber);
        }
      } catch {}

      try {
        const defSnap = await getDocs(collection(defaultDb, 'books', bookId, 'chapters'));
        if (!defSnap.empty) {
          return defSnap.docs
            .map((d) => normalizeChapterDoc(d.id, d.data()))
            .sort((a, b) => a.chapterNumber - b.chapterNumber);
        }
      } catch {}

      if (firebaseUser) {
        try {
          const qAuthorChaps = query(
            collection(db, 'books', bookId, 'chapters'),
            where('authorId', '==', firebaseUser.uid)
          );
          const snap2 = await getDocs(qAuthorChaps);
          if (!snap2.empty) {
            return snap2.docs
              .map((d) => normalizeChapterDoc(d.id, d.data()))
              .sort((a, b) => a.chapterNumber - b.chapterNumber);
          }
        } catch {}
      }
      const matchedBook = books.find((b) => b.id === bookId);
      if (
        matchedBook?.availableModes?.length &&
        !matchedBook.availableModes.some((mode) => mode !== 'pdf')
      ) {
        return [];
      }
      if (
        matchedBook?.fileURL &&
        !matchedBook.fileURL.startsWith('https://redcover.app/pdf-text-edition/')
      ) {
        try {
          const { extractPdfTextFromUrl } = await import('../services/pdf/pdfExtractor');
          const authorizedPdfUrl = await getBookPdfAccessUrl(matchedBook.id);
          const extracted = await extractPdfTextFromUrl(authorizedPdfUrl, matchedBook.title);
          if (extracted.length > 0) {
            const nowIso = new Date().toISOString();
            const safeBookId = sanitizeId(bookId, 'book');
            if (firebaseUser && (isAdmin || matchedBook.authorId === firebaseUser.uid)) {
              for (const ch of extracted) {
                const chId = `${safeBookId}-ch-${ch.chapterNumber}`;
                setDoc(doc(db, 'books', safeBookId, 'chapters', chId), {
                  id: chId,
                  bookId: safeBookId,
                  authorId: isAdmin ? sanitizeId(matchedBook.authorId, 'author') : firebaseUser.uid,
                  bookStatus: 'published',
                  chapterNumber: ch.chapterNumber,
                  title: ch.title.slice(0, 200),
                  content: ch.content.slice(0, 100000),
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                }).catch(() => {});
              }
            }
            return extracted.map((ch) => ({
              id: `${bookId}-ch-${ch.chapterNumber}`,
              bookId,
              authorId: matchedBook.authorId || 'author-redcover',
              bookStatus: 'published' as const,
              chapterNumber: ch.chapterNumber,
              title: ch.title,
              content: ch.content,
              createdAt: nowIso,
              updatedAt: nowIso,
            }));
          }
        } catch {
          // Fallback to book description if CORS blocks remote PDF fetch
        }
      }

      return [
        {
          id: `${bookId}-ch-1`,
          bookId,
          authorId: matchedBook?.authorId || 'author-redcover',
          bookStatus: 'published',
          chapterNumber: 1,
          title: matchedBook?.title || 'Chapter 1',
          content:
            matchedBook?.description ||
            'Welcome to the Redcover digital edition. Your reading position and bookmarks synchronize automatically across Redcover Web and Android.',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];
    },
    [firebaseUser, isAdmin, books, sanitizeId]
  );

  const saveReadingProgress = useCallback(
    async (
      book: Book,
      currentChapter: number,
      totalChapters: number,
      percentage: number,
      isBookmarked = false,
      bookmarkNote = ''
    ) => {
      if (!firebaseUser) return;
      const safeBookId = sanitizeId(book.id, 'book');
      const progressId = sanitizeId(`${firebaseUser.uid}_${safeBookId}`, 'prog');
      const progressRef = doc(db, 'readingProgress', progressId);
      const clampPct = Math.min(100, Math.max(0, Math.round(percentage)));

      try {
        await ensureBookInFirestore(book);
        const snap = await getDoc(progressRef);
        const payload = {
          id: progressId,
          userId: firebaseUser.uid,
          bookId: safeBookId,
          bookTitle: (book.title || 'Untitled Book').trim().slice(0, 200) || 'Untitled Book',
          bookCover: book.coverURL && book.coverURL.length <= 5000 ? book.coverURL : '',
          bookAuthor: (book.authorName || 'Author').slice(0, 120),
          currentChapter: Math.max(1, Math.round(currentChapter || 1)),
          totalChapters: Math.max(1, Math.round(totalChapters || 1)),
          percentage: clampPct,
          bookmarkNote: bookmarkNote.slice(0, 5000),
          isBookmarked: Boolean(isBookmarked),
          isPublic: currentUser?.publicActivity ?? true,
          updatedAt: serverTimestamp(),
        };
        if (!snap.exists()) {
          await setDoc(progressRef, {
            ...payload,
            createdAt: serverTimestamp(),
          });
        } else {
          await updateDoc(progressRef, payload);
        }
        try {
          await setDoc(doc(defaultDb, 'readingProgress', progressId), payload, { merge: true });
        } catch {}
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `readingProgress/${progressId}`);
      }
    },
    [firebaseUser, currentUser?.publicActivity, ensureBookInFirestore, sanitizeId]
  );

  const submitReview = useCallback(
    async (book: Book, rating: number, text: string) => {
      if (!firebaseUser || !currentUser) {
        addToast('Please sign in to post a review.', 'info');
        return;
      }
      const safeBookId = sanitizeId(book.id, 'book');
      const reviewId = sanitizeId(`${firebaseUser.uid}_${safeBookId}`, 'rev');
      const reviewRef = doc(db, 'reviews', reviewId);
      const cleanRating = Math.min(5, Math.max(1, Math.round(rating)));
      const cleanText = text.trim().slice(0, 2000);

      try {
        await ensureBookInFirestore(book);
        const snap = await getDoc(reviewRef);
        if (!snap.exists()) {
          const revPayload = {
            id: reviewId,
            bookId: safeBookId,
            bookTitle: (book.title || 'Untitled Book').trim().slice(0, 200) || 'Untitled Book',
            userId: firebaseUser.uid,
            userName: (currentUser.displayName || 'Reader').trim().slice(0, 100) || 'Reader',
            userAvatar: currentUser.photoURL && currentUser.photoURL.length <= 5000 ? currentUser.photoURL : '',
            rating: cleanRating,
            text: cleanText,
            visibility: 'public',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };
          await setDoc(reviewRef, revPayload);
          try {
            await setDoc(doc(defaultDb, 'reviews', reviewId), revPayload, { merge: true });
          } catch {}

          const previousCount = Math.max(0, Math.round(Number(book.reviewsCount) || 0));
          const previousRating = previousCount > 0 ? Number(book.rating) || 0 : 0;
          const newCount = previousCount + 1;
          const newAvg = Number(((previousRating * previousCount + cleanRating) / newCount).toFixed(1));
          await updateDoc(doc(db, 'books', safeBookId), {
            reviewsCount: newCount,
            rating: Math.min(5, Math.max(0, newAvg)),
            updatedAt: serverTimestamp(),
          }).catch(() => {});
          addToast('Review published in real-time!', 'success');
        } else {
          await updateDoc(reviewRef, {
            rating: cleanRating,
            text: cleanText,
            userName: (currentUser.displayName || 'Reader').trim().slice(0, 100) || 'Reader',
            userAvatar: currentUser.photoURL && currentUser.photoURL.length <= 5000 ? currentUser.photoURL : '',
            updatedAt: serverTimestamp(),
          });
          addToast('Your review has been updated.', 'success');
        }
      } catch (error) {
        addToast('Could not submit review. Please check your connection and sign-in status.', 'error');
        handleFirestoreError(error, OperationType.WRITE, `reviews/${reviewId}`);
      }
    },
    [firebaseUser, currentUser, ensureBookInFirestore, sanitizeId, addToast]
  );

  const publishOrSaveBook = useCallback(
    async (
      bookInput: Omit<
        Book,
        | 'id'
        | 'authorId'
        | 'authorName'
        | 'authorUsername'
        | 'authorAvatar'
        | 'rating'
        | 'reviewsCount'
        | 'views'
        | 'likes'
        | 'saves'
        | 'createdAt'
        | 'updatedAt'
      > & { id?: string },
      chaptersInput: { id?: string; chapterNumber: number; title: string; content: string }[]
    ): Promise<string> => {
      if (!firebaseUser || !currentUser) {
        throw new Error('Must be signed in to publish or save a book.');
      }
      await ensureUserProfile(firebaseUser);

      const bookId =
        bookInput.id && /^[a-zA-Z0-9_-]+$/.test(bookInput.id)
          ? bookInput.id
          : `rc-book-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const bookRef = doc(db, 'books', bookId);

      try {
        const snap = await getDoc(bookRef);
        const totalChaps = Math.max(1, chaptersInput.length);
        const supportsText = bookInput.availableModes?.some((mode) => mode !== 'pdf') ?? true;
        const persistedChapterCount = supportsText ? totalChaps : 0;
        const safeTitle = (bookInput.title || 'Untitled Book').trim().slice(0, 200) || 'Untitled Book';
        const safeDesc = (bookInput.description || '').trim().slice(0, 5000);
        const safeShortDesc = (bookInput.shortDescription || safeDesc || safeTitle).trim().slice(0, 400);
        const safeAuthorName = (currentUser.displayName || 'Author').trim().slice(0, 120) || 'Author';
        const safeAuthorUsername = (currentUser.username || 'author').trim().slice(0, 80) || 'author';
        const safeCategory = (bookInput.category || 'Fiction').trim().slice(0, 80) || 'Fiction';
        const safeLanguage = (bookInput.language || 'English').trim().slice(0, 60) || 'English';

        const basePayload = {
          id: bookId,
          title: safeTitle,
          description: safeDesc,
          shortDescription: safeShortDesc,
          authorId: firebaseUser.uid,
          authorName: safeAuthorName,
          authorUsername: safeAuthorUsername,
          authorAvatar: currentUser.photoURL && currentUser.photoURL.length <= 5000 ? currentUser.photoURL : '',
          coverURL: bookInput.coverURL && bookInput.coverURL.length <= 5000 ? bookInput.coverURL : '',
          fileURL: bookInput.fileURL && bookInput.fileURL.length <= 5000 ? bookInput.fileURL : '',
          format: bookInput.format === 'pdf' ? ('pdf' as const) : ('story' as const),
          availableModes: bookInput.availableModes,
          category: safeCategory,
          language: safeLanguage,
          chaptersCount: persistedChapterCount,
          status: bookInput.status,
          updatedAt: serverTimestamp(),
        };

        if (!snap.exists()) {
          const fullCreatePayload = {
            ...basePayload,
            rating: 0,
            reviewsCount: 0,
            views: 1,
            likes: 0,
            saves: 0,
            featured: Boolean(bookInput.featured),
            createdAt: serverTimestamp(),
          };
          await setDoc(bookRef, fullCreatePayload);
          try {
            await setDoc(doc(defaultDb, 'books', bookId), fullCreatePayload, { merge: true });
          } catch {}

          await updateDoc(doc(db, 'users', firebaseUser.uid), {
            booksCount: Math.max(0, Math.round(Number(currentUser.booksCount) || 0)) + 1,
            updatedAt: serverTimestamp(),
          }).catch(() => {});
        } else {
          await updateDoc(bookRef, basePayload);
          try {
            await setDoc(doc(defaultDb, 'books', bookId), basePayload, { merge: true });
          } catch {}
        }

        let existingChaptersDocs: { id: string }[] = [];
        try {
          const existingChaptersSnap = await getDocs(
            query(
              collection(db, 'books', bookId, 'chapters'),
              where('authorId', '==', firebaseUser.uid)
            )
          );
          existingChaptersDocs = existingChaptersSnap.docs;
        } catch {}
        const incomingChapterIds = new Set<string>();

        for (let i = 0; i < chaptersInput.length; i++) {
          const ch = chaptersInput[i];
          const chId =
            ch.id && /^[a-zA-Z0-9_-]+$/.test(ch.id) ? ch.id : `${bookId}-ch-${i + 1}`;
          incomingChapterIds.add(chId);
          const chRef = doc(db, 'books', bookId, 'chapters', chId);
          const chSnap = await getDoc(chRef);
          const chPayload = {
            id: chId,
            bookId,
            authorId: firebaseUser.uid,
            bookStatus: bookInput.status,
            chapterNumber: i + 1,
            title: (ch.title || `Chapter ${i + 1}`).trim().slice(0, 200) || `Chapter ${i + 1}`,
            content: (ch.content || '').slice(0, 100000),
            updatedAt: serverTimestamp(),
          };
          if (!chSnap.exists()) {
            await setDoc(chRef, { ...chPayload, createdAt: serverTimestamp() });
          } else {
            await updateDoc(chRef, chPayload);
          }
          try {
            await setDoc(
              doc(defaultDb, 'books', bookId, 'chapters', chId),
              { ...chPayload, createdAt: serverTimestamp() },
              { merge: true }
            );
          } catch {}
        }

        // Remove any old chapters that were deleted in the studio
        for (const existingDoc of existingChaptersDocs) {
          if (!incomingChapterIds.has(existingDoc.id)) {
            await deleteDoc(doc(db, 'books', bookId, 'chapters', existingDoc.id)).catch(() => {});
          }
        }

        // If published, ensure a story_publication post exists in `posts`
        if (bookInput.status === 'published') {
          try {
            const pubPostId = `post_book_${bookId}`.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 120);
            const pubPostRef = doc(db, 'posts', pubPostId);
            const pubSnap = await getDoc(pubPostRef);
            const postText = (
              bookInput.shortDescription ||
              bookInput.description ||
              `Published "${safeTitle}" on Redcover!`
            )
              .trim()
              .slice(0, 3000) || `Published "${safeTitle}" on Redcover!`;

            if (!pubSnap.exists()) {
              await setDoc(pubPostRef, {
                id: pubPostId,
                authorId: firebaseUser.uid,
                authorName: safeAuthorName.slice(0, 100),
                authorUsername: safeAuthorUsername.slice(0, 80),
                authorAvatar: currentUser.photoURL && currentUser.photoURL.length <= 5000 ? currentUser.photoURL : '',
                postType: 'story_publication',
                text: postText,
                bookId: bookId.slice(0, 128),
                bookTitle: safeTitle,
                bookAuthor: safeAuthorName,
                bookCover: bookInput.coverURL && bookInput.coverURL.length <= 5000 ? bookInput.coverURL : '',
                bookCategory: safeCategory,
                rating: 0,
                progressPercentage: 0,
                chapterNumber: totalChaps,
                likesCount: 0,
                commentsCount: 0,
                visibility: 'public',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              });
            }
          } catch {
            // Non-blocking feed post creation
          }
        }

        addToast(
          bookInput.status === 'published'
            ? `"${safeTitle}" published successfully!`
            : `Draft "${safeTitle}" saved successfully.`,
          'success'
        );
        return bookId;
      } catch (error) {
        addToast('Could not upload your book. Check your account access and file details, then try again.', 'error');
        handleFirestoreError(error, OperationType.WRITE, `books/${bookId}`);
        return bookId;
      }
    },
    [firebaseUser, currentUser, ensureUserProfile, addToast]
  );

  const deleteBook = useCallback(
    async (bookId: string) => {
      if (!firebaseUser) return;
      try {
        await deleteDoc(doc(db, 'books', bookId));
        try {
          await deleteDoc(doc(defaultDb, 'books', bookId));
        } catch {}
        addToast('Book deleted.', 'info');
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `books/${bookId}`);
      }
    },
    [firebaseUser, addToast]
  );

  const updateBookStatusAdmin = useCallback(
    async (bookId: string, status: Book['status']) => {
      if (!firebaseUser || !isAdmin) return;
      try {
        const bookObj = books.find((b) => b.id === bookId);
        if (bookObj) {
          await ensureBookInFirestore(bookObj);
        }
        await updateDoc(doc(db, 'books', bookId), {
          status,
          updatedAt: serverTimestamp(),
        });
        try {
          await updateDoc(doc(defaultDb, 'books', bookId), { status });
        } catch {}
        addToast(`Book status updated to "${status}".`, 'success');
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `books/${bookId}`);
      }
    },
    [firebaseUser, isAdmin, books, ensureBookInFirestore, addToast]
  );

  const updateUserProfile = useCallback(
    async (
      updates: Partial<
        Pick<
          UserProfile,
          | 'displayName'
          | 'username'
          | 'bio'
          | 'photoURL'
          | 'coverURL'
          | 'showOnlineStatus'
          | 'publicActivity'
          | 'nameColor'
        >
      >
    ) => {
      if (!firebaseUser && !currentUser) return;
      const targetUid = firebaseUser?.uid || currentUser?.uid;
      if (!targetUid) return;

      // 1. Instant Optimistic State Update for currentUser and users list
      const updatedProfile: UserProfile = {
        ...(currentUser || {
          uid: targetUid,
          username: 'reader',
          displayName: 'Redcover User',
          photoURL: '',
          coverURL: '',
          bio: '',
          followersCount: 0,
          followingCount: 0,
          booksCount: 0,
          streakDays: 0,
          points: 0,
          membershipPlan: 'free',
          isOnline: false,
          showOnlineStatus: true,
          publicActivity: true,
          role: 'user',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
        ...(updates.displayName !== undefined ? { displayName: updates.displayName.trim() } : {}),
        ...(updates.username !== undefined ? { username: updates.username.trim().toLowerCase() } : {}),
        ...(updates.bio !== undefined ? { bio: updates.bio } : {}),
        ...(updates.photoURL !== undefined ? { photoURL: updates.photoURL } : {}),
        ...(updates.coverURL !== undefined ? { coverURL: updates.coverURL } : {}),
        ...(updates.showOnlineStatus !== undefined ? { showOnlineStatus: updates.showOnlineStatus } : {}),
        ...(updates.publicActivity !== undefined ? { publicActivity: updates.publicActivity } : {}),
        ...(updates.nameColor !== undefined ? { nameColor: updates.nameColor } : {}),
        updatedAt: new Date().toISOString(),
      };

      setCurrentUser(updatedProfile);
      setFirestoreUsers((prev) =>
        prev.some((u) => u.uid === targetUid)
          ? prev.map((u) => (u.uid === targetUid ? updatedProfile : u))
          : [updatedProfile, ...prev]
      );

      try {
        localStorage.setItem(`rc_cached_user_${targetUid}`, JSON.stringify(updatedProfile));
      } catch {}

      addToast('Profile updated successfully!', 'success');

      // 2. Safe Background Sync with Firestore
      if (firebaseUser) {
        try {
          await ensureUserProfile(firebaseUser);
          const payload: Record<string, any> = {
            updatedAt: serverTimestamp(),
          };
          if (updates.displayName !== undefined) payload.displayName = updates.displayName.trim().slice(0, 100);
          if (updates.username !== undefined) {
            const clean = updates.username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 60);
            if (clean.length >= 2) payload.username = clean;
          }
          if (updates.bio !== undefined) payload.bio = updates.bio.slice(0, 1000);
          if (updates.photoURL !== undefined) payload.photoURL = updates.photoURL.slice(0, 5000);
          if (updates.coverURL !== undefined) payload.coverURL = updates.coverURL.slice(0, 5000);
          if (updates.showOnlineStatus !== undefined) payload.showOnlineStatus = updates.showOnlineStatus;
          if (updates.publicActivity !== undefined) payload.publicActivity = updates.publicActivity;
          if (updates.nameColor !== undefined) payload.nameColor = updates.nameColor;

          await updateDoc(doc(db, 'users', firebaseUser.uid), payload).catch(() => {});
          await setDoc(doc(defaultDb, 'users', firebaseUser.uid), payload, { merge: true }).catch(() => {});
        } catch (error) {
          console.warn('Profile firestore background notice:', error);
        }
      }
    },
    [firebaseUser, currentUser, ensureUserProfile, addToast]
  );

  const updatePrivateSettings = useCallback(
    async (updates: Partial<Pick<UserPrivateInfo, 'readingReminders' | 'notificationSettings' | 'theme'>>) => {
      if (!firebaseUser) return;
      try {
        if (updates.theme !== undefined) {
          setThemeState(updates.theme);
          localStorage.setItem('rc_theme', updates.theme);
        }
        await syncPrivateInfoDoc(firebaseUser, updates);
        addToast('Account preferences updated.', 'success');
      } catch (error) {
        console.warn('Private settings notice:', error);
      }
    },
    [firebaseUser, syncPrivateInfoDoc, addToast]
  );

  const upgradeMembership = useCallback(
    async (plan: 'free' | 'premium') => {
      if (!firebaseUser && !currentUser) {
        addToast('Please sign in to manage your Redcover membership.', 'info');
        return;
      }
      const targetUid = firebaseUser?.uid || currentUser?.uid;

      // 1. Instant Optimistic State Update
      setCurrentUser((prev) => (prev ? { ...prev, membershipPlan: plan } : prev));
      setFirestoreUsers((prev) =>
        prev.map((u) => (u.uid === targetUid ? { ...u, membershipPlan: plan } : u))
      );
      try {
        localStorage.setItem('rc_member_plan', plan);
        if (currentUser) {
          localStorage.setItem(
            `rc_cached_user_${targetUid}`,
            JSON.stringify({ ...currentUser, membershipPlan: plan })
          );
        }
      } catch {}

      addToast(
        plan === 'premium'
          ? '✨ Redcover Premium Membership activated!'
          : 'Membership switched to Free plan.',
        'success'
      );

      // 2. Safe Background Sync with Firestore
      if (firebaseUser) {
        try {
          await ensureUserProfile(firebaseUser);
          await updateDoc(doc(db, 'users', firebaseUser.uid), {
            membershipPlan: plan,
            updatedAt: serverTimestamp(),
          }).catch(() => {});
          await setDoc(
            doc(defaultDb, 'users', firebaseUser.uid),
            { membershipPlan: plan, isPremium: plan === 'premium' },
            { merge: true }
          ).catch(() => {});
          const expiry =
            plan === 'premium'
              ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
              : '';
          await syncPrivateInfoDoc(firebaseUser, { subscriptionExpiry: expiry }).catch(() => {});
        } catch (error) {
          console.warn('Membership sync notice:', error);
        }
      }
    },
    [firebaseUser, currentUser, ensureUserProfile, syncPrivateInfoDoc, addToast]
  );

  const ensureTargetUserInFirestore = useCallback(
    async (targetUser: UserProfile) => {
      const safeUid = sanitizeId(targetUser.uid, 'user');
      const targetRef = doc(db, 'users', safeUid);
      const snap = await getDoc(targetRef);
      if (!snap.exists() && isAdmin) {
        const cleanHandle =
          (targetUser.username || 'author').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 60) || 'author';
        await setDoc(targetRef, {
          uid: safeUid,
          username: cleanHandle.length >= 2 ? cleanHandle : `rc_${cleanHandle}`,
          displayName: (targetUser.displayName || 'Redcover Author').trim().slice(0, 100) || 'Redcover Author',
          photoURL: targetUser.photoURL && targetUser.photoURL.length <= 5000 ? targetUser.photoURL : '',
          coverURL: targetUser.coverURL && targetUser.coverURL.length <= 5000 ? targetUser.coverURL : '',
          bio: (targetUser.bio || '').slice(0, 1000),
          followersCount: Math.max(0, Math.round(Number(targetUser.followersCount) || 0)),
          followingCount: Math.max(0, Math.round(Number(targetUser.followingCount) || 0)),
          booksCount: Math.max(0, Math.round(Number(targetUser.booksCount) || 0)),
          streakDays: Math.max(0, Math.round(Number(targetUser.streakDays) || 0)),
          points: Math.max(0, Math.round(Number(targetUser.points) || 0)),
          membershipPlan: targetUser.membershipPlan === 'premium' ? 'premium' : 'free',
          isOnline: Boolean(targetUser.isOnline ?? false),
          showOnlineStatus: Boolean(targetUser.showOnlineStatus ?? true),
          publicActivity: Boolean(targetUser.publicActivity ?? true),
          role: targetUser.role === 'admin' ? 'admin' : targetUser.role === 'author' ? 'author' : 'user',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }).catch(() => {});
      }
    },
    [isAdmin, sanitizeId]
  );

  const toggleFollowUser = useCallback(
    async (targetUser: UserProfile) => {
      if (!firebaseUser || !currentUser) {
        addToast('Please sign in to follow authors and readers.', 'info');
        return;
      }
      if (isSystemAccount(targetUser)) {
        addToast('The Redcover System account cannot be followed.', 'info');
        return;
      }
      if (targetUser.uid === firebaseUser.uid) return;
      const safeTargetUid = sanitizeId(targetUser.uid, 'user');
      const followId = sanitizeId(`${firebaseUser.uid}_${safeTargetUid}`, 'follow');
      const existingFollow = follows.find(
        (f) => f.id === followId || (f.followerId === firebaseUser.uid && f.followingId === safeTargetUid)
      );

      try {
        await ensureUserProfile(firebaseUser);
        await ensureTargetUserInFirestore(targetUser);
        const targetSnap = await getDoc(doc(db, 'users', safeTargetUid));

        if (existingFollow) {
          await deleteDoc(doc(db, 'follows', existingFollow.id));
          await updateDoc(doc(db, 'users', firebaseUser.uid), {
            followingCount: Math.max(0, Math.round(Number(currentUser.followingCount) || 1) - 1),
            updatedAt: serverTimestamp(),
          }).catch(() => {});
          if (targetSnap.exists()) {
            await updateDoc(doc(db, 'users', safeTargetUid), {
              followersCount: Math.max(0, Math.round(Number(targetSnap.data().followersCount ?? 1)) - 1),
              updatedAt: serverTimestamp(),
            }).catch(() => {});
          }
          addToast(`Unfollowed ${targetUser.displayName}.`, 'info');
        } else {
          await setDoc(doc(db, 'follows', followId), {
            id: followId,
            followerId: firebaseUser.uid,
            followingId: safeTargetUid,
            followerName: (currentUser.displayName || 'Reader').slice(0, 100),
            followingName: (targetUser.displayName || 'Author').slice(0, 100),
            createdAt: serverTimestamp(),
          });
          await updateDoc(doc(db, 'users', firebaseUser.uid), {
            followingCount: Math.max(0, Math.round(Number(currentUser.followingCount) || 0)) + 1,
            updatedAt: serverTimestamp(),
          }).catch(() => {});
          if (targetSnap.exists()) {
            await updateDoc(doc(db, 'users', safeTargetUid), {
              followersCount: Math.max(0, Math.round(Number(targetSnap.data().followersCount ?? 0))) + 1,
              updatedAt: serverTimestamp(),
            }).catch(() => {});
          }

          const notifId = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          await setDoc(doc(db, 'notifications', notifId), {
            id: notifId,
            recipientId: safeTargetUid,
            actorId: firebaseUser.uid,
            actorName: (currentUser.displayName || 'Reader').slice(0, 100),
            category: 'social',
            title: 'New Follower',
            body: `${currentUser.displayName} started following your work on Redcover.`,
            link: `/profile/${firebaseUser.uid}`,
            read: false,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          }).catch(() => {});
          addToast(`Now following ${targetUser.displayName}!`, 'success');
        }
      } catch (error) {
        addToast('Could not update follow status.', 'error');
        handleFirestoreError(error, OperationType.WRITE, `follows/${followId}`);
      }
    },
    [firebaseUser, currentUser, follows, ensureUserProfile, ensureTargetUserInFirestore, sanitizeId, addToast]
  );

  const sendFriendRequest = useCallback(
    async (targetUser: UserProfile) => {
      if (!firebaseUser || !currentUser) {
        addToast('Please sign in to send friend requests.', 'info');
        return;
      }
      if (isSystemAccount(targetUser)) {
        addToast('The Redcover System account cannot be sent friend requests.', 'info');
        return;
      }
      if (targetUser.uid === firebaseUser.uid) return;
      const safeTargetUid = sanitizeId(targetUser.uid, 'user');
      const friendshipId = sanitizeId(`${firebaseUser.uid}_${safeTargetUid}`, 'friend');
      try {
        await ensureUserProfile(firebaseUser);
        await ensureTargetUserInFirestore(targetUser);
        await setDoc(doc(db, 'friendships', friendshipId), {
          id: friendshipId,
          requesterId: firebaseUser.uid,
          receiverId: safeTargetUid,
          requesterName: (currentUser.displayName || 'Reader').slice(0, 100),
          receiverName: (targetUser.displayName || 'Reader').slice(0, 100),
          requesterAvatar: currentUser.photoURL && currentUser.photoURL.length <= 5000 ? currentUser.photoURL : '',
          receiverAvatar: targetUser.photoURL && targetUser.photoURL.length <= 5000 ? targetUser.photoURL : '',
          status: 'pending',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        const notifId = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        await setDoc(doc(db, 'notifications', notifId), {
          id: notifId,
          recipientId: safeTargetUid,
          actorId: firebaseUser.uid,
          actorName: (currentUser.displayName || 'Reader').slice(0, 100),
          category: 'social',
          title: 'Friend Request',
          body: `${currentUser.displayName} sent you a friend request.`,
          link: '/hub/social',
          read: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }).catch(() => {});
        addToast(`Friend request sent to ${targetUser.displayName}.`, 'success');
      } catch (error) {
        addToast('Could not send friend request.', 'error');
        handleFirestoreError(error, OperationType.CREATE, `friendships/${friendshipId}`);
      }
    },
    [firebaseUser, currentUser, ensureUserProfile, ensureTargetUserInFirestore, sanitizeId, addToast]
  );

  const updateFriendshipStatus = useCallback(
    async (friendshipId: string, status: FriendshipStatus) => {
      if (!firebaseUser || !currentUser) return;
      try {
        await updateDoc(doc(db, 'friendships', friendshipId), {
          status,
          updatedAt: serverTimestamp(),
        });
        addToast(`Friendship status updated to ${status}.`, 'success');

        if (status === 'accepted') {
          const friendship = friendships.find((f) => f.id === friendshipId);
          const targetRecipient =
            friendship && friendship.requesterId !== firebaseUser.uid
              ? friendship.requesterId
              : friendship?.receiverId;
          if (targetRecipient) {
            const notifId = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
            await setDoc(doc(db, 'notifications', notifId), {
              id: notifId,
              recipientId: targetRecipient,
              actorId: firebaseUser.uid,
              actorName: currentUser.displayName.slice(0, 100),
              category: 'social',
              title: 'Friend Request Accepted',
              body: `${currentUser.displayName} accepted your friend request. You can now chat!`,
              link: '/hub/chats',
              read: false,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            }).catch(() => {});
          }
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `friendships/${friendshipId}`);
      }
    },
    [firebaseUser, currentUser, friendships, addToast]
  );

  const cancelFriendRequest = useCallback(
    async (friendshipId: string) => {
      if (!firebaseUser) return;
      try {
        await deleteDoc(doc(db, 'friendships', friendshipId));
        addToast('Friend request canceled.', 'info');
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `friendships/${friendshipId}`);
      }
    },
    [firebaseUser, addToast]
  );

  const removeFriendship = useCallback(
    async (friendshipId: string) => {
      if (!firebaseUser) return;
      try {
        await deleteDoc(doc(db, 'friendships', friendshipId));
        addToast('Friendship removed.', 'info');
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `friendships/${friendshipId}`);
      }
    },
    [firebaseUser, addToast]
  );

  const blockUser = useCallback(
    async (targetUser: UserProfile) => {
      if (!firebaseUser || !currentUser) return;
      const friendshipId = `${firebaseUser.uid}_${targetUser.uid}`;
      try {
        await ensureTargetUserInFirestore(targetUser);
        const snap = await getDoc(doc(db, 'friendships', friendshipId));
        if (!snap.exists()) {
          await setDoc(doc(db, 'friendships', friendshipId), {
            id: friendshipId,
            requesterId: firebaseUser.uid,
            receiverId: targetUser.uid,
            requesterName: currentUser.displayName.slice(0, 100),
            receiverName: targetUser.displayName.slice(0, 100),
            requesterAvatar: currentUser.photoURL.slice(0, 1000),
            receiverAvatar: targetUser.photoURL.slice(0, 1000),
            status: 'blocked',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else {
          await updateDoc(doc(db, 'friendships', friendshipId), {
            status: 'blocked',
            updatedAt: serverTimestamp(),
          });
        }
        addToast(`Blocked ${targetUser.displayName}.`, 'info');
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `friendships/${friendshipId}`);
      }
    },
    [firebaseUser, currentUser, ensureTargetUserInFirestore, addToast]
  );

  const isFriend = useCallback(
    (targetUserId: string): boolean => {
      if (!firebaseUser) return false;
      return friendships.some(
        (f) =>
          f.status === 'accepted' &&
          ((f.requesterId === firebaseUser.uid && f.receiverId === targetUserId) ||
            (f.receiverId === firebaseUser.uid && f.requesterId === targetUserId))
      );
    },
    [firebaseUser, friendships]
  );

  const acceptedFriends = useMemo((): UserProfile[] => {
    if (!firebaseUser) return [];
    const friendUids = new Set<string>();
    friendships.forEach((f) => {
      if (f.status === 'accepted') {
        if (f.requesterId === firebaseUser.uid) friendUids.add(f.receiverId);
        if (f.receiverId === firebaseUser.uid) friendUids.add(f.requesterId);
      }
    });
    return users.filter((u) => friendUids.has(u.uid) && !isSystemAccount(u));
  }, [firebaseUser, friendships, users]);

  const startOrGetChat = useCallback(
    async (targetUser: UserProfile): Promise<string> => {
      if (!firebaseUser || !currentUser) {
        throw new Error('Sign in required for messaging.');
      }
      if (targetUser.uid === firebaseUser.uid) {
        throw new Error('Cannot start a chat with yourself.');
      }
      if (isSystemAccount(targetUser)) {
        throw new Error('The Redcover System account does not accept direct messages.');
      }

      // Consistent deterministic ID: sorted alphabetically
      const [u1, u2] = [firebaseUser.uid, targetUser.uid].sort();
      const chatId = `chat_${u1}_${u2}`.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 120);

      // Check if conversation already exists in active state
      const existingChat = chats.find(
        (c) =>
          c.id === chatId ||
          (c.participantA === u1 && c.participantB === u2) ||
          (c.participantA === u2 && c.participantB === u1)
      );

      if (existingChat) {
        return existingChat.id;
      }

      const isUser1 = firebaseUser.uid === u1;
      const participantAName = (isUser1 ? currentUser.displayName : targetUser.displayName).slice(0, 100);
      const participantBName = (isUser1 ? targetUser.displayName : currentUser.displayName).slice(0, 100);
      const participantAAvatar = (isUser1 ? currentUser.photoURL || '' : targetUser.photoURL || '').slice(0, 1000);
      const participantBAvatar = (isUser1 ? targetUser.photoURL || '' : currentUser.photoURL || '').slice(0, 1000);

      const chatRef = doc(db, 'chats', chatId);
      try {
        const snap = await getDoc(chatRef);
        if (!snap.exists()) {
          const newDocPayload = {
            id: chatId,
            participantA: u1,
            participantB: u2,
            participantAName,
            participantBName,
            participantAAvatar,
            participantBAvatar,
            lastMessage: 'Conversation started',
            lastSenderId: firebaseUser.uid,
            unreadCountA: 0,
            unreadCountB: 0,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };
          await setDoc(chatRef, newDocPayload);

          const optimisticChat: Chat = {
            id: chatId,
            participantA: u1,
            participantB: u2,
            participantAName,
            participantBName,
            participantAAvatar,
            participantBAvatar,
            lastMessage: 'Conversation started',
            lastSenderId: firebaseUser.uid,
            unreadCountA: 0,
            unreadCountB: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          setChats((prev) => (prev.some((c) => c.id === chatId) ? prev : [optimisticChat, ...prev]));
        } else {
          // Document exists in Firestore; ensure it is present in local chats state
          const d = snap.data();
          if (Array.isArray(d.hiddenFor) && d.hiddenFor.includes(firebaseUser.uid)) {
            await updateDoc(chatRef, {
              hiddenFor: arrayRemove(firebaseUser.uid),
              updatedAt: serverTimestamp(),
            });
          }
          const loadedChat: Chat = {
            id: snap.id,
            participantA: d.participantA || u1,
            participantB: d.participantB || u2,
            participantAName: d.participantAName || participantAName,
            participantBName: d.participantBName || participantBName,
            participantAAvatar: d.participantAAvatar || participantAAvatar,
            participantBAvatar: d.participantBAvatar || participantBAvatar,
            lastMessage: d.lastMessage || 'Conversation started',
            lastSenderId: d.lastSenderId || firebaseUser.uid,
            unreadCountA: d.unreadCountA || 0,
            unreadCountB: d.unreadCountB || 0,
            hiddenFor: (Array.isArray(d.hiddenFor) ? d.hiddenFor : []).filter((id: string) => id !== firebaseUser.uid),
            createdAt: d.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
            updatedAt: d.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          };
          setChats((prev) => (prev.some((c) => c.id === snap.id) ? prev : [loadedChat, ...prev]));
        }

        return chatId;
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `chats/${chatId}`);
        addToast('Could not start this chat. Check your Firebase permissions and try again.', 'error');
        throw error;
      }
    },
    [firebaseUser, currentUser, chats, addToast]
  );

  const clearChatUnreadCount = useCallback(
    async (chatId: string) => {
      if (!chatId || !firebaseUser) return;
      const uid = firebaseUser.uid;

      // 1. Identify target chat & partner to clear ALL related duplicate/parallel chat docs
      const targetChat = chats.find((c) => c.id === chatId);
      const partnerUid = targetChat
        ? targetChat.participantA === uid
          ? targetChat.participantB
          : targetChat.participantA
        : '';

      // 2. Instantly clear unread count in local state for this chat and any other chat with this partner
      setChats((previousChats) => {
        let changed = false;
        const updatedChats = previousChats.map((chat) => {
          const isMatch =
            chat.id === chatId ||
            (partnerUid &&
              ((chat.participantA === uid && chat.participantB === partnerUid) ||
                (chat.participantB === uid && chat.participantA === partnerUid)));
          if (!isMatch) return chat;
          const isParticipantA = chat.participantA === uid;
          const unreadCountA = isParticipantA ? 0 : chat.unreadCountA;
          const unreadCountB = isParticipantA ? chat.unreadCountB : 0;
          if (chat.unreadCountA === unreadCountA && chat.unreadCountB === unreadCountB) {
            return chat;
          }
          changed = true;
          return {
            ...chat,
            unreadCountA,
            unreadCountB,
          };
        });
        return changed ? updatedChats : previousChats;
      });

      // Clear unread counts in the authoritative Firestore conversation documents.
      try {
        const isA = targetChat ? targetChat.participantA === uid : true;
        await updateDoc(doc(db, 'chats', chatId), {
          [isA ? 'unreadCountA' : 'unreadCountB']: 0,
        }).catch(() => {});

        if (partnerUid) {
          const matchingChats = chats.filter(
            (c) =>
              c.id !== chatId &&
              ((c.participantA === uid && c.participantB === partnerUid) ||
                (c.participantB === uid && c.participantA === partnerUid))
          );
          for (const mc of matchingChats) {
            const mcIsA = mc.participantA === uid;
            await updateDoc(doc(db, 'chats', mc.id), {
              [mcIsA ? 'unreadCountA' : 'unreadCountB']: 0,
            }).catch(() => {});
          }
        }
      } catch {}
    },
    [firebaseUser, chats]
  );

  const deleteChat = useCallback(
    async (chatId: string) => {
      if (!chatId || !firebaseUser) return;
      const uid = firebaseUser.uid;
      try {
        await updateDoc(doc(db, 'chats', chatId), {
          hiddenFor: arrayUnion(uid),
          updatedAt: serverTimestamp(),
        });
        setChats((prev) => prev.filter((chat) => chat.id !== chatId));
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `chats/${chatId}`);
        addToast('Could not remove this conversation. Check your chat permissions and retry.', 'error');
        return;
      }

      // 4. Remove cached messages
      try {
        localStorage.removeItem(`rc_chat_msgs_${chatId}`);
      } catch {}

      addToast('Conversation removed.', 'info');
    },
    [firebaseUser, addToast]
  );

  const setChatNickname = useCallback(
    async (chatId: string, partnerUid: string, nickname: string) => {
      if (!firebaseUser || !partnerUid) return;
      const cleanNick = nickname.trim().slice(0, 50);
      const storageKey = `rc_nick_${firebaseUser.uid}_${partnerUid}`;
      if (cleanNick) {
        localStorage.setItem(storageKey, cleanNick);
      } else {
        localStorage.removeItem(storageKey);
      }
      if (chatId) {
        updateDoc(doc(db, 'chats', chatId), {
          [`nicknames.${firebaseUser.uid}`]: cleanNick,
          updatedAt: serverTimestamp(),
        }).catch(() => {});
      }
      addToast(cleanNick ? `Nickname set to "${cleanNick}"` : 'Nickname removed.', 'success');
    },
    [firebaseUser, addToast]
  );

  const sendChatMessage = useCallback(
    async (
      chat: Chat,
      text: string,
      options?: {
        messageId?: string;
        bookAttachment?: ChatMessageBookAttachment;
        replyTo?: ChatMessageReply;
        isForwarded?: boolean;
        redCode?: string;
      }
    ) => {
      if (!firebaseUser || !currentUser) return;
      const currentSenderUid = firebaseUser.uid;

      const cleanText = (text || '').trim().slice(0, 2000);
      if (!cleanText && !options?.bookAttachment) return;

      const receiverId = chat.participantA === currentSenderUid ? chat.participantB : chat.participantA;

      // 1. Permissions validation: must be friend or have active conversation
      const isPermitted = Boolean(chat.id) || isFriend(receiverId);
      if (!isPermitted) {
        addToast('Private messaging is restricted to accepted friends.', 'error');
        return;
      }

      // 2. Stable message ID across optimistic state and Firestore
      const msgId =
        options?.messageId && /^[a-zA-Z0-9_-]+$/.test(options.messageId)
          ? options.messageId
          : `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      let previewText = cleanText;
      if (options?.bookAttachment) {
        previewText = `📚 ${options.bookAttachment.title}`;
      } else if (cleanText.startsWith('[attachment:image:')) {
        previewText = '📷 Sent a photo';
      } else if (cleanText.startsWith('[attachment:file:')) {
        previewText = '📎 Sent a file attachment';
      } else if (cleanText.startsWith('[attachment:book:')) {
        previewText = '📚 Shared a book recommendation';
      }

      // Cleanly sanitize replyTo so no undefined properties can exist
      const cleanReplyTo =
        options?.replyTo && options.replyTo.id
          ? {
              id: String(options.replyTo.id),
              text: String(options.replyTo.text || 'Message').slice(0, 500),
              senderName: String(options.replyTo.senderName || 'Reader').slice(0, 100),
              senderId: String(options.replyTo.senderId || '').slice(0, 128),
            }
          : undefined;

      const payload: Record<string, any> = {
        id: msgId,
        chatId: chat.id,
        senderId: currentSenderUid,
        receiverId,
        text: cleanText || (options?.bookAttachment ? previewText : ''),
        status: 'sent',
        createdAt: serverTimestamp(),
      };
      if (options?.bookAttachment && options.bookAttachment.title) {
        payload.bookAttachment = {
          id: String(options.bookAttachment.id || options.bookAttachment.bookId || ''),
          title: String(options.bookAttachment.title || '').slice(0, 200),
          author: String(options.bookAttachment.author || options.bookAttachment.authorName || 'Author').slice(0, 120),
          coverURL: String(options.bookAttachment.coverURL || '').slice(0, 5000),
          description: String(options.bookAttachment.description || options.bookAttachment.shortDescription || '').slice(0, 300),
          redCode: String(options.bookAttachment.redCode || '').slice(0, 12),
        };
      }
      if (cleanReplyTo) payload.replyTo = cleanReplyTo;
      if (options?.isForwarded) payload.isForwarded = true;
      if (options?.redCode) payload.redCode = String(options.redCode).slice(0, 12);

      try {
        // Persist the message independently. A legacy chat summary with stale
        // fields must not make a valid message write fail atomically with it.
        await setDoc(doc(db, 'chats', chat.id, 'messages', msgId), payload);
        const isSenderA = chat.participantA === currentSenderUid;
        try {
          await updateDoc(doc(db, 'chats', chat.id), {
            lastMessage: previewText.slice(0, 1000),
            lastSenderId: currentSenderUid,
            unreadCountA: isSenderA ? 0 : increment(1),
            unreadCountB: isSenderA ? increment(1) : 0,
            hiddenFor: arrayRemove(receiverId),
            updatedAt: serverTimestamp(),
          });
        } catch (summaryError) {
          // The message is already committed; treat summary/unread repair as a
          // secondary failure and report it without claiming message delivery failed.
          handleFirestoreError(summaryError, OperationType.UPDATE, `chats/${chat.id}`);
          console.warn('Message sent; chat preview update failed:', (summaryError as { code?: string })?.code || 'unknown');
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `chats/${chat.id}/messages/${msgId}`);
        const code = String((error as { code?: unknown } | null)?.code || 'unknown');
        addToast(`Message could not be sent (${code}). Check your chat rules or connection, then retry.`, 'error');
        throw error;
      }

      // Update local sidebar preview
      setChats((prev) =>
        prev.map((c) =>
          c.id === chat.id
            ? {
                ...c,
                lastMessage: previewText.slice(0, 1000),
                lastSenderId: currentSenderUid,
                updatedAt: new Date().toISOString(),
              }
            : c
        )
      );
    },
    [firebaseUser, currentUser, isFriend, addToast]
  );

  const editChatMessage = useCallback(
    async (chatId: string, messageId: string, newText: string) => {
      if (!firebaseUser) return;
      const cleanText = newText.trim().slice(0, 2000);
      if (!cleanText) return;
      try {
        const msgRef = doc(db, 'chats', chatId, 'messages', messageId);
        await updateDoc(msgRef, {
          text: cleanText,
          isEdited: true,
          editedAt: serverTimestamp(),
        });
        addToast('Message edited.', 'success');
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `chats/${chatId}/messages/${messageId}`);
      }
    },
    [firebaseUser, addToast]
  );

  const unsendChatMessage = useCallback(
    async (chatId: string, messageId: string) => {
      if (!firebaseUser) return;
      try {
        const msgRef = doc(db, 'chats', chatId, 'messages', messageId);
        const snap = await getDoc(msgRef);
        if (snap.exists() && snap.data().senderId === firebaseUser.uid) {
          await updateDoc(msgRef, {
            isDeleted: true,
            deletedAt: serverTimestamp(),
            text: 'This message was unsent',
          });
          addToast('Message unsent.', 'info');
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `chats/${chatId}/messages/${messageId}`);
      }
    },
    [firebaseUser, addToast]
  );

  const deleteMessageForMe = useCallback(
    async (chatId: string, messageId: string) => {
      if (!firebaseUser) return;
      try {
        const msgRef = doc(db, 'chats', chatId, 'messages', messageId);
        const snap = await getDoc(msgRef);
        if (snap.exists()) {
          const deletedFor: string[] = snap.data().deletedForUsers || [];
          if (!deletedFor.includes(firebaseUser.uid)) {
            await updateDoc(msgRef, {
              deletedForUsers: [...deletedFor, firebaseUser.uid],
            });
            addToast('Message removed for you.', 'info');
          }
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `chats/${chatId}/messages/${messageId}`);
      }
    },
    [firebaseUser, addToast]
  );

  const reactToChatMessage = useCallback(
    async (chatId: string, messageId: string, emoji: string) => {
      if (!firebaseUser) return;
      try {
        const msgRef = doc(db, 'chats', chatId, 'messages', messageId);
        const snap = await getDoc(msgRef);
        if (snap.exists()) {
          const reactions: Record<string, string[]> = snap.data().reactions || {};
          const currentReacters = reactions[emoji] || [];
          const hasReacted = currentReacters.includes(firebaseUser.uid);
          const updatedReactions = { ...reactions };
          if (hasReacted) {
            updatedReactions[emoji] = currentReacters.filter((uid) => uid !== firebaseUser.uid);
            if (updatedReactions[emoji].length === 0) {
              delete updatedReactions[emoji];
            }
          } else {
            updatedReactions[emoji] = [...currentReacters, firebaseUser.uid];
          }
          await updateDoc(msgRef, { reactions: updatedReactions });
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `chats/${chatId}/messages/${messageId}`);
      }
    },
    [firebaseUser]
  );

  const forwardChatMessage = useCallback(
    async (text: string, recipientUids: string[]) => {
      if (!firebaseUser || !currentUser) return;
      for (const targetUid of recipientUids) {
        const targetUser = users.find((u) => u.uid === targetUid);
        if (!targetUser) continue;
        try {
          const chatId = await startOrGetChat(targetUser);
          const chat = chats.find((c) => c.id === chatId) || {
            id: chatId,
            participantA: firebaseUser.uid,
            participantB: targetUid,
            participantAName: currentUser.displayName,
            participantBName: targetUser.displayName,
            participantAAvatar: currentUser.photoURL,
            participantBAvatar: targetUser.photoURL,
            lastMessage: '',
            lastSenderId: firebaseUser.uid,
            unreadCountA: 0,
            unreadCountB: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          await sendChatMessage(chat, text, { isForwarded: true });
        } catch (err) {
          console.warn('Forward failed for recipient:', targetUid, err);
        }
      }
      addToast(`Forwarded to ${recipientUids.length} friend${recipientUids.length > 1 ? 's' : ''}.`, 'success');
    },
    [firebaseUser, currentUser, users, chats, startOrGetChat, sendChatMessage, addToast]
  );

  const createGroup = useCallback(
    async (name: string, description: string, avatarURL: string, initialInvitees: UserProfile[]): Promise<string> => {
      if (!firebaseUser || !currentUser) throw new Error('Sign in required.');
      const groupId = await createGroupService(
        name,
        description,
        avatarURL,
        currentUser,
        initialInvitees
      );
      addToast(`Group "${name}" created!`, 'success');
      return groupId;
    },
    [firebaseUser, currentUser, addToast]
  );

  const inviteUserToGroup = useCallback(
    async (groupId: string, groupName: string, groupAvatar: string, targetUser: UserProfile) => {
      if (!firebaseUser || !currentUser) return;
      await inviteUserToGroupService(
        groupId,
        groupName,
        groupAvatar,
        targetUser,
        currentUser
      );
      addToast(`Invitation sent to ${targetUser.displayName}.`, 'success');
    },
    [firebaseUser, currentUser, addToast]
  );

  const acceptGroupInvitation = useCallback(
    async (invitationId: string, groupId: string) => {
      if (!firebaseUser || !currentUser) return;
      await acceptGroupInvitationService(invitationId, groupId, currentUser);
      addToast('You joined the group!', 'success');
    },
    [firebaseUser, currentUser, addToast]
  );

  const declineGroupInvitation = useCallback(
    async (invitationId: string, groupId: string) => {
      if (!firebaseUser) return;
      await declineGroupInvitationService(invitationId, groupId, firebaseUser.uid);
      addToast('Group invitation declined.', 'info');
    },
    [firebaseUser, addToast]
  );

  const leaveGroup = useCallback(
    async (groupId: string) => {
      if (!firebaseUser) return;
      await leaveGroupService(groupId, firebaseUser.uid);
      addToast('You left the group.', 'info');
    },
    [firebaseUser, addToast]
  );

  const removeGroupMember = useCallback(
    async (groupId: string, memberId: string) => {
      if (!firebaseUser) return;
      await removeGroupMemberService(groupId, memberId);
      addToast('Member removed from group.', 'info');
    },
    [firebaseUser, addToast]
  );

  const sendGroupMessage = useCallback(
    async (groupId: string, text: string, options?: any) => {
      if (!firebaseUser || !currentUser) throw new Error('Sign in required.');
      return await sendGroupMessageService(
        groupId,
        currentUser,
        text,
        options
      );
    },
    [firebaseUser, currentUser]
  );

  const reactToGroupMessage = useCallback(
    async (groupId: string, messageId: string, emoji: string) => {
      if (!firebaseUser || !groupId || !messageId) return;
      try {
        const { reactToGroupMessage: reactService } = await import('../services/firebase/groupService');
        await reactService(groupId, messageId, firebaseUser.uid, emoji);
      } catch (err) {
        console.warn('Group reaction notice:', err);
      }
    },
    [firebaseUser]
  );

  const assignUniqueRedCodeToBook = useCallback(
    async (bookId: string, bookTitle: string): Promise<string> => {
      const code = await assignUniqueRedCodeService(bookId, bookTitle);
      addToast(`Assigned unique RedCode: ${code}`, 'success');
      return code;
    },
    [addToast]
  );

  const shareBookToFriends = useCallback(
    async (book: Book, recipientUids: string[], personalMessage?: string) => {
      if (!firebaseUser || !currentUser) return;
      const cappedUids = recipientUids.slice(0, 10);
      for (const targetUid of cappedUids) {
        const targetUser = users.find((u) => u.uid === targetUid);
        if (!targetUser) continue;
        try {
          const chatId = await startOrGetChat(targetUser);
          const chat = chats.find((c) => c.id === chatId) || {
            id: chatId,
            participantA: firebaseUser.uid,
            participantB: targetUid,
            participantAName: currentUser.displayName,
            participantBName: targetUser.displayName,
            participantAAvatar: currentUser.photoURL,
            participantBAvatar: targetUser.photoURL,
            lastMessage: '',
            lastSenderId: firebaseUser.uid,
            unreadCountA: 0,
            unreadCountB: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          const attachment: ChatMessageBookAttachment = {
            id: book.id,
            bookId: book.id,
            title: book.title,
            author: book.authorName,
            authorName: book.authorName,
            coverURL: book.coverURL,
            description: book.shortDescription || book.description?.slice(0, 120) || '',
            shortDescription: book.shortDescription || book.description?.slice(0, 120),
            redCode: book.redCode,
            note: personalMessage?.trim() || undefined,
          };
          const shareText = personalMessage?.trim()
            ? `[attachment:book:${book.id}] ${personalMessage.trim()}`
            : `[attachment:book:${book.id}] Recommended book: ${book.title}`;
          await sendChatMessage(chat, shareText, { bookAttachment: attachment });
        } catch (err) {
          console.warn('Share book failed for recipient:', targetUid, err);
        }
      }
      addToast(`Book shared with ${cappedUids.length} friend${cappedUids.length > 1 ? 's' : ''}!`, 'success');
    },
    [firebaseUser, currentUser, users, chats, startOrGetChat, sendChatMessage, addToast]
  );

  const inviteToReadTogether = useCallback(
    async (book: Book, targetUser: UserProfile, personalMessage: string) => {
      if (!firebaseUser || !currentUser) throw new Error('Sign in required.');
      const result = await createReadingSessionService(
        book,
        currentUser,
        targetUser,
        personalMessage
      );
      addToast(`Reading session invitation sent to ${targetUser.displayName}!`, 'success');
      return result;
    },
    [firebaseUser, currentUser, addToast]
  );

  const acceptReadingInvitation = useCallback(
    async (invitationId: string, sessionId: string) => {
      if (!firebaseUser || !currentUser) return;
      await acceptReadingInvitationService(
        invitationId,
        sessionId,
        currentUser
      );
      addToast('You joined the reading session!', 'success');
    },
    [firebaseUser, currentUser, addToast]
  );

  const declineReadingInvitation = useCallback(
    async (invitationId: string) => {
      if (!firebaseUser) return;
      await declineReadingInvitationService(invitationId);
      addToast('Reading invitation declined.', 'info');
    },
    [firebaseUser, addToast]
  );

  const markNotificationRead = useCallback(
    async (notificationId: string) => {
      if (!firebaseUser) return;
      try {
        await updateDoc(doc(db, 'notifications', notificationId), {
          read: true,
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `notifications/${notificationId}`);
      }
    },
    [firebaseUser]
  );

  const markAllNotificationsRead = useCallback(async () => {
    if (!firebaseUser) return;
    try {
      const unread = notifications.filter((n) => !n.read);
      for (const n of unread) {
        await updateDoc(doc(db, 'notifications', n.id), {
          read: true,
          updatedAt: serverTimestamp(),
        });
      }
      addToast('All notifications marked as read.', 'info');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'notifications');
    }
  }, [firebaseUser, notifications, addToast]);

  const deleteNotification = useCallback(
    async (notificationId: string) => {
      if (!firebaseUser) return;
      try {
        await deleteDoc(doc(db, 'notifications', notificationId));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `notifications/${notificationId}`);
      }
    },
    [firebaseUser]
  );

  const submitReport = useCallback(
    async (targetType: 'book' | 'user' | 'comment', targetId: string, targetTitle: string, reason: string) => {
      if (!firebaseUser) {
        addToast('Please sign in to submit a report.', 'info');
        return;
      }
      const reportId = `rep_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      try {
        await setDoc(doc(db, 'reports', reportId), {
          id: reportId,
          reporterId: firebaseUser.uid,
          targetType,
          targetId,
          targetTitle: targetTitle.slice(0, 200),
          reason: reason.trim().slice(0, 1000),
          status: 'open',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        addToast('Report submitted to Redcover Trust & Safety.', 'success');
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `reports/${reportId}`);
      }
    },
    [firebaseUser, addToast]
  );

  const resolveReportAdmin = useCallback(
    async (reportId: string, status: 'resolved' | 'dismissed') => {
      if (!firebaseUser || !isAdmin) return;
      try {
        await updateDoc(doc(db, 'reports', reportId), {
          status,
          updatedAt: serverTimestamp(),
        });
        addToast(`Report marked as ${status}.`, 'success');
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `reports/${reportId}`);
      }
    },
    [firebaseUser, isAdmin, addToast]
  );

  const executeMasterWipe = useCallback(
    async (secretPassphrase: string): Promise<boolean> => {
      const cleanPass = (secretPassphrase || '').trim();
      if (cleanPass !== 'muzammil-please-delete-everything-232006') {
        addToast('❌ Invalid secret code! Emergency master wipe rejected.', 'error');
        throw new Error('Invalid secret code.');
      }

      addToast('⚠️ Master Emergency Wipe in progress... Clearing all collections.', 'info');

      try {
        const collectionsToClear = [
          'books',
          'likes',
          'bookViews',
          'saves',
          'savedBooks',
          'chats',
          'groups',
          'groupChats',
          'groupInvitations',
          'readingSessions',
          'readingInvitations',
          'readingProgress',
          'reviews',
          'posts',
          'socialPosts',
          'postLikes',
          'postComments',
          'follows',
          'friendships',
          'notifications',
          'reports',
        ];

        // 1. Wipe all specified Firestore collections & subcollections
        for (const collName of collectionsToClear) {
          try {
            const snap = await getDocs(collection(db, collName));
            for (const d of snap.docs) {
              if (collName === 'books') {
                try {
                  const chSnap = await getDocs(collection(db, 'books', d.id, 'chapters'));
                  for (const ch of chSnap.docs) {
                    await deleteDoc(doc(db, 'books', d.id, 'chapters', ch.id)).catch(() => {});
                  }
                  const pcSnap = await getDocs(collection(db, 'books', d.id, 'paragraph_comments'));
                  for (const pc of pcSnap.docs) {
                    await deleteDoc(doc(db, 'books', d.id, 'paragraph_comments', pc.id)).catch(() => {});
                  }
                } catch {}
              } else if (collName === 'chats') {
                try {
                  const msgSnap = await getDocs(collection(db, 'chats', d.id, 'messages'));
                  for (const m of msgSnap.docs) {
                    await deleteDoc(doc(db, 'chats', d.id, 'messages', m.id)).catch(() => {});
                  }
                } catch {}
              } else if (collName === 'groups') {
                try {
                  const gmSnap = await getDocs(collection(db, 'groups', d.id, 'messages'));
                  for (const gm of gmSnap.docs) {
                    await deleteDoc(doc(db, 'groups', d.id, 'messages', gm.id)).catch(() => {});
                  }
                } catch {}
              }
              await deleteDoc(d.ref).catch(() => {});
            }
          } catch (e) {
            console.warn(`Error wiping collection ${collName}:`, e);
          }
        }

        // 2. Also wipe mirrored books in `defaultDb`
        try {
          const defBooksSnap = await getDocs(collection(defaultDb, 'books'));
          for (const d of defBooksSnap.docs) {
            try {
              const defChSnap = await getDocs(collection(defaultDb, 'books', d.id, 'chapters'));
              for (const ch of defChSnap.docs) {
                await deleteDoc(doc(defaultDb, 'books', d.id, 'chapters', ch.id)).catch(() => {});
              }
            } catch {}
            await deleteDoc(d.ref).catch(() => {});
          }
        } catch {}

        // 3. Clear RTDB nodes: /chats, /messages, /user_chats, /presence, /typing, /books, /users
        if (rtdb) {
          try {
            const { set: rtdbSet, ref: getRtdbRef } = await import('firebase/database');
            await rtdbSet(getRtdbRef(rtdb, 'chats'), null);
            await rtdbSet(getRtdbRef(rtdb, 'messages'), null);
            await rtdbSet(getRtdbRef(rtdb, 'user_chats'), null);
            await rtdbSet(getRtdbRef(rtdb, 'presence'), null);
            await rtdbSet(getRtdbRef(rtdb, 'typing'), null);
            await rtdbSet(getRtdbRef(rtdb, 'books'), null);
            await rtdbSet(getRtdbRef(rtdb, 'users'), null);
          } catch (rtdbErr) {
            console.warn('RTDB wipe warning:', rtdbErr);
          }
        }

        // 4. Wipe localStorage entirely and set marker
        try {
          localStorage.clear();
          sessionStorage.clear();
          localStorage.setItem('rc_master_wiped', 'true');
        } catch {}

        // 5. Reset in-memory states to clean fresh start
        setFirestoreBooks([]);
        setDefaultDbBooks([]);
        setRtdbBooks([]);
        setMyAuthoredBooks([]);
        setReadingProgress([]);
        setSavedBooks([]);
        setLikedBooks([]);
        setFollows([]);
        setFriendships([]);
        setChats([]);
        setGroups([]);
        setGroupInvitations([]);
        setReadingSessions([]);
        setReadingInvitations([]);
        setNotifications([]);
        setReports([]);
        setFirestorePostComments([]);
        setDefaultDbPostComments([]);
        setLocalPostComments([]);
        setPostLikes([]);

        addToast('💥 All Firebase data successfully wiped! Fresh new start initiated.', 'success');

        // 6. Reload after brief moment
        setTimeout(() => {
          window.location.href = '/';
        }, 1200);

        return true;
      } catch (err) {
        console.error('Master wipe failure:', err);
        addToast('Failed to complete master wipe. Please verify permissions.', 'error');
        return false;
      }
    },
    [addToast]
  );

  const createSocialPost = useCallback(
    async (input: {
      postType: SocialPostType;
      text: string;
      book?: Book | null;
      rating?: number;
      progressPercentage?: number;
      chapterNumber?: number;
    }) => {
      if (!firebaseUser || !currentUser) {
        addToast('Please sign in to share activity with the community.', 'info');
        return;
      }
      const cleanText = input.text.trim().slice(0, 3000);
      if (!cleanText) {
        addToast('Please enter some text for your post.', 'info');
        return;
      }

      const postId = `post_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const selectedBook = input.book || null;
      const cleanRating =
        input.postType === 'book_review'
          ? Math.min(5, Math.max(1, Math.round(input.rating || 5)))
          : 0;
      const cleanPct =
        input.postType === 'reading_update' || input.postType === 'reading_achievement'
          ? Math.min(100, Math.max(0, Math.round(input.progressPercentage ?? 0)))
          : 0;
      const cleanChap =
        input.postType === 'reading_update'
          ? Math.max(1, Math.round(input.chapterNumber ?? 1))
          : 0;

      try {
        await ensureUserProfile(firebaseUser);
        if (selectedBook) {
          await ensureBookInFirestore(selectedBook);
        }

        const safeBookId = selectedBook ? sanitizeId(selectedBook.id, 'book') : '';
        const payload = {
          id: postId,
          authorId: firebaseUser.uid,
          authorName: (currentUser.displayName || 'Reader').trim().slice(0, 100) || 'Reader',
          authorUsername: (currentUser.username || 'reader').trim().slice(0, 80) || 'reader',
          authorAvatar: currentUser.photoURL && currentUser.photoURL.length <= 5000 ? currentUser.photoURL : '',
          postType: input.postType,
          text: cleanText,
          bookId: safeBookId.slice(0, 128),
          bookTitle: selectedBook ? selectedBook.title.slice(0, 200) : '',
          bookAuthor: selectedBook ? selectedBook.authorName.slice(0, 120) : '',
          bookCover:
            selectedBook && selectedBook.coverURL && selectedBook.coverURL.length <= 5000
              ? selectedBook.coverURL
              : '',
          bookCategory: selectedBook ? selectedBook.category.slice(0, 80) : '',
          rating: cleanRating,
          progressPercentage: cleanPct,
          chapterNumber: cleanChap,
          likesCount: 0,
          commentsCount: 0,
          visibility: 'public',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        await setDoc(doc(db, 'posts', postId), payload);
        try {
          await setDoc(doc(defaultDb, 'posts', postId), payload, { merge: true });
        } catch {}

        // Also synchronize with the canonical review or readingProgress collection if applicable
        if (input.postType === 'book_review' && selectedBook) {
          await submitReview(selectedBook, cleanRating, cleanText);
        } else if (input.postType === 'reading_update' && selectedBook) {
          await saveReadingProgress(
            selectedBook,
            cleanChap,
            Math.max(1, selectedBook.chaptersCount || 1),
            cleanPct,
            false,
            cleanText.slice(0, 500)
          );
          addToast('Reading progress updated and shared to feed!', 'success');
        } else {
          addToast('Shared to the Redcover community feed!', 'success');
        }
      } catch (error) {
        addToast('Could not publish post to community feed.', 'error');
        handleFirestoreError(error, OperationType.CREATE, `posts/${postId}`);
      }
    },
    [firebaseUser, currentUser, ensureUserProfile, ensureBookInFirestore, sanitizeId, submitReview, saveReadingProgress, addToast]
  );

  const deleteSocialPost = useCallback(
    async (postId: string) => {
      if (!firebaseUser) return;
      try {
        await deleteDoc(doc(db, 'posts', postId));
        try {
          await deleteDoc(doc(defaultDb, 'posts', postId));
        } catch {}
        addToast('Post removed from feed.', 'info');
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `posts/${postId}`);
      }
    },
    [firebaseUser, addToast]
  );

  const toggleLikePost = useCallback(
    async (
      postId: string,
      backingPost?: SocialPost | null,
      options?: {
        targetAuthorId?: string;
        targetTitle?: string;
        bookForSync?: Book | null;
        link?: string;
      }
    ) => {
      if (!firebaseUser) {
        addToast('Please sign in to like community posts.', 'info');
        return;
      }
      const cleanPostId = postId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
      const likeId = `${firebaseUser.uid}_${cleanPostId}`.slice(0, 128);
      const existingLike = postLikes.find(
        (l) => l.id === likeId || (l.postId === cleanPostId && l.userId === firebaseUser.uid)
      );
      const bookSync = options?.bookForSync;
      const safeBookSyncId = bookSync ? sanitizeId(bookSync.id, 'book') : '';
      const existingBookLike = bookSync
        ? likedBooks.find(
            (l) =>
              l.id === `${firebaseUser.uid}_${safeBookSyncId}` ||
              l.bookId === safeBookSyncId ||
              l.bookId === bookSync.id
          )
        : undefined;

      try {
        if (existingLike || existingBookLike) {
          if (existingLike) {
            await deleteDoc(doc(db, 'postLikes', existingLike.id));
          }
          if (backingPost) {
            const nextCount = Math.max(0, Math.round(Number(backingPost.likesCount) || 1) - 1);
            await updateDoc(doc(db, 'posts', backingPost.id), {
              likesCount: nextCount,
              updatedAt: serverTimestamp(),
            }).catch(() => {});
          }
          if (bookSync) {
            await ensureBookInFirestore(bookSync);
            if (existingBookLike) {
              await deleteDoc(doc(db, 'likes', existingBookLike.id)).catch(() => {});
            }
            const nextBookLikes = Math.max(0, Math.round(Number(bookSync.likes) || 1) - 1);
            await updateDoc(doc(db, 'books', safeBookSyncId), {
              likes: nextBookLikes,
              updatedAt: serverTimestamp(),
            }).catch(() => {});
            try {
              await updateDoc(doc(defaultDb, 'books', bookSync.id), { likes: nextBookLikes });
            } catch {}
          }
        } else {
          await setDoc(doc(db, 'postLikes', likeId), {
            id: likeId,
            postId: cleanPostId,
            userId: firebaseUser.uid,
            createdAt: serverTimestamp(),
          });
          if (backingPost) {
            const nextCount = Math.max(0, Math.round(Number(backingPost.likesCount) || 0)) + 1;
            await updateDoc(doc(db, 'posts', backingPost.id), {
              likesCount: nextCount,
              updatedAt: serverTimestamp(),
            }).catch(() => {});
          }
          if (bookSync) {
            await ensureBookInFirestore(bookSync);
            const bookLikeId = sanitizeId(`${firebaseUser.uid}_${safeBookSyncId}`, 'like');
            await setDoc(doc(db, 'likes', bookLikeId), {
              id: bookLikeId,
              userId: firebaseUser.uid,
              bookId: safeBookSyncId,
              targetAuthorId: sanitizeId(bookSync.authorId || firebaseUser.uid, 'author'),
              createdAt: serverTimestamp(),
            }).catch(() => {});
            const nextBookLikes = Math.max(0, Math.round(Number(bookSync.likes) || 0)) + 1;
            await updateDoc(doc(db, 'books', safeBookSyncId), {
              likes: nextBookLikes,
              updatedAt: serverTimestamp(),
            }).catch(() => {});
            try {
              await updateDoc(doc(defaultDb, 'books', bookSync.id), { likes: nextBookLikes });
            } catch {}
          }

          // Send real-time notification to post/book author
          const recipientUid = options?.targetAuthorId || backingPost?.authorId || bookSync?.authorId;
          if (recipientUid && recipientUid !== firebaseUser.uid && currentUser) {
            const safeRecip = sanitizeId(recipientUid, 'user');
            const notifId = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
            const label = options?.targetTitle || backingPost?.bookTitle || bookSync?.title || 'your post';
            await setDoc(doc(db, 'notifications', notifId), {
              id: notifId,
              recipientId: safeRecip,
              actorId: firebaseUser.uid,
              actorName: (currentUser.displayName || 'Reader').slice(0, 100),
              category: 'social',
              title: 'New Like',
              body: `${currentUser.displayName} liked "${label.slice(0, 80)}".`,
              link: (options?.link || (bookSync ? `/book/${bookSync.id}` : '/')).slice(0, 300),
              read: false,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            }).catch(() => {});
          }
        }
      } catch (error) {
        addToast('Could not update like on post.', 'error');
        handleFirestoreError(error, OperationType.WRITE, `postLikes/${likeId}`);
      }
    },
    [firebaseUser, currentUser, postLikes, likedBooks, ensureBookInFirestore, sanitizeId, addToast]
  );

  const toggleLikeComment = useCallback(
    async (comment: PostComment, postLink?: string) => {
      if (!firebaseUser) {
        addToast('Please sign in to like comments.', 'info');
        return;
      }
      const cmtPostKey = `cmtlike_${comment.id}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
      const likeId = `${firebaseUser.uid}_${cmtPostKey}`.slice(0, 128);
      const existingLike = postLikes.find(
        (l) => l.id === likeId || (l.postId === cmtPostKey && l.userId === firebaseUser.uid)
      );

      try {
        if (existingLike) {
          await deleteDoc(doc(db, 'postLikes', existingLike.id));
        } else {
          await setDoc(doc(db, 'postLikes', likeId), {
            id: likeId,
            postId: cmtPostKey,
            userId: firebaseUser.uid,
            createdAt: serverTimestamp(),
          });

          if (comment.userId && comment.userId !== firebaseUser.uid && currentUser) {
            const safeRecip = sanitizeId(comment.userId, 'user');
            const notifId = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
            await setDoc(doc(db, 'notifications', notifId), {
              id: notifId,
              recipientId: safeRecip,
              actorId: firebaseUser.uid,
              actorName: (currentUser.displayName || 'Reader').slice(0, 100),
              category: 'social',
              title: 'Liked Your Comment',
              body: `${currentUser.displayName} liked your comment: "${comment.text.slice(0, 80)}"`,
              link: (postLink || '/').slice(0, 300),
              read: false,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            }).catch(() => {});
          }
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `postLikes/${likeId}`);
      }
    },
    [firebaseUser, currentUser, postLikes, sanitizeId, addToast]
  );

  const addPostComment = useCallback(
    async (
      postId: string,
      text: string,
      backingPost?: SocialPost | null,
      options?: {
        parentId?: string;
        replyToUsername?: string;
        targetAuthorId?: string;
        targetTitle?: string;
        link?: string;
      }
    ) => {
      const rawBody = text.trim();
      if (!rawBody) return;
      const encodedText = encodeCommentReplyText(rawBody, options?.parentId, options?.replyToUsername);
      const cleanPostId = postId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
      const commentId = `cmt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const nowIso = new Date().toISOString();

      const resolvedUid = firebaseUser?.uid || currentUser?.uid || 'guest_reader';
      const resolvedName =
        (
          currentUser?.displayName ||
          firebaseUser?.displayName ||
          firebaseUser?.email?.split('@')[0] ||
          'Redcover Reader'
        )
          .trim()
          .slice(0, 100) || 'Redcover Reader';
      const resolvedUsername =
        (
          currentUser?.username ||
          firebaseUser?.email?.split('@')[0]?.replace(/[^a-zA-Z0-9_]/g, '') ||
          'reader'
        )
          .trim()
          .slice(0, 80) || 'reader';
      const resolvedAvatar =
        (currentUser?.photoURL || firebaseUser?.photoURL || '').length <= 5000
          ? currentUser?.photoURL || firebaseUser?.photoURL || ''
          : '';

      // 1. Instant Optimistic Update + Local Cache so the comment is immediately visible!
      const optimisticComment: PostComment = normalizePostCommentDoc(commentId, {
        id: commentId,
        postId: cleanPostId,
        userId: resolvedUid,
        userName: resolvedName,
        userUsername: resolvedUsername,
        userAvatar: resolvedAvatar,
        text: encodedText,
        createdAt: nowIso,
        updatedAt: nowIso,
      });

      setLocalPostComments((prev) => {
        const next = [...prev.filter((c) => c.id !== commentId), optimisticComment];
        try {
          localStorage.setItem('rc_local_post_comments_v1', JSON.stringify(next));
        } catch {}
        return next;
      });
      addToast('Comment posted!', 'success');

      if (!firebaseUser) {
        return;
      }

      try {
        await ensureUserProfile(firebaseUser);
        const payload = {
          id: commentId,
          postId: cleanPostId,
          userId: firebaseUser.uid,
          userName: resolvedName,
          userUsername: resolvedUsername,
          userAvatar: resolvedAvatar,
          text: encodedText,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        await setDoc(doc(db, 'postComments', commentId), payload);
        try {
          await setDoc(doc(defaultDb, 'postComments', commentId), payload, { merge: true });
        } catch {}

        if (backingPost) {
          await updateDoc(doc(db, 'posts', backingPost.id), {
            commentsCount: Math.max(0, Math.round(Number(backingPost.commentsCount) || 0)) + 1,
            updatedAt: serverTimestamp(),
          }).catch(() => {});
        }

        // Send real-time notification to post/comment author
        const recipientUid = options?.targetAuthorId || backingPost?.authorId;
        if (recipientUid && recipientUid !== firebaseUser.uid) {
          const safeRecip = sanitizeId(recipientUid, 'user');
          const notifId = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          const isReply = Boolean(options?.parentId);
          await setDoc(doc(db, 'notifications', notifId), {
            id: notifId,
            recipientId: safeRecip,
            actorId: firebaseUser.uid,
            actorName: resolvedName.slice(0, 100),
            category: 'social',
            title: isReply ? 'New Reply to Your Comment' : 'New Comment',
            body: `${resolvedName} ${isReply ? 'replied' : 'commented'}: "${rawBody.slice(0, 90)}"`,
            link: (options?.link || '/').slice(0, 300),
            read: false,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          }).catch(() => {});
        }
      } catch (error) {
        console.warn('Firestore comment sync warning (kept in local cache):', error);
      }
    },
    [firebaseUser, currentUser, ensureUserProfile, sanitizeId, addToast]
  );

  const editPostComment = useCallback(
    async (
      commentId: string,
      newText: string,
      parentId?: string,
      replyToUsername?: string
    ) => {
      const cleanBody = newText.trim();
      if (!cleanBody) return;
      const existingCmt = postComments.find((c) => c.id === commentId);
      const effectiveParentId = parentId ?? existingCmt?.parentId;
      const effectiveReplyUser = replyToUsername ?? existingCmt?.replyToUsername;
      const encodedText = encodeCommentReplyText(cleanBody, effectiveParentId, effectiveReplyUser);
      const nowIso = new Date().toISOString();

      if (existingCmt) {
        const updatedLocal: PostComment = {
          ...existingCmt,
          text: cleanBody,
          updatedAt: nowIso,
        };
        setLocalPostComments((prev) => {
          const next = [...prev.filter((c) => c.id !== commentId), updatedLocal];
          try {
            localStorage.setItem('rc_local_post_comments_v1', JSON.stringify(next));
          } catch {}
          return next;
        });
      }
      addToast('Comment updated.', 'success');

      if (!firebaseUser || !currentUser) return;

      try {
        await updateDoc(doc(db, 'postComments', commentId), {
          text: encodedText,
          userName: (currentUser.displayName || 'Reader').trim().slice(0, 100) || 'Reader',
          userUsername: (currentUser.username || 'reader').trim().slice(0, 80) || 'reader',
          userAvatar: currentUser.photoURL && currentUser.photoURL.length <= 5000 ? currentUser.photoURL : '',
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        console.warn('Comment edit sync warning:', error);
      }
    },
    [firebaseUser, currentUser, postComments, addToast]
  );

  const deletePostComment = useCallback(
    async (commentId: string, _postId: string, backingPost?: SocialPost | null) => {
      const childReplies = postComments.filter((c) => c.parentId === commentId);
      const idsToRemove = [commentId, ...childReplies.map((r) => r.id)];

      setDeletedCommentIds((prev) => {
        const next = Array.from(new Set([...prev, ...idsToRemove]));
        try {
          localStorage.setItem('rc_deleted_comment_ids_v1', JSON.stringify(next));
        } catch {}
        return next;
      });

      setLocalPostComments((prev) => {
        const next = prev.filter((c) => !idsToRemove.includes(c.id));
        try {
          localStorage.setItem('rc_local_post_comments_v1', JSON.stringify(next));
        } catch {}
        return next;
      });
      addToast('Comment deleted.', 'info');

      if (!firebaseUser) return;
      try {
        await deleteDoc(doc(db, 'postComments', commentId)).catch(() => {});
        for (const reply of childReplies) {
          if (reply.userId === firebaseUser.uid || isAdmin) {
            await deleteDoc(doc(db, 'postComments', reply.id)).catch(() => {});
          }
        }
        if (backingPost) {
          const dec = 1 + childReplies.length;
          await updateDoc(doc(db, 'posts', backingPost.id), {
            commentsCount: Math.max(0, Math.round(Number(backingPost.commentsCount) || dec) - dec),
            updatedAt: serverTimestamp(),
          }).catch(() => {});
        }
      } catch (error) {
        console.warn('Comment delete sync warning:', error);
      }
    },
    [firebaseUser, isAdmin, postComments, addToast]
  );

  const value: RedcoverContextValue = {
    firebaseUser,
    currentUser,
    privateInfo,
    authLoading,
    isAdmin,
    hqRole,
    hqPermissions,
    refreshHqClaims,
    hasHqPermission,
    books,
    users,
    reviews,
    readingProgress,
    publicReadingProgress,
    socialPosts,
    postLikes,
    postComments,
    savedBooks,
    likedBooks,
    follows,
    friendships,
    chats,
    groups,
    groupInvitations,
    readingSessions,
    readingInvitations,
    notifications,
    reports,
    booksLoading,
    realtimeSyncCount,
    lastSyncedAt,
    defaultDbCount: defaultDbBooks.length + defaultDbUsers.length + rtdbBooks.length + rtdbUsers.length,
    sourceStats,
    toasts,
    theme,
    recentSearches,
    addToast,
    dismissToast,
    setTheme,
    addRecentSearch,
    clearRecentSearches,
    loginWithGoogle,
    loginWithEmail,
    registerWithEmail,
    sendResetPassword,
    logout,
    toggleSaveBook,
    toggleLikeBook,
    incrementBookView,
    incrementPostView,
    getBookChapters,
    saveReadingProgress,
    submitReview,
    createSocialPost,
    deleteSocialPost,
    toggleLikePost,
    toggleLikeComment,
    addPostComment,
    editPostComment,
    deletePostComment,
    publishOrSaveBook,
    deleteBook,
    updateBookStatusAdmin,
    updateUserProfile,
    updatePrivateSettings,
    upgradeMembership,
    toggleFollowUser,
    sendFriendRequest,
    updateFriendshipStatus,
    cancelFriendRequest,
    removeFriendship,
    blockUser,
    isFriend,
    acceptedFriends,
    startOrGetChat,
    clearChatUnreadCount,
    deleteChat,
    setChatNickname,
    sendChatMessage,
    editChatMessage,
    unsendChatMessage,
    deleteMessageForMe,
    reactToChatMessage,
    forwardChatMessage,
    createGroup,
    inviteUserToGroup,
    acceptGroupInvitation,
    declineGroupInvitation,
    leaveGroup,
    removeGroupMember,
    sendGroupMessage,
    reactToGroupMessage,
    assignUniqueRedCodeToBook,
    shareBookToFriends,
    inviteToReadTogether,
    acceptReadingInvitation,
    declineReadingInvitation,
    markNotificationRead,
    markAllNotificationsRead,
    deleteNotification,
    submitReport,
    resolveReportAdmin,
    executeMasterWipe,
  };

  return <RedcoverContext.Provider value={value}>{children}</RedcoverContext.Provider>;
};

export const useRedcover = (): RedcoverContextValue => {
  const ctx = useContext(RedcoverContext);
  if (!ctx) throw new Error('useRedcover must be used inside RedcoverProvider');
  return ctx;
};
