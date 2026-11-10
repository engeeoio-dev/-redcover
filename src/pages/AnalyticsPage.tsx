import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp,
  BookOpen,
  Eye,
  Users,
  Award,
  Clock,
  Heart,
  Bookmark,
  Share2,
  KeyRound,
  Crown,
  ChevronRight,
  BarChart3,
  MessageSquare,
  Sparkles,
  ArrowUpRight,
  ShieldCheck,
} from 'lucide-react';
import { useRedcover } from '../contexts/RedcoverContext';
import { BookCover, UserAvatar } from '../components/common/UIPrimitives';
import { Book } from '../models/types';

export const AnalyticsPage: React.FC = () => {
  const { currentUser, books, readingProgress, savedBooks, likedBooks, reviews } = useRedcover();
  const [selectedBookId, setSelectedBookId] = useState<string>('all');

  const isMember = currentUser?.membershipPlan === 'premium';

  // User's published / authored books
  const myBooks = useMemo(() => {
    if (!currentUser) return [];
    return books.filter((book) => book.authorId === currentUser.uid);
  }, [books, currentUser]);

  const activeBook = useMemo(() => {
    if (selectedBookId === 'all') return null;
    return myBooks.find((book) => book.id === selectedBookId) || null;
  }, [myBooks, selectedBookId]);

  // Aggregate account-level statistics
  const accountStats = useMemo(() => {
    const totalViews = myBooks.reduce((acc, b) => acc + (b.views || 0), 0);
    const totalLikes = myBooks.reduce((acc, b) => acc + (b.likes || 0), 0);
    const totalSaves = myBooks.reduce((acc, b) => acc + (b.saves || 0), 0);
    const totalReviews = myBooks.reduce((acc, b) => acc + (b.reviewsCount || 0), 0);
    const totalRatingCount = myBooks.reduce((acc, book) => acc + (book.reviewsCount || 0), 0);
    const avgRating = totalRatingCount
      ? (
          myBooks.reduce((acc, book) => acc + (book.rating || 0) * (book.reviewsCount || 0), 0) /
          totalRatingCount
        ).toFixed(1)
      : '—';

    return {
      totalViews,
      totalLikes,
      totalSaves,
      totalReviews,
      avgRating,
    };
  }, [myBooks]);

  const trendData = useMemo(() => {
    const selectedBooks = selectedBookId === 'all'
      ? myBooks
      : myBooks.filter((book) => book.id === selectedBookId);
    return [...selectedBooks]
      .sort((a, b) => b.views - a.views)
      .slice(0, 7)
      .map((book) => ({
        id: book.id,
        label: book.title,
        views: book.views || 0,
        reviews: book.reviewsCount || 0,
      }));
  }, [myBooks, selectedBookId]);

  const maxVal = Math.max(...trendData.flatMap((book) => [book.views, book.reviews]), 1);

  if (!currentUser) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-4">
        <TrendingUp className="w-12 h-12 text-[#E43136] mx-auto" />
        <h2 className="text-xl font-bold">Sign In Required</h2>
        <p className="text-sm text-[#777780]">Sign in to access your author and member analytics dashboard.</p>
        <Link
          to="/auth"
          className="inline-block py-2.5 px-6 rounded-xl bg-[#E43136] text-white text-xs font-semibold"
        >
          Sign In Now
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#DDDDE3] dark:border-[#2C2C35]">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#202020] dark:text-[#F4F4F6] mb-1">
            Book & Reader Analytics Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-[#777780] dark:text-[#9E9EA9]">
            Comprehensive real-time performance analytics for your account and individual books.
          </p>
        </div>

      </div>


      {/* Account-Level Key Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#16161A] border border-[#DDDDE3] dark:border-[#2C2C35] shadow-xs space-y-1">
          <div className="flex items-center justify-between text-[#6E6E77] dark:text-[#9E9EA8] text-xs">
            <span>Total Impressions</span>
            <Eye className="w-4 h-4 text-[#E43136]" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-[#202020] dark:text-white">
            {accountStats.totalViews.toLocaleString()}
          </div>
          <div className="text-[11px] text-[#6E6E77] dark:text-[#9E9EA9]">
            Across your authored books
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#16161A] border border-[#DDDDE3] dark:border-[#2C2C35] shadow-xs space-y-1">
          <div className="flex items-center justify-between text-[#6E6E77] dark:text-[#9E9EA8] text-xs">
            <span>Book Likes</span>
            <Heart className="w-4 h-4 text-[#E43136]" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-[#202020] dark:text-white">
            {accountStats.totalLikes.toLocaleString()}
          </div>
          <div className="text-[11px] text-[#6E6E77] dark:text-[#9E9EA9]">
            Total likes on your books
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#16161A] border border-[#DDDDE3] dark:border-[#2C2C35] shadow-xs space-y-1">
          <div className="flex items-center justify-between text-[#6E6E77] dark:text-[#9E9EA8] text-xs">
            <span>Book Saves</span>
            <Bookmark className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-[#202020] dark:text-white">
            {accountStats.totalSaves.toLocaleString()}
          </div>
          <div className="text-[11px] text-[#6E6E77] dark:text-[#9E9EA8]">
            Total saves on your books
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#16161A] border border-[#DDDDE3] dark:border-[#2C2C35] shadow-xs space-y-1">
          <div className="flex items-center justify-between text-[#6E6E77] dark:text-[#9E9EA8] text-xs">
            <span>Reviews</span>
            <MessageSquare className="w-4 h-4 text-[#E43136]" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-[#202020] dark:text-white">
            {accountStats.totalReviews.toLocaleString()}
          </div>
          <div className="text-[11px] text-[#6E6E77] dark:text-[#9E9EA9]">
            Average rating: {accountStats.avgRating}/5
          </div>
        </div>
      </div>

      {/* Visual Chart: Actual Book Views and Reviews */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#16161A] border border-[#DDDDE3] dark:border-[#2C2C35] shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-sm sm:text-base text-[#202020] dark:text-white flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[#E43136]" />
              <span>Book Views & Reviews</span>
            </h3>
            <p className="text-xs text-[#6E6E77] dark:text-[#9E9EA9]">
              Current totals for your highest-viewed books.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs font-medium">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-[#E43136]" />
              <span>Views</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-[#FB8500]" />
              <span>Reviews</span>
            </span>
          </div>
        </div>

        {/* CSS Bar Chart */}
        {trendData.length > 0 ? (
        <div className="h-56 flex items-end gap-3 sm:gap-6 pt-6 pb-2 border-b border-[#F1F1F4] dark:border-[#2C2C35]">
          {trendData.map((d) => {
            const viewHeight = Math.round((d.views / maxVal) * 100);
            const reviewHeight = Math.round((d.reviews / maxVal) * 100);
            return (
              <div key={d.id} className="flex-1 min-w-0 flex flex-col items-center h-full justify-end group">
                <div className="w-full max-w-[48px] flex items-end gap-1.5 h-full justify-center">
                  {/* View Bar */}
                  <div
                    style={{ height: `${viewHeight}%` }}
                    className="w-1/2 bg-[#E43136] rounded-t-md transition-all group-hover:brightness-110 relative"
                  >
                    <span className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 text-[10px] font-mono bg-black text-white px-1 rounded transition-opacity pointer-events-none">
                      {d.views}
                    </span>
                  </div>
                  {/* Reads Bar */}
                  <div
                    style={{ height: `${reviewHeight}%` }}
                    className="w-1/2 bg-[#FB8500] rounded-t-md transition-all group-hover:brightness-110 relative"
                  >
                    <span className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 text-[10px] font-mono bg-black text-white px-1 rounded transition-opacity pointer-events-none">
                      {d.reviews}
                    </span>
                  </div>
                </div>
                <span className="text-[10px] sm:text-xs text-[#777780] dark:text-[#9E9EA9] mt-2 font-medium">
                  <span className="max-w-full truncate">{d.label}</span>
                </span>
              </div>
            );
          })}
        </div>
        ) : (
          <p className="py-10 text-center text-xs text-[#777780] dark:text-[#9E9EA9]">
            No book analytics yet. Publish a book to see its views and reviews here.
          </p>
        )}
      </div>

      {/* Per-Book Performance Breakdown */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-[#202020] dark:text-white flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-[#E43136]" />
              <span>Per-Book Granular Analytics</span>
            </h2>
            <p className="text-xs text-[#6E6E77] dark:text-[#9E9EA9]">
              Views, likes, saves, and reviews for each authored book.
            </p>
          </div>

          {/* Book Filter Selector */}
          <select
            value={selectedBookId}
            onChange={(e) => setSelectedBookId(e.target.value)}
            className="py-1.5 px-3 rounded-xl border border-[#DDDDE3] dark:border-[#2C2C35] bg-white dark:bg-[#16161A] text-xs font-semibold text-[#202020] dark:text-white outline-none"
          >
            <option value="all">All Books ({myBooks.length})</option>
            {myBooks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.title} (RedCode: {b.redCode || 'N/A'})
              </option>
            ))}
          </select>
        </div>

        {/* Per-Book Grid Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(activeBook ? [activeBook] : myBooks).length > 0 ? (
            (activeBook ? [activeBook] : myBooks).map((book) => (
              <div
                key={book.id}
                className="p-5 rounded-2xl bg-white dark:bg-[#16161A] border border-[#DDDDE3] dark:border-[#2C2C35] shadow-xs flex flex-col justify-between space-y-4 hover:border-[#E43136]/30 transition-all"
              >
                {/* Book Header */}
                <div className="flex gap-3.5">
                  <div className="w-16 h-22 shrink-0 rounded-lg overflow-hidden shadow-xs">
                    <BookCover book={book} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {book.redCode && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-black bg-[#E43136] text-white shadow-2xs">
                          <KeyRound className="w-2.5 h-2.5" />
                          {book.redCode}
                        </span>
                      )}
                      <span className="text-[10px] font-semibold text-[#6E6E77] dark:text-[#9E9EA8] uppercase tracking-wider">
                        {book.category}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-[#202020] dark:text-white truncate">
                      {book.title}
                    </h3>
                    <p className="text-xs text-[#6E6E77] dark:text-[#9E9EA8] truncate">
                      by {book.authorName}
                    </p>
                    <div className="flex items-center gap-3 text-xs mt-2 text-[#777780] dark:text-[#9E9EA9]">
                      <span className="flex items-center gap-1">
                        <Eye className="w-3.5 h-3.5 text-[#E43136]" />
                        <span className="font-semibold text-[#202020] dark:text-white">
                          {book.views.toLocaleString()}
                        </span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Heart className="w-3.5 h-3.5 text-rose-500" />
                        <span>{book.likes}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Bookmark className="w-3.5 h-3.5 text-amber-500" />
                        <span>{book.saves}</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="flex items-center justify-between pt-1">
                  <div className="text-[11px] text-[#6E6E77] dark:text-[#9E9EA8]">
                    ⭐ {book.rating} ({book.reviewsCount} reviews)
                  </div>
                  <div className="flex gap-2">
                    <Link
                      to={`/book/${book.id}`}
                      className="px-3 py-1.5 rounded-lg border border-[#DDDDE3] dark:border-[#2C2C35] text-xs font-semibold hover:border-[#E43136] transition-colors"
                    >
                      Book Page
                    </Link>
                    <Link
                      to={`/read/${book.id}`}
                      className="px-3 py-1.5 rounded-lg bg-[#E43136] text-white text-xs font-semibold hover:bg-[#D92D32] transition-colors inline-flex items-center gap-1"
                    >
                      <span>Read</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="col-span-full rounded-xl border border-dashed border-[#DDDDE3] p-8 text-center text-xs text-[#777780] dark:border-[#2C2C35] dark:text-[#9E9EA9]">
              No authored books yet. Published book analytics will appear here.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
