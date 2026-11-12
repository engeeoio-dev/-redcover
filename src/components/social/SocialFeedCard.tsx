import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  BookOpen,
  Star,
  MoreHorizontal,
  UserPlus,
  UserCheck,
  Trash2,
  Flag,
  Award,
  TrendingUp,
  Sparkles,
  Eye,
} from 'lucide-react';
import { Book, PostComment, SocialPost, SocialPostType, UserProfile } from '../../models/types';
import { useRedcover } from '../../contexts/RedcoverContext';
import { BookCover, UserAvatar } from '../common/UIPrimitives';
import { CommentThread, LikedByBar } from './CommentThread';

export interface UnifiedFeedItem {
  id: string;
  authorId: string;
  authorName: string;
  authorUsername: string;
  authorAvatar: string;
  activityType: SocialPostType;
  activityLabel: string;
  text: string;
  book?: Book | null;
  bookId: string;
  bookTitle: string;
  bookAuthor: string;
  bookCover: string;
  bookCategory: string;
  rating: number;
  progressPercentage: number;
  chapterNumber: number;
  totalChapters: number;
  createdAt: string;
  backingPost?: SocialPost | null;
  baseLikesCount: number;
  baseCommentsCount: number;
  aiRecommendationReason?: string;
}

function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const diffSec = Math.max(1, Math.floor((Date.now() - date.getTime()) / 1000));
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export const SocialFeedCard: React.FC<{
  item: UnifiedFeedItem;
}> = ({ item }) => {
  const {
    firebaseUser,
    isAdmin,
    users,
    books,
    follows,
    savedBooks,
    likedBooks,
    postLikes,
    postComments,
    toggleLikePost,
    deleteSocialPost,
    toggleSaveBook,
    toggleFollowUser,
    submitReport,
    addToast,
    incrementPostView,
  } = useRedcover();

  const navigate = useNavigate();

  const [showAllComments, setShowAllComments] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [likePop, setLikePop] = useState(false);

  const cleanPostKey = item.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);

  // Exactly 1 view per user tracked automatically
  useEffect(() => {
    if (cleanPostKey) {
      incrementPostView(cleanPostKey);
    }
  }, [cleanPostKey, incrementPostView]);

  // Always resolve the freshest book record from `books` so coverURL & fileURL are up to date
  const liveBookFromCatalog: Book | null =
    (item.bookId ? books.find((b) => b.id === item.bookId) || null : null) ||
    (item.bookTitle
      ? books.find((b) => b.title.toLowerCase() === item.bookTitle.toLowerCase()) || null
      : null) ||
    item.book ||
    null;

  // Real likes & comments from Firestore for this feed item
  const itemLikes = postLikes.filter((l) => l.postId === cleanPostKey);
  const isLikedInPostLikes = Boolean(
    firebaseUser && itemLikes.some((l) => l.userId === firebaseUser.uid)
  );
  const isLikedInBookCatalog = Boolean(
    item.activityType === 'story_publication' &&
      liveBookFromCatalog &&
      likedBooks.some((l) => l.bookId === liveBookFromCatalog.id)
  );
  const isLikedByMe = isLikedInPostLikes || isLikedInBookCatalog;

  const effectiveLikesCount = item.backingPost
    ? Math.max(item.backingPost.likesCount, itemLikes.length)
    : item.activityType === 'story_publication' && liveBookFromCatalog
    ? Math.max(liveBookFromCatalog.likes, itemLikes.length, isLikedByMe ? 1 : 0)
    : Math.max(item.baseLikesCount, itemLikes.length, isLikedByMe ? 1 : 0);

  const itemComments: PostComment[] = postComments.filter((c) => c.postId === cleanPostKey);
  const effectiveCommentsCount = item.backingPost
    ? Math.max(item.backingPost.commentsCount, itemComments.length)
    : itemComments.length;

  // Author profile lookup for Follow button & real avatar
  const authorProfile: UserProfile =
    users.find((u) => u.uid === item.authorId) || {
      uid: item.authorId,
      username: item.authorUsername || 'reader',
      displayName: item.authorName || 'Redcover Reader',
      photoURL: item.authorAvatar || '',
      coverURL: '',
      bio: 'Redcover community member',
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
      createdAt: item.createdAt,
      updatedAt: item.createdAt,
    };

  const isSelf = Boolean(firebaseUser && firebaseUser.uid === item.authorId);
  const isFollowingAuthor = Boolean(
    firebaseUser &&
      follows.some(
        (f) => f.followerId === firebaseUser.uid && f.followingId === item.authorId
      )
  );

  const bookDisplayData = liveBookFromCatalog
    ? {
        ...liveBookFromCatalog,
        coverURL: liveBookFromCatalog.coverURL || item.book?.coverURL || item.bookCover || '',
        fileURL: liveBookFromCatalog.fileURL || item.book?.fileURL || '',
      }
    : item.bookTitle
    ? {
        id: item.bookId || 'book',
        title: item.bookTitle,
        authorId: item.authorId,
        authorName: item.bookAuthor || item.authorName,
        coverURL: item.bookCover || '',
        fileURL: '',
        category: item.bookCategory || 'Fiction',
        description: item.text,
        shortDescription: item.text,
        rating: item.rating ?? 0,
        views: 0,
        likes: item.baseLikesCount || 0,
        chaptersCount: item.totalChapters || 1,
        format: 'story' as const,
      }
    : null;

  const isBookSaved = Boolean(
    bookDisplayData && savedBooks.some((s) => s.bookId === bookDisplayData.id)
  );

  const postTargetLink = bookDisplayData
    ? `/book/${bookDisplayData.id}`
    : `/profile/${item.authorId}`;

  const handleToggleLike = () => {
    setLikePop(true);
    setTimeout(() => setLikePop(false), 380);
    toggleLikePost(item.id, item.backingPost, {
      targetAuthorId: item.authorId,
      targetTitle: bookDisplayData?.title || item.text.slice(0, 60),
      bookForSync: item.activityType === 'story_publication' ? liveBookFromCatalog : null,
      link: postTargetLink,
    });
  };

  const handleDoubleTapLike = () => {
    if (!isLikedByMe) {
      handleToggleLike();
    } else {
      setLikePop(true);
      setTimeout(() => setLikePop(false), 380);
    }
  };

  const handleShare = async () => {
    const shareUrl = bookDisplayData
      ? `${window.location.origin}/book/${bookDisplayData.id}`
      : `${window.location.origin}/profile/${item.authorId}`;
    const shareTitle = bookDisplayData
      ? `${item.authorName} on "${bookDisplayData.title}" — Redcover`
      : `${item.authorName} on Redcover`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: item.text.slice(0, 140),
          url: shareUrl,
        });
        return;
      } catch {
        // Fallback to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      addToast('Link copied to clipboard!', 'success');
    } catch {
      addToast(`Share link: ${shareUrl}`, 'info');
    }
  };

  // Activity Type Badge Styling
  const badgeConfig = (() => {
    switch (item.activityType) {
      case 'story_publication':
        return {
          label: 'New Book Published',
          bg: 'bg-[#FFF3F4] dark:bg-[#2D1619] text-[#E43136] border-[#E43136]/20',
          icon: <Sparkles className="w-3 h-3" />,
        };
      case 'book_review':
        return {
          label: 'Reader Review',
          bg: 'bg-[#FFF8EB] dark:bg-[#2B2112] text-[#C87D12] dark:text-[#E6A02C] border-[#E6A02C]/25',
          icon: <Star className="w-3 h-3 fill-current" />,
        };
      case 'reading_update':
        return {
          label: 'Reading Update',
          bg: 'bg-[#EEF9F3] dark:bg-[#13281E] text-[#268B62] border-[#268B62]/25',
          icon: <TrendingUp className="w-3 h-3" />,
        };
      case 'reading_achievement':
        return {
          label: 'Reading Milestone',
          bg: 'bg-[#FFF8EB] dark:bg-[#2B2112] text-[#C87D12] dark:text-[#E6A02C] border-[#E6A02C]/25',
          icon: <Award className="w-3 h-3" />,
        };
      case 'book_recommendation':
        return {
          label: 'Book Recommendation',
          bg: 'bg-[#FFF3F4] dark:bg-[#2D1619] text-[#E43136] border-[#E43136]/20',
          icon: <BookOpen className="w-3 h-3" />,
        };
      default:
        return {
          label: 'Community Discussion',
          bg: 'bg-[#F1F1F4] dark:bg-[#22222A] text-[#202020] dark:text-[#F4F4F6] border-[#DDDDE3] dark:border-[#2C2C35]',
          icon: <MessageCircle className="w-3 h-3 text-[#E43136]" />,
        };
    }
  })();

  return (
    <article className="bg-white dark:bg-[#16161A] rounded-xl sm:rounded-2xl border border-[#DDDDE3] dark:border-[#2C2C35] p-3 sm:p-6 space-y-2.5 sm:space-y-4 transition-all hover:border-[#E43136]/30">
      {/* ================================================================= */}
      {/* 1. AUTHOR / READER HEADER                                         */}
      {/* ================================================================= */}
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <Link to={`/profile/${item.authorId}`} className="shrink-0">
            <UserAvatar
              user={{
                displayName: item.authorName,
                photoURL: authorProfile.photoURL || item.authorAvatar,
                isOnline: authorProfile.isOnline,
                showOnlineStatus: authorProfile.showOnlineStatus,
              }}
              size="sm"
              showPresence
            />
          </Link>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0">
              <Link
                to={`/profile/${item.authorId}`}
                className="text-xs sm:text-[15px] font-bold text-[#202020] dark:text-[#F4F4F6] hover:text-[#E43136] transition-colors truncate"
              >
                {item.authorName}
              </Link>
              <Link
                to={`/profile/${item.authorId}`}
                className="text-[11px] sm:text-xs text-[#777780] dark:text-[#9E9EA9] hover:underline truncate"
              >
                @{item.authorUsername}
              </Link>
              <span aria-hidden="true" className="text-[11px] sm:text-xs text-[#777780]">
                ·
              </span>
              <span className="text-[11px] sm:text-xs text-[#777780] dark:text-[#9E9EA9] whitespace-nowrap">
                {formatRelativeTime(item.createdAt)}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-0.5 sm:mt-1">
              <span
                className={`inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-semibold border ${badgeConfig.bg}`}
              >
                {badgeConfig.icon}
                <span>{badgeConfig.label}</span>
              </span>
              {bookDisplayData?.category && (
                <span className="text-[11px] sm:text-xs font-medium text-[#777780] dark:text-[#9E9EA9]">
                  in <strong className="text-[#202020] dark:text-[#F4F4F6]">{bookDisplayData.category}</strong>
                </span>
              )}
              {item.aiRecommendationReason && (
                <span className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-semibold bg-[#FFF3F4] dark:bg-[#E43136]/15 text-[#E43136] border border-[#E43136]/25">
                  <Sparkles className="w-3 h-3 text-[#E43136]" />
                  <span>{item.aiRecommendationReason}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right Header Controls: Follow + Menu */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {!isSelf && (
            <button
              type="button"
              onClick={() => toggleFollowUser(authorProfile)}
              className={`py-1 px-2.5 sm:py-1.5 sm:px-3 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-semibold inline-flex items-center gap-1 transition-colors whitespace-nowrap cursor-pointer ${
                isFollowingAuthor
                  ? 'bg-[#F1F1F4] dark:bg-[#1F1F26] text-[#202020] dark:text-[#F4F4F6] hover:bg-[#DDDDE3]'
                  : 'bg-[#FFF3F4] dark:bg-[#2D1619] text-[#E43136] hover:bg-[#E43136] hover:text-white'
              }`}
            >
              {isFollowingAuthor ? (
                <>
                  <UserCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  <span className="hidden sm:inline">Following</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  <span>Follow</span>
                </>
              )}
            </button>
          )}

          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="More post options"
              className="p-1 sm:p-1.5 rounded-lg text-[#777780] hover:text-[#202020] dark:hover:text-white hover:bg-[#F1F1F4] dark:hover:bg-[#1F1F26] cursor-pointer"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 mt-1 w-44 rounded-xl bg-white dark:bg-[#16161A] border border-[#DDDDE3] dark:border-[#2C2C35] shadow-lg py-1.5 z-40 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      navigate(`/profile/${item.authorId}`);
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-[#FAFAFB] dark:hover:bg-[#1F1F26] cursor-pointer"
                  >
                    View Author Profile
                  </button>
                  {bookDisplayData && (
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        navigate(`/book/${bookDisplayData.id}`);
                      }}
                      className="w-full text-left px-3.5 py-2 hover:bg-[#FAFAFB] dark:hover:bg-[#1F1F26] cursor-pointer"
                    >
                      Open Book Details
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      handleShare();
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-[#FAFAFB] dark:hover:bg-[#1F1F26] cursor-pointer"
                  >
                    Copy Share Link
                  </button>
                  {!isSelf && (
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        submitReport(
                          bookDisplayData ? 'book' : 'user',
                          bookDisplayData ? bookDisplayData.id : item.authorId,
                          bookDisplayData ? bookDisplayData.title : item.authorName,
                          'Reported from community social feed'
                        );
                      }}
                      className="w-full text-left px-3.5 py-2 text-[#E6A02C] hover:bg-[#FAFAFB] dark:hover:bg-[#1F1F26] inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Flag className="w-3.5 h-3.5" />
                      Report Activity
                    </button>
                  )}
                  {item.backingPost && (isSelf || isAdmin) && (
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        deleteSocialPost(item.backingPost!.id);
                      }}
                      className="w-full text-left px-3.5 py-2 text-[#D9363E] hover:bg-[#FFF3F4] dark:hover:bg-[#2D1619] inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete Post
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ================================================================= */}
      {/* 2. DISTINCT VISUAL HIERARCHY BY POST TYPE                         */}
      {/* ================================================================= */}

      {/* TYPE A: BOOK PUBLICATION POST (Compact Horizontal Card on Mobile, Showcase on Desktop) */}
      {item.activityType === 'story_publication' && bookDisplayData && (
        <div
          onDoubleClick={handleDoubleTapLike}
          title="Double-tap to like"
          className="relative rounded-xl sm:rounded-2xl bg-gradient-to-br from-[#FFF3F4] via-[#FAFAFB] to-white dark:from-[#231316] dark:via-[#16161A] dark:to-[#0F0F12] border border-[#E43136]/20 p-3 sm:p-5 select-none"
        >
          {likePop && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-20">
              <Heart className="w-14 h-14 text-[#E43136] fill-[#E43136] animate-ping opacity-80 drop-shadow-md" />
            </div>
          )}
          <div className="flex flex-row gap-3 sm:gap-5 items-start">
            <Link
              to={`/book/${bookDisplayData.id}`}
              className="w-20 sm:w-36 aspect-[3/4] shrink-0 rounded-lg sm:rounded-xl overflow-hidden shadow-xs sm:shadow-md group transition-transform duration-200 hover:scale-[1.02]"
            >
              <BookCover book={bookDisplayData} size="sm" className="w-full h-full" />
            </Link>

            <div className="flex-1 min-w-0 space-y-1.5 sm:space-y-2.5 text-left">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs text-[#777780] dark:text-[#9E9EA9]">
                <span className="px-2 py-0.5 rounded bg-white dark:bg-[#16161A] border border-[#E43136]/25 font-semibold text-[#E43136]">
                  {bookDisplayData.category}
                </span>
                <span className="inline-flex items-center gap-0.5 font-semibold text-[#202020] dark:text-[#F4F4F6] tabular-nums">
                  <Star className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-[#E6A02C] text-[#E6A02C]" />
                  {bookDisplayData.rating.toFixed(1)}
                </span>
                {bookDisplayData.views > 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      <Eye className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                      {bookDisplayData.views.toLocaleString()}
                    </span>
                  </>
                )}
              </div>

              <Link
                to={`/book/${bookDisplayData.id}`}
                className="block font-display text-sm sm:text-xl font-bold text-[#202020] dark:text-[#F4F4F6] hover:text-[#E43136] transition-colors leading-snug line-clamp-1 sm:line-clamp-2"
              >
                {bookDisplayData.title}
              </Link>

              <p className="text-[11px] sm:text-xs font-medium text-[#777780] dark:text-[#9E9EA9] truncate">
                by{' '}
                <Link
                  to={`/profile/${item.authorId}`}
                  className="text-[#202020] dark:text-[#F4F4F6] hover:text-[#E43136] font-semibold"
                >
                  {bookDisplayData.authorName}
                </Link>
              </p>

              <p className="text-xs sm:text-sm text-[#4A4A52] dark:text-[#B8B8C2] leading-relaxed line-clamp-2 sm:line-clamp-3">
                {item.text || bookDisplayData.description || bookDisplayData.shortDescription}
              </p>

              <div className="pt-1 sm:pt-2 flex flex-wrap items-center gap-2">
                <Link
                  to={`/read/${bookDisplayData.id}`}
                  className="py-1.5 px-3 sm:py-2.5 sm:px-5 rounded-lg sm:rounded-xl bg-[#E43136] hover:bg-[#B9272D] text-white text-[11px] sm:text-sm font-semibold inline-flex items-center gap-1.5 transition-colors shadow-2xs"
                >
                  <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span>Read Now</span>
                </Link>

                {liveBookFromCatalog && (
                  <button
                    type="button"
                    onClick={() => toggleSaveBook(liveBookFromCatalog)}
                    className={`py-1.5 px-2.5 sm:py-2.5 sm:px-4 rounded-lg sm:rounded-xl border text-[11px] sm:text-sm font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer ${
                      isBookSaved
                        ? 'bg-[#E43136]/10 border-[#E43136] text-[#E43136]'
                        : 'bg-white dark:bg-[#16161A] border-[#DDDDE3] dark:border-[#2C2C35] text-[#202020] dark:text-[#F4F4F6] hover:border-[#E43136] hover:text-[#E43136]'
                    }`}
                  >
                    <Bookmark className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isBookSaved ? 'fill-[#E43136]' : ''}`} />
                    <span>{isBookSaved ? 'Saved' : 'Save'}</span>
                  </button>
                )}

                <Link
                  to={`/book/${bookDisplayData.id}`}
                  className="hidden sm:inline-block py-2 px-3 text-xs font-semibold text-[#777780] hover:text-[#E43136] transition-colors"
                >
                  Details →
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TYPE B: BOOK REVIEW POST (Compact Side-by-Side on Mobile & Desktop) */}
      {item.activityType === 'book_review' && (
        <div
          onDoubleClick={handleDoubleTapLike}
          className="rounded-xl sm:rounded-2xl bg-[#FAFAFB] dark:bg-[#0F0F12] border border-[#DDDDE3] dark:border-[#2C2C35] p-3 sm:p-5"
        >
          <div className="flex flex-row gap-3 sm:gap-5 items-start">
            {bookDisplayData && (
              <Link
                to={`/book/${bookDisplayData.id}`}
                className="w-16 sm:w-28 aspect-[3/4] shrink-0 rounded-lg sm:rounded-xl overflow-hidden shadow-xs group"
              >
                <BookCover book={bookDisplayData} size="sm" className="w-full h-full" />
              </Link>
            )}

            <div className="flex-1 min-w-0 space-y-1.5 sm:space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <div className="flex items-center gap-0.5 sm:gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${
                        i < item.rating
                          ? 'fill-[#E6A02C] text-[#E6A02C]'
                          : 'text-[#DDDDE3] dark:text-[#2C2C35]'
                      }`}
                    />
                  ))}
                  <span className="text-[11px] sm:text-xs font-bold text-[#202020] dark:text-[#F4F4F6] ml-1 tabular-nums">
                    {item.rating.toFixed(1)}
                  </span>
                </div>

                {bookDisplayData && (
                  <span className="text-[10px] sm:text-[11px] font-semibold text-[#E43136]">
                    {bookDisplayData.category}
                  </span>
                )}
              </div>

              {bookDisplayData && (
                <div>
                  <Link
                    to={`/book/${bookDisplayData.id}`}
                    className="font-display text-xs sm:text-lg font-bold text-[#202020] dark:text-[#F4F4F6] hover:text-[#E43136] transition-colors line-clamp-1"
                  >
                    {bookDisplayData.title}
                  </Link>
                  <p className="text-[11px] sm:text-xs text-[#777780] dark:text-[#9E9EA9] truncate">
                    by {bookDisplayData.authorName}
                  </p>
                </div>
              )}

              <div className="relative pl-2.5 sm:pl-3.5 border-l-2 border-[#E43136]/40">
                <p className="text-xs sm:text-[15px] text-[#202020] dark:text-[#F4F4F6] leading-relaxed line-clamp-3 sm:line-clamp-none whitespace-pre-line">
                  “{item.text}”
                </p>
              </div>

              {bookDisplayData && (
                <div className="pt-0.5 sm:pt-1 flex flex-wrap items-center gap-2">
                  <Link
                    to={`/read/${bookDisplayData.id}`}
                    className="py-1 px-2.5 sm:py-1.5 sm:px-3.5 rounded-lg bg-[#E43136] hover:bg-[#B9272D] text-white text-[11px] sm:text-xs font-semibold inline-flex items-center gap-1 transition-colors"
                  >
                    <BookOpen className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    <span>Read</span>
                  </Link>
                  {liveBookFromCatalog && (
                    <button
                      type="button"
                      onClick={() => toggleSaveBook(liveBookFromCatalog)}
                      className={`py-1 px-2.5 sm:py-1.5 sm:px-3 rounded-lg border text-[11px] sm:text-xs font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer ${
                        isBookSaved
                          ? 'bg-[#FFF3F4] dark:bg-[#2D1619] border-[#E43136] text-[#E43136]'
                          : 'bg-white dark:bg-[#16161A] border-[#DDDDE3] dark:border-[#2C2C35] text-[#202020] dark:text-[#F4F4F6] hover:border-[#E43136]'
                      }`}
                    >
                      <Bookmark className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${isBookSaved ? 'fill-[#E43136]' : ''}`} />
                      <span>{isBookSaved ? 'Saved' : 'Save'}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TYPE C: READING UPDATE / MILESTONE POST (Compact Side-by-Side on Mobile) */}
      {(item.activityType === 'reading_update' ||
        item.activityType === 'reading_achievement') && (
        <div className="space-y-2.5 sm:space-y-3.5">
          {item.text && (
            <p className="text-xs sm:text-[15px] text-[#202020] dark:text-[#F4F4F6] leading-relaxed whitespace-pre-line">
              {item.text}
            </p>
          )}

          {bookDisplayData ? (
            <div className="rounded-xl sm:rounded-2xl bg-[#FAFAFB] dark:bg-[#0F0F12] border border-[#DDDDE3] dark:border-[#2C2C35] p-2.5 sm:p-4 flex flex-row gap-3 sm:gap-4 items-center">
              <Link
                to={`/read/${bookDisplayData.id}`}
                className="w-14 sm:w-24 aspect-[3/4] shrink-0 rounded-lg sm:rounded-xl overflow-hidden shadow-xs"
              >
                <BookCover book={bookDisplayData} size="xs" className="w-full h-full" />
              </Link>

              <div className="flex-1 min-w-0 w-full space-y-1.5 sm:space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      to={`/book/${bookDisplayData.id}`}
                      className="block font-display text-xs sm:text-base font-bold text-[#202020] dark:text-[#F4F4F6] hover:text-[#E43136] truncate"
                    >
                      {bookDisplayData.title}
                    </Link>
                    <p className="text-[11px] sm:text-xs text-[#777780] dark:text-[#9E9EA9] truncate">
                      by {bookDisplayData.authorName} · {bookDisplayData.category}
                    </p>
                  </div>

                  <Link
                    to={`/read/${bookDisplayData.id}`}
                    className="py-1 px-2.5 sm:py-1.5 sm:px-3.5 rounded-lg sm:rounded-xl bg-[#E43136] hover:bg-[#B9272D] text-white text-[11px] sm:text-xs font-semibold inline-flex items-center gap-1 shrink-0 transition-colors"
                  >
                    <BookOpen className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    <span>Read</span>
                  </Link>
                </div>

                {item.progressPercentage > 0 && (
                  <div className="p-2 sm:p-3 rounded-lg sm:rounded-xl bg-white dark:bg-[#16161A] border border-[#F1F1F4] dark:border-[#2C2C35] space-y-1">
                    <div className="flex items-center justify-between text-[11px] sm:text-xs font-semibold">
                      <span className="inline-flex items-center gap-1 text-[#202020] dark:text-[#F4F4F6] truncate">
                        {item.progressPercentage >= 100 ? (
                          <>
                            <Award className="w-3.5 h-3.5 text-[#E6A02C] shrink-0" />
                            <span>Finished Book!</span>
                          </>
                        ) : (
                          <>
                            <TrendingUp className="w-3.5 h-3.5 text-[#268B62] shrink-0" />
                            <span className="truncate">
                              Ch. {Math.max(1, item.chapterNumber)}
                              {item.totalChapters > 1 ? ` / ${item.totalChapters}` : ''}
                            </span>
                          </>
                        )}
                      </span>
                      <span className="text-[#E43136] font-bold tabular-nums shrink-0">
                        {item.progressPercentage}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 sm:h-2 rounded-full bg-[#EAEAEF] dark:bg-[#262630] overflow-hidden">
                      <div
                        style={{
                          width: `${Math.min(100, Math.max(5, item.progressPercentage))}%`,
                        }}
                        className="h-full bg-[#E43136] rounded-full transition-all duration-300"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            item.progressPercentage > 0 && (
              <div className="p-2.5 sm:p-3.5 rounded-xl bg-[#FAFAFB] dark:bg-[#0F0F12] border border-[#F1F1F4] dark:border-[#2C2C35] flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#202020] dark:text-[#F4F4F6]">
                  <Award className="w-3.5 h-3.5 text-[#E6A02C]" />
                  <span>Reading Milestone Achieved</span>
                </span>
                <span className="text-xs font-bold text-[#E43136] tabular-nums">
                  {item.progressPercentage}%
                </span>
              </div>
            )
          )}
        </div>
      )}

      {/* TYPE D: DISCUSSION OR BOOK RECOMMENDATION POST */}
      {(item.activityType === 'discussion' ||
        item.activityType === 'book_recommendation') && (
        <div className="space-y-2.5 sm:space-y-3.5">
          <p className="text-xs sm:text-base text-[#202020] dark:text-[#F4F4F6] leading-relaxed whitespace-pre-line">
            {item.text}
          </p>

          {bookDisplayData && (
            <div className="rounded-xl sm:rounded-2xl bg-[#FAFAFB] dark:bg-[#0F0F12] border border-[#DDDDE3] dark:border-[#2C2C35] p-2.5 sm:p-4 flex flex-row gap-3 sm:gap-4 items-center justify-between">
              <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                <Link
                  to={`/book/${bookDisplayData.id}`}
                  className="w-14 sm:w-24 aspect-[3/4] shrink-0 overflow-hidden rounded-lg sm:rounded-xl shadow-xs group"
                >
                  <BookCover book={bookDisplayData} size="xs" className="w-full h-full" />
                </Link>

                <div className="min-w-0 flex-1 space-y-0.5 sm:space-y-1">
                  <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs text-[#777780] dark:text-[#9E9EA9]">
                    <span className="font-semibold text-[#E43136]">{bookDisplayData.category}</span>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-0.5 text-[#202020] dark:text-[#F4F4F6] font-semibold tabular-nums">
                      <Star className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-[#E6A02C] text-[#E6A02C]" />
                      {bookDisplayData.rating.toFixed(1)}
                    </span>
                  </div>

                  <Link
                    to={`/book/${bookDisplayData.id}`}
                    className="block font-display text-xs sm:text-base font-bold text-[#202020] dark:text-[#F4F4F6] hover:text-[#E43136] transition-colors line-clamp-1"
                  >
                    {bookDisplayData.title}
                  </Link>

                  <p className="text-[11px] sm:text-xs text-[#777780] dark:text-[#9E9EA9] truncate">
                    by {bookDisplayData.authorName}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-1.5 shrink-0">
                <Link
                  to={`/read/${bookDisplayData.id}`}
                  className="py-1.5 px-3 sm:py-2 sm:px-4 rounded-lg sm:rounded-xl bg-[#E43136] hover:bg-[#B9272D] text-white text-[11px] sm:text-xs font-semibold inline-flex items-center justify-center gap-1 transition-colors whitespace-nowrap"
                >
                  <BookOpen className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  <span>Read</span>
                </Link>

                {liveBookFromCatalog && (
                  <button
                    type="button"
                    onClick={() => toggleSaveBook(liveBookFromCatalog)}
                    className={`py-1 px-2.5 sm:py-2 sm:px-3.5 rounded-lg sm:rounded-xl border text-[11px] sm:text-xs font-semibold inline-flex items-center justify-center gap-1 transition-colors whitespace-nowrap cursor-pointer ${
                      isBookSaved
                        ? 'bg-[#FFF3F4] dark:bg-[#2D1619] border-[#E43136] text-[#E43136]'
                        : 'bg-white dark:bg-[#16161A] border-[#DDDDE3] dark:border-[#2C2C35] text-[#202020] dark:text-[#F4F4F6] hover:border-[#E43136]'
                    }`}
                  >
                    <Bookmark className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${isBookSaved ? 'fill-[#E43136]' : ''}`} />
                    <span>{isBookSaved ? 'Saved' : 'Save'}</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* 3. SOCIAL ENGAGEMENT BAR (Like, Comment, Share, Save)             */}
      {/* ================================================================= */}
      <div className="pt-2 sm:pt-2.5 border-t border-[#F1F1F4] dark:border-[#2C2C35] flex items-center justify-between gap-1.5 sm:gap-2 text-[11px] sm:text-xs text-[#777780] dark:text-[#9E9EA9] tabular-nums">
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={handleToggleLike}
            className={`py-1 px-2.5 sm:py-1.5 sm:px-3 rounded-lg sm:rounded-xl inline-flex items-center gap-1 sm:gap-1.5 font-semibold transition-all cursor-pointer ${
              isLikedByMe
                ? 'text-[#E43136] bg-[#FFF3F4] dark:bg-[#2D1619]'
                : 'hover:text-[#E43136] hover:bg-[#FAFAFB] dark:hover:bg-[#1F1F26]'
            }`}
          >
            <Heart
              className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform duration-200 ${
                isLikedByMe ? 'fill-[#E43136]' : ''
              } ${likePop ? 'scale-125' : 'scale-100'}`}
            />
            <span>
              {effectiveLikesCount > 0
                ? `${effectiveLikesCount.toLocaleString()}`
                : 'Like'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setShowAllComments((prev) => !prev)}
            className={`py-1 px-2.5 sm:py-1.5 sm:px-3 rounded-lg sm:rounded-xl inline-flex items-center gap-1 sm:gap-1.5 font-semibold transition-colors cursor-pointer ${
              showAllComments || effectiveCommentsCount > 0
                ? 'text-[#202020] dark:text-[#F4F4F6] hover:text-[#E43136] hover:bg-[#FAFAFB] dark:hover:bg-[#1F1F26]'
                : 'hover:text-[#202020] dark:hover:text-white hover:bg-[#FAFAFB] dark:hover:bg-[#1F1F26]'
            }`}
          >
            <MessageCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#E43136]" />
            <span>
              {effectiveCommentsCount > 0
                ? `${effectiveCommentsCount}`
                : 'Comment'}
            </span>
          </button>

          <button
            type="button"
            onClick={handleShare}
            className="py-1 px-2.5 sm:py-1.5 sm:px-3 rounded-lg sm:rounded-xl inline-flex items-center gap-1 sm:gap-1.5 font-semibold hover:text-[#202020] dark:hover:text-white hover:bg-[#FAFAFB] dark:hover:bg-[#1F1F26] transition-colors cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Share</span>
          </button>
        </div>

        {liveBookFromCatalog && (
          <button
            type="button"
            onClick={() => toggleSaveBook(liveBookFromCatalog)}
            aria-label="Save book"
            className={`py-1 px-2 sm:py-1.5 sm:px-2.5 rounded-lg sm:rounded-xl inline-flex items-center gap-1 font-semibold transition-colors cursor-pointer ${
              isBookSaved
                ? 'text-[#E43136] bg-[#FFF3F4] dark:bg-[#2D1619]'
                : 'hover:text-[#E43136] hover:bg-[#FAFAFB] dark:hover:bg-[#1F1F26]'
            }`}
          >
            <Bookmark className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isBookSaved ? 'fill-[#E43136]' : ''}`} />
            <span className="hidden sm:inline">{isBookSaved ? 'Saved' : 'Save'}</span>
          </button>
        )}
      </div>

      {/* ================================================================= */}
      {/* 4. LIKED BY BAR & PROFESSIONAL THREADED COMMENT SYSTEM            */}
      {/* ================================================================= */}
      <LikedByBar
        postId={item.id}
        baseLikesCount={effectiveLikesCount}
        bookForSync={item.activityType === 'story_publication' ? liveBookFromCatalog : null}
      />

      <CommentThread
        postId={item.id}
        postAuthorId={item.authorId}
        postAuthorName={item.authorName}
        backingPost={item.backingPost}
        targetTitle={bookDisplayData?.title || item.text.slice(0, 60)}
        postLink={postTargetLink}
        expanded={showAllComments}
        onToggleExpand={setShowAllComments}
      />
    </article>
  );
};
