export type UserRole = 'user' | 'author' | 'admin' | 'system';
export type MembershipPlan = 'free' | 'premium';
export type BookFormat = 'story' | 'pdf';
export type BookReadingMode = 'text' | 'pdf' | 'audio';
export type BookStatus = 'draft' | 'published' | 'pending' | 'removed';
export type NotificationCategory =
  | 'social'
  | 'messages'
  | 'books'
  | 'membership'
  | 'reading'
  | 'groups'
  | 'system';
export type FriendshipStatus = 'pending' | 'accepted' | 'rejected' | 'blocked';
export type AppTheme = 'light' | 'dark';

export const REDCOVER_SYSTEM_ACCOUNT = {
  email: 'engeeo.io@gmail.com',
  displayName: 'Redcover System',
  role: 'system' as const,
  verified: true,
};

export function isSystemAccount(account?: UserProfile | string | null): boolean {
  if (!account) return false;
  if (typeof account === 'object') {
    if (account.role === 'system') return true;
    if (account.uid === 'system' || account.uid === 'redcover-system') return true;
    if (account.username?.toLowerCase() === 'redcover-system' || account.username?.toLowerCase() === 'system') return true;
    if ((account as any).email && (account as any).email.toLowerCase() === REDCOVER_SYSTEM_ACCOUNT.email.toLowerCase()) return true;
    return false;
  }
  return (
    account.toLowerCase() === REDCOVER_SYSTEM_ACCOUNT.email.toLowerCase() ||
    account === 'system' ||
    account === 'redcover-system'
  );
}

