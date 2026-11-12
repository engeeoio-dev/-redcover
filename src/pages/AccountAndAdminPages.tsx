import React, { useState, useMemo, useEffect } from 'react';
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Book } from '../models/types';
import {
  Edit3,
  UserPlus,
  UserCheck,
  MessageSquare,
  Ban,
  Flame,
  Award,
  Bell,
  CheckCheck,
  Crown,
  Check,
  Shield,
  Database,
  RefreshCw,
  LogOut,
  Upload,
  Sparkles,
  AlertTriangle,
  Trash2,
  ChevronRight,
  LayoutDashboard,
  UsersRound,
  BookOpen,
  BookMarked,
  Flag,
  Activity,
  ClipboardList,
  Search,
  CheckCircle2,
  CircleDot,
  Clock3,
  LockKeyhole,
  XCircle,
  Loader2,
  HardDrive,
  Cloud,
  ShieldCheck,
  Info,
  BarChart3,
  Gem,
  ImagePlus,
  Settings2,
  Ticket,
  ShieldAlert,
} from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { useRedcover } from '../contexts/RedcoverContext';
import { db, FIREBASE_PROJECT_INFO } from '../services/firebase/firebaseConfig';
import { uploadFileToRedcoverStorage } from '../services/firebase/storageService';
import { ImageCropModal } from '../components/common/ImageCropModal';
import { BookCard, BookCover, EmptyState, UserAvatar } from '../components/common/UIPrimitives';
import { headquartersService, HeadquartersOverview, HeadquartersRole, HqAuditEntry, HqBook, HqEvent, HqReport, HqServiceHealth, HqStaff, HqUser } from '../services/firebase/headquartersService';
import { HeadquartersExtendedPanels } from './HeadquartersExtendedPanels';
import { HqUserDetailsModal } from './HqUserDetailsModal';

