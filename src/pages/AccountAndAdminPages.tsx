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
} from 'lucide-react';
import { useRedcover } from '../contexts/RedcoverContext';
import { FIREBASE_PROJECT_INFO } from '../services/firebase/firebaseConfig';
import { uploadFileToRedcoverStorage } from '../services/firebase/storageService';
import { ImageCropModal } from '../components/common/ImageCropModal';
import { BookCard, BookCover, EmptyState, UserAvatar } from '../components/common/UIPrimitives';

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
      addToast('Profile image uploaded to Firebase Storage!', 'success');
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
              <h2 className="text-base font-semibold">Admin Diagnostics: Firebase (`red-cover`)</h2>
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

          <p className="text-xs text-[#777780]">Read-only Firebase connection diagnostics.</p>
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
          {isAdmin && (
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
  const { isAdmin, users, books, reports, updateBookStatusAdmin, resolveReportAdmin, deleteBook } =
    useRedcover();
  const [adminTab, setAdminTab] = useState<'books' | 'users' | 'reports'>('books');

  if (!isAdmin) {
    return (
      <EmptyState
        title="Administrator Access Required"
        description="The Admin Control Center is restricted to verified Redcover platform administrators."
        actionLabel="Return Home"
        actionTo="/"
      />
    );
  }

  const publishedCount = books.filter((b) => b.status === 'published').length;
  const pendingOrDraftCount = books.filter((b) => b.status !== 'published').length;
  const premiumCount = users.filter((u) => u.membershipPlan === 'premium').length;
  const openReportsCount = reports.filter((r) => r.status === 'open').length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold">Admin Control Center</h1>
        <p className="text-sm text-[#777780]">
          Real-time platform moderation, catalog governance, and community analytics for `red-cover`.
        </p>
      </div>

      {/* 17.1 Real Backend KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 tabular-nums">
        {[
          { label: 'Registered Users', val: users.length },
          { label: 'Total Books', val: books.length },
          { label: 'Published Books', val: publishedCount },
          { label: 'Draft / Pending', val: pendingOrDraftCount },
          { label: 'Premium Members', val: premiumCount },
          { label: 'Open Reports', val: openReportsCount },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="bg-white dark:bg-[#16161A] rounded-xl border border-[#DDDDE3] dark:border-[#2C2C35] p-4"
          >
            <span className="block text-2xl font-bold text-[#202020] dark:text-[#F4F4F6]">
              {kpi.val}
            </span>
            <span className="text-xs text-[#777780]">{kpi.label}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 border-b border-[#DDDDE3] dark:border-[#2C2C35] pb-3">
        {(
          [
            { id: 'books', label: `Book Management (${books.length})` },
            { id: 'users', label: `User Management (${users.length})` },
            { id: 'reports', label: `Moderation Reports (${reports.length})` },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setAdminTab(t.id)}
            className={`py-2 px-4 rounded-lg text-xs font-semibold cursor-pointer ${
              adminTab === t.id ? 'bg-[#E43136] text-white' : 'text-[#777780]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {adminTab === 'books' && (
        <div className="bg-white dark:bg-[#16161A] rounded-2xl border border-[#DDDDE3] dark:border-[#2C2C35] divide-y divide-[#F1F1F4] dark:divide-[#2C2C35]">
          {books.map((b) => (
            <div key={b.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <Link to={`/book/${b.id}`} className="text-sm font-semibold hover:text-[#E43136]">
                  {b.title}
                </Link>
                <p className="text-xs text-[#777780]">
                  by {b.authorName} · Category: {b.category} · Status:{' '}
                  <strong className="uppercase">{b.status}</strong>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => updateBookStatusAdmin(b.id, 'published')}
                  className="py-1.5 px-3 rounded-lg bg-[#268B62] text-white text-xs font-semibold cursor-pointer"
                >
                  Approve / Publish
                </button>
                <button
                  type="button"
                  onClick={() => updateBookStatusAdmin(b.id, 'removed')}
                  className="py-1.5 px-3 rounded-lg border border-[#DDDDE3] text-xs font-semibold text-[#E6A02C] cursor-pointer"
                >
                  Unpublish
                </button>
                <button
                  type="button"
                  onClick={() => deleteBook(b.id)}
                  className="py-1.5 px-3 rounded-lg bg-[#D9363E] text-white text-xs font-semibold cursor-pointer"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {adminTab === 'users' && (
        <div className="bg-white dark:bg-[#16161A] rounded-2xl border border-[#DDDDE3] dark:border-[#2C2C35] divide-y divide-[#F1F1F4] dark:divide-[#2C2C35]">
          {users.map((u) => (
            <div key={u.uid} className="p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <UserAvatar user={u} size="sm" />
                <div>
                  <Link to={`/profile/${u.uid}`} className="text-sm font-semibold hover:text-[#E43136]">
                    {u.displayName}
                  </Link>
                  <p className="text-xs text-[#777780]">
                    @{u.username} · Role: {u.role} · Plan: {u.membershipPlan}
                  </p>
                </div>
              </div>
              <Link
                to={`/profile/${u.uid}`}
                className="py-1.5 px-3 rounded-lg border border-[#DDDDE3] text-xs font-semibold"
              >
                Inspect Profile
              </Link>
            </div>
          ))}
        </div>
      )}

      {adminTab === 'reports' &&
        (reports.length > 0 ? (
          <div className="space-y-3">
            {reports.map((rep) => (
              <div
                key={rep.id}
                className="bg-white dark:bg-[#16161A] rounded-xl border border-[#DDDDE3] dark:border-[#2C2C35] p-4 flex items-center justify-between gap-4"
              >
                <div>
                  <p className="text-sm font-semibold">
                    [{rep.targetType.toUpperCase()}] {rep.targetTitle}
                  </p>
                  <p className="text-xs text-[#777780]">Reason: {rep.reason}</p>
                  <span className="text-[11px] uppercase font-semibold text-[#E43136]">
                    Status: {rep.status}
                  </span>
                </div>
                {rep.status === 'open' && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => resolveReportAdmin(rep.id, 'resolved')}
                      className="py-1.5 px-3 rounded-lg bg-[#268B62] text-white text-xs font-semibold cursor-pointer"
                    >
                      Resolve
                    </button>
                    <button
                      type="button"
                      onClick={() => resolveReportAdmin(rep.id, 'dismissed')}
                      className="py-1.5 px-3 rounded-lg border border-[#DDDDE3] text-xs font-semibold cursor-pointer"
                    >
                      Dismiss
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="Zero Open Reports" description="No community reports require moderation." />
        ))}
    </div>
  );
};

export const AuthPage: React.FC = () => {
  const { firebaseUser, loginWithGoogle, loginWithEmail, registerWithEmail, sendResetPassword, addToast } =
    useRedcover();
  const navigate = useNavigate();

  const [authMode, setAuthMode] = useState<'login' | 'register' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  if (firebaseUser) {
    return (
      <EmptyState
        title="You Are Signed In to Redcover"
        description="Your Redcover account is connected and synchronizing in real time with Firebase."
        actionLabel="Go to Homepage"
        actionTo="/"
      />
    );
  }

  const handleGoogle = async () => {
    setFormError(null);
    setSubmitting(true);
    try {
      await loginWithGoogle();
      navigate('/');
    } catch {
      // Handled by toast
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setFormError('Please enter your email address.');
      return;
    }

    if (authMode === 'register') {
      if (!displayName.trim()) {
        setFormError('Please enter your full name.');
        return;
      }
      if (password.length < 6) {
        setFormError('Password must be at least 6 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setFormError('Passwords do not match. Please re-enter.');
        return;
      }
      if (!acceptTerms) {
        setFormError('Please agree to the Terms & Conditions and Privacy Policy.');
        return;
      }

      setSubmitting(true);
      try {
        const cleanUser =
          username.trim() ||
          cleanEmail.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '') ||
          `reader${Math.floor(Math.random() * 1000)}`;
        await registerWithEmail(cleanEmail, password, displayName.trim(), cleanUser);
        navigate('/');
      } catch (err: any) {
        setFormError(err?.message || 'Could not complete registration.');
      } finally {
        setSubmitting(false);
      }
    } else if (authMode === 'login') {
      if (!password) {
        setFormError('Please enter your password.');
        return;
      }
      setSubmitting(true);
      try {
        await loginWithEmail(cleanEmail, password);
        navigate('/');
      } catch (err: any) {
        setFormError(err?.message || 'Invalid email or password.');
      } finally {
        setSubmitting(false);
      }
    } else {
      setSubmitting(true);
      try {
        await sendResetPassword(cleanEmail);
        addToast('Password reset link sent to your email.', 'success');
        setAuthMode('login');
      } catch (err: any) {
        setFormError(err?.message || 'Could not send reset link.');
      } finally {
        setSubmitting(false);
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto my-6 sm:my-10 bg-white dark:bg-[#16161A] rounded-3xl border border-[#DDDDE3] dark:border-[#2C2C35] overflow-hidden shadow-xl grid grid-cols-1 md:grid-cols-12 min-h-[560px]">
      {/* Left Column: Atmospheric Brand Visual */}
      <div className="hidden md:flex md:col-span-5 relative bg-black flex-col justify-between p-8 text-white">
        <img
          src="/assets/hero-banner.jpg"
          alt="Redcover"
          className="absolute inset-0 w-full h-full object-cover opacity-50"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />

        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center gap-2">
            <img
              src="/assets/aistudio/WhatsApp_Image_2026-10-24_at_6.29.36_PM_8a2e5d20.jpeg"
              alt="Redcover"
              className="w-7 h-7 rounded-lg object-cover"
            />
            <span className="font-display text-xl font-bold text-[#E43136]">Redcover</span>
          </div>
          <p className="text-xs text-gray-300">Read • Write • Publish • Connect • Co-Read</p>
        </div>

        <div className="relative z-10 space-y-3">
          <div className="space-y-2 text-xs text-gray-200">
            <div className="flex items-center gap-2">
              <span className="text-[#E43136]">✔</span>
              <span>Discover original books &amp; stories</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[#E43136]">✔</span>
              <span>Publish your own work with full ownership</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[#E43136]">✔</span>
              <span>Co-Read in real time with friends</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[#E43136]">✔</span>
              <span>100% free with safe ad support</span>
            </div>
          </div>
          <div className="pt-4 border-t border-white/20 text-[11px] text-gray-400">
            Official platform • <span className="text-white">https://redcover.app</span>
          </div>
        </div>
      </div>

      {/* Right Column: Interactive Form */}
      <div className="md:col-span-7 p-6 sm:p-10 flex flex-col justify-center space-y-5">
        <div className="space-y-1">
          <h1 className="font-display text-2xl font-bold text-[#202020] dark:text-[#F4F4F6]">
            {authMode === 'login'
              ? 'Sign In to Your Account'
              : authMode === 'register'
              ? 'Create Your Free Account'
              : 'Reset Your Password'}
          </h1>
          <p className="text-xs text-[#777780] dark:text-[#9E9EA8]">
            {authMode === 'login'
              ? 'Welcome back! Enter your credentials to access your library and chats.'
              : authMode === 'register'
              ? 'Join our growing community of passionate readers and independent authors.'
              : 'Enter your registered email to receive a secure password reset link.'}
          </p>
        </div>

        {formError && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs">
            {formError}
          </div>
        )}

        {/* Google OAuth Button */}
        <button
          type="button"
          disabled={submitting}
          onClick={handleGoogle}
          className="w-full py-2.5 px-4 rounded-xl border border-[#DDDDE3] dark:border-[#2C2C35] hover:bg-[#FAFAFB] dark:hover:bg-[#1E1E26] text-xs font-semibold flex items-center justify-center gap-2.5 transition-colors cursor-pointer disabled:opacity-50"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>Continue with Google</span>
        </button>

        <div className="relative flex items-center justify-center">
          <div className="border-t border-[#DDDDE3] dark:border-[#2C2C35] w-full" />
          <span className="bg-white dark:bg-[#16161A] px-3 text-[10px] text-[#777780] dark:text-[#9E9EA8] uppercase tracking-wider">
            or with email
          </span>
          <div className="border-t border-[#DDDDE3] dark:border-[#2C2C35] w-full" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {authMode === 'register' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full py-2 px-3 rounded-xl border border-[#DDDDE3] dark:border-[#2C2C35] bg-transparent text-xs sm:text-sm focus:outline-none focus:border-[#E43136]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. rahulreads"
                  className="w-full py-2 px-3 rounded-xl border border-[#DDDDE3] dark:border-[#2C2C35] bg-transparent text-xs sm:text-sm focus:outline-none focus:border-[#E43136]"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold mb-1">Email Address *</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full py-2 px-3 rounded-xl border border-[#DDDDE3] dark:border-[#2C2C35] bg-transparent text-xs sm:text-sm focus:outline-none focus:border-[#E43136]"
            />
          </div>

          {authMode !== 'reset' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold">Password *</label>
                {authMode === 'login' && (
                  <button
                    type="button"
                    onClick={() => {
                      setFormError(null);
                      setAuthMode('reset');
                    }}
                    className="text-[11px] text-[#E43136] hover:underline cursor-pointer"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full py-2 px-3 rounded-xl border border-[#DDDDE3] dark:border-[#2C2C35] bg-transparent text-xs sm:text-sm focus:outline-none focus:border-[#E43136]"
              />
            </div>
          )}

          {authMode === 'register' && (
            <div>
              <label className="block text-xs font-semibold mb-1">Confirm Password *</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full py-2 px-3 rounded-xl border border-[#DDDDE3] dark:border-[#2C2C35] bg-transparent text-xs sm:text-sm focus:outline-none focus:border-[#E43136]"
              />
            </div>
          )}

          {authMode === 'register' && (
            <label className="flex items-start gap-2 text-xs text-[#6E6E77] dark:text-[#9E9EA8] cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                className="mt-0.5 rounded text-[#E43136] focus:ring-[#E43136]"
              />
              <span>
                I agree to the{' '}
                <Link to="/terms" className="text-[#E43136] underline" target="_blank">
                  Terms &amp; Conditions
                </Link>{' '}
                and{' '}
                <Link to="/privacy" className="text-[#E43136] underline" target="_blank">
                  Privacy Policy
                </Link>
                .
              </span>
            </label>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 px-4 rounded-xl bg-[#E43136] hover:bg-[#B9272D] text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer shadow-md disabled:opacity-50"
          >
            {submitting
              ? 'Authenticating...'
              : authMode === 'login'
              ? 'Sign In with Email'
              : authMode === 'register'
              ? 'Create Free Account'
              : 'Send Password Reset Link'}
          </button>
        </form>

        <div className="flex items-center justify-between text-xs text-[#6E6E77] dark:text-[#9E9EA8] pt-2 border-t border-[#F1F1F4] dark:border-[#2C2C35]">
          {authMode === 'login' ? (
            <div className="w-full text-center">
              <span>New to Redcover? </span>
              <button
                type="button"
                onClick={() => {
                  setFormError(null);
                  setAuthMode('register');
                }}
                className="text-[#E43136] font-bold hover:underline cursor-pointer"
              >
                Create a Free Account
              </button>
            </div>
          ) : authMode === 'register' ? (
            <div className="w-full text-center">
              <span>Already registered? </span>
              <button
                type="button"
                onClick={() => {
                  setFormError(null);
                  setAuthMode('login');
                }}
                className="text-[#E43136] font-bold hover:underline cursor-pointer"
              >
                Sign In to Account
              </button>
            </div>
          ) : (
            <div className="w-full text-center">
              <button
                type="button"
                onClick={() => {
                  setFormError(null);
                  setAuthMode('login');
                }}
                className="text-[#6E6E77] hover:text-[#202020] dark:hover:text-white cursor-pointer"
              >
                ← Back to Sign In
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
