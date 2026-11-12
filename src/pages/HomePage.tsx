import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Flame,
  Users,
  Star,
  UserPlus,
  UserCheck,
  BookOpen,
  Heart,
  BookMarked,
} from 'lucide-react';
import { useRedcover } from '../contexts/RedcoverContext';
import {
  Book,
  FeedFilterType,
  SocialPostType,
  UserProfile,
} from '../models/types';
import { BookCover, UserAvatar } from '../components/common/UIPrimitives';
import { SocialFeedCard, UnifiedFeedItem } from '../components/social/SocialFeedCard';
import { PublicLandingPage } from './PublicLandingPage';

function formatRelativeTimeShort(iso: string): string {
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

const FEED_TABS: {
  id: FeedFilterType;
  label: string;
}[] = [
  { id: 'for_you', label: 'For You' },
  { id: 'following', label: 'Following' },
  { id: 'latest', label: 'Latest' },
  { id: 'trending', label: 'Trending' },
];

export const HomePage: React.FC = () => {
  const {
    books,
    users,
    reviews,
    booksLoading,
    savedBooks,
    likedBooks,
    readingProgress,
    publicReadingProgress,
    socialPosts,
    postLikes,
    postComments,
    follows,
    friendships,
    firebaseUser,
    currentUser,
    toggleFollowUser,
  } = useRedcover();

  const [feedFilter, setFeedFilter] = useState<FeedFilterType>('for_you');
  const [visibleFeedCount, setVisibleFeedCount] = useState<number>(25);

  const blockedSet = useMemo(() => {
    const s = new Set<string>();
    if (!firebaseUser) return s;
    friendships.forEach((f) => {
      if (f.status === 'blocked') {
        if (f.requesterId === firebaseUser.uid) s.add(f.receiverId);
        if (f.receiverId === firebaseUser.uid) s.add(f.requesterId);
      }
    });
    return s;
  }, [friendships, firebaseUser]);

  const followingIds = useMemo(() => {
    if (!firebaseUser) return new Set<string>();
    return new Set(
      follows
        .filter((f) => f.followerId === firebaseUser.uid)
        .map((f) => f.followingId)
    );
  }, [follows, firebaseUser]);

  // All published books from Firebase
  const publishedBooks = useMemo(
    () => books.filter((b) => b.status === 'published' && !blockedSet.has(b.authorId)),
    [books, blockedSet]
  );

  // User's preferred categories & affinities from reading progress & saved books
  const { preferredCategories, categoryAffinities } = useMemo(() => {
    const cats = new Set<string>();
    const weights: Record<string, number> = {};
    readingProgress.forEach((p) => {
      const b = publishedBooks.find((item) => item.id === p.bookId);
      if (b?.category) {
        const cat = b.category.toLowerCase();
        cats.add(cat);
        weights[cat] = (weights[cat] || 0) + 3;
      }
    });
    savedBooks.forEach((s) => {
      const b = publishedBooks.find((item) => item.id === s.bookId);
      if (b?.category) {
        const cat = b.category.toLowerCase();
        cats.add(cat);
        weights[cat] = (weights[cat] || 0) + 2;
      }
    });
    return { preferredCategories: cats, categoryAffinities: weights };
  }, [readingProgress, savedBooks, publishedBooks]);

  // Synthesize Instagram-style Unified Book & Social Feed from real Firestore collections
  const allFeedItems: UnifiedFeedItem[] = useMemo(() => {
    const items: UnifiedFeedItem[] = [];
    const seenKeys = new Set<string>();

    // 1. All Published Books & Stories from /books (ensures every book is in the feed)
    publishedBooks.forEach((book) => {
      const hasExplicitPublicationPost = socialPosts.some(
        (p) =>
          p.authorId === book.authorId &&
          p.bookId === book.id &&
          p.postType === 'story_publication'
      );
      if (hasExplicitPublicationPost) return;

      const authorUser = users.find((u) => u.uid === book.authorId);
      items.push({
        id: `book_pub_${book.id}`,
        authorId: book.authorId,
        authorName: book.authorName || authorUser?.displayName || 'Redcover Author',
        authorUsername:
          book.authorUsername ||
          authorUser?.username ||
          (book.authorName || 'author').toLowerCase().replace(/[^a-z0-9]/g, ''),
        authorAvatar: authorUser?.photoURL || book.authorAvatar || '',
        activityType: 'story_publication',
        activityLabel:
          book.chaptersCount > 1 ? 'published a multi-chapter story' : 'published a book',
        text:
          book.description ||
          book.shortDescription ||
          `Published "${book.title}" in ${book.category}. Read it now on Redcover!`,
        book,
        bookId: book.id,
        bookTitle: book.title,
        bookAuthor: book.authorName,
        bookCover: book.coverURL,
        bookCategory: book.category,
        rating: book.rating,
        progressPercentage: 0,
        chapterNumber: 0,
        totalChapters: book.chaptersCount,
        createdAt: book.createdAt,
        backingPost: null,
        baseLikesCount: book.likes || 0,
        baseCommentsCount: 0,
      });
    });

    // 2. Explicit Social Posts from /posts (excluding reading milestone/progress updates)
    socialPosts.forEach((post) => {
      if (blockedSet.has(post.authorId)) return;
      if (post.postType === 'reading_achievement' || post.postType === 'reading_update') return;
      const matchedBook = post.bookId
        ? publishedBooks.find((b) => b.id === post.bookId) || null
        : post.bookTitle
        ? publishedBooks.find(
            (b) => b.title.toLowerCase() === post.bookTitle.toLowerCase()
          ) || null
        : null;

      const labelMap: Record<SocialPostType, string> = {
        discussion: 'started a discussion',
        book_recommendation: 'recommended a book',
        book_review: 'reviewed a book',
        reading_update: 'shared reading progress',
        reading_achievement: 'celebrated a reading milestone',
        story_publication: 'published a story',
      };

      const dedupSig = `${post.authorId}_${post.postType}_${post.bookId}_${post.text.slice(0, 40)}`;
      seenKeys.add(dedupSig);

      items.push({
        id: `post_${post.id}`,
        authorId: post.authorId,
        authorName: post.authorName,
        authorUsername: post.authorUsername,
        authorAvatar: post.authorAvatar,
        activityType: post.postType,
        activityLabel: labelMap[post.postType] || 'shared an update',
        text: post.text,
        book: matchedBook,
        bookId: post.bookId || matchedBook?.id || '',
        bookTitle: post.bookTitle || matchedBook?.title || '',
        bookAuthor: post.bookAuthor || matchedBook?.authorName || '',
        bookCover: matchedBook?.coverURL || post.bookCover || '',
        bookCategory: post.bookCategory || matchedBook?.category || '',
        rating: post.rating ?? matchedBook?.rating ?? 0,
        progressPercentage: post.progressPercentage || 0,
        chapterNumber: post.chapterNumber || 0,
        totalChapters: matchedBook?.chaptersCount || 1,
        createdAt: post.createdAt,
        backingPost: post,
        baseLikesCount: post.likesCount || 0,
        baseCommentsCount: post.commentsCount || 0,
      });
    });

    // 3. Real Book Reviews from /reviews
    reviews.forEach((rev) => {
      if (blockedSet.has(rev.userId)) return;
      const matchedBook = publishedBooks.find((b) => b.id === rev.bookId) || null;
      const dedupSig = `${rev.userId}_book_review_${rev.bookId}_${rev.text.slice(0, 40)}`;
      if (seenKeys.has(dedupSig)) return;
      seenKeys.add(dedupSig);

      const reviewerUser = users.find((u) => u.uid === rev.userId);
      items.push({
        id: `review_${rev.id}`,
        authorId: rev.userId,
        authorName: rev.userName || reviewerUser?.displayName || 'Redcover Reader',
        authorUsername:
          reviewerUser?.username ||
          (rev.userName || 'reader').toLowerCase().replace(/[^a-z0-9]/g, ''),
        authorAvatar: reviewerUser?.photoURL || rev.userAvatar || '',
        activityType: 'book_review',
        activityLabel: 'wrote a book review',
        text: rev.text,
        book: matchedBook,
        bookId: rev.bookId,
        bookTitle: matchedBook?.title || rev.bookTitle || 'Redcover Book',
        bookAuthor: matchedBook?.authorName || '',
        bookCover: matchedBook?.coverURL || '',
        bookCategory: matchedBook?.category || 'Fiction',
        rating: rev.rating ?? 0,
        progressPercentage: 0,
        chapterNumber: 0,
        totalChapters: matchedBook?.chaptersCount || 1,
        createdAt: rev.createdAt,
        backingPost: null,
        baseLikesCount: 0,
        baseCommentsCount: 0,
      });
    });

    return items;
  }, [
    publishedBooks,
    socialPosts,
    reviews,
    users,
    blockedSet,
  ]);

  // Filter & Sort Unified Feed based on feedFilter
  const filteredFeedItems = useMemo(() => {
    let list = [...allFeedItems];

    // Feed tab filter
    if (feedFilter === 'following') {
      list = list.filter(
        (item) =>
          followingIds.has(item.authorId) ||
          (firebaseUser && item.authorId === firebaseUser.uid)
      );
    }

    const getEngagementScore = (item: UnifiedFeedItem) => {
      const cleanKey = item.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
      const liveLikes = postLikes.filter((l) => l.postId === cleanKey).length;
      const liveComments = postComments.filter((c) => c.postId === cleanKey).length;
      const totalLikes = Math.max(item.baseLikesCount, liveLikes);
      const totalComments = Math.max(item.baseCommentsCount, liveComments);
      const bookReadsBoost = item.book ? Math.min(25, Math.floor(item.book.views / 100)) : 0;
      return totalLikes * 3 + totalComments * 5 + bookReadsBoost;
    };

    if (feedFilter === 'latest' || feedFilter === 'following') {
      list.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } else if (feedFilter === 'trending') {
      list.sort((a, b) => {
        const diff = getEngagementScore(b) - getEngagementScore(a);
        if (diff !== 0) return diff;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    } else {
      // 'for_you': AI recommendation algorithm matching user's reading taste, saved books, and social connections
      const scoredList = list.map((item) => {
        let aiScore = 0;
        let aiReason: string | undefined = undefined;

        const ageHours = Math.max(
          0.5,
          (Date.now() - new Date(item.createdAt).getTime()) / (1000 * 60 * 60)
        );
        // Base recency decay
        aiScore += Math.max(10, 100 - ageHours * 1.2);

        // Category affinity
        const cat = (item.bookCategory || '').toLowerCase();
        const catWeight = categoryAffinities[cat] || 0;
        if (catWeight > 0) {
          aiScore += Math.min(80, catWeight * 18);
          aiReason = `Based on your interest in ${item.bookCategory}`;
        }

        // Following affinity
        if (followingIds.has(item.authorId)) {
          aiScore += 45;
          if (!aiReason) aiReason = 'From an author you follow';
        }

        // Engagement score
        const engagement = getEngagementScore(item);
        aiScore += Math.min(40, engagement * 2);
        if (!aiReason && engagement >= 5) {
          aiReason = 'Popular in community';
        }

        // Author self-boost for fresh items
        if (firebaseUser && item.authorId === firebaseUser.uid && ageHours < 48) {
          aiScore += 50;
        }

        return {
          ...item,
          aiRecommendationReason: aiScore > 85 ? aiReason : undefined,
          _aiScore: aiScore,
        };
      });

      scoredList.sort((a, b) => b._aiScore - a._aiScore);
      return scoredList;
    }

    return list;
  }, [
    allFeedItems,
    feedFilter,
    followingIds,
    firebaseUser,
    postLikes,
    postComments,
    categoryAffinities,
  ]);

  const visibleFeed = useMemo(
    () => filteredFeedItems.slice(0, visibleFeedCount),
    [filteredFeedItems, visibleFeedCount]
  );

  // Community Currently Reading (Public reading progress)
  const communityReadingList = useMemo(() => {
    const seenUserBook = new Set<string>();
    const list: {
      id: string;
      userId: string;
      userName: string;
      userUsername: string;
      userAvatar: string;
      bookId: string;
      bookTitle: string;
      bookAuthor: string;
      bookCover: string;
      bookCategory: string;
      book?: Book;
      percentage: number;
      currentChapter: number;
      totalChapters: number;
      lastReadAt: string;
    }[] = [];

    publicReadingProgress.forEach((prog) => {
      if (!prog.isPublic || blockedSet.has(prog.userId)) return;
      const key = `${prog.userId}_${prog.bookId}`;
      if (seenUserBook.has(key)) return;
      seenUserBook.add(key);

      const matchedBook = publishedBooks.find(
        (b) =>
          b.id === prog.bookId ||
          (prog.bookTitle && b.title.toLowerCase() === prog.bookTitle.toLowerCase())
      );
      const reader = users.find((u) => u.uid === prog.userId);
      list.push({
        id: prog.id,
        userId: prog.userId,
        userName:
          reader?.displayName ||
          (firebaseUser?.uid === prog.userId
            ? currentUser?.displayName || 'You'
            : 'Redcover Reader'),
        userUsername:
          reader?.username ||
          (firebaseUser?.uid === prog.userId ? currentUser?.username || 'reader' : 'reader'),
        userAvatar: reader?.photoURL || '',
        bookId: matchedBook?.id || prog.bookId,
        bookTitle: matchedBook?.title || prog.bookTitle || 'Redcover Story',
        bookAuthor: matchedBook?.authorName || prog.bookAuthor || 'Author',
        bookCover: matchedBook?.coverURL || prog.bookCover || '',
        bookCategory: matchedBook?.category || 'Fiction',
        book: matchedBook,
        percentage: prog.percentage,
        currentChapter: prog.currentChapter,
        totalChapters: prog.totalChapters || matchedBook?.chaptersCount || 1,
        lastReadAt: prog.updatedAt || prog.createdAt,
      });
    });

    return list.slice(0, 5);
  }, [
    publicReadingProgress,
    blockedSet,
    publishedBooks,
    users,
    firebaseUser,
    currentUser,
  ]);

  // Trending Community Books (Right sidebar)
  const trendingBooksSidebar = useMemo(
    () =>
      [...publishedBooks]
        .sort((a, b) => b.likes * 3 + b.views - (a.likes * 3 + a.views))
        .slice(0, 4),
    [publishedBooks]
  );

  // Suggested Readers & Authors
  const suggestedUsers = useMemo(() => {
    const candidates: UserProfile[] = [...users];

    publishedBooks.forEach((b) => {
      if (b.authorId && !candidates.some((u) => u.uid === b.authorId)) {
        candidates.push({
          uid: b.authorId,
          username:
            b.authorUsername ||
            b.authorName.toLowerCase().replace(/[^a-z0-9]/g, '') ||
            'author',
          displayName: b.authorName,
          photoURL: b.authorAvatar || '',
          coverURL: '',
          bio: `Author of "${b.title}" (${b.category})`,
          followersCount: 0,
          followingCount: 0,
          booksCount: 1,
          streakDays: 0,
          points: 0,
          membershipPlan: 'free',
          isOnline: false,
          showOnlineStatus: true,
          publicActivity: true,
          role: 'author',
          createdAt: b.createdAt,
          updatedAt: b.createdAt,
        });
      }
    });

    return candidates
      .filter((u) => u.uid && u.uid !== firebaseUser?.uid && !blockedSet.has(u.uid))
      .sort((a, b) => {
        const aFollowed = followingIds.has(a.uid) ? 1 : 0;
        const bFollowed = followingIds.has(b.uid) ? 1 : 0;
        if (aFollowed !== bFollowed) return aFollowed - bFollowed;
        return b.booksCount * 5 + b.followersCount - (a.booksCount * 5 + a.followersCount);
      })
      .slice(0, 5);
  }, [users, publishedBooks, firebaseUser, blockedSet, followingIds]);

  // Personal Reading Journey Stats (100% Backend-Driven)
  const myReadingStats = useMemo(() => {
    const completed = readingProgress.filter((p) => p.percentage >= 100).length;
    const inProgress = readingProgress.filter(
      (p) => p.percentage > 0 && p.percentage < 100
    ).length;
    return {
      completed,
      inProgress,
      saved: savedBooks.length,
    };
  }, [readingProgress, savedBooks.length, currentUser]);

  const myRecentReadBooks = useMemo(() => {
    if (!firebaseUser) return [];
    return readingProgress
      .filter((progress) => progress.userId === firebaseUser.uid && progress.percentage > 0)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .map((progress) => books.find((book) => book.id === progress.bookId))
      .filter((book): book is Book => Boolean(book))
      .slice(0, 5);
  }, [books, firebaseUser?.uid, readingProgress]);

  const myLikedBooks = useMemo(() => {
    if (!firebaseUser) return [];
    return likedBooks
      .filter((like) => like.userId === firebaseUser.uid)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((like) => books.find((book) => book.id === like.bookId))
      .filter((book): book is Book => Boolean(book))
      .slice(0, 5);
  }, [books, firebaseUser?.uid, likedBooks]);

  // If visitor is logged out, render the professional Redcover Public Landing Page
  if (!firebaseUser) {
    return <PublicLandingPage />;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-8 items-start">
      {/* ================================================================= */}
      {/* INSTAGRAM-STYLE MAIN BOOKS & SOCIAL FEED COLUMN                   */}
      {/* ================================================================= */}
      <div className="lg:col-span-8 space-y-3 sm:space-y-4 min-w-0">
        {firebaseUser && (
          <>
            <section
              aria-label="Recently read books"
              className="rounded-xl border border-[#DDDDE3] bg-white p-3 dark:border-[#2C2C35] dark:bg-[#16161A] sm:rounded-2xl sm:p-4"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-sm font-bold text-[#202020] dark:text-[#F4F4F6]">Recently Read</h2>
                <Link to="/hub/history" className="shrink-0 text-xs font-semibold text-[#E43136] hover:underline">
                  More
                </Link>
              </div>
              {myRecentReadBooks.length > 0 ? (
                <div className="flex snap-x gap-3 overflow-x-auto pb-1 no-scrollbar">
                  {myRecentReadBooks.map((book) => (
                    <Link
                      key={book.id}
                      to={`/read/${book.id}`}
                      className="w-28 shrink-0 snap-start sm:w-32"
                    >
                      <div className="mb-2 aspect-[3/4] overflow-hidden rounded-lg">
                        <BookCover book={book} size="sm" className="h-full w-full" />
                      </div>
                      <p className="truncate text-xs font-semibold text-[#202020] dark:text-[#F4F4F6]">
                        {book.title}
                      </p>
                      <p className="truncate text-[11px] text-[#777780] dark:text-[#9E9EA9]">
                        {book.authorName}
                      </p>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="py-4 text-center text-xs text-[#777780] dark:text-[#9E9EA9]">
                  Books you start reading will appear here.
                </p>
              )}
            </section>

            <section
              aria-label="Liked books"
              className="rounded-xl border border-[#DDDDE3] bg-white p-3 dark:border-[#2C2C35] dark:bg-[#16161A] sm:rounded-2xl sm:p-4"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-sm font-bold text-[#202020] dark:text-[#F4F4F6]">Liked Books</h2>
                {currentUser && (
                  <Link
                    to={`/profile/${currentUser.uid}?tab=likes`}
                    className="shrink-0 text-xs font-semibold text-[#E43136] hover:underline"
                  >
                    More
                  </Link>
                )}
              </div>
              {myLikedBooks.length > 0 ? (
                <div className="flex snap-x gap-3 overflow-x-auto pb-1 no-scrollbar">
                  {myLikedBooks.map((book) => (
                    <Link
                      key={book.id}
                      to={`/book/${book.id}`}
                      className="w-28 shrink-0 snap-start sm:w-32"
                    >
                      <div className="mb-2 aspect-[3/4] overflow-hidden rounded-lg">
                        <BookCover book={book} size="sm" className="h-full w-full" />
                      </div>
                      <p className="truncate text-xs font-semibold text-[#202020] dark:text-[#F4F4F6]">
                        {book.title}
                      </p>
                      <p className="truncate text-[11px] text-[#777780] dark:text-[#9E9EA9]">
                        {book.authorName}
                      </p>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="py-4 text-center text-xs text-[#777780] dark:text-[#9E9EA9]">
                  Books you like will appear here.
                </p>
              )}
            </section>
          </>
        )}

        {/* Feed Filter Tabs: For You | Following | Latest | Trending */}
        <div className="bg-white dark:bg-[#16161A] rounded-xl sm:rounded-2xl border border-[#DDDDE3] dark:border-[#2C2C35] p-1 sm:p-1.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            {FEED_TABS.map((tab) => {
              const isActive = feedFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setFeedFilter(tab.id);
                    setVisibleFeedCount(25);
                  }}
                  className={`py-1.5 px-3 sm:py-2 sm:px-4 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
                      ? 'bg-[#E43136] text-white'
                      : 'text-[#777780] dark:text-[#9E9EA9] hover:text-[#202020] dark:hover:text-white hover:bg-[#FAFAFB] dark:hover:bg-[#1F1F26]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <span className="px-2.5 sm:px-3 text-[10px] sm:text-[11px] font-medium text-[#777780] dark:text-[#9E9EA9] whitespace-nowrap">
            {filteredFeedItems.length} {filteredFeedItems.length === 1 ? 'post' : 'posts'}
          </span>
        </div>

        {/* Continuous Instagram-Style Books & Activity Feed */}
          {booksLoading ? (
            <div className="space-y-3 sm:space-y-4">
              {Array.from({ length: 3 }).map((_, idx) => (
                <div
                  key={idx}
                  className="bg-white dark:bg-[#16161A] rounded-xl sm:rounded-2xl border border-[#DDDDE3] dark:border-[#2C2C35] p-3.5 sm:p-5 space-y-3 sm:space-y-4 animate-pulse"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[#EAEAEF] dark:bg-[#22222A]" />
                    <div className="space-y-1.5 flex-1">
                      <div className="h-3.5 w-40 bg-[#EAEAEF] dark:bg-[#22222A] rounded" />
                      <div className="h-2.5 w-24 bg-[#EAEAEF] dark:bg-[#22222A] rounded" />
                    </div>
                  </div>
                  <div className="h-4 w-3/4 bg-[#EAEAEF] dark:bg-[#22222A] rounded" />
                  <div className="h-28 sm:h-44 w-full bg-[#EAEAEF] dark:bg-[#22222A] rounded-xl" />
                </div>
              ))}
            </div>
          ) : visibleFeed.length > 0 ? (
            <div className="space-y-3 sm:space-y-5">
              {visibleFeed.map((item) => (
                <SocialFeedCard key={item.id} item={item} />
              ))}

              {visibleFeedCount < filteredFeedItems.length && (
                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => setVisibleFeedCount((prev) => prev + 15)}
                    className="py-2.5 px-6 rounded-xl bg-white dark:bg-[#16161A] border border-[#DDDDE3] dark:border-[#2C2C35] hover:border-[#E43136] text-xs font-semibold text-[#202020] dark:text-[#F4F4F6] transition-colors cursor-pointer"
                  >
                    Load More Posts ({filteredFeedItems.length - visibleFeedCount} more)
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white dark:bg-[#16161A] rounded-2xl border border-[#DDDDE3] dark:border-[#2C2C35] p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-[#FFF3F4] dark:bg-[#2D1619] text-[#E43136] flex items-center justify-center mx-auto">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="font-display text-base font-bold text-[#202020] dark:text-[#F4F4F6]">
                {feedFilter === 'following'
                  ? 'You Are Not Following Any Readers or Authors Yet'
                  : 'No Posts in Feed Yet'}
              </h3>
              <p className="text-xs text-[#777780] dark:text-[#9E9EA9] max-w-md mx-auto">
                {feedFilter === 'following'
                  ? 'Follow authors and readers to see their books, reviews, and reading updates in your Following feed.'
                  : 'Books, reviews, and reading updates will appear here in real time.'}
              </p>
              {feedFilter === 'following' && (
                <button
                  type="button"
                  onClick={() => setFeedFilter('for_you')}
                  className="py-2 px-4 rounded-xl bg-[#E43136] hover:bg-[#B9272D] text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  Switch to "For You" Feed
                </button>
              )}
            </div>
          )}
        </div>

        {/* ================================================================= */}
        {/* SECONDARY COMMUNITY SIDEBAR (Desktop Only — Pinned with independent hover-scroll)   */}
        {/* ================================================================= */}
        <aside className="hidden lg:block lg:col-span-4 sticky top-4 max-h-[calc(100vh-5rem)] overflow-y-auto no-scrollbar space-y-5 min-w-0 pr-1">
          {/* WIDGET 1: SUGGESTED READERS & AUTHORS */}
          <section
            aria-label="Suggested Readers and Authors"
            className="bg-white dark:bg-[#16161A] rounded-2xl border border-[#DDDDE3] dark:border-[#2C2C35] p-5 space-y-4"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#FFF3F4] dark:bg-[#2D1619] text-[#E43136] flex items-center justify-center shrink-0">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="font-display text-sm font-bold text-[#202020] dark:text-[#F4F4F6]">
                    Suggested Readers &amp; Authors
                  </h2>
                  <p className="text-[11px] text-[#777780] dark:text-[#9E9EA9]">
                    Writers and readers to follow
                  </p>
                </div>
              </div>
            </div>

            {suggestedUsers.length > 0 ? (
              <div className="space-y-3">
                {suggestedUsers.map((person) => {
                  const isFollowing = followingIds.has(person.uid);
                  return (
                    <div
                      key={person.uid}
                      className="p-3 rounded-xl bg-[#FAFAFB] dark:bg-[#0F0F12] border border-[#F1F1F4] dark:border-[#2C2C35] flex items-center justify-between gap-3"
                    >
                      <Link
                        to={`/profile/${person.uid}`}
                        className="flex items-center gap-2.5 min-w-0 group"
                      >
                        <UserAvatar user={person} size="md" showPresence />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[#202020] dark:text-[#F4F4F6] group-hover:text-[#E43136] truncate">
                            {person.displayName}
                          </p>
                          <p className="text-[11px] text-[#777780] dark:text-[#9E9EA9] truncate">
                            @{person.username}
                            {person.booksCount > 0
                              ? ` · ${person.booksCount} ${
                                  person.booksCount === 1 ? 'book' : 'books'
                                }`
                              : ''}
                          </p>
                        </div>
                      </Link>

                      <button
                        type="button"
                        onClick={() => toggleFollowUser(person)}
                        className={`py-1.5 px-3 rounded-xl text-xs font-semibold inline-flex items-center gap-1 transition-colors shrink-0 cursor-pointer ${
                          isFollowing
                            ? 'bg-[#F1F1F4] dark:bg-[#1F1F26] text-[#202020] dark:text-[#F4F4F6]'
                            : 'bg-[#E43136] text-white hover:bg-[#B9272D]'
                        }`}
                      >
                        {isFollowing ? (
                          <>
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>Following</span>
                          </>
                        ) : (
                          <>
                            <UserPlus className="w-3.5 h-3.5" />
                            <span>Follow</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-[#777780] dark:text-[#9E9EA9]">
                More community readers and authors will appear here as they join Redcover.
              </p>
            )}
          </section>

          {/* WIDGET 2: WHAT READERS ARE READING */}
          <section
            aria-label="What Readers Are Reading"
            className="bg-white dark:bg-[#16161A] rounded-2xl border border-[#DDDDE3] dark:border-[#2C2C35] p-5 space-y-4"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#FFF3F4] dark:bg-[#2D1619] text-[#E43136] flex items-center justify-center shrink-0">
                  <BookMarked className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="font-display text-sm font-bold text-[#202020] dark:text-[#F4F4F6]">
                    What Readers Are Reading
                  </h2>
                  <p className="text-[11px] text-[#777780] dark:text-[#9E9EA9]">
                    Live community reading sessions
                  </p>
                </div>
              </div>
              {firebaseUser && (
                <Link
                  to="/hub/history"
                  className="text-xs font-semibold text-[#E43136] hover:underline whitespace-nowrap"
                >
                  History
                </Link>
              )}
            </div>

            {communityReadingList.length > 0 ? (
              <div className="space-y-3">
                {communityReadingList.map((entry) => (
                  <div
                    key={entry.id}
                    className="p-3.5 rounded-xl bg-[#FAFAFB] dark:bg-[#0F0F12] border border-[#F1F1F4] dark:border-[#2C2C35] space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Link
                        to={`/profile/${entry.userId}`}
                        className="flex items-center gap-2 min-w-0 group"
                      >
                        <UserAvatar
                          user={{
                            displayName: entry.userName,
                            photoURL: entry.userAvatar,
                          }}
                          size="xs"
                        />
                        <span className="text-xs font-semibold text-[#202020] dark:text-[#F4F4F6] group-hover:text-[#E43136] truncate">
                          {entry.userName}
                        </span>
                      </Link>
                      <span className="text-[11px] font-bold text-[#E43136] tabular-nums shrink-0">
                        {entry.percentage}%
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <Link
                        to={`/read/${entry.bookId}`}
                        className="w-11 aspect-[3/4] shrink-0 rounded-lg overflow-hidden shadow-2xs"
                      >
                        <BookCover
                          book={
                            entry.book || {
                              id: entry.bookId,
                              title: entry.bookTitle,
                              authorName: entry.bookAuthor,
                              coverURL: entry.bookCover,
                              category: entry.bookCategory,
                            }
                          }
                          size="xs"
                          className="w-full h-full"
                        />
                      </Link>
                      <div className="min-w-0 flex-1 space-y-1">
                        <Link
                          to={`/book/${entry.bookId}`}
                          className="block text-xs font-bold text-[#202020] dark:text-[#F4F4F6] hover:text-[#E43136] truncate"
                        >
                          {entry.bookTitle}
                        </Link>
                        <p className="text-[11px] text-[#777780] dark:text-[#9E9EA9] truncate">
                          Ch. {Math.max(1, entry.currentChapter)} of {entry.totalChapters} ·{' '}
                          {formatRelativeTimeShort(entry.lastReadAt)}
                        </p>
                        <div className="w-full h-1.5 bg-[#EAEAEF] dark:bg-[#262630] rounded-full overflow-hidden">
                          <div
                            style={{
                              width: `${Math.min(100, Math.max(5, entry.percentage))}%`,
                            }}
                            className="h-full bg-[#E43136] rounded-full"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-[#FAFAFB] dark:bg-[#0F0F12] border border-[#F1F1F4] dark:border-[#2C2C35] text-center space-y-2">
                <p className="text-xs font-semibold text-[#202020] dark:text-[#F4F4F6]">
                  No Public Reading Sessions Yet
                </p>
                <p className="text-[11px] text-[#777780] dark:text-[#9E9EA9]">
                  Open any book in the Redcover Reader to share your live chapter progress.
                </p>
              </div>
            )}
          </section>

          {/* WIDGET 3: TRENDING IN THE COMMUNITY */}
          <section
            aria-label="Trending in the Community"
            className="bg-white dark:bg-[#16161A] rounded-2xl border border-[#DDDDE3] dark:border-[#2C2C35] p-5 space-y-4"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#FFF3F4] dark:bg-[#2D1619] text-[#E43136] flex items-center justify-center shrink-0">
                  <Flame className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="font-display text-sm font-bold text-[#202020] dark:text-[#F4F4F6]">
                    Trending Books
                  </h2>
                  <p className="text-[11px] text-[#777780] dark:text-[#9E9EA9]">
                    Most read stories right now
                  </p>
                </div>
              </div>
              <Link
                to="/explore"
                className="text-xs font-semibold text-[#E43136] hover:underline"
              >
                Explore
              </Link>
            </div>

            {trendingBooksSidebar.length > 0 ? (
              <div className="space-y-3">
                {trendingBooksSidebar.map((book, index) => (
                  <div
                    key={book.id}
                    className="flex items-center gap-3 p-2.5 rounded-xl bg-[#FAFAFB] dark:bg-[#0F0F12] border border-[#F1F1F4] dark:border-[#2C2C35] hover:border-[#E43136]/30 transition-colors"
                  >
                    <Link
                      to={`/book/${book.id}`}
                      className="w-12 aspect-[3/4] shrink-0 rounded-lg overflow-hidden shadow-2xs relative"
                    >
                      <BookCover book={book} size="xs" className="w-full h-full" />
                      <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-[#E43136] text-white font-mono-tabular text-[9px] font-bold">
                        #{index + 1}
                      </span>
                    </Link>

                    <div className="min-w-0 flex-1 space-y-0.5">
                      <span className="block text-[10px] font-semibold text-[#E43136] uppercase tracking-wider truncate">
                        {book.category}
                      </span>
                      <Link
                        to={`/book/${book.id}`}
                        className="block text-xs font-bold text-[#202020] dark:text-[#F4F4F6] hover:text-[#E43136] truncate"
                      >
                        {book.title}
                      </Link>
                      <p className="text-[11px] text-[#777780] dark:text-[#9E9EA9] truncate">
                        by {book.authorName}
                      </p>
                      <div className="flex items-center gap-2 pt-0.5 text-[11px] text-[#777780] dark:text-[#9E9EA9] tabular-nums">
                        <span className="inline-flex items-center gap-0.5 text-[#202020] dark:text-[#F4F4F6] font-semibold">
                          <Star className="w-3 h-3 fill-[#E6A02C] text-[#E6A02C]" />
                          {book.rating.toFixed(1)}
                        </span>
                        <span className="inline-flex items-center gap-0.5">
                          <Heart className="w-3 h-3 text-[#E43136]" />
                          {book.likes.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <Link
                      to={`/read/${book.id}`}
                      className="py-1.5 px-3 rounded-lg bg-[#FFF3F4] dark:bg-[#2D1619] text-[#E43136] hover:bg-[#E43136] hover:text-white text-xs font-semibold transition-colors shrink-0"
                    >
                      Read
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#777780] dark:text-[#9E9EA9]">
                Trending books will appear here as readers engage with stories.
              </p>
            )}
          </section>

          {/* WIDGET 4: YOUR READING JOURNEY */}
          {firebaseUser && (
            <section
              aria-label="Your Reading Journey"
              className="bg-white dark:bg-[#16161A] rounded-2xl border border-[#DDDDE3] dark:border-[#2C2C35] p-5 space-y-3.5"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#FFF3F4] dark:bg-[#2D1619] text-[#E43136] flex items-center justify-center shrink-0">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="font-display text-sm font-bold text-[#202020] dark:text-[#F4F4F6]">
                    Your Reading Journey
                  </h2>
                  <p className="text-[11px] text-[#777780] dark:text-[#9E9EA9]">
                    Live account stats
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                <div className="p-3 rounded-xl bg-[#FAFAFB] dark:bg-[#0F0F12] border border-[#F1F1F4] dark:border-[#2C2C35]">
                  <span className="block text-[11px] text-[#777780] dark:text-[#9E9EA9]">
                    Completed
                  </span>
                  <span className="font-display text-lg font-bold text-[#202020] dark:text-[#F4F4F6] tabular-nums">
                    {myReadingStats.completed}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-[#FAFAFB] dark:bg-[#0F0F12] border border-[#F1F1F4] dark:border-[#2C2C35]">
                  <span className="block text-[11px] text-[#777780] dark:text-[#9E9EA9]">
                    Reading
                  </span>
                  <span className="font-display text-lg font-bold text-[#202020] dark:text-[#F4F4F6] tabular-nums">
                    {myReadingStats.inProgress}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-[#FAFAFB] dark:bg-[#0F0F12] border border-[#F1F1F4] dark:border-[#2C2C35]">
                  <span className="block text-[11px] text-[#777780] dark:text-[#9E9EA9]">
                    Saved
                  </span>
                  <span className="font-display text-lg font-bold text-[#202020] dark:text-[#F4F4F6] tabular-nums">
                    {myReadingStats.saved}
                  </span>
                </div>
              </div>
            </section>
          )}
        </aside>
    </div>
  );
};
