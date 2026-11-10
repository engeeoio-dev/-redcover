import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Star,
  BookOpen,
  TrendingUp,
  PenTool,
  MessageSquarePlus,
  X,
  Send,
} from 'lucide-react';
import { Book, SocialPostType } from '../../models/types';
import { useRedcover } from '../../contexts/RedcoverContext';
import { BookCover, UserAvatar } from '../common/UIPrimitives';

const COMPOSER_MODES: {
  id: SocialPostType;
  label: string;
  placeholder: string;
  needsBook: boolean;
}[] = [
  {
    id: 'discussion',
    label: 'Discussion',
    placeholder: 'Start a discussion, ask for book recs, or share a literary thought...',
    needsBook: false,
  },
  {
    id: 'book_recommendation',
    label: 'Share a Book',
    placeholder: 'Tell the Redcover community why they should read this book...',
    needsBook: true,
  },
  {
    id: 'book_review',
    label: 'Write a Review',
    placeholder: 'Share your honest thoughts, favorite moments, and rating for this book...',
    needsBook: true,
  },
  {
    id: 'reading_update',
    label: 'Reading Progress',
    placeholder: 'What chapter are you on and what do you think so far?',
    needsBook: true,
  },
  {
    id: 'story_publication',
    label: 'Announce Story',
    placeholder: 'Introduce your published book or new chapter to readers...',
    needsBook: true,
  },
];