export const ProfilePage: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const {
    currentUser,
    users,
    books,
    reviews,
    readingProgress,
    follows,
    friendships,
    savedBooks,
    likedBooks,
    toggleFollowUser,
    sendFriendRequest,
    blockUser,
    startOrGetChat,
    updateUserProfile,
    toggleSaveBook,
    toggleLikeBook,
    addToast,
  } = useRedcover();
  const [searchParams] = useSearchParams();

  const targetUid = userId || currentUser?.uid;
  const profileUser = useMemo(
    () => users.find((u) => u.uid === targetUid) || (currentUser?.uid === targetUid ? currentUser : null),
    [users, targetUid, currentUser]
  );

  const [activeTab, setActiveTab] = useState<
    'overview' | 'books' | 'reviews' | 'activity' | 'about' | 'followers' | 'following' | 'friends' | 'likes'
  >(() => {
    const requestedTab = searchParams.get('tab');
    return requestedTab === 'likes' ? 'likes' : 'overview';
  });
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [displayNameInput, setDisplayNameInput] = useState('');
  const [usernameInput, setUsernameInput] = useState('');
  const [bioInput, setBioInput] = useState('');
  const [photoURLInput, setPhotoURLInput] = useState('');
  const [coverURLInput, setCoverURLInput] = useState('');
  const [cropTarget, setCropTarget] = useState<{ file: File; field: 'avatar' | 'cover' } | null>(null);
  const [nameColorInput, setNameColorInput] = useState('');
  const [staffRole, setStaffRole] = useState<string | null>(null);

  useEffect(() => {
    if (!targetUid) { setStaffRole(null); return; }
    return onSnapshot(doc(db, 'hqStaffProfiles', targetUid), (snapshot) => {
      setStaffRole(snapshot.exists() && snapshot.get('verifiedStaff') === true ? String(snapshot.get('role') || 'staff') : null);
    }, () => setStaffRole(null));
  }, [targetUid]);

  if (!profileUser) {
    return (
      <EmptyState
        title="Profile Not Found"
        description="This reader or author profile could not be found."
        actionLabel="Explore Community"
        actionTo="/search"
      />
    );
  }

  const isSelf = currentUser?.uid === profileUser.uid;
  const isFollowing = follows.some(
    (f) => f.followerId === currentUser?.uid && f.followingId === profileUser.uid
  );
  const followerUsers = follows
    .filter((follow) => follow.followingId === profileUser.uid)
    .map((follow) => users.find((user) => user.uid === follow.followerId))
    .filter((user): user is NonNullable<typeof user> => Boolean(user));
  const followingUsers = follows
    .filter((follow) => follow.followerId === profileUser.uid)
    .map((follow) => users.find((user) => user.uid === follow.followingId))
    .filter((user): user is NonNullable<typeof user> => Boolean(user));
  const friendUsers = friendships
    .filter(
      (friendship) =>
        friendship.status === 'accepted' &&
        (friendship.requesterId === profileUser.uid || friendship.receiverId === profileUser.uid)
    )
    .map((friendship) => {
      const friendId =
        friendship.requesterId === profileUser.uid ? friendship.receiverId : friendship.requesterId;
      return users.find((user) => user.uid === friendId);
    })
    .filter((user): user is NonNullable<typeof user> => Boolean(user));
  const profileLikedBooks = likedBooks
    .filter((like) => like.userId === profileUser.uid)
    .map((like) => books.find((book) => book.id === like.bookId))
    .filter((book): book is Book => Boolean(book));

  const userPublishedBooks = books.filter(
    (b) => b.authorId === profileUser.uid && b.status === 'published'
  );
  const userReviews = reviews.filter((r) => r.userId === profileUser.uid);
  const userActivity = isSelf ? readingProgress : [];
  const savedSet = new Set(savedBooks.map((s) => s.bookId));
  const likedSet = new Set(likedBooks.map((l) => l.bookId));
  const profilePeople =
    activeTab === 'followers'
      ? followerUsers
      : activeTab === 'following'
      ? followingUsers
      : friendUsers;

  const openEditModal = () => {
    setDisplayNameInput(profileUser.displayName);
    setUsernameInput(profileUser.username);
    setBioInput(profileUser.bio);
    setPhotoURLInput(profileUser.photoURL);
    setCoverURLInput(profileUser.coverURL);
    setNameColorInput(profileUser.nameColor || '');
    setEditModalOpen(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateUserProfile({
      displayName: displayNameInput,
      username: usernameInput,
      bio: bioInput,
      photoURL: photoURLInput,
      coverURL: coverURLInput,
      nameColor: profileUser.membershipPlan === 'premium' ? nameColorInput : undefined,
    });
    setEditModalOpen(false);
  };

  const handleProfileImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    field: 'avatar' | 'cover'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setCropTarget({ file, field });
  };

  const handleSaveCroppedImage = async (file: File) => {
    if (!cropTarget) return;
    try {
      const url = await uploadFileToRedcoverStorage('profile_media', profileUser.uid, file);
      if (cropTarget.field === 'avatar') setPhotoURLInput(url);
      else setCoverURLInput(url);
      addToast('Profile image uploaded successfully!', 'success');
      setCropTarget(null);
    } catch {
      addToast('Could not upload image.', 'error');
      throw new Error('Could not upload image. Check your connection and try again.');
    }
  };

  return (
    <div className="space-y-8">
      {/* 12.1 Profile Header */}
      <div className="bg-white dark:bg-[#16161A] rounded-2xl border border-[#DDDDE3] dark:border-[#2C2C35] overflow-hidden">
        <div
          style={
            profileUser.coverURL
              ? { backgroundImage: `url(${profileUser.coverURL})`, backgroundSize: 'cover', backgroundPosition: 'center' }
              : undefined
          }
          className="h-36 sm:h-48 bg-gradient-to-r from-[#FBE5E8] via-[#FFF3F4] to-[#FBE5E8] dark:from-[#2D1619] dark:to-[#16161A]"
        />

        <div className="px-6 sm:px-8 pb-6 -mt-10 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            <div className="ring-4 ring-white dark:ring-[#16161A] rounded-full w-fit">
              <UserAvatar user={profileUser} size="xl" showPresence />
            </div>
            <div className="pt-2">
              <div className="flex items-center gap-2.5">
                <h1
                  className="font-display text-2xl font-bold text-[#202020] dark:text-[#F4F4F6]"
                  style={
                    profileUser.nameColor && profileUser.membershipPlan === 'premium'
                      ? { color: profileUser.nameColor }
                      : undefined
                  }
                >
                  {profileUser.displayName}
                  {staffRole && <span className="ml-2 inline-flex items-center gap-1 align-middle rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400"><ShieldCheck className="h-3 w-3" />Redcover staff · {staffRole.replaceAll('_', ' ')}</span>}
                </h1>
                {profileUser.membershipPlan === 'premium' && (
                  <span className="text-xs font-semibold text-[#E6A02C] inline-flex items-center gap-1">
                    <Crown className="w-3.5 h-3.5" />
                    Premium
                  </span>
                )}
              </div>
              <p className="text-xs text-[#777780] dark:text-[#9E9EA9]">@{profileUser.username}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isSelf ? (
              <button
                type="button"
                onClick={openEditModal}
                className="py-2 px-4 rounded-xl border border-[#DDDDE3] dark:border-[#2C2C35] hover:border-[#E43136] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Edit Profile
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => toggleFollowUser(profileUser)}
                  className={`py-2 px-4 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer ${
                    isFollowing
                      ? 'bg-[#F1F1F4] dark:bg-[#1F1F26] text-[#202020] dark:text-[#F4F4F6]'
                      : 'bg-[#E43136] text-white hover:bg-[#B9272D]'
                  }`}
                >
                  {isFollowing ? <UserCheck className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
                  {isFollowing ? 'Following' : 'Follow'}
                </button>
                <button
                  type="button"
                  onClick={() => sendFriendRequest(profileUser)}
                  className="py-2 px-4 rounded-xl border border-[#DDDDE3] dark:border-[#2C2C35] hover:border-[#E43136] text-xs font-semibold cursor-pointer"
                >
                  Add Friend
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const cid = await startOrGetChat(profileUser);
                      navigate(`/hub/chats?chatId=${cid}`);
                    } catch {
                      navigate('/auth');
                    }
                  }}
                  className="py-2 px-4 rounded-xl border border-[#DDDDE3] dark:border-[#2C2C35] hover:border-[#E43136] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  Message
                </button>
                <button
                  type="button"
                  onClick={() => blockUser(profileUser)}
                  aria-label="Block user"
                  className="p-2 rounded-xl border border-[#DDDDE3] dark:border-[#2C2C35] text-[#777780] hover:text-[#D9363E] cursor-pointer"
                >
                  <Ban className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>

        <div className="px-6 sm:px-8 pb-6 space-y-5">
          <p className="text-sm text-[#202020] dark:text-[#F4F4F6] max-w-2xl">{profileUser.bio}</p>

          {/* 12.2 Profile Statistics */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 pt-4 border-t border-[#F1F1F4] dark:border-[#2C2C35] tabular-nums">
            <div>
              <span className="block text-lg font-bold">{userPublishedBooks.length}</span>
              <span className="text-xs text-[#777780]">Published Books</span>
            </div>
            <button type="button" onClick={() => setActiveTab('followers')} className="text-left cursor-pointer">
              <span className="block text-lg font-bold">{followerUsers.length}</span>
              <span className="text-xs text-[#777780]">Followers</span>
            </button>
            <button type="button" onClick={() => setActiveTab('following')} className="text-left cursor-pointer">
              <span className="block text-lg font-bold">{followingUsers.length}</span>
              <span className="text-xs text-[#777780]">Following</span>
            </button>
            <button type="button" onClick={() => setActiveTab('friends')} className="text-left cursor-pointer">
              <span className="block text-lg font-bold">{friendUsers.length}</span>
              <span className="text-xs text-[#777780]">Friends</span>
            </button>
            <button type="button" onClick={() => setActiveTab('likes')} className="text-left cursor-pointer">
              <span className="block text-lg font-bold">{profileLikedBooks.length}</span>
              <span className="text-xs text-[#777780]">Liked Books</span>
            </button>
          </div>
        </div>
      </div>

      {/* 12.3 Profile Tabs */}
      <div className="flex items-center gap-2 border-b border-[#DDDDE3] dark:border-[#2C2C35] pb-3 overflow-x-auto no-scrollbar">
        {(
          [
            { id: 'overview', label: 'Overview' },
            { id: 'books', label: `Published Books (${userPublishedBooks.length})` },
            { id: 'reviews', label: `Reviews (${userReviews.length})` },
            ...(profileUser.publicActivity || isSelf
              ? [{ id: 'activity' as const, label: 'Reading Activity' }]
              : []),
            { id: 'followers', label: `Followers (${followerUsers.length})` },
            { id: 'following', label: `Following (${followingUsers.length})` },
            { id: 'friends', label: `Friends (${friendUsers.length})` },
            { id: 'likes', label: `Liked Books (${profileLikedBooks.length})` },
            { id: 'about', label: 'About' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`py-2 px-4 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === tab.id
                ? 'bg-[#E43136] text-white'
                : 'text-[#777780] hover:text-[#202020] dark:hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {(activeTab === 'followers' || activeTab === 'following' || activeTab === 'friends') && (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-semibold capitalize">{activeTab}</h2>
          {profilePeople.length > 0 ? (
            <div className="divide-y divide-[#F1F1F4] rounded-xl border border-[#DDDDE3] bg-white dark:divide-[#2C2C35] dark:border-[#2C2C35] dark:bg-[#16161A]">
              {profilePeople.map((person) => (
                <Link
                  key={person.uid}
                  to={`/profile/${person.uid}`}
                  className="flex items-center gap-3 p-3 hover:bg-[#FAFAFB] dark:hover:bg-[#1E1E24]"
                >
                  <UserAvatar user={person} size="md" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-[#202020] dark:text-[#F4F4F6]">
                      {person.displayName}
                    </span>
                    <span className="block truncate text-xs text-[#777780] dark:text-[#9E9EA9]">
                      @{person.username}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-[#9E9EA9]" />
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState title={`No ${activeTab} yet`} description="People will appear here as your community grows." />
          )}
        </section>
      )}

      {activeTab === 'likes' && (
        <section className="space-y-4">
          <h2 className="font-display text-lg font-semibold">Liked Books</h2>
          {profileLikedBooks.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {profileLikedBooks.map((book) => (
                <Link key={book.id} to={`/book/${book.id}`} className="min-w-0">
                  <div className="mb-2 aspect-[3/4] overflow-hidden rounded-lg">
                    <BookCover book={book} size="sm" className="h-full w-full" />
                  </div>
                  <p className="truncate text-xs font-semibold">{book.title}</p>
                  <p className="truncate text-[11px] text-[#777780]">{book.authorName}</p>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState title="No liked books" description="Books you like will appear here." />
          )}
        </section>
      )}

      {(activeTab === 'overview' || activeTab === 'books') && (
        <section className="space-y-4">
          <h2 className="font-display text-lg font-semibold">Published Books</h2>
          {userPublishedBooks.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-5">
              {userPublishedBooks.map((b) => (
                <BookCard
                  key={b.id}
                  book={b}
                  isSaved={savedSet.has(b.id)}
                  isLiked={likedSet.has(b.id)}
                  onToggleSave={toggleSaveBook}
                  onToggleLike={toggleLikeBook}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No Published Books Yet"
              description={`${profileUser.displayName} hasn't published any books yet.`}
            />
          )}
        </section>
      )}

      {activeTab === 'reviews' && (
        <section className="space-y-3">
          {userReviews.length > 0 ? (
            userReviews.map((rev) => (
              <div
                key={rev.id}
                className="bg-white dark:bg-[#16161A] rounded-xl border border-[#DDDDE3] dark:border-[#2C2C35] p-4"
              >
                <Link to={`/book/${rev.bookId}`} className="text-sm font-semibold hover:text-[#E43136]">
                  {rev.bookTitle}
                </Link>
                <p className="text-xs text-[#777780] mt-1">{rev.text}</p>
              </div>
            ))
          ) : (
            <EmptyState title="No Reviews" description="No public reviews posted yet." />
          )}
        </section>
      )}

      {activeTab === 'activity' && (
        <section className="space-y-3">
          {userActivity.length > 0 ? (
            userActivity.map((act) => (
              <div
                key={act.id}
                className="bg-white dark:bg-[#16161A] rounded-xl border border-[#DDDDE3] dark:border-[#2C2C35] p-4 flex items-center justify-between"
              >
                <div>
                  <Link to={`/book/${act.bookId}`} className="text-sm font-semibold hover:text-[#E43136]">
                    {act.bookTitle}
                  </Link>
                  <p className="text-xs text-[#777780]">
                    Chapter {act.currentChapter} of {act.totalChapters} ({act.percentage}% completed)
                  </p>
                </div>
                <Link to={`/read/${act.bookId}`} className="text-xs font-semibold text-[#E43136]">
                  Open Book →
                </Link>
              </div>
            ))
          ) : (
            <EmptyState title="No Public Activity" description="Reading activity will appear here." />
          )}
        </section>
      )}

      {activeTab === 'about' && (
        <div className="bg-white dark:bg-[#16161A] rounded-xl border border-[#DDDDE3] dark:border-[#2C2C35] p-6 space-y-2 text-sm">
          <p>
            <strong>Display Name:</strong> {profileUser.displayName}
          </p>
          <p>
            <strong>Username:</strong> @{profileUser.username}
          </p>
          <p>
            <strong>Bio:</strong> {profileUser.bio}
          </p>
          <p>
            <strong>Joined Redcover:</strong> {new Date(profileUser.createdAt).toLocaleDateString()}
          </p>
        </div>
      )}

      {/* 12.4 Edit Profile Modal */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#16161A] rounded-2xl border border-[#DDDDE3] dark:border-[#2C2C35] max-w-lg w-full p-6 space-y-4">
            <h3 className="font-display text-lg font-bold">Edit Redcover Profile</h3>
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Display Name</label>
                  <input
                    type="text"
                    required
                    value={displayNameInput}
                    onChange={(e) => setDisplayNameInput(e.target.value)}
                    className="w-full py-2 px-3 rounded-xl border border-[#DDDDE3] dark:border-[#2C2C35] bg-transparent text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Username</label>
                  <input
                    type="text"
                    required
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    className="w-full py-2 px-3 rounded-xl border border-[#DDDDE3] dark:border-[#2C2C35] bg-transparent text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Bio</label>
                <textarea
                  rows={3}
                  value={bioInput}
                  onChange={(e) => setBioInput(e.target.value)}
                  className="w-full py-2 px-3 rounded-xl border border-[#DDDDE3] dark:border-[#2C2C35] bg-transparent text-sm"
                />
              </div>

              {/* Member Custom Name Color */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold flex items-center gap-1.5">
                    <span>Name Display Font Color</span>
                    {profileUser.membershipPlan === 'premium' ? (
                      <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-gradient-to-r from-red-600 to-amber-500 text-white">
                        MEMBER
                      </span>
                    ) : (
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-600">
                        MEMBER ONLY
                      </span>
                    )}
                  </label>
                  {nameColorInput && (
                    <button
                      type="button"
                      onClick={() => setNameColorInput('')}
                      className="text-[10px] text-[#6E6E77] hover:underline cursor-pointer"
                    >
                      Reset Default
                    </button>
                  )}
                </div>

                {profileUser.membershipPlan === 'premium' ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={nameColorInput || '#E43136'}
                        onChange={(e) => setNameColorInput(e.target.value)}
                        className="w-8 h-8 rounded-lg cursor-pointer border border-[#DDDDE3] dark:border-[#2C2C35] bg-transparent p-0.5"
                      />
                      <input
                        type="text"
                        placeholder="Hex color code (e.g. #E43136)"
                        value={nameColorInput}
                        onChange={(e) => setNameColorInput(e.target.value)}
                        className="flex-1 py-1.5 px-3 rounded-xl border border-[#DDDDE3] dark:border-[#2C2C35] bg-transparent text-xs font-mono"
                      />
                    </div>
                    {/* Preset colors */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {[
                        { label: 'Crimson', color: '#E43136' },
                        { label: 'Royal Blue', color: '#2563EB' },
                        { label: 'Emerald', color: '#059669' },
                        { label: 'Violet', color: '#7C3AED' },
                        { label: 'Sunset Gold', color: '#D97706' },
                        { label: 'Rose Pink', color: '#DB2777' },
                        { label: 'Cyan', color: '#0891B2' },
                      ].map((c) => (
                        <button
                          key={c.color}
                          type="button"
                          onClick={() => setNameColorInput(c.color)}
                          className={`px-2 py-1 rounded-md text-[10px] font-bold border transition-transform cursor-pointer ${
                            nameColorInput === c.color ? 'ring-2 ring-current scale-105' : ''
                          }`}
                          style={{ color: c.color, borderColor: `${c.color}40`, backgroundColor: `${c.color}10` }}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-400">
                    Custom Name Font Color is an exclusive perk for Redcover Members. Upgrade on the Membership tab to customize how your name appears to all readers!
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="py-2 px-3 rounded-xl border border-[#DDDDE3] dark:border-[#2C2C35] text-xs font-semibold text-center cursor-pointer inline-flex items-center justify-center gap-1.5">
                  <Upload className="w-3.5 h-3.5 text-[#E43136]" />
                  <span>Upload Avatar</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleProfileImageUpload(e, 'avatar')}
                    className="hidden"
                  />
                </label>
                <label className="py-2 px-3 rounded-xl border border-[#DDDDE3] dark:border-[#2C2C35] text-xs font-semibold text-center cursor-pointer inline-flex items-center justify-center gap-1.5">
                  <Upload className="w-3.5 h-3.5 text-[#E43136]" />
                  <span>Upload Cover Banner</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleProfileImageUpload(e, 'cover')}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="py-2 px-4 rounded-lg text-xs font-medium text-[#777780] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="py-2 px-5 rounded-lg bg-[#E43136] text-white text-xs font-semibold cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {cropTarget && (
        <ImageCropModal
          file={cropTarget.file}
          kind={cropTarget.field}
          onCancel={() => setCropTarget(null)}
          onSave={handleSaveCroppedImage}
        />
      )}
    </div>
  );
};

export const NotificationsPage: React.FC = () => {
  const { notifications, markNotificationRead, markAllNotificationsRead } = useRedcover();
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'social' | 'messages' | 'books' | 'membership'>('all');

  const filtered = useMemo(
    () =>
      categoryFilter === 'all'
        ? notifications
        : notifications.filter((n) => n.category === categoryFilter),
    [notifications, categoryFilter]
  );

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Notifications</h1>
          <p className="text-xs text-[#777780]">Real-time updates from your Redcover community</p>
        </div>
        {notifications.some((n) => !n.read) && (
          <button
            type="button"
            onClick={markAllNotificationsRead}
            className="py-2 px-3.5 rounded-xl border border-[#DDDDE3] dark:border-[#2C2C35] text-xs font-semibold inline-flex items-center gap-1.5 hover:border-[#E43136] cursor-pointer"
          >
            <CheckCheck className="w-3.5 h-3.5 text-[#E43136]" />
            Mark All as Read
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
        {(['all', 'social', 'messages', 'books', 'membership'] as const).map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategoryFilter(cat)}
            className={`py-2 px-4 rounded-lg text-xs font-semibold capitalize cursor-pointer ${
              categoryFilter === cat
                ? 'bg-[#E43136] text-white'
                : 'bg-white dark:bg-[#16161A] border border-[#DDDDE3] dark:border-[#2C2C35]'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {filtered.length > 0 ? (
        <div className="space-y-2.5">
          {filtered.map((n) => (
            <div
              key={n.id}
              onClick={() => !n.read && markNotificationRead(n.id)}
              className={`p-4 rounded-xl border flex items-start justify-between gap-4 transition-colors cursor-pointer ${
                n.read
                  ? 'bg-white dark:bg-[#16161A] border-[#DDDDE3] dark:border-[#2C2C35]'
                  : 'bg-[#FFF3F4] dark:bg-[#2D1619] border-[#E43136]/40'
              }`}
            >
              <div className="flex items-start gap-3">
                <Bell className="w-4 h-4 text-[#E43136] mt-0.5 shrink-0" />
                <div>
                  <h3 className="text-sm font-semibold">{n.title}</h3>
                  <p className="text-xs text-[#777780] dark:text-[#9E9EA9] mt-0.5">{n.body}</p>
                  <span className="text-[11px] text-[#777780] mt-1 block">
                    {new Date(n.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>
              {!n.read && (
                <span className="text-[11px] font-semibold text-[#E43136] shrink-0">Unread</span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          title="You're All Caught Up"
          description="New follower alerts, book reviews, and direct messages will appear here in real time."
        />
      )}
    </div>
  );
};

export const MembershipPage: React.FC = () => {
  return (
    <div className="max-w-2xl mx-auto py-12 px-4 text-center space-y-6">
      <div className="w-16 h-16 mx-auto rounded-3xl bg-[#E43136]/10 text-[#E43136] flex items-center justify-center">
        <Sparkles className="w-8 h-8" />
      </div>
      <div className="space-y-2">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#202020] dark:text-white">
          All Features Are 100% Free & Open
        </h1>
        <p className="text-sm text-[#777780] dark:text-[#9E9EA9] max-w-lg mx-auto">
          Membership fees have been completely removed. Enjoy unlimited reading, publishing, and full analytics.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
        <Link
          to="/explore"
          className="px-5 py-2.5 rounded-xl bg-[#E43136] hover:bg-[#D92D32] text-white text-xs font-bold transition-all shadow-xs"
        >
          Explore Books
        </Link>
        <Link
          to="/settings"
          className="px-5 py-2.5 rounded-xl border border-[#DDDDE3] dark:border-[#2C2C35] text-xs font-semibold text-[#202020] dark:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-all"
        >
          Appearance Settings
        </Link>
      </div>
    </div>
  );
};

export const SettingsPage: React.FC = () => {
  const {
    currentUser,
    privateInfo,
    theme,
    isAdmin,
    hasHqPermission,
    books,
    users,
    realtimeSyncCount,
    lastSyncedAt,
    defaultDbCount,
    setTheme,
    updateUserProfile,
    updatePrivateSettings,
    logout,
  } = useRedcover();

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold">Account Settings</h1>
        <p className="text-sm text-[#777780]">
          Manage your reading preferences, privacy controls, and account membership.
        </p>
      </div>

      {/* Developer / Admin-Only Firebase Diagnostics Card */}
      {isAdmin && (
        <div className="bg-white dark:bg-[#16161A] rounded-2xl border border-[#DDDDE3] dark:border-[#2C2C35] p-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <Database className="w-5 h-5 text-[#E43136]" />
              <h2 className="text-base font-semibold">System diagnostics</h2>
            </div>
            <span className="text-xs font-semibold text-[#268B62]">Connected & Live</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-[#777780] dark:text-[#9E9EA9] font-mono-tabular bg-[#FAFAFB] dark:bg-[#0F0F12] p-4 rounded-xl border border-[#F1F1F4] dark:border-[#2C2C35]">
            <div>Project ID: {FIREBASE_PROJECT_INFO.projectId}</div>
            <div>Storage Bucket: {FIREBASE_PROJECT_INFO.storageBucket}</div>
            <div>Auth Domain: {FIREBASE_PROJECT_INFO.authDomain}</div>
            <div>Live Sync Events: {realtimeSyncCount}</div>
            <div>Total Books Loaded: {books.length}</div>
            <div>Total Users Loaded: {users.length}</div>
            {defaultDbCount > 0 && <div>Default DB Records Bridged: {defaultDbCount}</div>}
            <div>Last Synced: {new Date(lastSyncedAt).toLocaleTimeString()}</div>
          </div>

          <p className="text-xs text-[#777780]">Read-only connection diagnostics.</p>
        </div>
      )}

      {/* Preferences */}
      <div className="bg-white dark:bg-[#16161A] rounded-2xl border border-[#DDDDE3] dark:border-[#2C2C35] p-6 space-y-5">
        <h2 className="text-base font-semibold">Preferences & Privacy</h2>

        <div className="py-2 border-b border-[#F1F1F4] dark:border-[#2C2C35] space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Platform Themes</p>
              <p className="text-xs text-[#777780]">
                Choose Light or Dark mode.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {[
              { id: 'light', label: 'Light Mode', icon: '☀️', desc: 'Clean crisp paper white' },
              { id: 'dark', label: 'Dark Mode', icon: '🌙', desc: 'Obsidian dark reader mode' },
            ].map((t) => {
              const isSelected = theme === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTheme(t.id as any)}
                  className={`p-3 rounded-2xl text-left border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-[#E43136] bg-[#E43136]/10 ring-2 ring-[#E43136]'
                      : 'border-[#DDDDE3] dark:border-[#2C2C35] hover:border-black/30'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold flex items-center gap-1.5">
                      <span>{t.icon}</span>
                      <span>{t.label}</span>
                    </span>
                    {isSelected && (
                      <span className="w-2 h-2 rounded-full bg-[#E43136]"></span>
                    )}
                  </div>
                  <p className="text-xs text-[#777780]">{t.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        {currentUser && (
          <>
            <div className="flex items-center justify-between py-2 border-b border-[#F1F1F4] dark:border-[#2C2C35]">
              <div>
                <p className="text-sm font-medium">Show Online Status</p>
                <p className="text-xs text-[#777780]">Allow friends to see when you are active on Redcover</p>
              </div>
              <input
                type="checkbox"
                checked={currentUser.showOnlineStatus}
                onChange={(e) => updateUserProfile({ showOnlineStatus: e.target.checked })}
                className="w-4 h-4 accent-[#E43136] cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between py-2 border-b border-[#F1F1F4] dark:border-[#2C2C35]">
              <div>
                <p className="text-sm font-medium">Public Reading Activity</p>
                <p className="text-xs text-[#777780]">Display your reading progress on your public profile</p>
              </div>
              <input
                type="checkbox"
                checked={currentUser.publicActivity}
                onChange={(e) => updateUserProfile({ publicActivity: e.target.checked })}
                className="w-4 h-4 accent-[#E43136] cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium">Daily Reading Reminders</p>
                <p className="text-xs text-[#777780]">Choose whether to receive daily reading reminders</p>
              </div>
              <input
                type="checkbox"
                checked={privateInfo?.readingReminders ?? true}
                onChange={(e) => updatePrivateSettings({ readingReminders: e.target.checked })}
                className="w-4 h-4 accent-[#E43136] cursor-pointer"
              />
            </div>
          </>
        )}
      </div>

      {/* Administration & Account Actions */}
      <div className="bg-white dark:bg-[#16161A] rounded-2xl border border-[#DDDDE3] dark:border-[#2C2C35] p-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/membership"
            className="py-2 px-4 rounded-xl border border-[#DDDDE3] dark:border-[#2C2C35] text-xs font-semibold hover:border-[#E43136]"
          >
            Manage Membership
          </Link>
          {hasHqPermission('hq:overview') && (
            <Link
              to="/admin"
              className="py-2 px-4 rounded-xl bg-[#FFF3F4] dark:bg-[#2D1619] text-[#E43136] text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <Shield className="w-4 h-4" />
              Admin Control Center
            </Link>
          )}
        </div>

        {currentUser && (
          <button
            type="button"
            onClick={logout}
            className="py-2 px-4 rounded-xl bg-[#D9363E] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        )}
      </div>
    </div>
  );
};

export const AdminPage: React.FC = () => {
  const { hqRole, hqPermissions, hasHqPermission, refreshHqClaims, addToast } = useRedcover();
  const [activeTab, setActiveTab] = useState('overview');
  const [overview, setOverview] = useState<HeadquartersOverview | null>(null);
  const [users, setUsers] = useState<HqUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<HqUser | null>(null);
  const [userPageToken, setUserPageToken] = useState<string | null>(null);
  const [staff, setStaff] = useState<HqStaff[]>([]);
  const [books, setBooks] = useState<HqBook[]>([]);
  const [bookPageToken, setBookPageToken] = useState<string | null>(null);
  const [reports, setReports] = useState<HqReport[]>([]);
  const [events, setEvents] = useState<HqEvent[]>([]);
  const [auditEntries, setAuditEntries] = useState<HqAuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [userSearchDebounced, setUserSearchDebounced] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [userPlanFilter, setUserPlanFilter] = useState('');
  const [userCreatedFrom, setUserCreatedFrom] = useState('');
  const [userCreatedTo, setUserCreatedTo] = useState('');
  const [bookSearch, setBookSearch] = useState('');
  const [bookStatus, setBookStatus] = useState('');
  const [eventStatus, setEventStatus] = useState('');
  const [rangeDays, setRangeDays] = useState(7);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [roleDrafts, setRoleDrafts] = useState<Record<string, HeadquartersRole>>({});

  const rolePermissions = hqPermissions;
  const canAccess = hqRole === 'owner' || rolePermissions.includes('*') || rolePermissions.includes('hq:overview');
  const navigation = [
    { id: 'overview', label: 'Overview', permission: 'hq:overview', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'users', label: 'Users', permission: 'users:view', icon: <UsersRound className="w-4 h-4" /> },
    { id: 'staff', label: 'Staff', permission: 'staff:manage', icon: <ShieldCheck className="w-4 h-4" /> },
    { id: 'content', label: 'Books & Content', permission: 'content:books', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'posts', label: 'Posts', permission: 'content:books', icon: <MessageSquare className="w-4 h-4" /> },
    { id: 'reviews', label: 'Reviews', permission: 'content:books', icon: <BookMarked className="w-4 h-4" /> },
    { id: 'comments', label: 'Comments', permission: 'content:books', icon: <MessageSquare className="w-4 h-4" /> },
    { id: 'moderation', label: 'Moderation', permission: 'moderation:reports', icon: <Flag className="w-4 h-4" /> },
    { id: 'health', label: 'Firebase Health', permission: 'health:read', icon: <Activity className="w-4 h-4" /> },
    { id: 'analytics', label: 'Analytics', permission: 'analytics:read', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'membership', label: 'Membership', permission: 'membership:read', icon: <Gem className="w-4 h-4" /> },
    { id: 'brand', label: 'Brand Studio', permission: 'brand:manage', icon: <ImagePlus className="w-4 h-4" /> },
    { id: 'settings', label: 'Global Settings', permission: 'platform:manage', icon: <Settings2 className="w-4 h-4" /> },
    { id: 'support', label: 'Support Center', permission: 'support:read', icon: <Ticket className="w-4 h-4" /> },
    { id: 'security', label: 'Security Center', permission: 'security:read', icon: <ShieldAlert className="w-4 h-4" /> },
    { id: 'audit', label: 'Audit Logs', permission: 'audit:read', icon: <ClipboardList className="w-4 h-4" /> },
  ].filter((item) => hasHqPermission(item.permission));
  const staffRoles: HeadquartersRole[] = ['administrator', 'moderator', 'content_manager', 'community_manager', 'support_staff'];

  useEffect(() => {
    const timer = window.setTimeout(() => setUserSearchDebounced(userSearch.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [userSearch]);

  useEffect(() => {
    if (!canAccess) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    const load = async () => {
      try {
        if (activeTab === 'overview') {
          const result = await headquartersService.getOverview(rangeDays, customStart || undefined, customEnd || undefined);
          if (!cancelled) setOverview(result);
        } else if (activeTab === 'users') {
          const result = await headquartersService.listUsers(userSearchDebounced, undefined, { status: userStatusFilter, role: userRoleFilter, membershipPlan: userPlanFilter, createdFrom: userCreatedFrom, createdTo: userCreatedTo });
          if (!cancelled) { setUsers(result.users); setUserPageToken(result.nextPageToken); }
        } else if (activeTab === 'staff') {
          const result = await headquartersService.listStaff();
          if (!cancelled) setStaff(result.staff);
        } else if (activeTab === 'content') {
          const result = await headquartersService.listBooks(bookSearch.trim(), bookStatus);
          if (!cancelled) { setBooks(result.books); setBookPageToken(result.nextPageToken); }
        } else if (activeTab === 'moderation') {
          const result = await headquartersService.listReports();
          if (!cancelled) setReports(result.reports);
        } else if (activeTab === 'health') {
          const result = await headquartersService.listEvents(eventStatus);
          if (!cancelled) setEvents(result.events);
        } else if (activeTab === 'audit') {
          const result = await headquartersService.getAuditLogs();
          if (!cancelled) setAuditEntries(result.entries);
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Headquarters data could not be loaded.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [activeTab, canAccess, userSearchDebounced, userStatusFilter, userRoleFilter, userPlanFilter, userCreatedFrom, userCreatedTo, bookSearch, bookStatus, eventStatus, rangeDays, customStart, customEnd]);

  const runAction = async (id: string, action: () => Promise<unknown>, successText: string, reloadTab = activeTab) => {
    setBusyId(id);
    setError('');
    try {
      await action();
      addToast(successText, 'success');
      if (reloadTab === 'users') {
        const result = await headquartersService.listUsers(userSearchDebounced, undefined, { status: userStatusFilter, role: userRoleFilter, membershipPlan: userPlanFilter, createdFrom: userCreatedFrom, createdTo: userCreatedTo });
        setUsers(result.users); setUserPageToken(result.nextPageToken);
      } else if (reloadTab === 'staff') {
        setStaff((await headquartersService.listStaff()).staff);
      } else if (reloadTab === 'content') {
        const result = await headquartersService.listBooks(bookSearch.trim(), bookStatus);
        setBooks(result.books); setBookPageToken(result.nextPageToken);
      } else if (reloadTab === 'moderation') {
        setReports((await headquartersService.listReports()).reports);
      } else if (reloadTab === 'health') {
        setEvents((await headquartersService.listEvents(eventStatus)).events);
      } else if (reloadTab === 'overview') {
        setOverview(await headquartersService.getOverview(rangeDays, customStart || undefined, customEnd || undefined));
      }
    } catch (err: any) {
      const message = String(err?.message || 'Action failed.');
      setError(message.includes('functions/not-found') ? 'Headquarters backend is not deployed yet. Deploy the project functions and security rules first.' : message);
    } finally {
      setBusyId('');
    }
  };

  const loadMoreUsers = async () => {
    if (!userPageToken) return;
    setBusyId('users-more');
    try {
      const result = await headquartersService.listUsers(userSearchDebounced, userPageToken, { status: userStatusFilter, role: userRoleFilter, membershipPlan: userPlanFilter, createdFrom: userCreatedFrom, createdTo: userCreatedTo });
      setUsers((old) => [...old, ...result.users]); setUserPageToken(result.nextPageToken);
    } catch (err: any) { setError(err?.message || 'More users could not be loaded.'); }
    finally { setBusyId(''); }
  };

  const loadMoreBooks = async () => {
    if (!bookPageToken) return;
    setBusyId('books-more');
    try {
      const result = await headquartersService.listBooks('', bookStatus, bookPageToken);
      setBooks((old) => [...old, ...result.books]); setBookPageToken(result.nextPageToken);
    } catch (err: any) { setError(err?.message || 'More books could not be loaded.'); }
    finally { setBusyId(''); }
  };

  const refreshClaims = async () => {
    setBusyId('claims');
    try { await refreshHqClaims(); addToast('Access status refreshed.', 'success'); }
    catch (err: any) { setError(err?.message || 'Could not refresh access status.'); }
    finally { setBusyId(''); }
  };

  if (!canAccess) {
    return (
      <div className="max-w-xl mx-auto my-12 rounded-3xl border border-[#DDDDE3] dark:border-[#2C2C35] bg-white dark:bg-[#16161A] p-8 text-center space-y-4">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-[#E43136]/10 text-[#E43136] flex items-center justify-center"><LockKeyhole className="w-7 h-7" /></div>
        <h1 className="font-display text-2xl font-bold">Redcover Headquarters</h1>
        <p className="text-sm text-[#777780] dark:text-[#A8A8B2]">Owner and staff access is verified by server-issued custom claims. A profile role or email address alone cannot grant access.</p>
        <button type="button" disabled={busyId === 'claims'} onClick={refreshClaims} className="px-4 py-2.5 rounded-xl bg-[#E43136] text-white text-sm font-semibold disabled:opacity-50">{busyId === 'claims' ? 'Checking…' : 'Refresh access status'}</button>
        {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  const metricLabels: Record<string, string> = {
    userProfiles: 'User profiles', books: 'All books', publishedBooks: 'Published books', drafts: 'Drafts', posts: 'Public posts', comments: 'Comments', likes: 'Likes', followers: 'Followers', readingSessions: 'Reading sessions', reports: 'Reports', pendingModeration: 'Pending moderation', premiumMemberships: 'Premium memberships', newUsersPeriod: 'New registrations', failedOperations24h: 'Failures · 24h', activeUsers: 'Active users', storageBytes: 'Storage use', billingEstimate: 'Monthly cost estimate',
  };
  const healthLabel = (name: string) => ({ auth: 'Authentication', firestore: 'Cloud Firestore', storage: 'Cloud Storage', realtimeDatabase: 'Realtime Database', functions: 'Cloud Functions', appCheck: 'App Check', cloudFunctions: 'Scheduled / worker services', cloudflare: 'Cloudflare' } as Record<string, string>)[name] || name;
  const metricValue = (metric?: { available: boolean; value: number | null }) => metric?.available && metric.value !== null ? metric.value.toLocaleString() : 'Unavailable';
  const healthColor = (status: string) => status === 'healthy' ? 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20' : status === 'critical' ? 'text-red-600 bg-red-500/10 border-red-500/20' : status === 'warning' ? 'text-amber-600 bg-amber-500/10 border-amber-500/20' : 'text-[#777780] bg-black/5 border-black/10 dark:bg-white/5 dark:border-white/10';
  const roleLabel = (role: string) => role.replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase());

  return (
    <div className="min-h-[70vh] grid grid-cols-1 lg:grid-cols-[230px_minmax(0,1fr)] gap-5">
      <aside className="rounded-2xl border border-[#DDDDE3] dark:border-[#2C2C35] bg-white dark:bg-[#15151A] p-3 h-fit lg:sticky lg:top-4">
        <div className="px-3 pt-2 pb-4 border-b border-[#EEEFF2] dark:border-[#2C2C35]">
          <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-[#E43136]">Redcover</div>
          <h1 className="font-display text-xl font-bold mt-1">Headquarters</h1>
          <p className="text-[11px] text-[#777780] mt-1">{roleLabel(hqRole || 'staff')} access</p>
        </div>
        <nav className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-1 gap-1 pt-3">
          {navigation.map((item) => (
            <button key={item.id} type="button" onClick={() => setActiveTab(item.id)} className={"w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-xs font-semibold transition-colors " + (activeTab === item.id ? 'bg-[#E43136] text-white' : 'text-[#62626C] dark:text-[#B0B0B8] hover:bg-black/5 dark:hover:bg-white/5')}>
              {item.icon}<span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="hidden lg:block mx-3 mt-4 pt-3 border-t border-[#EEEFF2] dark:border-[#2C2C35] text-[10px] text-[#8A8A94]">Server-authorized · paginated</div>
      </aside>

      <main className="min-w-0 space-y-5">
        <header className="rounded-2xl border border-[#DDDDE3] dark:border-[#2C2C35] bg-white dark:bg-[#15151A] p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4">
          <div><p className="text-[10px] uppercase tracking-[0.16em] text-[#E43136] font-bold">Owner Control Center</p><h2 className="font-display text-2xl sm:text-3xl font-bold mt-1">{navigation.find((item) => item.id === activeTab)?.label || 'Headquarters'}</h2><p className="text-xs text-[#777780] mt-1">Live platform data and permission-checked controls.</p></div>
          <div className="flex items-center gap-2 text-xs"><span className="px-2.5 py-1.5 rounded-lg border border-[#DDDDE3] dark:border-[#33333D] text-[#777780]">{hqRole === 'owner' ? 'Owner' : 'Staff'}</span>{activeTab === 'overview' && <button type="button" onClick={() => void runAction('overview', () => headquartersService.getOverview(rangeDays), 'Overview refreshed.')} className="px-3 py-2 rounded-lg border border-[#DDDDE3] dark:border-[#33333D] font-semibold inline-flex items-center gap-1.5"><RefreshCw className="w-3.5 h-3.5" />Refresh</button>}</div>
        </header>

        {error && <div role="alert" className="rounded-xl border border-red-300 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 px-4 py-3 text-xs text-red-700 dark:text-red-300 flex items-start gap-2"><AlertTriangle className="w-4 h-4 shrink-0" /><span>{error}</span><button type="button" onClick={() => setError('')} className="ml-auto font-bold">Dismiss</button></div>}
        {loading && <div className="rounded-xl border border-[#DDDDE3] dark:border-[#2C2C35] bg-white dark:bg-[#15151A] p-4 text-xs text-[#777780] flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Loading live data…</div>}

        {['analytics', 'membership', 'brand', 'settings', 'support', 'security', 'posts', 'reviews', 'comments'].includes(activeTab) && (
          <HeadquartersExtendedPanels activeTab={activeTab} rangeDays={rangeDays} addToast={addToast} />
        )}

        {activeTab === 'overview' && (
          <div className="space-y-5">
            <section className="rounded-2xl border border-[#DDDDE3] dark:border-[#2C2C35] bg-white dark:bg-[#15151A] p-4 flex flex-wrap items-end gap-3">
              <label className="text-xs font-semibold">Date range<select value={rangeDays} onChange={(e) => setRangeDays(Number(e.target.value))} className="block mt-1 rounded-lg border border-[#DDDDE3] dark:border-[#33333D] bg-transparent px-3 py-2"><option value={1}>Today</option><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option></select></label>
              <label className="text-xs font-semibold">Custom start<input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="block mt-1 rounded-lg border border-[#DDDDE3] dark:border-[#33333D] bg-transparent px-3 py-2" /></label>
              <label className="text-xs font-semibold">Custom end<input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="block mt-1 rounded-lg border border-[#DDDDE3] dark:border-[#33333D] bg-transparent px-3 py-2" /></label>
              <span className="ml-auto text-[10px] text-[#8A8A94]">Updated {overview?.generatedAt ? new Date(overview.generatedAt).toLocaleTimeString() : '—'}</span>
            </section>
            <section className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {Object.entries(metricLabels).map(([key, label]) => (
                <div key={key} className="rounded-2xl border border-[#DDDDE3] dark:border-[#2C2C35] bg-white dark:bg-[#15151A] p-4">
                  <div className="text-[11px] text-[#777780] min-h-8">{label}</div><div className="text-xl sm:text-2xl font-bold tabular-nums mt-1">{metricValue(overview?.metrics[key])}</div>
                </div>
              ))}
            </section>
            <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {[['services', overview?.services || {}], ['integrations', overview?.integrations || {}]].map(([group, entries]) => (
                <div key={String(group)} className="rounded-2xl border border-[#DDDDE3] dark:border-[#2C2C35] bg-white dark:bg-[#15151A] p-4 sm:p-5">
                  <h3 className="font-semibold text-sm mb-3">{group === 'services' ? 'Platform services' : 'Integrations'}</h3>
                  <div className="space-y-2">{Object.entries(entries as Record<string, HqServiceHealth>).map(([name, health]) => <div key={name} className="rounded-xl border border-[#EEEFF2] dark:border-[#2B2B34] p-3 flex items-start gap-3"><span className={"mt-0.5 rounded-full border px-2 py-1 text-[9px] uppercase font-bold " + healthColor(health.status)}>{health.status}</span><div className="min-w-0"><div className="text-xs font-semibold">{healthLabel(name)}</div><p className="text-[11px] text-[#777780] mt-0.5">{health.details}</p></div></div>)}</div>
                </div>
              ))}
            </section>
            <div className="rounded-xl border border-sky-300/60 bg-sky-50 dark:bg-sky-950/20 dark:border-sky-900/40 p-4 text-xs text-sky-900 dark:text-sky-200 flex gap-2"><Info className="w-4 h-4 shrink-0" /><span>Billing cost, storage byte totals, active-user analytics and daily trend charts are marked unavailable until the matching Billing/Analytics integrations or historical aggregation are enabled. No placeholder figures are shown.</span></div>
          </div>
        )}

        {activeTab === 'users' && (
          <section className="rounded-2xl border border-[#DDDDE3] dark:border-[#2C2C35] bg-white dark:bg-[#15151A] overflow-hidden">
            <div className="p-4 border-b border-[#EEEFF2] dark:border-[#2C2C35] flex flex-wrap items-center gap-3"><div className="relative flex-1 min-w-[220px]"><Search className="absolute left-3 top-2.5 w-4 h-4 text-[#8A8A94]" /><input value={userSearch} onChange={(e) => setUserSearch(e.target.value)} placeholder="Search name, username, email or UID" className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#DDDDE3] dark:border-[#33333D] bg-transparent text-xs" /></div><span className="text-[11px] text-[#8A8A94]">{users.length} loaded · pages of 25</span></div>
            <div className="p-4 grid grid-cols-2 lg:grid-cols-5 gap-2 border-b border-[#EEEFF2] dark:border-[#2C2C35]"><select aria-label="Account status filter" value={userStatusFilter} onChange={(e) => setUserStatusFilter(e.target.value)} className="px-2 py-2 rounded-lg border border-[#DDDDE3] dark:border-[#33333D] bg-transparent text-[10px]"><option value="">All statuses</option><option value="active">Active</option><option value="suspended">Suspended</option></select><select aria-label="User role filter" value={userRoleFilter} onChange={(e) => setUserRoleFilter(e.target.value)} className="px-2 py-2 rounded-lg border border-[#DDDDE3] dark:border-[#33333D] bg-transparent text-[10px]"><option value="">All roles</option><option value="staff">Staff</option>{staffRoles.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}</select><select aria-label="Membership filter" value={userPlanFilter} onChange={(e) => setUserPlanFilter(e.target.value)} className="px-2 py-2 rounded-lg border border-[#DDDDE3] dark:border-[#33333D] bg-transparent text-[10px]"><option value="">All memberships</option><option value="free">Free</option><option value="premium">Premium</option></select><label className="text-[9px] text-[#777780]">Joined after<input type="date" value={userCreatedFrom} onChange={(e) => setUserCreatedFrom(e.target.value)} className="mt-1 block w-full px-2 py-1.5 rounded-lg border border-[#DDDDE3] dark:border-[#33333D] bg-transparent text-[10px]" /></label><label className="text-[9px] text-[#777780]">Joined before<input type="date" value={userCreatedTo} onChange={(e) => setUserCreatedTo(e.target.value)} className="mt-1 block w-full px-2 py-1.5 rounded-lg border border-[#DDDDE3] dark:border-[#33333D] bg-transparent text-[10px]" /></label></div>
            <div className="divide-y divide-[#EEEFF2] dark:divide-[#2B2B34]">{users.map((user) => <div key={user.uid} className="p-4 flex flex-col xl:flex-row xl:items-center gap-3 xl:gap-6"><div className="min-w-0 flex-1"><div className="text-sm font-semibold truncate">{user.displayName} <span className="text-[10px] text-[#8A8A94] font-normal">@{user.username || '—'}</span></div><div className="text-xs text-[#6F6F79] truncate mt-0.5">{user.email || 'No email'} · UID {user.uid}</div><div className="text-[10px] text-[#8A8A94] mt-1">Joined {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'} · Last seen {user.lastSignInAt ? new Date(user.lastSignInAt).toLocaleDateString() : '—'} · {user.booksCount} books · {user.membershipPlan}</div></div><div className="flex flex-wrap items-center gap-2"><span className={"px-2 py-1 rounded-md text-[10px] font-semibold " + (user.disabled ? 'bg-red-500/10 text-red-600' : 'bg-emerald-500/10 text-emerald-700')}>{user.disabled ? 'Suspended' : 'Active'}</span>{user.hqRole && <span className="px-2 py-1 rounded-md bg-[#E43136]/10 text-[#E43136] text-[10px] font-semibold">{roleLabel(user.hqRole)}</span>}<Link to={'/profile/' + user.uid} className="px-3 py-1.5 rounded-lg border border-[#DDDDE3] dark:border-[#33333D] text-[11px] font-semibold">Profile</Link><button type="button" onClick={() => setSelectedUser(user)} className="px-3 py-1.5 rounded-lg border border-[#DDDDE3] dark:border-[#33333D] text-[11px] font-semibold">Details</button>{hqRole === 'owner' && <button type="button" disabled={busyId === user.uid || user.hqRole === 'owner'} onClick={() => void runAction(user.uid, () => headquartersService.setAccountSuspended(user.uid, !user.disabled), user.disabled ? 'Account restored.' : 'Account suspended.', 'users')} className="px-3 py-1.5 rounded-lg border border-[#DDDDE3] dark:border-[#33333D] text-[11px] font-semibold disabled:opacity-50">{user.disabled ? 'Restore' : 'Suspend'}</button>}{hqRole === 'owner' && <div className="flex items-center gap-1"><select aria-label={'Staff role for ' + user.displayName} value={roleDrafts[user.uid] || ''} onChange={(e) => setRoleDrafts((old) => ({ ...old, [user.uid]: e.target.value as HeadquartersRole }))} className="max-w-36 px-2 py-1.5 rounded-lg border border-[#DDDDE3] dark:border-[#33333D] bg-transparent text-[10px]"><option value="">Staff role…</option>{staffRoles.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}</select><button type="button" disabled={!roleDrafts[user.uid] || busyId === user.uid} onClick={() => void runAction(user.uid, () => headquartersService.setStaffRole(user.uid, roleDrafts[user.uid]), 'Staff access updated.', 'staff')} className="px-2.5 py-1.5 rounded-lg bg-[#E43136] text-white text-[10px] font-semibold disabled:opacity-50">Assign</button></div>}</div></div>)}</div>
            {userPageToken && <div className="p-4 text-center"><button type="button" disabled={busyId === 'users-more'} onClick={() => void loadMoreUsers()} className="px-4 py-2 rounded-lg border border-[#DDDDE3] dark:border-[#33333D] text-xs font-semibold">{busyId === 'users-more' ? 'Loading…' : 'Load more users'}</button></div>}
            {!loading && users.length === 0 && <div className="p-8 text-center text-xs text-[#8A8A94]">No users found for this search.</div>}
          </section>
        )}

        {selectedUser && <HqUserDetailsModal user={selectedUser} isOwner={hqRole === 'owner'} onClose={() => setSelectedUser(null)} onDeleted={() => { void headquartersService.listUsers(userSearchDebounced).then((result) => { setUsers(result.users); setUserPageToken(result.nextPageToken); }); }} addToast={addToast} />}

        {activeTab === 'staff' && (
          <section className="rounded-2xl border border-[#DDDDE3] dark:border-[#2C2C35] bg-white dark:bg-[#15151A] overflow-hidden"><div className="p-4 border-b border-[#EEEFF2] dark:border-[#2C2C35]"><h3 className="text-sm font-semibold">Staff permissions</h3><p className="text-[11px] text-[#777780] mt-1">Revoking staff access leaves the person’s normal account, books and followers intact.</p></div><div className="divide-y divide-[#EEEFF2] dark:divide-[#2B2B34]">{staff.map((person) => <div key={person.uid} className="p-4 flex flex-wrap items-center gap-3"><div className="min-w-0 flex-1"><div className="text-sm font-semibold">{person.displayName} <span className="ml-1 text-[10px] text-[#268B62]">✓ Redcover staff</span></div><div className="text-xs text-[#777780]">{person.email} · {person.uid}</div><div className="flex flex-wrap gap-1 mt-2">{person.permissions.map((permission) => <span key={permission} className="px-2 py-1 rounded bg-black/5 dark:bg-white/5 text-[9px]">{permission}</span>)}</div></div><select aria-label={'Role for ' + person.displayName} value={roleDrafts[person.uid] || person.role} onChange={(e) => setRoleDrafts((old) => ({ ...old, [person.uid]: e.target.value as HeadquartersRole }))} className="px-2 py-2 rounded-lg border border-[#DDDDE3] dark:border-[#33333D] bg-transparent text-xs">{staffRoles.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}</select><button type="button" disabled={busyId === person.uid} onClick={() => void runAction(person.uid, () => headquartersService.setStaffRole(person.uid, roleDrafts[person.uid] || person.role), 'Staff role updated.', 'staff')} className="px-3 py-2 rounded-lg border border-[#DDDDE3] dark:border-[#33333D] text-xs font-semibold">Save role</button><button type="button" disabled={busyId === person.uid} onClick={() => void runAction(person.uid, () => headquartersService.setStaffRole(person.uid, null), 'Staff access revoked.', 'staff')} className="px-3 py-2 rounded-lg text-red-600 border border-red-200 text-xs font-semibold">Revoke access</button></div>)}{!loading && staff.length === 0 && <div className="p-8 text-center text-xs text-[#8A8A94]">No staff roles have been provisioned.</div>}</div></section>
        )}

        {activeTab === 'content' && (
          <section className="rounded-2xl border border-[#DDDDE3] dark:border-[#2C2C35] bg-white dark:bg-[#15151A] overflow-hidden"><div className="p-4 border-b border-[#EEEFF2] dark:border-[#2C2C35] flex flex-wrap gap-2"><div className="relative flex-1 min-w-[200px]"><Search className="absolute left-3 top-2.5 w-4 h-4 text-[#8A8A94]" /><input value={bookSearch} onChange={(e) => setBookSearch(e.target.value)} placeholder="Search title, author or book ID" className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#DDDDE3] dark:border-[#33333D] bg-transparent text-xs" /></div><select value={bookStatus} onChange={(e) => setBookStatus(e.target.value)} className="px-3 py-2 rounded-xl border border-[#DDDDE3] dark:border-[#33333D] bg-transparent text-xs"><option value="">All statuses</option>{['published','draft','pending','removed'].map((status) => <option key={status} value={status}>{roleLabel(status)}</option>)}</select></div><div className="divide-y divide-[#EEEFF2] dark:divide-[#2B2B34]">{books.map((book) => <div key={book.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3"><div className="w-12 h-16 rounded-lg bg-black/5 overflow-hidden shrink-0">{book.coverURL && <img src={book.coverURL} alt="" loading="lazy" className="w-full h-full object-cover" />}</div><div className="min-w-0 flex-1"><Link to={'/book/' + book.id} className="text-sm font-semibold hover:text-[#E43136]">{book.title}</Link><p className="text-xs text-[#777780] mt-0.5">{book.authorName} · {book.category} · {book.status}</p><p className="text-[10px] text-[#8A8A94] mt-1 truncate">Book ID: {book.id}</p></div><div className="flex gap-2"><button type="button" disabled={busyId === book.id || book.status === 'published'} onClick={() => void runAction(book.id, () => headquartersService.updateBookStatus(book.id, 'published'), 'Book published.', 'content')} className="px-3 py-2 rounded-lg bg-[#268B62] text-white text-[11px] font-semibold disabled:opacity-40">Publish</button><button type="button" disabled={busyId === book.id || book.status === 'removed'} onClick={() => void runAction(book.id, () => headquartersService.updateBookStatus(book.id, 'removed'), 'Book unpublished (recoverable).', 'content')} className="px-3 py-2 rounded-lg border border-[#DDDDE3] dark:border-[#33333D] text-[11px] font-semibold disabled:opacity-40">Unpublish</button></div></div>)}</div>{bookPageToken && !bookSearch && <div className="p-4 text-center"><button type="button" disabled={busyId === 'books-more'} onClick={() => void loadMoreBooks()} className="px-4 py-2 rounded-lg border border-[#DDDDE3] dark:border-[#33333D] text-xs font-semibold">Load more books</button></div>}{!loading && books.length === 0 && <div className="p-8 text-center text-xs text-[#8A8A94]">No books match these filters.</div>}</section>
        )}

        {activeTab === 'moderation' && (
          <section className="space-y-3">{reports.map((report) => <article key={report.id} className="rounded-2xl border border-[#DDDDE3] dark:border-[#2C2C35] bg-white dark:bg-[#15151A] p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-[10px] uppercase tracking-wider text-[#E43136] font-bold">{report.targetType} · {report.status}</div><h3 className="text-sm font-semibold mt-1">{report.targetTitle || report.targetId}</h3><p className="text-xs text-[#777780] mt-1">{report.reason} · Reporter {report.reporterId}</p>{report.description && <p className="text-xs mt-2">{report.description}</p>}<p className="text-[10px] text-[#8A8A94] mt-2">{report.createdAt ? new Date(report.createdAt).toLocaleString() : ''} · ID {report.id}</p></div><div className="flex gap-2"><button type="button" disabled={busyId === report.id} onClick={() => void runAction(report.id, () => headquartersService.resolveReport(report.id, 'investigating'), 'Report assigned for review.', 'moderation')} className="px-3 py-2 rounded-lg border border-[#DDDDE3] dark:border-[#33333D] text-[11px] font-semibold">Investigate</button><button type="button" disabled={busyId === report.id} onClick={() => void runAction(report.id, () => headquartersService.resolveReport(report.id, 'resolved'), 'Report resolved.', 'moderation')} className="px-3 py-2 rounded-lg bg-[#268B62] text-white text-[11px] font-semibold">Resolve</button><button type="button" disabled={busyId === report.id} onClick={() => void runAction(report.id, () => headquartersService.resolveReport(report.id, 'dismissed'), 'Report dismissed.', 'moderation')} className="px-3 py-2 rounded-lg border border-[#DDDDE3] dark:border-[#33333D] text-[11px] font-semibold">Dismiss</button></div></div></article>)}{!loading && reports.length === 0 && <div className="rounded-2xl border border-[#DDDDE3] dark:border-[#2C2C35] bg-white dark:bg-[#15151A] p-8 text-center text-xs text-[#8A8A94]">No open reports.</div>}</section>
        )}

        {activeTab === 'health' && (
          <section className="rounded-2xl border border-[#DDDDE3] dark:border-[#2C2C35] bg-white dark:bg-[#15151A] overflow-hidden"><div className="p-4 border-b border-[#EEEFF2] dark:border-[#2C2C35] flex flex-wrap items-center gap-3"><div className="flex items-center gap-2 text-sm font-semibold"><Activity className="w-4 h-4 text-[#E43136]" />Error Center</div><select value={eventStatus} onChange={(e) => setEventStatus(e.target.value)} className="ml-auto px-3 py-2 rounded-lg border border-[#DDDDE3] dark:border-[#33333D] bg-transparent text-xs"><option value="">All events</option>{['new','investigating','resolved','ignored'].map((status) => <option key={status} value={status}>{roleLabel(status)}</option>)}</select></div><div className="divide-y divide-[#EEEFF2] dark:divide-[#2B2B34]">{events.map((event) => <article key={event.id} className="p-4 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_auto] gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className={"px-2 py-1 rounded text-[9px] uppercase font-bold " + (event.severity === 'critical' ? 'bg-red-500/10 text-red-600' : event.severity === 'warning' ? 'bg-amber-500/10 text-amber-700' : 'bg-sky-500/10 text-sky-700')}>{event.severity}</span><span className="text-[10px] uppercase font-semibold">{event.service}</span><span className="text-[10px] text-[#8A8A94]">{event.category} / {event.operation}</span><span className="text-[10px] text-[#8A8A94]">{event.status}</span></div><div className="text-xs font-semibold mt-2">{event.message || event.errorCode || 'Operation event'}</div><div className="text-[10px] text-[#777780] mt-1">Code {event.errorCode || '—'} · User {event.actorUid || '—'} · {event.createdAt ? new Date(event.createdAt).toLocaleString() : '—'}</div>{(event.fileCategory || event.fileName || event.storagePath) && <div className="text-[10px] text-[#777780] mt-1">{event.fileCategory} · {event.fileName} · {event.storagePath}</div>}<div className="text-[10px] text-[#8A8A94] mt-1">ID {event.id} · Related {event.relatedId || '—'} · Retry {event.retryStatus || '—'}</div></div><div className="flex items-center gap-2"><select aria-label="Update issue status" value="" onChange={(e) => { const value=e.target.value as 'investigating'|'resolved'|'ignored'; if(value) void runAction(event.id, () => headquartersService.updateEvent(event.id,value), 'Issue status updated.', 'health'); }} className="px-2 py-2 rounded-lg border border-[#DDDDE3] dark:border-[#33333D] bg-transparent text-[10px]"><option value="">Update status…</option><option value="investigating">Investigating</option><option value="resolved">Resolved</option><option value="ignored">Ignored</option></select></div></article>)}</div>{!loading && events.length === 0 && <div className="p-8 text-center text-xs text-[#8A8A94]">No diagnostic events recorded yet. Services without probes remain marked unknown.</div>}</section>
        )}

        {activeTab === 'audit' && (
          <section className="rounded-2xl border border-[#DDDDE3] dark:border-[#2C2C35] bg-white dark:bg-[#15151A] overflow-hidden"><div className="p-4 border-b border-[#EEEFF2] dark:border-[#2C2C35]"><h3 className="text-sm font-semibold">Administrative activity</h3><p className="text-[11px] text-[#777780] mt-1">Latest 100 server-written events. Entries cannot be edited from the client.</p></div><div className="divide-y divide-[#EEEFF2] dark:divide-[#2B2B34]">{auditEntries.map((entry) => <div key={entry.id} className="p-4 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2"><div><div className="text-xs font-semibold">{entry.action}</div><div className="text-[10px] text-[#777780] mt-1">{entry.actorRole} · {entry.actorUid} → {entry.targetType} {entry.targetId} · {entry.result}</div><div className="text-[10px] text-[#8A8A94] mt-1">{entry.createdAt ? new Date(entry.createdAt).toLocaleString() : '—'}</div></div><div className="text-[10px] text-[#777780]">{JSON.stringify(entry.previousValue)} → {JSON.stringify(entry.newValue)}</div></div>)}{!loading && auditEntries.length===0 && <div className="p-8 text-center text-xs text-[#8A8A94]">No audit events recorded yet.</div>}</div></section>
        )}
      </main>
    </div>
  );
};

export const AuthPage: React.FC = () => {
  const { firebaseUser, loginWithGoogle } = useRedcover();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  if (firebaseUser) {
    return <EmptyState title="You Are Signed In to Redcover" description="Your Redcover account is connected and ready to use." actionLabel="Go to Homepage" actionTo="/" />;
  }

  const handleGoogle = async () => {
    setFormError(null);
    setSubmitting(true);
    try {
      await loginWithGoogle();
      navigate('/');
    } catch (err: any) {
      setFormError(err?.message || 'Google sign-in could not be completed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto my-6 sm:my-10 bg-white dark:bg-[#16161A] rounded-3xl border border-[#DDDDE3] dark:border-[#2C2C35] overflow-hidden shadow-xl grid grid-cols-1 md:grid-cols-12 min-h-[560px]">
      <div className="hidden md:flex md:col-span-5 relative bg-black flex-col justify-between p-8 text-white">
        <img src="/assets/hero-banner.jpg" alt="Redcover" className="absolute inset-0 w-full h-full object-cover opacity-50" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
        <div className="relative z-10 space-y-2"><span className="font-display text-xl font-bold text-[#E43136]">Redcover</span><p className="text-xs text-gray-300">Read • Write • Publish • Connect • Co-Read</p></div>
        <div className="relative z-10 text-xs text-gray-200 space-y-2"><p>Discover original books and stories</p><p>Publish your own work</p><p>Co-read with friends</p></div>
      </div>
      <div className="md:col-span-7 p-6 sm:p-10 flex flex-col justify-center space-y-5">
        <div className="space-y-1"><h1 className="font-display text-2xl font-bold text-[#202020] dark:text-[#F4F4F6]">Sign In or Create an Account</h1><p className="text-xs text-[#777780] dark:text-[#9E9EA8]">Continue securely with your Google account.</p></div>
        {formError && <div role="alert" className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs">{formError}</div>}
        <button type="button" disabled={submitting} onClick={handleGoogle} className="w-full py-3 px-4 rounded-xl border border-[#DDDDE3] dark:border-[#2C2C35] hover:bg-[#FAFAFB] dark:hover:bg-[#1E1E26] text-sm font-semibold flex items-center justify-center gap-2.5 transition-colors cursor-pointer disabled:opacity-50"><span className="text-lg font-bold text-[#4285F4]">G</span><span>{submitting ? 'Connecting…' : 'Continue with Google'}</span></button>
      </div>
    </div>
  );
};
