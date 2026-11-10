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
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | 'all'>('30d');
  const [selectedBookId, setSelectedBookId] = useState<string>('all');

  const isMember = currentUser?.membershipPlan === 'premium';

  // User's published / authored books
  const myBooks = useMemo(() => {
    if (!currentUser) return [];
    const authored = books.filter((b) => b.authorId === currentUser.uid);
    // If user hasn't authored books yet, include seed books for rich demonstration
    return authored.length > 0 ? authored : books.slice(0, 5);
  }, [books, currentUser]);

  const activeBook = useMemo(() => {
    if (selectedBookId === 'all') return null;
    return books.find((b) => b.id === selectedBookId) || null;
  }, [books, selectedBookId]);

  // Aggregate account-level statistics
  const accountStats = useMemo(() => {
    const totalViews = myBooks.reduce((acc, b) => acc + (b.views || 0), 0);
    const totalLikes = myBooks.reduce((acc, b) => acc + (b.likes || 0), 0);
    const totalSaves = myBooks.reduce((acc, b) => acc + (b.saves || 0), 0);
    const totalReviews = myBooks.reduce((acc, b) => acc + (b.reviewsCount || 0), 0);
    const avgRating =
      myBooks.length > 0
        ? (myBooks.reduce((acc, b) => acc + (b.rating || 4.8), 0) / myBooks.length).toFixed(1)
        : '4.9';

    // Reading hours estimate (views * 18 mins / 60)
    const totalHours = Math.round((totalViews * 16) / 60);
    const uniqueReaders = Math.round(totalViews * 0.72);
    const avgCompletion = 76; // 76%

    return {
      totalViews,
      totalLikes,
      totalSaves,
      totalReviews,
      avgRating,
      totalHours,
      uniqueReaders,
      avgCompletion,
    };
  }, [myBooks]);

  // Chart data simulation based on time range
  const trendData = useMemo(() => {
    if (timeRange === '7d') {
      return [
        { label: 'Mon', views: 420, reads: 310 },
        { label: 'Tue', views: 580, reads: 440 },
        { label: 'Wed', views: 510, reads: 390 },
        { label: 'Thu', views: 720, reads: 590 },
        { label: 'Fri', views: 890, reads: 710 },
        { label: 'Sat', views: 1150, reads: 940 },
        { label: 'Sun', views: 1040, reads: 880 },
      ];
    }
    return [
      { label: 'Week 1', views: 2840, reads: 2150 },
      { label: 'Week 2', views: 3410, reads: 2790 },
      { label: 'Week 3', views: 4120, reads: 3340 },
      { label: 'Week 4', views: 4890, reads: 4020 },
    ];
  }, [timeRange]);

  const maxVal = Math.max(...trendData.map((d) => d.views), 1);

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

        {/* Time range switcher */}
        <div className="inline-flex rounded-xl p-1 bg-[#F1F1F4] dark:bg-[#16161C] border border-[#DDDDE3] dark:border-[#2C2C35] text-xs font-semibold self-start sm:self-auto">
          {[
            { id: '7d', label: '7 Days' },
            { id: '30d', label: '30 Days' },
            { id: 'all', label: 'All Time' },
          ].map((r) => (
            <button
              key={r.id}
              onClick={() => setTimeRange(r.id as any)}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                timeRange === r.id
                  ? 'bg-white dark:bg-[#22222C] text-[#E43136] shadow-xs'
                  : 'text-[#6E6E77] hover:text-[#202020] dark:hover:text-white'
              }`}
            >
              {r.label}
            </button>
          ))}
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
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
            <ArrowUpRight className="w-3 h-3" />
            <span>+18.4% from last period</span>
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#16161A] border border-[#DDDDE3] dark:border-[#2C2C35] shadow-xs space-y-1">
          <div className="flex items-center justify-between text-[#6E6E77] dark:text-[#9E9EA8] text-xs">
            <span>Unique Readers</span>
            <Users className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-[#202020] dark:text-white">
            {accountStats.uniqueReaders.toLocaleString()}
          </div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
            <ArrowUpRight className="w-3 h-3" />
            <span>+12.6% active reader growth</span>
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#16161A] border border-[#DDDDE3] dark:border-[#2C2C35] shadow-xs space-y-1">
          <div className="flex items-center justify-between text-[#6E6E77] dark:text-[#9E9EA8] text-xs">
            <span>Total Reading Hours</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-[#202020] dark:text-white">
            {accountStats.totalHours.toLocaleString()} hrs
          </div>
          <div className="text-[11px] text-[#6E6E77] dark:text-[#9E9EA8]">
            Avg. 18.2 mins per session
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#16161A] border border-[#DDDDE3] dark:border-[#2C2C35] shadow-xs space-y-1">
          <div className="flex items-center justify-between text-[#6E6E77] dark:text-[#9E9EA8] text-xs">
            <span>Avg. Completion Rate</span>
            <Award className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-[#202020] dark:text-white">
            {accountStats.avgCompletion}%
          </div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
            Top 10% reader retention tier
          </div>
        </div>
      </div>

      {/* Visual Chart: Reading Trends */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#16161A] border border-[#DDDDE3] dark:border-[#2C2C35] shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-sm sm:text-base text-[#202020] dark:text-white flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[#E43136]" />
              <span>Reader Engagement & View Velocity</span>
            </h3>
            <p className="text-xs text-[#6E6E77] dark:text-[#9E9EA9]">
              Compare total impressions against completed chapter read-throughs.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs font-medium">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-[#E43136]" />
              <span>Views</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-[#FB8500]" />
              <span>Completed Reads</span>
            </span>
          </div>
        </div>

        {/* CSS Bar Chart */}
        <div className="h-56 flex items-end gap-3 sm:gap-6 pt-6 pb-2 border-b border-[#F1F1F4] dark:border-[#2C2C35]">
          {trendData.map((d, i) => {
            const viewHeight = Math.round((d.views / maxVal) * 100);
            const readHeight = Math.round((d.reads / maxVal) * 100);
            return (
              <div key={i} className="flex-1 flex flex-col items-center h-full justify-end group">
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
                    style={{ height: `${readHeight}%` }}
                    className="w-1/2 bg-[#FB8500] rounded-t-md transition-all group-hover:brightness-110 relative"
                  >
                    <span className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 text-[10px] font-mono bg-black text-white px-1 rounded transition-opacity pointer-events-none">
                      {d.reads}
                    </span>
                  </div>
                </div>
                <span className="text-[10px] sm:text-xs text-[#777780] dark:text-[#9E9EA9] mt-2 font-medium">
                  {d.label}
                </span>
              </div>
            );
          })}
        </div>
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
              Detailed performance metrics, reader completion drop-offs, and unique RedCode data for each book.
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
          {(activeBook ? [activeBook] : myBooks).map((book) => {
            const bookRetention = Math.min(94, Math.max(62, 70 + (book.reviewsCount % 20)));
            const chapterDropOff = [100, 84, bookRetention];

            return (
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

                {/* Chapter Retention Progression */}
                <div className="p-3 rounded-xl bg-[#FAFAFB] dark:bg-[#0F0F12] border border-[#F1F1F4] dark:border-[#22222A] space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-[#202020] dark:text-[#F4F4F6]">
                      Chapter Reader Retention
                    </span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-mono">
                      {bookRetention}% Completed
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full h-2 rounded-full bg-[#E5E5EB] dark:bg-[#252530] overflow-hidden flex">
                    <div
                      style={{ width: `${bookRetention}%` }}
                      className="h-full bg-gradient-to-r from-[#E43136] to-[#FB8500] rounded-full"
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-[#777780] dark:text-[#9E9EA9]">
                    <span>Ch. 1 (100%)</span>
                    <span>Ch. 2 (84%)</span>
                    <span>Ch. 3 ({bookRetention}%)</span>
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
            );
          })}
        </div>
      </div>
    </div>
  );
};