export const SocialComposer: React.FC = () => {
  const { currentUser, firebaseUser, books, readingProgress, createSocialPost } = useRedcover();
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(false);
  const [postType, setPostType] = useState<SocialPostType>('discussion');
  const [text, setText] = useState('');
  const [selectedBookId, setSelectedBookId] = useState<string>('');
  const [rating, setRating] = useState<number>(5);
  const [progressPercentage, setProgressPercentage] = useState<number>(50);
  const [chapterNumber, setChapterNumber] = useState<number>(1);
  const [submitting, setSubmitting] = useState(false);

  const publishedBooks = useMemo(
    () => books.filter((b) => b.status === 'published'),
    [books]
  );

  const selectedBook: Book | null = useMemo(
    () => publishedBooks.find((b) => b.id === selectedBookId) || publishedBooks[0] || null,
    [publishedBooks, selectedBookId]
  );

  const activeModeConfig = useMemo(
    () => COMPOSER_MODES.find((m) => m.id === postType) || COMPOSER_MODES[0],
    [postType]
  );

  const openWithMode = (mode: SocialPostType) => {
    if (!firebaseUser) {
      navigate('/auth');
      return;
    }
    setPostType(mode);
    if (!selectedBookId && publishedBooks.length > 0) {
      setSelectedBookId(publishedBooks[0].id);
    }
    setIsOpen(true);
  };

  const handleBookSelectionChange = (bookId: string) => {
    setSelectedBookId(bookId);
    const existingProg = readingProgress.find((p) => p.bookId === bookId);
    if (existingProg) {
      setProgressPercentage(existingProg.percentage);
      setChapterNumber(existingProg.currentChapter);
    } else {
      setProgressPercentage(25);
      setChapterNumber(1);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !currentUser) {
      navigate('/auth');
      return;
    }
    if (!text.trim()) return;

    setSubmitting(true);
    try {
      const bookForPost =
        activeModeConfig.needsBook || selectedBookId ? selectedBook : null;
      await createSocialPost({
        postType,
        text: text.trim(),
        book: bookForPost,
        rating: postType === 'book_review' ? rating : 0,
        progressPercentage:
          postType === 'reading_update'
            ? progressPercentage
            : 0,
        chapterNumber: postType === 'reading_update' ? chapterNumber : 0,
      });
      setText('');
      setIsOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  const displayUser = currentUser || {
    displayName: 'Redcover Reader',
    photoURL: '',
    isOnline: false,
    showOnlineStatus: false,
  };

  return (
    <section
      aria-label="Share activity with readers"
      className="bg-white dark:bg-[#16161A] rounded-2xl border border-[#DDDDE3] dark:border-[#2C2C35] p-4 sm:p-5 transition-shadow"
    >
      {/* Compact Prompt Row */}
      <div className="flex items-center gap-3.5">
        <UserAvatar user={displayUser} size="md" showPresence={Boolean(currentUser)} />
        <button
          type="button"
          onClick={() => openWithMode('discussion')}
          className="flex-1 text-left py-2.5 px-4 rounded-xl bg-[#FAFAFB] dark:bg-[#0F0F12] border border-[#DDDDE3] dark:border-[#2C2C35] hover:border-[#E43136]/50 text-sm text-[#777780] dark:text-[#9E9EA9] transition-colors cursor-pointer truncate"
        >
          Share something with readers...
        </button>
      </div>

      {/* Quick Action Bar */}
      <div className="mt-3.5 pt-3 border-t border-[#F1F1F4] dark:border-[#2C2C35] flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => openWithMode('book_review')}
            className="py-1.5 px-3 rounded-lg text-xs font-medium text-[#202020] dark:text-[#F4F4F6] hover:bg-[#FFF3F4] dark:hover:bg-[#2D1619] hover:text-[#E43136] inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Star className="w-3.5 h-3.5 text-[#E6A02C]" />
            <span>Write a Review</span>
          </button>

          <button
            type="button"
            onClick={() => openWithMode('book_recommendation')}
            className="py-1.5 px-3 rounded-lg text-xs font-medium text-[#202020] dark:text-[#F4F4F6] hover:bg-[#FFF3F4] dark:hover:bg-[#2D1619] hover:text-[#E43136] inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <BookOpen className="w-3.5 h-3.5 text-[#E43136]" />
            <span>Share a Book</span>
          </button>

          <button
            type="button"
            onClick={() => openWithMode('reading_update')}
            className="py-1.5 px-3 rounded-lg text-xs font-medium text-[#202020] dark:text-[#F4F4F6] hover:bg-[#FFF3F4] dark:hover:bg-[#2D1619] hover:text-[#E43136] inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <TrendingUp className="w-3.5 h-3.5 text-[#268B62]" />
            <span>Update Reading Progress</span>
          </button>

        </div>

        <button
          type="button"
          onClick={() => navigate('/create')}
          className="py-1.5 px-3.5 rounded-lg bg-[#FFF3F4] dark:bg-[#2D1619] text-[#E43136] hover:bg-[#E43136] hover:text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <PenTool className="w-3.5 h-3.5" />
          <span>Publish a Story</span>
        </button>
      </div>

      {/* Expandable Composer Interface */}
      {isOpen && (
        <form
          onSubmit={handleSubmit}
          className="mt-4 pt-4 border-t border-[#DDDDE3] dark:border-[#2C2C35] space-y-4"
        >
          {/* Post Mode Selector */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
              {COMPOSER_MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setPostType(m.id)}
                  className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    postType === m.id
                      ? 'bg-[#E43136] text-white'
                      : 'bg-[#FAFAFB] dark:bg-[#0F0F12] text-[#777780] dark:text-[#9E9EA9] border border-[#DDDDE3] dark:border-[#2C2C35] hover:text-[#202020] dark:hover:text-white'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close composer"
              className="p-1.5 rounded-lg text-[#777780] hover:text-[#202020] dark:hover:text-white cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Book Selector when post references a book */}
          {(activeModeConfig.needsBook || postType === 'discussion') &&
            publishedBooks.length > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-xl bg-[#FAFAFB] dark:bg-[#0F0F12] border border-[#DDDDE3] dark:border-[#2C2C35]">
                <div className="flex-1 min-w-0">
                  <label className="block text-[11px] font-semibold text-[#777780] dark:text-[#9E9EA9] mb-1">
                    {activeModeConfig.needsBook ? 'Select Redcover Book' : 'Attach a Book (Optional)'}
                  </label>
                  <select
                    value={activeModeConfig.needsBook ? selectedBook?.id || '' : selectedBookId}
                    onChange={(e) => handleBookSelectionChange(e.target.value)}
                    className="w-full py-2 px-3 rounded-lg bg-white dark:bg-[#16161A] border border-[#DDDDE3] dark:border-[#2C2C35] text-xs font-medium text-[#202020] dark:text-[#F4F4F6]"
                  >
                    {!activeModeConfig.needsBook && <option value="">No book attached</option>}
                    {publishedBooks.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.title} — by {b.authorName} ({b.category})
                      </option>
                    ))}
                  </select>
                </div>

                {selectedBook && (activeModeConfig.needsBook || selectedBookId) && (
                  <div className="flex items-center gap-2.5 shrink-0">
                    <div className="w-10 aspect-[3/4] shrink-0">
                      <BookCover book={selectedBook} size="xs" className="w-full h-full" />
                    </div>
                    <div className="text-xs max-w-[160px]">
                      <p className="font-semibold text-[#202020] dark:text-[#F4F4F6] truncate">
                        {selectedBook.title}
                      </p>
                      <p className="text-[#777780] truncate">{selectedBook.authorName}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

          {/* Review Star Rating Control */}
          {postType === 'book_review' && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-[#FFF3F4]/60 dark:bg-[#2D1619]/40 border border-[#E43136]/20">
              <span className="text-xs font-semibold text-[#202020] dark:text-[#F4F4F6]">
                Your Rating:
              </span>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    aria-label={`Rate ${star} stars`}
                    className="p-1 cursor-pointer transition-transform hover:scale-110"
                  >
                    <Star
                      className={`w-4 h-4 ${
                        star <= rating
                          ? 'fill-[#E6A02C] text-[#E6A02C]'
                          : 'text-[#DDDDE3] dark:text-[#2C2C35]'
                      }`}
                    />
                  </button>
                ))}
              </div>
              <span className="text-xs font-semibold text-[#E6A02C] tabular-nums">
                {rating}.0 / 5.0
              </span>
            </div>
          )}

          {/* Reading Progress Controls */}
          {postType === 'reading_update' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-[#FAFAFB] dark:bg-[#0F0F12] border border-[#DDDDE3] dark:border-[#2C2C35]">
              <div>
                <label className="block text-xs font-semibold mb-1 tabular-nums">
                  Current Chapter: {chapterNumber}
                </label>
                <input
                  type="number"
                  min={1}
                  max={Math.max(100, selectedBook?.chaptersCount || 50)}
                  value={chapterNumber}
                  onChange={(e) => setChapterNumber(Math.max(1, Number(e.target.value) || 1))}
                  className="w-full py-1.5 px-3 rounded-lg bg-white dark:bg-[#16161A] border border-[#DDDDE3] dark:border-[#2C2C35] text-xs tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1 tabular-nums">
                  Reading Progress: {progressPercentage}%
                </label>
                <input
                  type="range"
                  min={1}
                  max={100}
                  value={progressPercentage}
                  onChange={(e) => setProgressPercentage(Number(e.target.value))}
                  className="w-full accent-[#E43136] cursor-pointer mt-2"
                />
              </div>
            </div>
          )}

          {/* Textarea */}
          <div>
            <textarea
              rows={3}
              required
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={activeModeConfig.placeholder}
              className="w-full p-3.5 rounded-xl bg-[#FAFAFB] dark:bg-[#0F0F12] border border-[#DDDDE3] dark:border-[#2C2C35] focus:border-[#E43136] focus:outline-none text-sm text-[#202020] dark:text-[#F4F4F6]"
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-[#777780] dark:text-[#9E9EA9]">
              Posting publicly as <strong>@{currentUser?.username || 'reader'}</strong>
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="py-2 px-4 rounded-xl text-xs font-medium text-[#777780] hover:text-[#202020] dark:hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !text.trim()}
                className="py-2 px-5 rounded-xl bg-[#E43136] hover:bg-[#B9272D] text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                {submitting ? 'Publishing...' : 'Post to Community'}
              </button>
            </div>
          </div>
        </form>
      )}
    </section>
  );
};