export interface UserProfile {
  uid: string;
  username: string;
  displayName: string;
  photoURL: string;
  coverURL: string;
  bio: string;
  followersCount: number;
  followingCount: number;
  booksCount: number;
  streakDays: number;
  points: number;
  membershipPlan: MembershipPlan;
  isOnline: boolean;
  showOnlineStatus: boolean;
  publicActivity: boolean;
  role: UserRole;
  nameColor?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ParagraphComment {
  id: string;
  bookId: string;
  chapterIndex?: number;
  paragraphIndex: number;
  userId: string;
  userName: string;
  userAvatar: string;
  userPlan?: MembershipPlan;
  userNameColor?: string;
  text: string;
  createdAt: string;
}

export interface UserPrivateInfo {
  uid: string;
  email: string;
  readingReminders: boolean;
  notificationSettings: 'all' | 'important' | 'none';
  theme: AppTheme;
  subscriptionExpiry: string;
  updatedAt: string;
}

export interface Book {
  id: string;
  title: string;
  description: string;
  shortDescription: string;
  authorId: string;
  authorName: string;
  authorUsername: string;
  authorAvatar: string;
  coverURL: string;
  fileURL: string;
  format: BookFormat;
  availableModes?: BookReadingMode[];
  category: string;
  language: string;
  rating: number;
  reviewsCount: number;
  views: number;
  viewers?: string[];
  likes: number;
  saves: number;
  chaptersCount: number;
  featured: boolean;
  status: BookStatus;
  createdAt: string;
  updatedAt: string;
  sourceDb?: 'applet' | 'default' | 'catalog';
  redCode?: string;
}

export interface Chapter {
  id: string;
  bookId: string;
  authorId: string;
  bookStatus: BookStatus;
  chapterNumber: number;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface Review {
  id: string;
  bookId: string;
  bookTitle: string;
  userId: string;
  userName: string;
  userAvatar: string;
  rating: number;
  text: string;
  visibility: 'public' | 'hidden';
  createdAt: string;
  updatedAt: string;
}

export interface ReadingProgress {
  id: string;
  userId: string;
  bookId: string;
  bookTitle: string;
  bookCover: string;
  bookAuthor: string;
  currentChapter: number;
  totalChapters: number;
  percentage: number;
  bookmarkNote: string;
  isBookmarked: boolean;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SavedBook {
  id: string;
  userId: string;
  bookId: string;
  createdAt: string;
}

export interface BookLike {
  id: string;
  userId: string;
  bookId: string;
  targetAuthorId: string;
  createdAt: string;
}

export interface Follow {
  id: string;
  followerId: string;
  followingId: string;
  followerName: string;
  followingName: string;
  createdAt: string;
}

export interface Friendship {
  id: string;
  requesterId: string;
  receiverId: string;
  requesterName: string;
  receiverName: string;
  requesterAvatar: string;
  receiverAvatar: string;
  status: FriendshipStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Chat {
  id: string;
  participantA: string;
  participantB: string;
  participantAName: string;
  participantBName: string;
  participantAAvatar: string;
  participantBAvatar: string;
  lastMessage: string;
  lastSenderId: string;
  unreadCountA: number;
  unreadCountB: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessageReply {
  id: string;
  text: string;
  senderName: string;
  senderId: string;
}

export interface ChatMessageBookAttachment {
  id?: string;
  bookId?: string;
  title: string;
  author?: string;
  authorName?: string;
  coverURL: string;
  description?: string;
  shortDescription?: string;
  redCode?: string;
  note?: string;
}

export interface ChatMessage {
  id: string;
  chatId: string;
  senderId: string;
  receiverId: string;
  text: string;
  status: 'sending' | 'sent' | 'delivered' | 'read';
  createdAt: string;
  replyTo?: ChatMessageReply;
  reactions?: Record<string, string[]>; // emoji -> array of user uids
  isEdited?: boolean;
  editedAt?: string;
  isDeletedForEveryone?: boolean;
  isDeleted?: boolean;
  deletedAt?: string;
  deletedForUsers?: string[]; // uids of users who clicked "Delete for me"
  isForwarded?: boolean;
  forwardedFrom?: string;
  attachmentType?: 'none' | 'image' | 'file' | 'book' | 'redcode';
  bookAttachment?: ChatMessageBookAttachment;
  redCode?: string;
}

export type NotificationType =
  | 'book_like'
  | 'book_comment'
  | 'comment_reply'
  | 'friend_request'
  | 'friend_accept'
  | 'follow'
  | 'reading_invite'
  | 'group_invite'
  | 'friend_suggestion'
  | 'system_announcement';

export interface NotificationItem {
  id: string;
  recipientId: string;
  actorId: string;
  actorName: string;
  actorAvatar?: string;
  category: NotificationCategory;
  type?: NotificationType;
  title: string;
  body: string;
  link: string;
  read: boolean;
  targetId?: string;
  actionState?: 'pending' | 'accepted' | 'declined' | 'joined';
  createdAt: string;
  updatedAt: string;
}

export type ChatWallpaperType = 'default' | 'solid' | 'preset' | 'custom';

export interface ChatWallpaperConfig {
  type: ChatWallpaperType;
  value: string;
}

export type GroupRole = 'creator' | 'admin' | 'member' | 'pending_invitee';

export interface Group {
  id: string;
  name: string;
  description: string;
  avatarURL: string;
  creatorId: string;
  creatorName: string;
  admins: string[];
  members: string[];
  pendingInvitees: string[];
  lastMessage?: string;
  lastSenderId?: string;
  lastMessageAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GroupMember {
  id: string;
  groupId: string;
  userId: string;
  userName: string;
  userAvatar: string;
  role: GroupRole;
  joinedAt: string;
}

export interface GroupInvitation {
  id: string;
  groupId: string;
  groupName: string;
  groupAvatar: string;
  inviterId: string;
  inviterName: string;
  inviteeId: string;
  inviteeName: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
  updatedAt: string;
}

export interface GroupMessage {
  id: string;
  groupId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  text: string;
  replyTo?: ChatMessageReply;
  reactions?: Record<string, string[]>;
  isEdited?: boolean;
  editedAt?: string;
  isDeletedForEveryone?: boolean;
  deletedForUsers?: string[];
  isForwarded?: boolean;
  forwardedFrom?: string;
  attachmentType?: 'none' | 'image' | 'file' | 'book' | 'redcode';
  bookAttachment?: ChatMessageBookAttachment;
  createdAt: string;
}

export interface RedCodeRecord {
  code: string;
  bookId: string;
  bookTitle: string;
  createdAt: string;
}

export interface ReadingSession {
  id: string;
  bookId: string;
  bookTitle: string;
  bookCover: string;
  bookFormat: BookFormat;
  hostId: string;
  hostName: string;
  hostAvatar: string;
  participantId?: string;
  participantName?: string;
  participantAvatar?: string;
  status: 'waiting' | 'active' | 'ended';
  currentChapter: number;
  currentPage: number;
  scrollPosition: number;
  activeControllerId: string;
  activeControllerName: string;
  controllerLeaseUntil: number;
  createdAt: string;
  updatedAt: string;
}

export interface ReadingRemoteRequest {
  id: string;
  sessionId: string;
  requesterId: string;
  requesterName: string;
  requesterAvatar: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  createdAt: string;
  expiresAt: string;
}

export interface ReadingInvitation {
  id: string;
  bookId: string;
  bookTitle: string;
  bookCover: string;
  inviterId: string;
  inviterName: string;
  inviterAvatar: string;
  inviteeId: string;
  inviteeName: string;
  personalMessage: string;
  sessionId: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  createdAt: string;
  updatedAt: string;
}

export interface ReportItem {
  id: string;
  reporterId: string;
  targetType: 'book' | 'user' | 'comment';
  targetId: string;
  targetTitle: string;
  reason: string;
  status: 'open' | 'resolved' | 'dismissed';
  createdAt: string;
  updatedAt: string;
}

export type SocialPostType =
  | 'discussion'
  | 'book_recommendation'
  | 'reading_update'
  | 'book_review'
  | 'story_publication'
  | 'reading_achievement';

export type FeedFilterType = 'for_you' | 'following' | 'latest' | 'trending';

export interface SocialPost {
  id: string;
  authorId: string;
  authorName: string;
  authorUsername: string;
  authorAvatar: string;
  postType: SocialPostType;
  text: string;
  bookId: string;
  bookTitle: string;
  bookAuthor: string;
  bookCover: string;
  bookCategory: string;
  rating: number;
  progressPercentage: number;
  chapterNumber: number;
  likesCount: number;
  commentsCount: number;
  viewsCount?: number;
  visibility: 'public' | 'hidden';
  createdAt: string;
  updatedAt: string;
}

export interface PostLike {
  id: string;
  postId: string;
  userId: string;
  createdAt: string;
}

export interface PostComment {
  id: string;
  postId: string;
  userId: string;
  userName: string;
  userUsername: string;
  userAvatar: string;
  text: string;
  parentId?: string;
  replyToUsername?: string;
  createdAt: string;
  updatedAt: string;
}

export const REDCOVER_CATEGORIES = [
  'All',
  'Romance',
  'Business',
  'Finance',
  'Self Help',
  'Productivity',
  'Education',
  'Fiction',
  'Mystery',
  'Thriller',
  'Personal Development',
] as const;

