import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  BookOpen,
  Bookmark,
  Heart,
  Share2,
  Flag,
  Star,
  Eye,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  BookMarked,
  Maximize2,
  Minimize2,
  FileText,
  Headphones,
  Volume2,
  Play,
  Pause,
  Square,
  SkipBack,
  SkipForward,
  List,
  Settings,
  CheckCircle2,
  Highlighter,
  StickyNote,
  Trash2,
  Clock,
  Flame,
  Award,
  AlignLeft,
  AlignJustify,
  X,
  Plus,
  Copy,
  MessageCircle,
  MessageSquare,
  KeyRound,
  Users,
  Sparkles,
  Edit2,
  Reply,
  CornerDownRight,
} from 'lucide-react';
import { useRedcover } from '../contexts/RedcoverContext';
import { Chapter } from '../models/types';
import {
  BookCard,
  BookCover,
  EmptyState,
  SectionHeader,
  UserAvatar,
  UserName,
} from '../components/common/UIPrimitives';
import { CommentThread, LikedByBar } from '../components/social/CommentThread';
import { PdfCanvasReader } from '../components/reader/PdfCanvasReader';
import { resolveFirebaseCoverUrl } from '../services/firebase/storageService';
import { ShareBookModal } from '../components/books/ShareBookModal';
import { InviteToReadModal } from '../components/reading/InviteToReadModal';
import { convertPdfTextToNarrative } from '../services/ai/aiPdfService';

export const BOOK_DISCUSSION_REACTIONS = [
  '❤️ Loved this book!',
  '🔥 Absolute masterpiece',
  '📖 Can’t put this down!',
  '👏 Brilliant storytelling',
  '🤔 Let’s discuss this plot twist!',
  '✨ Highly recommend to everyone',
];

export const PARAGRAPH_WATTPAD_REACTIONS = [
  '🔥 This line gave me chills!',
  '😭 Feeling this so deeply',
  '🤯 Wait, plot twist?!',
  '❤️ Favorite paragraph so far',
  '👏 So beautifully written',
  '😂 OMG I did not expect that!',
];

export function getBookCommentPostId(bookId: string): string {
  return `book_pub_${bookId}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
}

export function getChapterCommentPostId(bookId: string, chapterNumber: number): string {
  const cleanBook = bookId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 42);
  return `bk_${cleanBook}_ch_${chapterNumber}`;
}

export function getParagraphCommentPostId(
  bookId: string,
  chapterNumber: number,
  paragraphIdx: number
): string {
  const cleanBook = bookId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 36);
  return `bk_${cleanBook}_c${chapterNumber}_p${paragraphIdx}`;
}

export function parseBookScopedPostId(
  bookId: string,
  postId: string
):
  | { scope: 'book' }
  | { scope: 'chapter'; chapterNumber: number }
  | { scope: 'paragraph'; chapterNumber: number; paragraphIdx: number }
  | null {
  if (postId === getBookCommentPostId(bookId)) {
    return { scope: 'book' };
  }
  const cleanBook42 = bookId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 42);
  const chapPrefix = `bk_${cleanBook42}_ch_`;
  if (postId.startsWith(chapPrefix)) {
    const chNum = Number(postId.slice(chapPrefix.length));
    if (Number.isFinite(chNum) && chNum >= 1) {
      return { scope: 'chapter', chapterNumber: chNum };
    }
  }
  const cleanBook36 = bookId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 36);
  const paraPrefix = `bk_${cleanBook36}_c`;
  if (postId.startsWith(paraPrefix)) {
    const rest = postId.slice(paraPrefix.length);
    const match = rest.match(/^(\d+)_p(\d+)$/);
    if (match) {
      return {
        scope: 'paragraph',
        chapterNumber: Number(match[1]),
        paragraphIdx: Number(match[2]),
      };
    }
  }
  return null;
}

export function formatShortTime(iso?: string): string {
  if (!iso) return 'recent';
  const date = new Date(iso);
  if (isNaN(date.getTime())) return 'recent';
  const diffSec = Math.max(1, Math.floor((Date.now() - date.getTime()) / 1000));
  if (diffSec < 60) return 'now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export interface VoicePersona {
  id: string;
  name: string;
  role: string;
  accentLabel: string;
  langPrefs: string[];
  genderPref: 'female' | 'male';
  pitch: number;
  rateMultiplier: number;
  sampleText: string;
}

export const VOICE_PERSONAS: VoicePersona[] = [
  {
    id: 'aria-storyteller',
    name: 'Aria',
    role: 'Warm Storyteller',
    accentLabel: 'US English · Female',
    langPrefs: ['en-US', 'en'],
    genderPref: 'female',
    pitch: 1.05,
    rateMultiplier: 0.98,
    sampleText: 'Welcome to Redcover Audio. Sit back and enjoy the story.',
  },
  {
    id: 'marcus-baritone',
    name: 'Marcus',
    role: 'Deep Baritone',
    accentLabel: 'US English · Male',
    langPrefs: ['en-US', 'en'],
    genderPref: 'male',
    pitch: 0.84,
    rateMultiplier: 0.95,
    sampleText: 'Every chapter holds a secret waiting to be heard.',
  },
  {
    id: 'kavya-hinglish',
    name: 'Kavya',
    role: 'Hindi & Hinglish',
    accentLabel: 'India · Female',
    langPrefs: ['hi-IN', 'en-IN', 'en-GB'],
    genderPref: 'female',
    pitch: 1.08,
    rateMultiplier: 0.97,
    sampleText: 'Namaste! Aaiye is kitaab ki kahani ko aawaz mein sunte hain.',
  },
  {
    id: 'aarav-indian',
    name: 'Aarav',
    role: 'Indian Narrator',
    accentLabel: 'India · Male',
    langPrefs: ['en-IN', 'hi-IN', 'en-GB'],
    genderPref: 'male',
    pitch: 0.92,
    rateMultiplier: 0.98,
    sampleText: 'Let us begin this journey through the pages of your book.',
  },
  {
    id: 'elena-british',
    name: 'Elena',
    role: 'British Literary',
    accentLabel: 'UK English · Female',
    langPrefs: ['en-GB', 'en-AU', 'en'],
    genderPref: 'female',
    pitch: 1.04,
    rateMultiplier: 0.96,
    sampleText: 'A classic literary voice tailored for novels and timeless fiction.',
  },
  {
    id: 'arthur-documentary',
    name: 'Arthur',
    role: 'Documentary & History',
    accentLabel: 'UK English · Male',
    langPrefs: ['en-GB', 'en-US'],
    genderPref: 'male',
    pitch: 0.88,
    rateMultiplier: 0.93,
    sampleText: 'Clear, measured narration designed for biographies and deep insights.',
  },
  {
    id: 'maya-calm',
    name: 'Maya',
    role: 'Calm Late-Night',
    accentLabel: 'Soft & Relaxing · Female',
    langPrefs: ['en-US', 'en-CA', 'en'],
    genderPref: 'female',
    pitch: 0.96,
    rateMultiplier: 0.88,
    sampleText: 'Gentle, unhurried narration for peaceful evening reading.',
  },
  {
    id: 'liam-nonfiction',
    name: 'Liam',
    role: 'Crisp Non-Fiction',
    accentLabel: 'Business & Self-Help · Male',
    langPrefs: ['en-US', 'en-AU', 'en'],
    genderPref: 'male',
    pitch: 1.0,
    rateMultiplier: 1.06,
    sampleText: 'Sharp, energetic pacing ideal for business, finance, and productivity books.',
  },
  {
    id: 'sofia-drama',
    name: 'Sofia',
    role: 'Expressive Romance & Drama',
    accentLabel: 'Expressive · Female',
    langPrefs: ['en-AU', 'en-US', 'en-GB'],
    genderPref: 'female',
    pitch: 1.15,
    rateMultiplier: 1.0,
    sampleText: 'Vibrant, emotional delivery that brings characters and dialogue to life.',
  },
  {
    id: 'vikram-thriller',
    name: 'Vikram',
    role: 'Mystery & Thriller',
    accentLabel: 'Deep Suspense · Male',
    langPrefs: ['en-IN', 'en-GB', 'en-US'],
    genderPref: 'male',
    pitch: 0.78,
    rateMultiplier: 0.92,
    sampleText: 'In the shadows of the page, every word counts.',
  },
];

function pickVoiceForPersona(
  persona: VoicePersona,
  voices: SpeechSynthesisVoice[]
): SpeechSynthesisVoice | null {
  if (!voices.length) return null;
  const femaleKeywords = [
    'female',
    'zira',
    'samantha',
    'victoria',
    'karen',
    'moira',
    'tessa',
    'veena',
    'lekha',
    'heera',
    'kalpana',
    'aria',
    'jenny',
    'sonia',
    'natasha',
    'google uk english female',
    'google हिन्दी',
  ];
  const maleKeywords = [
    'male',
    'david',
    'mark',
    'alex',
    'daniel',
    'oliver',
    'rishi',
    'hemant',
    'prabhat',
    'guy',
    'ryan',
    'christopher',
    'google uk english male',
    'google us english',
  ];

  const matchesGender = (v: SpeechSynthesisVoice) => {
    const lower = v.name.toLowerCase();
    if (persona.genderPref === 'female') {
      return femaleKeywords.some((k) => lower.includes(k));
    }
    return maleKeywords.some((k) => lower.includes(k));
  };

  for (const langPref of persona.langPrefs) {
    const langVoices = voices.filter((v) =>
      v.lang.toLowerCase().startsWith(langPref.toLowerCase())
    );
    const genderMatch = langVoices.find(matchesGender);
    if (genderMatch) return genderMatch;
    if (langVoices.length > 0) {
      return persona.genderPref === 'male' && langVoices.length > 1
        ? langVoices[1]
        : langVoices[0];
    }
  }

  const anyGender = voices.find(matchesGender);
  return anyGender || voices[0];
}

// Inline Chapter Image component that resolves Firebase Storage paths (`gs://`, `book_covers/...`, etc.)
const InlineChapterImage: React.FC<{
  rawUrl: string;
  size: string;
  align: string;
  caption: string;
}> = ({ rawUrl, size, align, caption }) => {
  const [resolvedUrl, setResolvedUrl] = useState<string>(rawUrl);
  const [failed, setFailed] = useState<boolean>(false);

  useEffect(() => {
    let active = true;
    setFailed(false);
    resolveFirebaseCoverUrl(rawUrl).then((url) => {
      if (active && url) setResolvedUrl(url);
    });
    return () => {
      active = false;
    };
  }, [rawUrl]);

  if (failed || !resolvedUrl) return null;

  const sizeClass =
    size === 'sm'
      ? 'max-w-[240px]'
      : size === 'lg'
      ? 'max-w-[560px]'
      : size === 'full'
      ? 'w-full'
      : 'max-w-[380px]';

  const alignClass =
    align === 'left'
      ? 'sm:float-left sm:mr-6 sm:mb-4 mx-auto'
      : align === 'right'
      ? 'sm:float-right sm:ml-6 sm:mb-4 mx-auto'
      : 'mx-auto';

  return (
    <figure className={`my-6 clear-both ${sizeClass} ${alignClass}`}>
      <img
        src={resolvedUrl}
        alt={caption || 'Chapter illustration'}
        loading="lazy"
        onError={() => setFailed(true)}
        className="w-full h-auto rounded-xl border border-current/10 object-contain shadow-sm"
      />
      {caption && (
        <figcaption className="mt-2 text-center text-xs opacity-75 italic font-sans">
          {caption}
        </figcaption>
      )}
    </figure>
  );
};

function cleanDescriptionText(desc: string): string {
  if (!desc) return '';
  const trimmed = desc.trim();
  const halfLen = Math.floor(trimmed.length / 2);
  const firstHalf = trimmed.slice(0, halfLen).trim();
  const secondHalf = trimmed.slice(halfLen).trim();
  if (firstHalf && firstHalf.length > 8 && firstHalf === secondHalf) {
    return firstHalf;
  }
  return trimmed;
}

export const BookDetailsPage: React.FC = () => {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  const {
    books,
    users,
    reviews,
    savedBooks,
    likedBooks,
    postLikes,
    postComments,
    follows,
    currentUser,
    firebaseUser,
    acceptedFriends,
    shareBookToFriends,
    inviteToReadTogether,
    toggleSaveBook,
    toggleLikeBook,
    toggleFollowUser,
    submitReview,
    submitReport,
    incrementBookView,
    startOrGetChat,
    addToast,
  } = useRedcover();

  const book = useMemo(() => books.find((b) => b.id === bookId), [books, bookId]);

  const authorProfile = useMemo(() => {
    if (!book) return null;
    const found = users.find(
      (u) =>
        u.uid === book.authorId ||
        (book.authorId && u.uid.toLowerCase() === book.authorId.toLowerCase()) ||
        (book.authorUsername && u.username.toLowerCase() === book.authorUsername.toLowerCase())
    );
    if (found) {
      return {
        ...found,
        displayName: found.displayName || book.authorName || 'Author',
        photoURL: found.photoURL || book.authorAvatar || '',
      };
    }
    return {
      uid: book.authorId || 'author',
      username: book.authorUsername || book.authorName?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'author',
      displayName: book.authorName || 'Independent Author',
      photoURL: book.authorAvatar || '',
      coverURL: '',
      bio: 'Independent author publishing original stories on Redcover.',
      followersCount: 0,
      followingCount: 0,
      booksCount: 1,
      streakDays: 0,
      points: 0,
      membershipPlan: 'free' as const,
      isOnline: false,
      showOnlineStatus: true,
      publicActivity: true,
      role: 'author' as const,
      createdAt: book.createdAt || new Date().toISOString(),
      updatedAt: book.updatedAt || new Date().toISOString(),
    };
  }, [users, book]);

  const authorBooksCount = useMemo(() => {
    if (!authorProfile?.uid) return 1;
    const count = books.filter(
      (b) =>
        b.authorId === authorProfile.uid ||
        (b.authorName && b.authorName.toLowerCase() === authorProfile.displayName.toLowerCase())
    ).length;
    return Math.max(1, count);
  }, [books, authorProfile]);

  const isFollowingAuthor = Boolean(
    currentUser &&
      authorProfile &&
      follows.some(
        (f) => f.followerId === currentUser.uid && f.followingId === authorProfile.uid
      )
  );

  const handleMessageAuthor = async () => {
    if (!authorProfile) return;
    if (!currentUser) {
      navigate('/auth');
      return;
    }
    if (currentUser.uid === authorProfile.uid) {
      addToast('You are the author of this book!', 'info');
      return;
    }
    try {
      const chatId = await startOrGetChat(authorProfile);
      navigate(`/hub/chats?chatId=${chatId}`);
    } catch {
      navigate('/hub/chats');
    }
  };

  const bookReviews = useMemo(
    () =>
      reviews
        .filter((r) => r.bookId === bookId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [reviews, bookId]
  );

  const relatedBooks = useMemo(
    () =>
      books
        .filter(
          (b) =>
            b.id !== bookId &&
            b.status === 'published' &&
            (b.category === book?.category || b.authorId === book?.authorId)
        )
        .slice(0, 6),
    [books, bookId, book]
  );

  const [ratingInput, setRatingInput] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [showShareModal, setShowShareModal] = useState(false);
  const [showReadTogetherModal, setShowReadTogetherModal] = useState(false);
  const [likePop, setLikePop] = useState(false);
  const [discussionTab, setDiscussionTab] = useState<'book' | 'chapters' | 'paragraphs'>('book');
  const [selectedDiscussionChapter, setSelectedDiscussionChapter] = useState<number>(1);
  const discussionSectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (book) {
      incrementBookView(book);
    }
  }, [book?.id]);

  // Categorize all comments belonging to this book (Book-wide, Chapter-level, and Wattpad Paragraph-level)
  const {
    bookOverallComments,
    chapterCommentsList,
    paragraphCommentsList,
    totalBookCommentsCount,
  } = useMemo(() => {
    if (!book) {
      return {
        bookOverallComments: [],
        chapterCommentsList: [],
        paragraphCommentsList: [],
        totalBookCommentsCount: 0,
      };
    }
    const overall: typeof postComments = [];
    const chaps: { comment: (typeof postComments)[number]; chapterNumber: number }[] = [];
    const paras: {
      comment: (typeof postComments)[number];
      chapterNumber: number;
      paragraphIdx: number;
    }[] = [];

    postComments.forEach((c) => {
      const parsed = parseBookScopedPostId(book.id, c.postId);
      if (!parsed) return;
      if (parsed.scope === 'book') {
        overall.push(c);
      } else if (parsed.scope === 'chapter') {
        chaps.push({ comment: c, chapterNumber: parsed.chapterNumber });
      } else if (parsed.scope === 'paragraph') {
        paras.push({
          comment: c,
          chapterNumber: parsed.chapterNumber,
          paragraphIdx: parsed.paragraphIdx,
        });
      }
    });

    paras.sort(
      (a, b) =>
        new Date(b.comment.createdAt).getTime() - new Date(a.comment.createdAt).getTime()
    );

    return {
      bookOverallComments: overall,
      chapterCommentsList: chaps,
      paragraphCommentsList: paras,
      totalBookCommentsCount: overall.length + chaps.length + paras.length,
    };
  }, [book, postComments]);

  if (!book) {
    return (
      <EmptyState
        title="Book Not Found"
        description="This book may have been removed or is no longer available."
        actionLabel="Back to Explore"
        actionTo="/explore"
      />
    );
  }

  const bookPubPostKey = getBookCommentPostId(book.id);
  const bookPostLikes = postLikes.filter((l) => l.postId === bookPubPostKey);
  const isSaved = savedBooks.some((s) => s.bookId === book.id);
  const isLiked =
    likedBooks.some((l) => l.bookId === book.id) ||
    Boolean(firebaseUser && bookPostLikes.some((l) => l.userId === firebaseUser.uid));
  const totalBookLikes = Math.max(book.likes, bookPostLikes.length, isLiked ? 1 : 0);

  const handleShare = async () => {
    const shareUrl = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: book.title, text: book.shortDescription, url: shareUrl });
        return;
      } catch {
        // Fallback to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      addToast('Shareable book URL copied to clipboard!', 'success');
    } catch {
      addToast(`Share URL: ${shareUrl}`, 'info');
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewText.trim()) return;
    setSubmittingReview(true);
    try {
      await submitReview(book, ratingInput, reviewText);
      setReviewText('');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportReason.trim()) return;
    await submitReport('book', book.id, book.title, reportReason);
    setReportReason('');
    setReportModalOpen(false);
  };

  const totalChapterCount = Math.max(1, book.chaptersCount || 1);

  return (
    <div className="space-y-10 sm:space-y-12">
      {/* Main Book Header Module */}
      <div className="bg-white dark:bg-[#16161A] rounded-2xl border border-[#DDDDE3] dark:border-[#2C2C35] p-5 sm:p-8 lg:p-10">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 sm:gap-8 items-start">
          {/* Left Cover Column */}
          <div className="md:col-span-4 lg:col-span-3 flex justify-center">
            <div className="w-44 sm:w-60 md:w-full max-w-[260px] aspect-[3/4] shadow-lg rounded-xl overflow-hidden">
              <BookCover book={book} size="lg" className="w-full h-full" />
            </div>
          </div>

          {/* Right Contiguous Details Module */}
          <div className="md:col-span-8 lg:col-span-9 space-y-5">
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#777780] dark:text-[#9E9EA9]">
              <span className="font-semibold text-[#E43136] uppercase tracking-wider">
                {book.category}
              </span>
              <span aria-hidden="true">·</span>
              <span>{book.language}</span>
              <span aria-hidden="true">·</span>
              <span>
                {book.format === 'pdf'
                  ? `PDF Edition · Text, Original PDF & Audio (${totalChapterCount} Sections)`
                  : `${totalChapterCount} Chapters`}
              </span>
              <span aria-hidden="true">·</span>
              <span>Published {new Date(book.createdAt).toLocaleDateString()}</span>
            </div>

            {/* Title & RedCode Badge */}
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold text-[#202020] dark:text-[#F4F4F6]">
                {book.title}
              </h1>
              {book.redCode && (
                <div
                  title="Unique 6-digit numeric RedCode"
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#E43136]/10 border border-[#E43136]/25 text-[#E43136] font-mono text-xs sm:text-sm font-bold shadow-2xs"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>RedCode: {book.redCode}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(book.redCode || '');
                      addToast(`RedCode ${book.redCode} copied to clipboard!`, 'success');
                    }}
                    title="Copy RedCode"
                    className="p-1 hover:bg-[#E43136]/20 rounded-md transition-colors cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>

            {/* Prominent Author & Publisher Byline */}
            {authorProfile && (
              <div className="flex items-center gap-3 pt-0.5">
                <Link to={`/profile/${authorProfile.uid}`} className="relative shrink-0 group">
                  <UserAvatar user={authorProfile} size="sm" showPresence />
                </Link>
                <div className="flex items-center gap-2 flex-wrap text-xs sm:text-sm">
                  <span className="text-[#6E6E77] dark:text-[#9E9EA8]">Written & Published by</span>
                  <Link
                    to={`/profile/${authorProfile.uid}`}
                    className="font-semibold text-[#202020] dark:text-[#F4F4F6] hover:text-[#E43136] transition-colors inline-flex items-center gap-1.5"
                  >
                    <span>{authorProfile.displayName}</span>
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-[#E43136]/15 text-[#E43136] tracking-wide">
                      Author
                    </span>
                  </Link>
                  <span className="text-[#8E8E98] text-xs">@{authorProfile.username}</span>
                  {currentUser?.uid !== authorProfile.uid && (
                    <button
                      type="button"
                      onClick={() => toggleFollowUser(authorProfile)}
                      className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold transition-colors cursor-pointer ${
                        isFollowingAuthor
                          ? 'bg-black/5 dark:bg-white/10 text-[#6E6E77] dark:text-[#9E9EA8]'
                          : 'bg-[#E43136]/10 text-[#E43136] hover:bg-[#E43136] hover:text-white'
                      }`}
                    >
                      {isFollowingAuthor ? 'Following' : '+ Follow'}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Quick Ratings & Engagement Bar */}
            <div className="flex flex-wrap items-center gap-4 sm:gap-6 py-3 border-y border-[#F1F1F4] dark:border-[#2C2C35] text-xs sm:text-sm tabular-nums">
              <div className="flex items-center gap-1.5">
                <Star className="w-4 h-4 fill-[#E6A02C] text-[#E6A02C]" />
                <span className="font-bold text-[#202020] dark:text-[#F4F4F6]">
                  {book.rating.toFixed(1)}
                </span>
                <span className="text-xs text-[#777780]">
                  ({book.reviewsCount + bookReviews.length} reviews)
                </span>
              </div>

              <div className="flex items-center gap-1.5 text-[#777780] dark:text-[#9E9EA9]">
                <Eye className="w-4 h-4" />
                <span>{book.views.toLocaleString()} views</span>
              </div>

              <div className="flex items-center gap-1.5 text-[#777780] dark:text-[#9E9EA9]">
                <Heart className={`w-4 h-4 text-[#E43136] ${isLiked ? 'fill-[#E43136]' : ''}`} />
                <span>{totalBookLikes.toLocaleString()} likes</span>
              </div>

              <button
                type="button"
                onClick={() =>
                  discussionSectionRef.current?.scrollIntoView({ behavior: 'smooth' })
                }
                className="flex items-center gap-1.5 text-[#777780] dark:text-[#9E9EA9] hover:text-[#E43136] transition-colors cursor-pointer"
              >
                <MessageCircle className="w-4 h-4 text-[#E43136]" />
                <span>{totalBookCommentsCount.toLocaleString()} comments</span>
              </button>

              <div className="flex items-center gap-1.5 text-[#777780] dark:text-[#9E9EA9]">
                <Bookmark className="w-4 h-4" />
                <span>{book.saves.toLocaleString()} saves</span>
              </div>
            </div>

            {/* Story Description (Cleaned of duplicates) */}
            <p className="text-sm sm:text-base text-[#303038] dark:text-[#DDDDE6] leading-relaxed whitespace-pre-line font-normal">
              {cleanDescriptionText(book.description)}
            </p>

            {/* Structured Reading & Engagement Controls Bar */}
            <div className="pt-2 flex flex-col gap-3">
              {/* Row 1: Primary Reading & Co-reading CTAs */}
              <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
                {(!book.availableModes?.length || book.availableModes.includes('text')) && (
                  <button
                    type="button"
                    onClick={() => navigate(`/read/${book.id}?mode=text`)}
                    className="py-2.5 px-5 sm:py-3 sm:px-6 rounded-xl bg-[#E43136] hover:bg-[#B9272D] text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap shadow-xs cursor-pointer active:scale-98"
                  >
                    <BookOpen className="w-4 h-4" />
                    <span>Read Book</span>
                  </button>
                )}

                {(book.availableModes?.length
                  ? book.availableModes.includes('pdf')
                  : book.format === 'pdf' || Boolean(book.fileURL)) && (
                  <button
                    type="button"
                    onClick={() => navigate(`/read/${book.id}?mode=pdf`)}
                    className="py-2.5 px-4 sm:py-3 sm:px-5 rounded-xl border border-[#DDDDE3] dark:border-[#2C2C35] hover:border-[#E43136] bg-white dark:bg-[#181820] text-[#202020] dark:text-[#F4F4F6] text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer active:scale-98"
                  >
                    <FileText className="w-4 h-4 text-[#E43136]" />
                    <span>Original PDF</span>
                  </button>
                )}

                {(!book.availableModes?.length || book.availableModes.includes('audio')) && (
                  <button
                    type="button"
                    onClick={() => navigate(`/read/${book.id}?mode=audio`)}
                    className="py-2.5 px-4 sm:py-3 sm:px-5 rounded-xl bg-[#FFF3F4] dark:bg-[#2D1619] border border-[#E43136]/40 text-[#E43136] hover:bg-[#E43136] hover:text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer active:scale-98"
                  >
                    <Headphones className="w-4 h-4" />
                    <span>Audio Reader</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setShowReadTogetherModal(true)}
                  className="py-2.5 px-4 sm:py-3 sm:px-5 rounded-xl bg-linear-to-r from-[#E43136]/10 to-rose-500/10 hover:from-[#E43136]/20 hover:to-rose-500/20 border border-[#E43136]/30 text-[#E43136] text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer active:scale-98"
                >
                  <Users className="w-4 h-4" />
                  <span>Read Together</span>
                </button>
              </div>

              {/* Row 2: Secondary Utility Toolbar (Like, Save, Share, Discuss, Report) */}
              <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setLikePop(true);
                    setTimeout(() => setLikePop(false), 380);
                    toggleLikeBook(book);
                  }}
                  className={`py-2 px-3.5 sm:px-4 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
                    isLiked
                      ? 'bg-[#FFF3F4] dark:bg-[#2D1619] border-[#E43136] text-[#E43136]'
                      : 'border-[#DDDDE3] dark:border-[#2C2C35] bg-white dark:bg-[#181820] text-[#202020] dark:text-[#F4F4F6] hover:border-[#E43136]'
                  }`}
                >
                  <Heart
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${
                      isLiked ? 'fill-[#E43136]' : ''
                    } ${likePop ? 'scale-125' : 'scale-100'}`}
                  />
                  <span>
                    {isLiked ? 'Liked' : 'Like'} ({totalBookLikes.toLocaleString()})
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => toggleSaveBook(book)}
                  className={`py-2 px-3.5 sm:px-4 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
                    isSaved
                      ? 'bg-[#FFF3F4] dark:bg-[#2D1619] border-[#E43136] text-[#E43136]'
                      : 'border-[#DDDDE3] dark:border-[#2C2C35] bg-white dark:bg-[#181820] text-[#202020] dark:text-[#F4F4F6] hover:border-[#E43136]'
                  }`}
                >
                  <Bookmark className={`w-3.5 h-3.5 ${isSaved ? 'fill-[#E43136]' : ''}`} />
                  <span>{isSaved ? 'Saved' : 'Save'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowShareModal(true)}
                  className="py-2 px-3.5 sm:px-4 rounded-xl border border-[#DDDDE3] dark:border-[#2C2C35] bg-white dark:bg-[#181820] text-xs font-medium text-[#202020] dark:text-[#F4F4F6] hover:border-[#E43136] inline-flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5 text-[#E43136]" />
                  <span>Share</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setDiscussionTab('book');
                    discussionSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="py-2 px-3.5 sm:px-4 rounded-xl border border-[#DDDDE3] dark:border-[#2C2C35] bg-white dark:bg-[#181820] text-xs font-medium text-[#202020] dark:text-[#F4F4F6] hover:border-[#E43136] inline-flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <MessageCircle className="w-3.5 h-3.5 text-[#E43136]" />
                  <span>Discuss ({totalBookCommentsCount})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setReportModalOpen(true)}
                  className="py-2 px-2.5 rounded-xl text-xs font-medium text-[#8E8E98] hover:text-[#D9363E] inline-flex items-center gap-1 transition-colors whitespace-nowrap cursor-pointer ml-auto"
                  title="Report Book"
                >
                  <Flag className="w-3.5 h-3.5" />
                  <span>Report</span>
                </button>
              </div>
            </div>

            {/* Liked By Readers Bar */}
            <LikedByBar
              postId={bookPubPostKey}
              baseLikesCount={book.likes}
              bookForSync={book}
            />

            {/* Dedicated Author & Publisher Profile Showcase */}
            {authorProfile && (
              <div className="mt-8 pt-6 border-t border-[#F1F1F4] dark:border-[#2C2C35]">
                <div className="rounded-2xl bg-[#F9F9FB] dark:bg-[#111116] border border-[#DDDDE3] dark:border-[#262630] p-4 sm:p-6 shadow-2xs">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* Left: Avatar + Names + Badges */}
                    <div className="flex items-start sm:items-center gap-3.5 sm:gap-4 min-w-0">
                      <Link to={`/profile/${authorProfile.uid}`} className="shrink-0 relative group">
                        <UserAvatar user={authorProfile} size="lg" showPresence />
                      </Link>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link
                            to={`/profile/${authorProfile.uid}`}
                            className="font-display text-base sm:text-lg font-bold text-[#202020] dark:text-[#F4F4F6] hover:text-[#E43136] transition-colors truncate"
                          >
                            {authorProfile.displayName}
                          </Link>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#E43136]/15 text-[#E43136]">
                            <Award className="w-3 h-3" />
                            Author & Publisher
                          </span>
                        </div>
                        <p className="text-xs text-[#777780] dark:text-[#9E9EA9] mt-0.5">
                          @{authorProfile.username}
                        </p>

                        {/* Author Stats Row */}
                        <div className="flex items-center gap-4 text-xs text-[#777780] dark:text-[#9E9EA9] mt-2">
                          <span>
                            <strong className="text-[#202020] dark:text-white font-semibold">
                              {authorBooksCount}
                            </strong>{' '}
                            {authorBooksCount === 1 ? 'Book' : 'Books'}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>
                            <strong className="text-[#202020] dark:text-white font-semibold">
                              {authorProfile.followersCount.toLocaleString()}
                            </strong>{' '}
                            Followers
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Author Actions (Follow, Message, View Profile) */}
                    <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap shrink-0">
                      {currentUser?.uid !== authorProfile.uid && (
                        <>
                          <button
                            type="button"
                            onClick={() => toggleFollowUser(authorProfile)}
                            className={`py-2 px-4 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer shadow-xs ${
                              isFollowingAuthor
                                ? 'bg-[#E5E5EB] dark:bg-[#22222C] text-[#202020] dark:text-[#F4F4F6] hover:bg-black/10'
                                : 'bg-[#E43136] text-white hover:bg-[#B9272D]'
                            }`}
                          >
                            {isFollowingAuthor ? 'Following' : 'Follow Author'}
                          </button>

                          <button
                            type="button"
                            onClick={handleMessageAuthor}
                            className="py-2 px-3.5 rounded-xl border border-[#DDDDE3] dark:border-[#2C2C35] hover:border-[#E43136] bg-white dark:bg-[#181820] text-xs font-semibold text-[#202020] dark:text-[#F4F4F6] inline-flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
                            title="Send direct message to author"
                          >
                            <MessageSquare className="w-3.5 h-3.5 text-[#E43136]" />
                            <span>Message</span>
                          </button>
                        </>
                      )}

                      <Link
                        to={`/profile/${authorProfile.uid}`}
                        className="py-2 px-3.5 rounded-xl border border-[#DDDDE3] dark:border-[#2C2C35] hover:border-[#E43136] bg-white dark:bg-[#181820] text-xs font-semibold text-[#202020] dark:text-[#F4F4F6] whitespace-nowrap transition-colors"
                      >
                        View Profile →
                      </Link>
                    </div>
                  </div>

                  {/* Author Bio */}
                  {authorProfile.bio && (
                    <p className="mt-3.5 pt-3 border-t border-[#EAEAEF] dark:border-[#1E1E28] text-xs sm:text-sm text-[#555560] dark:text-[#B0B0BC] leading-relaxed">
                      {authorProfile.bio}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dedicated Book Discussion & Wattpad Paragraph Comments Hub */}
      <section
        id="book-discussion-section"
        ref={discussionSectionRef}
        className="bg-white dark:bg-[#16161A] rounded-2xl border border-[#DDDDE3] dark:border-[#2C2C35] p-5 sm:p-8 space-y-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#F1F1F4] dark:border-[#2C2C35]">
          <div>
            <div className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-[#E43136]" />
              <h2 className="font-display text-lg sm:text-xl font-bold text-[#202020] dark:text-[#F4F4F6]">
                Book Discussion & Reader Comments ({totalBookCommentsCount})
              </h2>
            </div>
            <p className="text-xs text-[#777780] dark:text-[#9E9EA9] mt-1">
              Discuss "{book.title}" with the community, join chapter threads, or explore Wattpad-style paragraph reactions inside the book.
            </p>
          </div>

          {/* 3-Mode Discussion Selector */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-[#FAFAFB] dark:bg-[#0F0F12] border border-[#DDDDE3] dark:border-[#2C2C35] self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setDiscussionTab('book')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                discussionTab === 'book'
                  ? 'bg-[#E43136] text-white shadow-xs'
                  : 'text-[#777780] hover:text-[#202020] dark:hover:text-white'
              }`}
            >
              Book Discussion ({bookOverallComments.length})
            </button>
            <button
              type="button"
              onClick={() => setDiscussionTab('chapters')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                discussionTab === 'chapters'
                  ? 'bg-[#E43136] text-white shadow-xs'
                  : 'text-[#777780] hover:text-[#202020] dark:hover:text-white'
              }`}
            >
              Chapter Threads ({chapterCommentsList.length})
            </button>
            <button
              type="button"
              onClick={() => setDiscussionTab('paragraphs')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                discussionTab === 'paragraphs'
                  ? 'bg-[#E43136] text-white shadow-xs'
                  : 'text-[#777780] hover:text-[#202020] dark:hover:text-white'
              }`}
            >
              Paragraph Reactions ({paragraphCommentsList.length})
            </button>
          </div>
        </div>

        {discussionTab === 'book' && (
          <div className="space-y-3">
            <CommentThread
              postId={bookPubPostKey}
              postAuthorId={book.authorId}
              postAuthorName={book.authorName}
              targetTitle={book.title}
              postLink={`/book/${book.id}`}
              expanded={true}
              onToggleExpand={() => {}}
              quickReactions={BOOK_DISCUSSION_REACTIONS}
              placeholder={`Share your thoughts on "${book.title}" with @${authorProfile?.username || 'author'} and fellow readers...`}
              emptyMessage={`No comments in the main book discussion yet. Start the conversation about "${book.title}" below!`}
            />
          </div>
        )}

        {discussionTab === 'chapters' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                {Array.from({ length: totalChapterCount }, (_, i) => i + 1).map((chNum) => {
                  const countForCh = chapterCommentsList.filter(
                    (c) => c.chapterNumber === chNum
                  ).length;
                  return (
                    <button
                      key={chNum}
                      type="button"
                      onClick={() => setSelectedDiscussionChapter(chNum)}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                        selectedDiscussionChapter === chNum
                          ? 'bg-[#E43136] border-[#E43136] text-white'
                          : 'bg-[#FAFAFB] dark:bg-[#0F0F12] border-[#DDDDE3] dark:border-[#2C2C35] text-[#202020] dark:text-[#F4F4F6] hover:border-[#E43136]'
                      }`}
                    >
                      Chapter {chNum} {countForCh > 0 ? `(${countForCh})` : ''}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() =>
                  navigate(`/read/${book.id}?mode=text&ch=${selectedDiscussionChapter}`)
                }
                className="py-1.5 px-3 rounded-xl bg-[#FFF3F4] dark:bg-[#2D1619] text-[#E43136] text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-[#E43136] hover:text-white transition-colors cursor-pointer shrink-0"
              >
                <BookOpen className="w-3.5 h-3.5" />
                Read Chapter {selectedDiscussionChapter}
              </button>
            </div>

            <CommentThread
              postId={getChapterCommentPostId(book.id, selectedDiscussionChapter)}
              postAuthorId={book.authorId}
              postAuthorName={book.authorName}
              targetTitle={`${book.title} · Chapter ${selectedDiscussionChapter}`}
              postLink={`/read/${book.id}?mode=text&ch=${selectedDiscussionChapter}`}
              expanded={true}
              onToggleExpand={() => {}}
              quickReactions={BOOK_DISCUSSION_REACTIONS}
              placeholder={`Discuss Chapter ${selectedDiscussionChapter} of "${book.title}"...`}
              emptyMessage={`No comments on Chapter ${selectedDiscussionChapter} yet. Share what you thought of this chapter!`}
            />
          </div>
        )}

        {discussionTab === 'paragraphs' && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 bg-[#FAFAFB] dark:bg-[#0F0F12] border border-[#DDDDE3] dark:border-[#2C2C35] rounded-xl p-3.5">
              <div className="text-xs text-[#202020] dark:text-[#F4F4F6]">
                <span className="font-bold text-[#E43136]">Wattpad-Style Inline Paragraph Comments:</span>{' '}
                While reading in the Text Reader, every paragraph has its own comment bubble so you can react line-by-line!
              </div>
              <button
                type="button"
                onClick={() => navigate(`/read/${book.id}?mode=text`)}
                className="py-1.5 px-3 rounded-lg bg-[#E43136] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Open Reader & Comment Inline
              </button>
            </div>

            {paragraphCommentsList.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[420px] overflow-y-auto pr-1">
                {paragraphCommentsList.map(({ comment, chapterNumber, paragraphIdx }) => (
                  <div
                    key={comment.id}
                    className="p-3.5 rounded-xl bg-[#FAFAFB] dark:bg-[#0F0F12] border border-[#DDDDE3] dark:border-[#2C2C35] flex flex-col justify-between gap-2.5"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <UserAvatar
                            user={{
                              displayName: comment.userName,
                              photoURL: comment.userAvatar,
                            }}
                            size="xs"
                          />
                          <span className="text-xs font-bold text-[#202020] dark:text-[#F4F4F6] truncate">
                            {comment.userName}
                          </span>
                          <span className="text-[11px] text-[#777780] truncate">
                            @{comment.userUsername}
                          </span>
                        </div>
                        <span className="text-[10px] font-bold text-[#E43136] bg-[#FFF3F4] dark:bg-[#2D1619] px-2 py-0.5 rounded-md shrink-0 tabular-nums">
                          Ch. {chapterNumber} · Para #{paragraphIdx + 1}
                        </span>
                      </div>
                      <p className="text-xs text-[#202020] dark:text-[#F4F4F6] leading-relaxed">
                        {comment.text}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-[#F1F1F4] dark:border-[#2C2C35] text-[11px]">
                      <span className="text-[#777780]">
                        {new Date(comment.createdAt).toLocaleDateString()}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          navigate(
                            `/read/${book.id}?mode=text&ch=${chapterNumber}&para=${paragraphIdx}`
                          )
                        }
                        className="font-semibold text-[#E43136] hover:underline inline-flex items-center gap-1 cursor-pointer"
                      >
                        Jump to Paragraph & Reply →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center space-y-2 border border-dashed border-[#DDDDE3] dark:border-[#2C2C35] rounded-xl">
                <MessageSquare className="w-6 h-6 text-[#E43136] mx-auto" />
                <p className="text-xs font-semibold text-[#202020] dark:text-[#F4F4F6]">
                  No paragraph-level reactions yet
                </p>
                <p className="text-[11px] text-[#777780] max-w-md mx-auto">
                  Open the book in the Text Reader and click the comment icon next to any paragraph to leave the first Wattpad-style reaction!
                </p>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Reviews Section */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-5">
          <div className="bg-white dark:bg-[#16161A] rounded-2xl border border-[#DDDDE3] dark:border-[#2C2C35] p-6 space-y-4">
            <h2 className="font-display text-xl font-semibold text-[#202020] dark:text-[#F4F4F6]">
              Write a Review
            </h2>
            <p className="text-xs text-[#777780] dark:text-[#9E9EA9]">
              Share your thoughts with the author and fellow Redcover readers. One review per reader is synced in real time.
            </p>

            <form onSubmit={handleReviewSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#777780] mb-1.5">
                  Your Rating
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRatingInput(star)}
                      className="p-1 cursor-pointer"
                    >
                      <Star
                        className={`w-6 h-6 ${
                          star <= ratingInput
                            ? 'fill-[#E6A02C] text-[#E6A02C]'
                            : 'text-[#DDDDE3] dark:text-[#2C2C35]'
                        }`}
                      />
                    </button>
                  ))}
                  <span className="text-xs font-semibold ml-2 tabular-nums">
                    {ratingInput}.0 / 5.0
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#777780] mb-1.5">
                  Review Commentary
                </label>
                <textarea
                  rows={4}
                  required
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  placeholder="What stood out to you about this book?"
                  className="w-full rounded-xl bg-[#FAFAFB] dark:bg-[#0F0F12] border border-[#DDDDE3] dark:border-[#2C2C35] p-3 text-sm text-[#202020] dark:text-[#F4F4F6] focus:outline-none focus:border-[#E43136]"
                />
              </div>

              <button
                type="submit"
                disabled={submittingReview}
                className="w-full py-2.5 px-4 rounded-xl bg-[#E43136] hover:bg-[#B9272D] text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
              >
                {submittingReview ? 'Publishing Review...' : 'Submit Review'}
              </button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-7 space-y-4">
          <h2 className="font-display text-xl font-semibold text-[#202020] dark:text-[#F4F4F6]">
            Reader Reviews ({bookReviews.length})
          </h2>

          {bookReviews.length > 0 ? (
            <div className="space-y-3">
              {bookReviews.map((rev) => (
                <div
                  key={rev.id}
                  className="bg-white dark:bg-[#16161A] rounded-xl border border-[#DDDDE3] dark:border-[#2C2C35] p-4 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <Link
                      to={`/profile/${rev.userId}`}
                      className="flex items-center gap-2.5 text-sm font-semibold text-[#202020] dark:text-[#F4F4F6] hover:text-[#E43136]"
                    >
                      <UserAvatar
                        user={{
                          displayName: rev.userName,
                          photoURL: rev.userAvatar,
                          isOnline: false,
                          showOnlineStatus: false,
                        }}
                        size="sm"
                      />
                      <span>{rev.userName}</span>
                    </Link>
                    <div className="flex items-center gap-1 text-xs tabular-nums">
                      <Star className="w-3.5 h-3.5 fill-[#E6A02C] text-[#E6A02C]" />
                      <span className="font-semibold">{rev.rating}.0</span>
                      <span className="text-[#777780] ml-2">
                        {new Date(rev.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-[#202020] dark:text-[#F4F4F6] leading-relaxed">
                    {rev.text}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No reader reviews yet"
              description="Be the first reader to rate and review this book."
            />
          )}
        </div>
      </section>

      {/* Related Books */}
      {relatedBooks.length > 0 && (
        <section>
          <SectionHeader
            title="Related Books"
            subtitle={`More in ${book.category} and by ${book.authorName}`}
            actionLabel="Explore More"
            actionTo="/explore"
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-5">
            {relatedBooks.map((rel) => (
              <BookCard
                key={rel.id}
                book={rel}
                isSaved={savedBooks.some((s) => s.bookId === rel.id)}
                isLiked={likedBooks.some((l) => l.bookId === rel.id)}
                onToggleSave={toggleSaveBook}
                onToggleLike={toggleLikeBook}
              />
            ))}
          </div>
        </section>
      )}

      {/* Report Modal */}
      {reportModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#16161A] rounded-2xl border border-[#DDDDE3] dark:border-[#2C2C35] max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-semibold text-[#202020] dark:text-[#F4F4F6]">
              Report "{book.title}"
            </h3>
            <p className="text-xs text-[#777780] dark:text-[#9E9EA9]">
              Please describe why this book violates Redcover community guidelines or copyright policy.
            </p>
            <form onSubmit={handleReportSubmit} className="space-y-4">
              <textarea
                rows={4}
                required
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                placeholder="Reason for reporting..."
                className="w-full rounded-xl bg-[#FAFAFB] dark:bg-[#0F0F12] border border-[#DDDDE3] dark:border-[#2C2C35] p-3 text-sm"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReportModalOpen(false)}
                  className="py-2 px-4 rounded-lg text-xs font-medium text-[#777780] hover:text-[#202020] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="py-2 px-4 rounded-lg bg-[#D9363E] text-white text-xs font-semibold hover:bg-[#B9272D] cursor-pointer"
                >
                  Submit Report
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Share Book to Chat Modal */}
      <ShareBookModal
        book={book}
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        friends={acceptedFriends}
        onShareToFriends={async (recipientUids, personalMessage) => {
          await shareBookToFriends(book, recipientUids, personalMessage);
          addToast('Book shared to selected friends!', 'success');
        }}
      />

      {/* Invite Friends to Read Together Modal */}
      <InviteToReadModal
        book={book}
        isOpen={showReadTogetherModal}
        onClose={() => setShowReadTogetherModal(false)}
        friends={acceptedFriends}
        allUsers={users}
        onInviteToRead={async (targetUser, personalMessage) => {
          const { sessionId } = await inviteToReadTogether(book, targetUser, personalMessage);
          addToast(`Invited ${targetUser.displayName} to read together!`, 'success');
          navigate(`/hub/reading?sessionId=${sessionId}`);
        }}
      />
    </div>
  );
};

// ============================================================================
// PROFESSIONAL EBOOK READING ENGINE (TEXT READER · ORIGINAL PDF · AUDIO READER)
// ============================================================================

export type ReadingMode = 'text' | 'pdf' | 'audio';
export type ReaderAppearance = 'light' | 'sepia' | 'dark' | 'black';
export type ReaderFontFamily = 'serif' | 'classic' | 'sans' | 'mono';
export type ReaderLineSpacing = 'compact' | 'comfortable' | 'relaxed' | 'loose';
export type ReaderParaSpacing = 'compact' | 'standard' | 'spacious';
export type ReaderTextAlign = 'left' | 'justify';
export type ReaderColumnWidth = 'narrow' | 'standard' | 'wide';
export type ReaderLayoutFlow = 'continuous' | 'paginated';
export type HighlightColor = 'amber' | 'rose' | 'emerald' | 'sky';

export interface SavedBookmarkItem {
  id: string;
  mode: 'text' | 'pdf';
  chapterIndex: number;
  chapterTitle: string;
  paragraphIndex: number;
  pdfPage?: number;
  snippet: string;
  note: string;
  createdAt: string;
}

export interface SavedHighlightItem {
  id: string;
  chapterIndex: number;
  chapterTitle: string;
  paragraphIndex: number;
  selectedText: string;
  color: HighlightColor;
  note: string;
  createdAt: string;
}

interface StructuredBookmarkPayload {
  v: 2;
  note: string;
  paragraphIndex: number;
  pdfPage: number;
  totalPdfPages: number;
  readingSeconds: number;
  completedChapters: number[];
  bookmarks: SavedBookmarkItem[];
  highlights: SavedHighlightItem[];
}

interface ReaderUserPreferences {
  appearance: ReaderAppearance;
  fontSize: number;
  fontFamily: ReaderFontFamily;
  lineSpacing: ReaderLineSpacing;
  paraSpacing: ReaderParaSpacing;
  textAlign: ReaderTextAlign;
  columnWidth: ReaderColumnWidth;
  layoutFlow: ReaderLayoutFlow;
  rememberPosition: boolean;
  autoNextChapter: boolean;
  keepScreenAwake: boolean;
}

const DEFAULT_READER_PREFS: ReaderUserPreferences = {
  appearance: 'light',
  fontSize: 18,
  fontFamily: 'serif',
  lineSpacing: 'relaxed',
  paraSpacing: 'standard',
  textAlign: 'left',
  columnWidth: 'standard',
  layoutFlow: 'continuous',
  rememberPosition: true,
  autoNextChapter: true,
  keepScreenAwake: false,
};

function parseStructuredBookmarkNote(raw: string | undefined): StructuredBookmarkPayload {
  const empty: StructuredBookmarkPayload = {
    v: 2,
    note: '',
    paragraphIndex: 0,
    pdfPage: 1,
    totalPdfPages: 1,
    readingSeconds: 0,
    completedChapters: [],
    bookmarks: [],
    highlights: [],
  };
  if (!raw || typeof raw !== 'string') return empty;
  const trimmed = raw.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object') {
        return {
          v: 2,
          note: typeof parsed.note === 'string' ? parsed.note : '',
          paragraphIndex: Number(parsed.paragraphIndex) || 0,
          pdfPage: Math.max(1, Number(parsed.pdfPage) || 1),
          totalPdfPages: Math.max(1, Number(parsed.totalPdfPages) || 1),
          readingSeconds: Math.max(0, Number(parsed.readingSeconds) || 0),
          completedChapters: Array.isArray(parsed.completedChapters)
            ? parsed.completedChapters.map(Number)
            : [],
          bookmarks: Array.isArray(parsed.bookmarks) ? parsed.bookmarks : [],
          highlights: Array.isArray(parsed.highlights) ? parsed.highlights : [],
        };
      }
    } catch {
      // Plain text note from legacy record
    }
  }
  return {
    ...empty,
    note: trimmed,
  };
}

function serializeStructuredBookmarkNote(payload: StructuredBookmarkPayload): string {
  const json = JSON.stringify(payload);
  if (json.length <= 4950) return json;
  // Trim oldest highlights/bookmarks if approaching Firestore's 5000-char limit
  const compact: StructuredBookmarkPayload = {
    ...payload,
    bookmarks: payload.bookmarks.slice(0, 12),
    highlights: payload.highlights.slice(0, 15).map((h) => ({
      ...h,
      selectedText: h.selectedText.slice(0, 140),
      note: h.note.slice(0, 120),
    })),
  };
  return JSON.stringify(compact).slice(0, 4980);
}

function formatDurationHuman(totalSeconds: number): string {
  const secs = Math.max(0, Math.round(totalSeconds));
  const hrs = Math.floor(secs / 3600);
  const mins = Math.floor((secs % 3600) / 60);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  if (mins > 0) return `${mins}m ${secs % 60}s`;
  return `${secs}s`;
}

export const ReaderPage: React.FC = () => {
  const { bookId } = useParams<{ bookId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const {
    books,
    users,
    readingProgress,
    currentUser,
    firebaseUser,
    getBookChapters,
    saveReadingProgress,
    addToast,
    theme,
    setTheme,
    postComments,
    postLikes,
    toggleLikeComment,
    addPostComment,
    editPostComment,
    deletePostComment,
    submitReport,
    isAdmin,
    incrementBookView,
  } = useRedcover();

  const book = useMemo(() => books.find((b) => b.id === bookId), [books, bookId]);
  const existingProgress = useMemo(
    () => readingProgress.find((p) => p.bookId === bookId),
    [readingProgress, bookId]
  );
  const availableModes = useMemo(
    () =>
      book?.availableModes?.length
        ? book.availableModes
        : book?.format === 'pdf' || book?.fileURL
        ? ['text', 'pdf', 'audio']
        : ['text', 'audio'],
    [book?.availableModes, book?.fileURL, book?.format]
  );

  // Exactly 1 view per user tracked (deduplicated across Details page & Reader)
  useEffect(() => {
    if (book) {
      incrementBookView(book);
    }
  }, [book?.id, incrementBookView]);

  // Determine initial mode from query params (`?mode=text|pdf|audio` or legacy `?audio=1`)
  const initialModeParam = searchParams.get('mode') as ReadingMode | null;
  const legacyAudioParam = searchParams.get('audio') === '1';
  const [readingMode, setReadingMode] = useState<ReadingMode>(
    initialModeParam === 'pdf' || initialModeParam === 'audio' || initialModeParam === 'text'
      ? initialModeParam
      : legacyAudioParam
      ? 'audio'
      : 'text'
  );

  useEffect(() => {
    if (!book || availableModes.includes(readingMode)) return;
    setReadingMode((availableModes[0] as ReadingMode) || 'text');
  }, [book?.id, availableModes, readingMode]);

  // Load persisted user reading preferences
  const prefsStorageKey = `rc_reader_prefs_${currentUser?.uid || 'guest'}`;
  const [prefs, setPrefs] = useState<ReaderUserPreferences>(() => {
    try {
      const raw = localStorage.getItem(prefsStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        return { ...DEFAULT_READER_PREFS, ...parsed };
      }
    } catch {}
    return {
      ...DEFAULT_READER_PREFS,
      appearance: theme === 'dark' ? 'dark' : 'light',
    };
  });

  const updatePref = useCallback(
    <K extends keyof ReaderUserPreferences>(key: K, val: ReaderUserPreferences[K]) => {
      setPrefs((prev) => {
        const next = { ...prev, [key]: val };
        try {
          localStorage.setItem(prefsStorageKey, JSON.stringify(next));
        } catch {}
        return next;
      });
    },
    [prefsStorageKey]
  );

  // Chapters & Loading
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loadingChapters, setLoadingChapters] = useState<boolean>(true);
  const [chapterError, setChapterError] = useState<string>('');
  const [currentChapterIndex, setCurrentChapterIndex] = useState<number>(0);
  const [paginatedSectionIdx, setPaginatedSectionIdx] = useState<number>(0);

  // Structured Progress, Bookmarks, Highlights & Notes State
  const localAnnotationsKey = `rc_reader_state_${currentUser?.uid || 'guest'}_${bookId || 'book'}`;
  const [personalNote, setPersonalNote] = useState<string>('');
  const [currentParagraphIdx, setCurrentParagraphIdx] = useState<number>(0);
  const [currentPdfPage, setCurrentPdfPage] = useState<number>(1);
  const [totalPdfPages, setTotalPdfPages] = useState<number>(1);
  const [maxPdfPageReached, setMaxPdfPageReached] = useState<number>(1);
  const [bookReadingSeconds, setBookReadingSeconds] = useState<number>(0);
  const [completedChapters, setCompletedChapters] = useState<number[]>([]);
  const [bookmarksList, setBookmarksList] = useState<SavedBookmarkItem[]>([]);
  const [highlightsList, setHighlightsList] = useState<SavedHighlightItem[]>([]);
  const [isBookmarked, setIsBookmarked] = useState<boolean>(false);

  // Drawers & Modals (Only one drawer open at a time)
  const [tocOpen, setTocOpen] = useState<boolean>(false);
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const [annotationsOpen, setAnnotationsOpen] = useState<boolean>(false);
  const [discussionOpen, setDiscussionOpen] = useState<boolean>(false);
  const [discussionDrawerTab, setDiscussionDrawerTab] = useState<'chapter' | 'book' | 'paragraphs'>('chapter');
  const [endOfChapterTab, setEndOfChapterTab] = useState<'chapter' | 'book'>('chapter');
  const [showInlineComments, setShowInlineComments] = useState<boolean>(true);
  const [expandedParagraphComments, setExpandedParagraphComments] = useState<Record<number, boolean>>({});
  const [annotationsFilter, setAnnotationsFilter] = useState<'all' | 'bookmarks' | 'highlights'>('all');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [immersiveBarsHidden, setImmersiveBarsHidden] = useState<boolean>(false);

  // Simple Paragraph Comment Drawer & AI Audio Normalizer States
  const [selectedSimpleParagraphIdx, setSelectedSimpleParagraphIdx] = useState<number | null>(null);
  const [simpleCommentInput, setSimpleCommentInput] = useState<string>('');
  const [isPostingSimpleComment, setIsPostingSimpleComment] = useState<boolean>(false);
  const [replyingToComment, setReplyingToComment] = useState<any | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState<string>('');
  const [isNormalizingAi, setIsNormalizingAi] = useState<boolean>(false);
  const [aiNormalizedText, setAiNormalizedText] = useState<string | null>(null);

  // Text Selection Highlight Popover
  const [selectionPopover, setSelectionPopover] = useState<{
    text: string;
    paragraphIndex: number;
    x: number;
    y: number;
  } | null>(null);
  const [pendingHighlightNote, setPendingHighlightNote] = useState<string>('');
  const [showHighlightNoteInput, setShowHighlightNoteInput] = useState<boolean>(false);

  // Multi-Voice Audio System ("Many Voices") State
  const [systemVoices, setSystemVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>(VOICE_PERSONAS[0].id);
  const [customNativeVoiceURI, setCustomNativeVoiceURI] = useState<string>('');
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [isPausedAudio, setIsPausedAudio] = useState<boolean>(false);
  const [activeBlockIdx, setActiveBlockIdx] = useState<number>(0);

  const activeBlockIdxRef = useRef<number>(0);
  const isPlayingRef = useRef<boolean>(false);
  const paragraphRefs = useRef<Record<number, HTMLElement | null>>({});
  const mainReadingScrollRef = useRef<HTMLElement | null>(null);
  const audioUtteranceCacheRef = useRef<Map<string, string>>(new Map());
  const hydratedProgressRef = useRef<boolean>(false);

  // Keep Screen Awake via WakeLock API when enabled
  useEffect(() => {
    let wakeLockSentinel: any = null;
    if (prefs.keepScreenAwake && 'wakeLock' in navigator) {
      (navigator as any).wakeLock
        .request('screen')
        .then((sentinel: any) => {
          wakeLockSentinel = sentinel;
        })
        .catch(() => {});
    }
    return () => {
      if (wakeLockSentinel && typeof wakeLockSentinel.release === 'function') {
        wakeLockSentinel.release().catch(() => {});
      }
    };
  }, [prefs.keepScreenAwake]);

  // Load browser SpeechSynthesis voices
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const loadVoices = () => {
      const available = window.speechSynthesis.getVoices();
      if (available && available.length > 0) {
        setSystemVoices(available);
      }
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Hydrate chapters and saved progress from Firestore + localStorage
  const loadBookContent = useCallback(() => {
    if (!bookId) return;
    setLoadingChapters(true);
    setChapterError('');
    getBookChapters(bookId)
      .then((chaps) => {
        setChapters(chaps);

        // Merge local state and Firestore readingProgress
        let localParsed: Partial<StructuredBookmarkPayload> = {};
        try {
          const rawLocal = localStorage.getItem(localAnnotationsKey);
          if (rawLocal) localParsed = JSON.parse(rawLocal);
        } catch {}

        const firestoreParsed = parseStructuredBookmarkNote(existingProgress?.bookmarkNote);
        const mergedNote = firestoreParsed.note || localParsed.note || '';
        const mergedPara = firestoreParsed.paragraphIndex || localParsed.paragraphIndex || 0;
        const mergedPdfPage = Math.max(
          firestoreParsed.pdfPage || 1,
          localParsed.pdfPage || 1
        );
        const mergedSeconds = Math.max(
          firestoreParsed.readingSeconds || 0,
          localParsed.readingSeconds || 0
        );
        const mergedCompleted = Array.from(
          new Set([
            ...(firestoreParsed.completedChapters || []),
            ...(localParsed.completedChapters || []),
          ])
        );
        const mergedBookmarks =
          (firestoreParsed.bookmarks && firestoreParsed.bookmarks.length > 0
            ? firestoreParsed.bookmarks
            : localParsed.bookmarks) || [];
        const mergedHighlights =
          (firestoreParsed.highlights && firestoreParsed.highlights.length > 0
            ? firestoreParsed.highlights
            : localParsed.highlights) || [];

        setPersonalNote(mergedNote);
        setCurrentParagraphIdx(mergedPara);
        setActiveBlockIdx(mergedPara);
        activeBlockIdxRef.current = mergedPara;
        setCurrentPdfPage(mergedPdfPage);
        setMaxPdfPageReached(mergedPdfPage);
        setBookReadingSeconds(mergedSeconds);
        setCompletedChapters(mergedCompleted);
        setBookmarksList(mergedBookmarks);
        setHighlightsList(mergedHighlights);

        const chQueryParam = searchParams.get('ch');
        const paraQueryParam = searchParams.get('para');

        if (chQueryParam && chaps.length > 0) {
          const requestedChapIdx = Math.max(
            0,
            Math.min(chaps.length - 1, Number(chQueryParam) - 1)
          );
          setCurrentChapterIndex(requestedChapIdx);
        } else if (existingProgress && prefs.rememberPosition) {
          const idx = Math.max(
            0,
            Math.min(chaps.length - 1, existingProgress.currentChapter - 1)
          );
          setCurrentChapterIndex(idx);
          setIsBookmarked(existingProgress.isBookmarked);
        }

        if (paraQueryParam !== null && !Number.isNaN(Number(paraQueryParam))) {
          const targetPara = Math.max(0, Number(paraQueryParam));
          setCurrentParagraphIdx(targetPara);
          setActiveBlockIdx(targetPara);
          activeBlockIdxRef.current = targetPara;
          setShowInlineComments(true);
          setExpandedParagraphComments({ [targetPara]: true });
          window.setTimeout(() => {
            paragraphRefs.current[targetPara]?.scrollIntoView({
              behavior: 'smooth',
              block: 'center',
            });
          }, 250);
        }

        hydratedProgressRef.current = true;
        setLoadingChapters(false);
      })
      .catch((err: any) => {
        setChapterError(err?.message || 'Could not load book chapters.');
        setLoadingChapters(false);
      });
  }, [bookId, getBookChapters, existingProgress, localAnnotationsKey, prefs.rememberPosition, searchParams]);

  useEffect(() => {
    hydratedProgressRef.current = false;
    loadBookContent();
  }, [bookId, getBookChapters]);

  // Active Reading-Time Tracker (pauses automatically when document is hidden or window blurred)
  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.hidden) return;
      setBookReadingSeconds((s) => s + 1);
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  const totalChapters = Math.max(1, chapters.length);
  const currentChapter = chapters[currentChapterIndex] || {
    id: 'ch-1',
    bookId: book?.id || '',
    authorId: book?.authorId || '',
    bookStatus: 'published' as const,
    chapterNumber: 1,
    title: book?.title || 'Chapter 1',
    content: book?.description || '',
    createdAt: book?.createdAt || '',
    updatedAt: book?.updatedAt || '',
  };

  // Parse blocks for Text & Audio modes
  const contentBlocks = useMemo(() => {
    const raw = aiNormalizedText || currentChapter.content || '';
    return raw
      .split(/\n\s*\n/)
      .map((b) => b.trim())
      .filter(Boolean);
  }, [currentChapter.content, aiNormalizedText]);

  // Paginated section chunks when user chooses `paginated` layout flow in Text Mode
  const BLOCKS_PER_SECTION = 7;
  const totalPaginatedSections = Math.max(
    1,
    Math.ceil(contentBlocks.length / BLOCKS_PER_SECTION)
  );
  const visibleBlocksWithOriginalIdx = useMemo(() => {
    if (prefs.layoutFlow === 'paginated' && readingMode === 'text') {
      const start = paginatedSectionIdx * BLOCKS_PER_SECTION;
      return contentBlocks
        .slice(start, start + BLOCKS_PER_SECTION)
        .map((block, i) => ({ block, originalIdx: start + i }));
    }
    return contentBlocks.map((block, i) => ({ block, originalIdx: i }));
  }, [contentBlocks, prefs.layoutFlow, paginatedSectionIdx, readingMode]);

  // Real-time Book, Chapter, and Wattpad Paragraph Comment maps
  const bookCommentPostId = useMemo(
    () => (book ? getBookCommentPostId(book.id) : ''),
    [book]
  );
  const chapterCommentPostId = useMemo(
    () => (book ? getChapterCommentPostId(book.id, currentChapter.chapterNumber) : ''),
    [book, currentChapter.chapterNumber]
  );

  const {
    bookLevelCommentsCount,
    chapterLevelCommentsCount,
    paragraphCommentsByIdx,
    totalChapterParagraphCommentsCount,
    totalBookAllCommentsCount,
  } = useMemo(() => {
    const paraMap = new Map<number, typeof postComments>();
    if (!book) {
      return {
        bookLevelCommentsCount: 0,
        chapterLevelCommentsCount: 0,
        paragraphCommentsByIdx: paraMap,
        totalChapterParagraphCommentsCount: 0,
        totalBookAllCommentsCount: 0,
      };
    }

    let bCount = 0;
    let cCount = 0;
    let pChapCount = 0;
    let totalAll = 0;

    for (const c of postComments) {
      const parsed = parseBookScopedPostId(book.id, c.postId);
      if (!parsed) continue;
      totalAll += 1;
      if (parsed.scope === 'book') {
        bCount += 1;
      } else if (
        parsed.scope === 'chapter' &&
        parsed.chapterNumber === currentChapter.chapterNumber
      ) {
        cCount += 1;
      } else if (
        parsed.scope === 'paragraph' &&
        parsed.chapterNumber === currentChapter.chapterNumber &&
        typeof parsed.paragraphIdx === 'number'
      ) {
        pChapCount += 1;
        const list = paraMap.get(parsed.paragraphIdx) || [];
        list.push(c);
        paraMap.set(parsed.paragraphIdx, list);
      }
    }

    return {
      bookLevelCommentsCount: bCount,
      chapterLevelCommentsCount: cCount,
      paragraphCommentsByIdx: paraMap,
      totalChapterParagraphCommentsCount: pChapCount,
      totalBookAllCommentsCount: totalAll,
    };
  }, [book, postComments, currentChapter.chapterNumber]);

  const toggleParagraphCommentBox = useCallback(
    (idx: number) => {
      setExpandedParagraphComments((prev) => {
        const hasComments = (paragraphCommentsByIdx.get(idx)?.length || 0) > 0;
        const currentExpanded = prev[idx] ?? hasComments;
        return {
          ...prev,
          [idx]: !currentExpanded,
        };
      });
    },
    [paragraphCommentsByIdx]
  );

  // Calculate accurate completion percentage based on active reading mode
  const progressPercentage = useMemo(() => {
    if (readingMode === 'pdf' && totalPdfPages > 0) {
      return Math.min(100, Math.max(1, Math.round((maxPdfPageReached / totalPdfPages) * 100)));
    }
    const chapterBase = currentChapterIndex / totalChapters;
    const withinChapter =
      contentBlocks.length > 0
        ? Math.min(1, (currentParagraphIdx + 1) / contentBlocks.length) / totalChapters
        : 1 / totalChapters;
    return Math.min(100, Math.max(1, Math.round((chapterBase + withinChapter) * 100)));
  }, [
    readingMode,
    totalPdfPages,
    maxPdfPageReached,
    currentChapterIndex,
    totalChapters,
    contentBlocks.length,
    currentParagraphIdx,
  ]);

  // Persist structured state to localStorage immediately & debounce Firestore writes
  const persistReaderStateNow = useCallback(
    async (overrides?: Partial<StructuredBookmarkPayload> & { chapterIdx?: number; bookmarked?: boolean }) => {
      if (!book) return;
      const chapIdx = overrides?.chapterIdx ?? currentChapterIndex;
      const bookmarkedFlag = overrides?.bookmarked ?? isBookmarked;

      const structured: StructuredBookmarkPayload = {
        v: 2,
        note: overrides?.note ?? personalNote,
        paragraphIndex: overrides?.paragraphIndex ?? currentParagraphIdx,
        pdfPage: overrides?.pdfPage ?? currentPdfPage,
        totalPdfPages: overrides?.totalPdfPages ?? totalPdfPages,
        readingSeconds: overrides?.readingSeconds ?? bookReadingSeconds,
        completedChapters: overrides?.completedChapters ?? completedChapters,
        bookmarks: overrides?.bookmarks ?? bookmarksList,
        highlights: overrides?.highlights ?? highlightsList,
      };

      try {
        localStorage.setItem(localAnnotationsKey, JSON.stringify(structured));
      } catch {}

      const encodedNote = serializeStructuredBookmarkNote(structured);
      const pct =
        readingMode === 'pdf' && structured.totalPdfPages > 0
          ? Math.min(100, Math.max(1, Math.round((Math.max(maxPdfPageReached, structured.pdfPage) / structured.totalPdfPages) * 100)))
          : Math.min(100, Math.max(1, Math.round(((chapIdx + 1) / totalChapters) * 100)));

      await saveReadingProgress(
        book,
        chapIdx + 1,
        totalChapters,
        pct,
        bookmarkedFlag,
        encodedNote
      );
    },
    [
      book,
      currentChapterIndex,
      isBookmarked,
      personalNote,
      currentParagraphIdx,
      currentPdfPage,
      totalPdfPages,
      bookReadingSeconds,
      completedChapters,
      bookmarksList,
      highlightsList,
      localAnnotationsKey,
      readingMode,
      maxPdfPageReached,
      totalChapters,
      saveReadingProgress,
    ]
  );

  // Debounced auto-save every 12 seconds when state changes (avoids writing on every scroll event)
  useEffect(() => {
    if (!hydratedProgressRef.current || !book) return;
    const timer = window.setTimeout(() => {
      persistReaderStateNow();
    }, 12000);
    return () => window.clearTimeout(timer);
  }, [
    currentChapterIndex,
    currentParagraphIdx,
    currentPdfPage,
    bookmarksList.length,
    highlightsList.length,
    completedChapters.length,
  ]);

  // Global Reading Analytics across all user readingProgress records
  const readingAnalytics = useMemo(() => {
    const booksStartedCount = Math.max(1, readingProgress.length);
    const booksCompletedCount = readingProgress.filter((p) => p.percentage >= 98).length;
    const totalChaptersDone = readingProgress.reduce((acc, p) => {
      const parsed = parseStructuredBookmarkNote(p.bookmarkNote);
      return acc + Math.max(p.currentChapter, parsed.completedChapters.length);
    }, 0);
    const otherBooksSeconds = readingProgress
      .filter((p) => p.bookId !== bookId)
      .reduce((acc, p) => acc + parseStructuredBookmarkNote(p.bookmarkNote).readingSeconds, 0);
    const totalReadingSecs = otherBooksSeconds + bookReadingSeconds;
    return {
      totalReadingSecs,
      booksStartedCount,
      booksCompletedCount,
      totalChaptersDone: Math.max(completedChapters.length, totalChaptersDone),
    };
  }, [readingProgress, bookId, bookReadingSeconds, completedChapters.length]);

  // Clean text for speech synthesis and cache by stable block ID
  const cleanTextForSpeech = useCallback(
    (rawBlock: string, blockIdx: number): string => {
      const cacheKey = `${bookId}_${currentChapter.id}_${blockIdx}`;
      const cached = audioUtteranceCacheRef.current.get(cacheKey);
      if (cached !== undefined) return cached;

      if (
        rawBlock === '* * *' ||
        rawBlock === '***' ||
        rawBlock === '---' ||
        rawBlock.includes('─── ❖ ───') ||
        rawBlock === '=== PAGE BREAK ===' ||
        rawBlock === '[pagebreak]' ||
        (rawBlock.startsWith('[image:') && rawBlock.endsWith(']')) ||
        /^!\[([^\]]*)\]\(([^)]+)\)$/.test(rawBlock)
      ) {
        audioUtteranceCacheRef.current.set(cacheKey, '');
        return '';
      }

      const cleaned = rawBlock
        .replace(/^#{1,3}\s+/, '')
        .replace(/^>\s?/gm, '')
        .replace(/^[-*]\s+/gm, '')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/~~([^~]+)~~/g, '$1')
        .trim();

      audioUtteranceCacheRef.current.set(cacheKey, cleaned);
      return cleaned;
    },
    [bookId, currentChapter.id]
  );

  const selectedPersona = useMemo(
    () => VOICE_PERSONAS.find((p) => p.id === selectedPersonaId) || VOICE_PERSONAS[0],
    [selectedPersonaId]
  );

  const stopAudio = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    isPlayingRef.current = false;
    setIsPlayingAudio(false);
    setIsPausedAudio(false);
  }, []);

  const speakBlockAt = useCallback(
    (blockIndex: number) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        addToast('Speech synthesis is not supported in this browser.', 'error');
        return;
      }

      if (blockIndex >= contentBlocks.length) {
        // Mark current chapter completed
        setCompletedChapters((prev) =>
          prev.includes(currentChapter.chapterNumber)
            ? prev
            : [...prev, currentChapter.chapterNumber]
        );
        if (prefs.autoNextChapter && currentChapterIndex < totalChapters - 1) {
          const nextChap = currentChapterIndex + 1;
          setCurrentChapterIndex(nextChap);
          setActiveBlockIdx(0);
          activeBlockIdxRef.current = 0;
          setCurrentParagraphIdx(0);
          return;
        }
        stopAudio();
        return;
      }

      const rawBlock = contentBlocks[blockIndex] || '';
      const spokenText = cleanTextForSpeech(rawBlock, blockIndex);
      if (!spokenText) {
        speakBlockAt(blockIndex + 1);
        return;
      }

      window.speechSynthesis.cancel();
      setActiveBlockIdx(blockIndex);
      activeBlockIdxRef.current = blockIndex;
      setCurrentParagraphIdx(blockIndex);
      isPlayingRef.current = true;
      setIsPlayingAudio(true);
      setIsPausedAudio(false);

      // Ensure paginated view shows the spoken block
      if (prefs.layoutFlow === 'paginated') {
        setPaginatedSectionIdx(Math.floor(blockIndex / BLOCKS_PER_SECTION));
      }

      const el = paragraphRefs.current[blockIndex];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }

      const utterance = new SpeechSynthesisUtterance(spokenText);
      const voices = window.speechSynthesis.getVoices();

      if (customNativeVoiceURI) {
        const matched = voices.find((v) => v.voiceURI === customNativeVoiceURI);
        if (matched) {
          utterance.voice = matched;
          utterance.lang = matched.lang;
        }
        utterance.pitch = 1.0;
        utterance.rate = playbackSpeed;
      } else {
        const matched = pickVoiceForPersona(selectedPersona, voices);
        if (matched) {
          utterance.voice = matched;
          utterance.lang = matched.lang;
        }
        utterance.pitch = selectedPersona.pitch;
        utterance.rate = Math.max(
          0.5,
          Math.min(2.0, playbackSpeed * selectedPersona.rateMultiplier)
        );
      }

      utterance.onend = () => {
        if (!isPlayingRef.current) return;
        speakBlockAt(blockIndex + 1);
      };

      utterance.onerror = () => {};

      window.speechSynthesis.speak(utterance);
    },
    [
      contentBlocks,
      cleanTextForSpeech,
      prefs.autoNextChapter,
      prefs.layoutFlow,
      currentChapterIndex,
      currentChapter.chapterNumber,
      totalChapters,
      stopAudio,
      customNativeVoiceURI,
      selectedPersona,
      playbackSpeed,
      addToast,
    ]
  );

  const handleTogglePlayPause = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      addToast('Audio narration is not supported in this browser.', 'error');
      return;
    }
    if (isPlayingAudio && !isPausedAudio) {
      window.speechSynthesis.pause();
      setIsPausedAudio(true);
    } else if (isPlayingAudio && isPausedAudio) {
      window.speechSynthesis.resume();
      setIsPausedAudio(false);
    } else {
      speakBlockAt(activeBlockIdx);
    }
  };

  const handlePreviewVoice = (persona: VoicePersona) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    isPlayingRef.current = false;
    setIsPlayingAudio(false);
    setIsPausedAudio(false);

    const utterance = new SpeechSynthesisUtterance(persona.sampleText);
    const voices = window.speechSynthesis.getVoices();
    const matched = pickVoiceForPersona(persona, voices);
    if (matched) {
      utterance.voice = matched;
      utterance.lang = matched.lang;
    }
    utterance.pitch = persona.pitch;
    utterance.rate = Math.max(0.5, Math.min(2.0, playbackSpeed * persona.rateMultiplier));
    window.speechSynthesis.speak(utterance);
  };

  // Re-trigger active paragraph if voice or speed changes mid-narration
  useEffect(() => {
    if (isPlayingRef.current && !isPausedAudio) {
      speakBlockAt(activeBlockIdxRef.current);
    }
  }, [selectedPersonaId, customNativeVoiceURI, playbackSpeed]);

  // Mode Switching
  const handleSwitchMode = (nextMode: ReadingMode) => {
    if (nextMode === 'pdf' && readingMode !== 'pdf') {
      stopAudio();
    }
    setReadingMode(nextMode);
    setSearchParams({ mode: nextMode }, { replace: true });
  };

  // Chapter Navigation
  const handleChapterChange = async (newIndex: number, targetParagraph = 0) => {
    stopAudio();
    const clamped = Math.max(0, Math.min(totalChapters - 1, newIndex));
    const nextCompleted =
      newIndex > currentChapterIndex && !completedChapters.includes(currentChapter.chapterNumber)
        ? [...completedChapters, currentChapter.chapterNumber]
        : completedChapters;

    setCompletedChapters(nextCompleted);
    setCurrentChapterIndex(clamped);
    setPaginatedSectionIdx(0);
    setExpandedParagraphComments({});
    setCurrentParagraphIdx(targetParagraph);
    setActiveBlockIdx(targetParagraph);
    activeBlockIdxRef.current = targetParagraph;

    if (mainReadingScrollRef.current) {
      mainReadingScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }

    await persistReaderStateNow({
      chapterIdx: clamped,
      paragraphIndex: targetParagraph,
      completedChapters: nextCompleted,
    });
  };

  // Add or Toggle Bookmark for current position (Text Chapter/Paragraph or PDF Page)
  const handleToggleBookmarkCurrentPosition = async () => {
    if (readingMode === 'pdf') {
      const existingPdfBm = bookmarksList.find(
        (b) => b.mode === 'pdf' && b.pdfPage === currentPdfPage
      );
      let nextBookmarks: SavedBookmarkItem[];
      if (existingPdfBm) {
        nextBookmarks = bookmarksList.filter((b) => b.id !== existingPdfBm.id);
        addToast(`Removed bookmark from PDF Page ${currentPdfPage}.`, 'info');
      } else {
        const newBm: SavedBookmarkItem = {
          id: `bm_pdf_${currentPdfPage}_${Date.now()}`,
          mode: 'pdf',
          chapterIndex: currentChapterIndex,
          chapterTitle: `PDF Page ${currentPdfPage}`,
          paragraphIndex: 0,
          pdfPage: currentPdfPage,
          snippet: `${book?.title} — Page ${currentPdfPage} of ${totalPdfPages}`,
          note: '',
          createdAt: new Date().toISOString(),
        };
        nextBookmarks = [newBm, ...bookmarksList];
        addToast(`Bookmarked PDF Page ${currentPdfPage} successfully!`, 'success');
      }
      const hasAny = nextBookmarks.length > 0;
      setBookmarksList(nextBookmarks);
      setIsBookmarked(hasAny);
      await persistReaderStateNow({ bookmarks: nextBookmarks, bookmarked: hasAny });
      return;
    }

    const existingTextBm = bookmarksList.find(
      (b) =>
        b.mode === 'text' &&
        b.chapterIndex === currentChapterIndex &&
        b.paragraphIndex === currentParagraphIdx
    );

    let nextBookmarks: SavedBookmarkItem[];
    if (existingTextBm) {
      nextBookmarks = bookmarksList.filter((b) => b.id !== existingTextBm.id);
      addToast('Bookmark removed.', 'info');
    } else {
      const snippetText = (contentBlocks[currentParagraphIdx] || currentChapter.title)
        .replace(/^#+\s*/, '')
        .slice(0, 140);
      const newBm: SavedBookmarkItem = {
        id: `bm_txt_${currentChapterIndex}_${currentParagraphIdx}_${Date.now()}`,
        mode: 'text',
        chapterIndex: currentChapterIndex,
        chapterTitle: currentChapter.title,
        paragraphIndex: currentParagraphIdx,
        snippet: snippetText,
        note: '',
        createdAt: new Date().toISOString(),
      };
      nextBookmarks = [newBm, ...bookmarksList];
      addToast('Reading position bookmarked successfully!', 'success');
    }

    const hasAny = nextBookmarks.length > 0;
    setBookmarksList(nextBookmarks);
    setIsBookmarked(hasAny);
    await persistReaderStateNow({ bookmarks: nextBookmarks, bookmarked: hasAny });
  };

  // Text Selection Handler for Highlights & Notes
  const handleTextMouseUp = (paragraphIndex: number) => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) {
      return;
    }
    const text = sel.toString().trim();
    if (text.length < 3 || text.length > 600) return;

    try {
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setSelectionPopover({
        text,
        paragraphIndex,
        x: Math.max(140, Math.min(window.innerWidth - 140, rect.left + rect.width / 2)),
        y: Math.max(70, rect.top - 12),
      });
      setPendingHighlightNote('');
      setShowHighlightNoteInput(false);
    } catch {}
  };

  const handleCreateHighlight = async (color: HighlightColor, customNote = '') => {
    if (!selectionPopover) return;
    const newHighlight: SavedHighlightItem = {
      id: `hl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      chapterIndex: currentChapterIndex,
      chapterTitle: currentChapter.title,
      paragraphIndex: selectionPopover.paragraphIndex,
      selectedText: selectionPopover.text,
      color,
      note: customNote.trim(),
      createdAt: new Date().toISOString(),
    };
    const nextHighlights = [newHighlight, ...highlightsList];
    setHighlightsList(nextHighlights);
    setSelectionPopover(null);
    setPendingHighlightNote('');
    setShowHighlightNoteInput(false);
    window.getSelection()?.removeAllRanges();
    addToast(
      customNote.trim() ? 'Highlight & note saved successfully!' : 'Highlight saved successfully!',
      'success'
    );
    await persistReaderStateNow({ highlights: nextHighlights, bookmarked: true });
  };

  const handleDeleteHighlight = async (id: string) => {
    const next = highlightsList.filter((h) => h.id !== id);
    setHighlightsList(next);
    await persistReaderStateNow({ highlights: next });
  };

  const handleDeleteBookmark = async (id: string) => {
    const next = bookmarksList.filter((b) => b.id !== id);
    setBookmarksList(next);
    setIsBookmarked(next.length > 0);
    await persistReaderStateNow({ bookmarks: next, bookmarked: next.length > 0 });
  };

  const handlePostSimpleComment = async (customText?: string) => {
    if (selectedSimpleParagraphIdx === null || !book) return;
    const textToPost = (customText || simpleCommentInput).trim();
    if (!textToPost) return;
    const targetPostId = getParagraphCommentPostId(
      book.id,
      currentChapter.chapterNumber,
      selectedSimpleParagraphIdx
    );
    setIsPostingSimpleComment(true);
    try {
      await addPostComment(targetPostId, textToPost, null, {
        parentId: replyingToComment?.id,
        replyToUsername: replyingToComment?.userUsername,
        targetAuthorId: book.authorId,
        targetTitle: `${book.title} · Ch. ${currentChapter.chapterNumber} · Para #${selectedSimpleParagraphIdx + 1}`,
        link: `/read/${book.id}?mode=text&ch=${currentChapter.chapterNumber}&para=${selectedSimpleParagraphIdx}`,
      });
      setSimpleCommentInput('');
      setReplyingToComment(null);
      addToast('Paragraph comment posted!', 'success');
    } catch {
      addToast('Could not post paragraph comment.', 'error');
    } finally {
      setIsPostingSimpleComment(false);
    }
  };

  const handleEditParagraphComment = async (commentId: string) => {
    const cleanText = editingCommentText.trim();
    if (!cleanText) return;
    try {
      await editPostComment(commentId, cleanText);
      setEditingCommentId(null);
      setEditingCommentText('');
      addToast('Comment updated!', 'success');
    } catch {
      addToast('Could not update comment.', 'error');
    }
  };

  const handleDeleteParagraphComment = async (commentId: string) => {
    if (selectedSimpleParagraphIdx === null || !book) return;
    const confirmed = window.confirm('Are you sure you want to delete this paragraph comment?');
    if (!confirmed) return;
    const targetPostId = getParagraphCommentPostId(
      book.id,
      currentChapter.chapterNumber,
      selectedSimpleParagraphIdx
    );
    try {
      await deletePostComment(commentId, targetPostId);
      addToast('Comment deleted.', 'info');
    } catch {
      addToast('Could not delete comment.', 'error');
    }
  };

  const handleReportParagraphComment = async (cmt: any) => {
    const reason = window.prompt(
      'Report reason (e.g. spoilers, offensive, harassment):',
      'Inappropriate content'
    );
    if (!reason || !reason.trim()) return;
    try {
      await submitReport('comment', cmt.id, `Comment by @${cmt.userUsername || 'user'}`, reason.trim());
      addToast('Comment reported to moderators.', 'success');
    } catch {
      addToast('Could not report comment.', 'error');
    }
  };

  const handleNormalizeAudioWithAI = async () => {
    if (!currentChapter.content) return;
    setIsNormalizingAi(true);
    try {
      const cleanNarrative = await convertPdfTextToNarrative(
        currentChapter.content,
        currentChapter.title
      );
      setAiNormalizedText(cleanNarrative.text);
      addToast(
        'AI PDF Cleaner: Converted text into smooth narration for the audio reader!',
        'success'
      );
    } catch {
      addToast('AI normalization failed, standard text will be used.', 'info');
    } finally {
      setIsNormalizingAi(false);
    }
  };

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  if (!book) {
    return (
      <div className="p-8">
        <EmptyState
          title="Book Not Found"
          description="Could not load reader for this title."
          actionLabel="Return Home"
          actionTo="/"
        />
      </div>
    );
  }

  // Appearance Theme Tokens (Light, Sepia, Dark, Pure Black)
  const themeClasses =
    prefs.appearance === 'black'
      ? 'bg-black text-[#F5F5F7]'
      : prefs.appearance === 'dark'
      ? 'bg-[#141419] text-[#E8E8ED]'
      : prefs.appearance === 'sepia'
      ? 'bg-[#F6EFE2] text-[#2D2419]'
      : 'bg-[#FFFFFF] text-[#171717]';

  const toolbarClasses =
    prefs.appearance === 'black'
      ? 'bg-[#08080A] border-[#1F1F26] text-[#F5F5F7]'
      : prefs.appearance === 'dark'
      ? 'bg-[#1A1A22] border-[#2A2A35] text-[#E8E8ED]'
      : prefs.appearance === 'sepia'
      ? 'bg-[#EFE5D2] border-[#DFD2B8] text-[#2D2419]'
      : 'bg-[#FAF9FB] border-[#DDDCE3] text-[#171717]';

  const drawerSurfaceClasses =
    prefs.appearance === 'black'
      ? 'bg-[#0C0C0F] border-[#22222A] text-[#F5F5F7]'
      : prefs.appearance === 'dark'
      ? 'bg-[#1A1A22] border-[#2C2C36] text-[#E8E8ED]'
      : prefs.appearance === 'sepia'
      ? 'bg-[#F4EBDC] border-[#DFD2B8] text-[#2D2419]'
      : 'bg-white border-[#DDDCE3] text-[#171717]';

  const widthClass =
    prefs.columnWidth === 'narrow'
      ? 'max-w-[580px]'
      : prefs.columnWidth === 'wide'
      ? 'max-w-[880px]'
      : 'max-w-[700px]';

  const fontFamilyStyle =
    prefs.fontFamily === 'serif'
      ? 'Georgia, Cambria, "Times New Roman", Times, serif'
      : prefs.fontFamily === 'classic'
      ? 'Garamond, Baskerville, "Palatino Linotype", Georgia, serif'
      : prefs.fontFamily === 'mono'
      ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
      : 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

  const lineHeightClass =
    prefs.lineSpacing === 'compact'
      ? 'leading-[1.5]'
      : prefs.lineSpacing === 'comfortable'
      ? 'leading-[1.7]'
      : prefs.lineSpacing === 'loose'
      ? 'leading-[2.15]'
      : 'leading-[1.88]';

  const paraSpacingClass =
    prefs.paraSpacing === 'compact'
      ? 'space-y-3.5'
      : prefs.paraSpacing === 'spacious'
      ? 'space-y-7'
      : 'space-y-5';

  const isCurrentPositionBookmarked =
    readingMode === 'pdf'
      ? bookmarksList.some((b) => b.mode === 'pdf' && b.pdfPage === currentPdfPage)
      : bookmarksList.some(
          (b) => b.mode === 'text' && b.chapterIndex === currentChapterIndex
        ) || isBookmarked;

  const bookmarkedPdfPages = useMemo(
    () =>
      bookmarksList
        .filter((b) => b.mode === 'pdf' && typeof b.pdfPage === 'number')
        .map((b) => b.pdfPage as number),
    [bookmarksList]
  );

  // Render inline markdown + user highlights inside a paragraph
  const renderFormattedParagraphContent = (rawText: string, paragraphIndex: number) => {
    const paraHighlights = highlightsList.filter(
      (h) => h.chapterIndex === currentChapterIndex && h.paragraphIndex === paragraphIndex
    );

    const applyHighlightSpans = (segment: string) => {
      if (paraHighlights.length === 0) return segment;
      for (const hl of paraHighlights) {
        if (!hl.selectedText) continue;
        const idx = segment.indexOf(hl.selectedText);
        if (idx !== -1) {
          const before = segment.slice(0, idx);
          const match = segment.slice(idx, idx + hl.selectedText.length);
          const after = segment.slice(idx + hl.selectedText.length);
          const colorBg =
            hl.color === 'rose'
              ? 'bg-[#E43136]/25 border-b-2 border-[#E43136]'
              : hl.color === 'emerald'
              ? 'bg-emerald-400/30 border-b-2 border-emerald-500'
              : hl.color === 'sky'
              ? 'bg-sky-400/30 border-b-2 border-sky-500'
              : 'bg-amber-300/40 border-b-2 border-amber-500';
          return (
            <>
              {before}
              <mark
                onClick={(e) => {
                  e.stopPropagation();
                  setAnnotationsFilter('highlights');
                  setAnnotationsOpen(true);
                }}
                title={hl.note ? `Note: ${hl.note}` : 'Click to view highlight'}
                className={`text-current px-0.5 rounded-xs cursor-pointer ${colorBg}`}
              >
                {match}
              </mark>
              {after}
            </>
          );
        }
      }
      return segment;
    };

    const parts = rawText.split(/(\*\*[^*]+\*\*|\*[^*]+\*|~~[^~]+~~)/g);
    return parts.map((part, pIdx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={pIdx} className="font-bold">
            {applyHighlightSpans(part.slice(2, -2))}
          </strong>
        );
      }
      if (part.startsWith('*') && part.endsWith('*')) {
        return (
          <em key={pIdx} className="italic">
            {applyHighlightSpans(part.slice(1, -1))}
          </em>
        );
      }
      if (part.startsWith('~~') && part.endsWith('~~')) {
        return (
          <del key={pIdx} className="line-through opacity-75">
            {applyHighlightSpans(part.slice(2, -2))}
          </del>
        );
      }
      return <React.Fragment key={pIdx}>{applyHighlightSpans(part)}</React.Fragment>;
    });
  };

  return (
    <div
      className={`h-[100dvh] w-full flex flex-col overflow-hidden select-text transition-colors duration-150 ${themeClasses}`}
    >
      {/* ====================================================================
          FIXED TOP READING TOOLBAR
         ==================================================================== */}
      <header
        className={`shrink-0 z-30 border-b px-2.5 sm:px-5 h-14 flex items-center justify-between gap-2 transition-all duration-200 ${toolbarClasses} ${
          immersiveBarsHidden ? 'max-md:-translate-y-full max-md:h-0 max-md:overflow-hidden max-md:border-0' : ''
        }`}
      >
        {/* Left: Back + Table of Contents + Book & Chapter Title */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => {
              stopAudio();
              persistReaderStateNow();
              navigate(`/book/${book.id}`);
            }}
            className="p-2 rounded-lg hover:bg-current/10 inline-flex items-center gap-1 text-xs font-medium cursor-pointer shrink-0"
            title="Back to Book Details"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden lg:inline">Back</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setTocOpen((o) => !o);
              setSettingsOpen(false);
              setAnnotationsOpen(false);
              setDiscussionOpen(false);
            }}
            className={`p-2 rounded-lg inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer shrink-0 transition-colors ${
              tocOpen ? 'bg-[#E43136] text-white' : 'hover:bg-current/10'
            }`}
            title="Table of Contents & Analytics"
          >
            <List className="w-4 h-4" />
            <span className="hidden md:inline">Contents</span>
          </button>

          <div className="min-w-0 pl-1 border-l border-current/15 flex items-center gap-2">
            <div className="min-w-0">
              <h1 className="text-xs sm:text-sm font-bold truncate leading-tight">
                {book.title}
              </h1>
              <p className="text-[10px] sm:text-[11px] opacity-70 truncate leading-tight">
                {readingMode === 'pdf'
                  ? `Original PDF · Page ${currentPdfPage} of ${totalPdfPages}`
                  : currentChapter.title}
              </p>
            </div>
            {book.redCode && (
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(book.redCode || '');
                  addToast(`RedCode ${book.redCode} copied to clipboard!`, 'success');
                }}
                className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#E43136]/10 text-[#E43136] hover:bg-[#E43136]/20 font-mono text-[11px] font-bold border border-[#E43136]/20 shrink-0 cursor-pointer transition-colors"
                title="Click to copy 6-digit A-Z RedCode"
              >
                <KeyRound className="w-3 h-3" />
                <span>{book.redCode}</span>
              </button>
            )}
          </div>
        </div>

        {/* Center: Three Distinct Reading Modes Selector */}
        <div
          role="tablist"
          aria-label="Reading mode selector"
          className="inline-flex items-center rounded-xl border border-current/15 p-0.5 text-[11px] font-semibold shrink-0"
        >
          {availableModes.includes('text') && (
            <button
              type="button"
              role="tab"
              aria-selected={readingMode === 'text'}
              onClick={() => handleSwitchMode('text')}
              className={`px-2.5 py-1.5 rounded-lg inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                readingMode === 'text'
                  ? 'bg-[#E43136] text-white shadow-2xs'
                  : 'opacity-75 hover:opacity-100'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Text</span>
            </button>
          )}

          {availableModes.includes('pdf') && (
            <button
              type="button"
              role="tab"
              aria-selected={readingMode === 'pdf'}
              onClick={() => handleSwitchMode('pdf')}
              className={`px-2.5 py-1.5 rounded-lg inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                readingMode === 'pdf'
                  ? 'bg-[#E43136] text-white shadow-2xs'
                  : 'opacity-75 hover:opacity-100'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>PDF</span>
            </button>
          )}

          {availableModes.includes('audio') && (
            <button
              type="button"
              role="tab"
              aria-selected={readingMode === 'audio'}
              onClick={() => handleSwitchMode('audio')}
              className={`px-2.5 py-1.5 rounded-lg inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                readingMode === 'audio'
                  ? 'bg-[#E43136] text-white shadow-2xs'
                  : 'opacity-75 hover:opacity-100'
              }`}
            >
              <Headphones className="w-3.5 h-3.5" />
              <span>Audio</span>
              {isPlayingAudio && !isPausedAudio && (
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-ping" />
              )}
            </button>
          )}
        </div>

        {/* Right: Bookmark, Highlights/Notes Drawer, Single Settings Icon, Fullscreen */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleToggleBookmarkCurrentPosition}
            aria-label="Bookmark current position"
            title="Bookmark current position"
            className={`p-2 rounded-lg transition-colors cursor-pointer ${
              isCurrentPositionBookmarked
                ? 'text-[#E43136] bg-[#E43136]/10'
                : 'hover:bg-current/10'
            }`}
          >
            <BookMarked className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              setDiscussionOpen((o) => !o);
              setAnnotationsOpen(false);
              setSettingsOpen(false);
              setTocOpen(false);
            }}
            aria-label="Book and chapter discussions"
            title="Book & Chapter Comments"
            className={`p-2 rounded-lg inline-flex items-center gap-1 text-xs font-semibold transition-colors cursor-pointer ${
              discussionOpen
                ? 'bg-[#E43136] text-white'
                : 'hover:bg-current/10'
            }`}
          >
            <MessageCircle className="w-4 h-4" />
            {totalBookAllCommentsCount > 0 && (
              <span
                className={`hidden sm:inline text-[10px] px-1.5 py-0.2 rounded-full font-bold tabular-nums ${
                  discussionOpen
                    ? 'bg-white/20 text-white'
                    : 'bg-[#E43136]/15 text-[#E43136]'
                }`}
              >
                {totalBookAllCommentsCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setAnnotationsOpen((o) => !o);
              setSettingsOpen(false);
              setTocOpen(false);
              setDiscussionOpen(false);
            }}
            aria-label="Saved bookmarks, highlights, and notes"
            title="Bookmarks, Highlights & Notes"
            className={`p-2 rounded-lg inline-flex items-center gap-1 text-xs font-semibold transition-colors cursor-pointer ${
              annotationsOpen
                ? 'bg-[#E43136] text-white'
                : 'hover:bg-current/10'
            }`}
          >
            <Highlighter className="w-4 h-4" />
            {(bookmarksList.length + highlightsList.length > 0) && (
              <span className="hidden sm:inline text-[10px] px-1.5 py-0.2 rounded-full bg-[#E43136]/15 text-[#E43136] font-bold tabular-nums">
                {bookmarksList.length + highlightsList.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setSettingsOpen((o) => !o);
              setTocOpen(false);
              setAnnotationsOpen(false);
              setDiscussionOpen(false);
            }}
            aria-label="Reading settings"
            title="Reading Settings"
            className={`p-2 rounded-lg inline-flex items-center gap-1 text-xs font-semibold transition-colors cursor-pointer ${
              settingsOpen ? 'bg-[#E43136] text-white' : 'hover:bg-current/10'
            }`}
          >
            <Settings className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={toggleFullScreen}
            aria-label="Toggle fullscreen reader"
            title="Full screen"
            className="hidden sm:inline-flex p-2 rounded-lg hover:bg-current/10 cursor-pointer"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* ====================================================================
           FLOATING TEXT SELECTION HIGHLIGHT & NOTE POPOVER
         ==================================================================== */}
      {selectionPopover && readingMode === 'text' && (
        <div
          style={{
            left: `${selectionPopover.x}px`,
            top: `${selectionPopover.y}px`,
          }}
          className="fixed z-50 -translate-x-1/2 -translate-y-full bg-[#171717] text-white rounded-xl shadow-2xl border border-white/15 p-2 flex flex-col gap-2 min-w-[240px]"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              {(
                [
                  { id: 'amber', cls: 'bg-amber-400' },
                  { id: 'rose', cls: 'bg-[#E43136]' },
                  { id: 'emerald', cls: 'bg-emerald-400' },
                  { id: 'sky', cls: 'bg-sky-400' },
                ] as { id: HighlightColor; cls: string }[]
              ).map((col) => (
                <button
                  key={col.id}
                  type="button"
                  onClick={() => handleCreateHighlight(col.id, pendingHighlightNote)}
                  title={`Highlight ${col.id}`}
                  className={`w-5 h-5 rounded-full ${col.cls} hover:scale-110 transition-transform cursor-pointer border border-white/40`}
                />
              ))}
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  const targetIdx = selectionPopover.paragraphIndex;
                  setShowInlineComments(true);
                  setExpandedParagraphComments((prev) => ({ ...prev, [targetIdx]: true }));
                  setSelectionPopover(null);
                  window.getSelection()?.removeAllRanges();
                }}
                className="px-2 py-1 rounded-lg bg-[#E43136] hover:bg-[#B9272D] text-white text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                title="Comment on this paragraph"
              >
                <MessageCircle className="w-3 h-3" />
                Comment
              </button>
              <button
                type="button"
                onClick={() => setShowHighlightNoteInput((v) => !v)}
                className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
              >
                <StickyNote className="w-3 h-3" />
                Note
              </button>
              <button
                type="button"
                onClick={() => {
                  speakBlockAt(selectionPopover.paragraphIndex);
                  setSelectionPopover(null);
                }}
                className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
              >
                <Volume2 className="w-3 h-3" />
                Speak
              </button>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(selectionPopover.text);
                  addToast('Selected quote copied!', 'success');
                  setSelectionPopover(null);
                }}
                className="p-1 rounded-lg bg-white/10 hover:bg-white/20 cursor-pointer"
                title="Copy selected text"
              >
                <Copy className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => setSelectionPopover(null)}
                className="p-1 rounded-lg hover:bg-white/10 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>

          {showHighlightNoteInput && (
            <div className="flex items-center gap-1.5 pt-1 border-t border-white/10">
              <input
                type="text"
                value={pendingHighlightNote}
                onChange={(e) => setPendingHighlightNote(e.target.value)}
                placeholder="Write a note for this highlight..."
                className="flex-1 bg-white/10 rounded-lg px-2.5 py-1 text-xs text-white placeholder:text-white/50 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => handleCreateHighlight('rose', pendingHighlightNote)}
                className="px-2.5 py-1 rounded-lg bg-[#E43136] text-white text-xs font-semibold cursor-pointer"
              >
                Save
              </button>
            </div>
          )}
        </div>
      )}

      {/* ====================================================================
          SLIDE-OVER DRAWERS:
          1. TABLE OF CONTENTS & ANALYTICS (`tocOpen`)
          2. BOOKMARKS, HIGHLIGHTS & NOTES (`annotationsOpen`)
          3. READING SETTINGS (`settingsOpen`)
         ==================================================================== */}

      {/* 1. TABLE OF CONTENTS & READING ANALYTICS DRAWER */}
      {tocOpen && (
        <div className="fixed inset-0 z-40 flex">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-[1px]"
            onClick={() => setTocOpen(false)}
          />
          <aside
            className={`relative z-50 w-80 sm:w-96 max-w-[90vw] h-full border-r flex flex-col overflow-hidden shadow-2xl ${drawerSurfaceClasses}`}
          >
            {/* Book Summary Header */}
            <div className="p-4 border-b border-current/10 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-15 rounded-lg overflow-hidden shrink-0 shadow-xs">
                  <BookCover book={book} size="sm" className="w-full h-full" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold truncate">{book.title}</h3>
                  <p className="text-xs opacity-70 truncate">by {book.authorName}</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="w-24 h-1.5 rounded-full bg-current/10 overflow-hidden">
                      <div
                        style={{ width: `${progressPercentage}%` }}
                        className="h-full bg-[#E43136]"
                      />
                    </div>
                    <span className="text-[11px] font-semibold text-[#E43136] tabular-nums">
                      {progressPercentage}%
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTocOpen(false)}
                className="p-1.5 rounded-lg hover:bg-current/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Reading Analytics Summary Card */}
            <div className="px-4 py-3 border-b border-current/10 bg-current/[0.03]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider opacity-70">
                  Your Reading Analytics
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded-lg border border-current/10 bg-current/[0.02]">
                  <div className="text-xs font-bold tabular-nums flex items-center justify-center gap-1">
                    <Clock className="w-3 h-3 text-[#E43136]" />
                    {formatDurationHuman(readingAnalytics.totalReadingSecs)}
                  </div>
                  <div className="text-[10px] opacity-65 mt-0.5">Total Time</div>
                </div>
                <div className="p-2 rounded-lg border border-current/10 bg-current/[0.02]">
                  <div className="text-xs font-bold tabular-nums">
                    {readingAnalytics.totalChaptersDone}
                  </div>
                  <div className="text-[10px] opacity-65 mt-0.5">Chapters Done</div>
                </div>
                <div className="p-2 rounded-lg border border-current/10 bg-current/[0.02]">
                  <div className="text-xs font-bold tabular-nums flex items-center justify-center gap-1">
                    <Award className="w-3 h-3 text-[#E6A02C]" />
                    {readingAnalytics.booksCompletedCount}/{readingAnalytics.booksStartedCount}
                  </div>
                  <div className="text-[10px] opacity-65 mt-0.5">Completed</div>
                </div>
              </div>
            </div>

            {/* Navigation List: PDF Pages when in PDF Mode, Chapters when in Text/Audio Mode */}
            <div className="flex-1 min-h-0 overflow-y-auto p-3">
              {readingMode === 'pdf' ? (
                <div className="space-y-3">
                  <div className="px-1 flex items-center justify-between text-xs font-semibold opacity-75">
                    <span>PDF Page Navigation</span>
                    <span>{totalPdfPages} Pages</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {Array.from({ length: totalPdfPages }, (_, idx) => idx + 1).map((pNum) => {
                      const isCurrent = pNum === currentPdfPage;
                      const isSavedPage = bookmarkedPdfPages.includes(pNum);
                      const isReadPage = pNum <= maxPdfPageReached;
                      return (
                        <button
                          key={pNum}
                          type="button"
                          onClick={() => {
                            setCurrentPdfPage(pNum);
                            setTocOpen(false);
                          }}
                          className={`py-2.5 px-2 rounded-xl border text-xs font-semibold tabular-nums flex flex-col items-center justify-center gap-1 cursor-pointer transition-all ${
                            isCurrent
                              ? 'border-[#E43136] bg-[#E43136] text-white shadow-xs'
                              : isSavedPage
                              ? 'border-[#E43136]/50 bg-[#E43136]/10 text-[#E43136]'
                              : isReadPage
                              ? 'border-current/15 bg-current/[0.04]'
                              : 'border-current/10 opacity-75 hover:opacity-100'
                          }`}
                        >
                          <span>P. {pNum}</span>
                          {isSavedPage && <Bookmark className="w-2.5 h-2.5 fill-current" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="px-2 pb-1.5 flex items-center justify-between text-xs font-semibold opacity-75">
                    <span>Chapters ({chapters.length})</span>
                    <span>{completedChapters.length} Completed</span>
                  </div>
                  {chapters.map((ch, idx) => {
                    const isCurrent = idx === currentChapterIndex;
                    const isDone =
                      completedChapters.includes(ch.chapterNumber) || idx < currentChapterIndex;
                    return (
                      <button
                        key={ch.id}
                        type="button"
                        onClick={() => {
                          handleChapterChange(idx, 0);
                          setTocOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center justify-between gap-2.5 text-xs transition-colors cursor-pointer ${
                          isCurrent
                            ? 'bg-[#E43136] text-white font-semibold'
                            : 'hover:bg-current/[0.06]'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-[10px] uppercase tracking-wider opacity-75">
                            Chapter {ch.chapterNumber}
                          </div>
                          <div className="truncate font-medium mt-0.5">{ch.title}</div>
                        </div>
                        {isDone && (
                          <CheckCircle2
                            className={`w-4 h-4 shrink-0 ${
                              isCurrent ? 'text-white' : 'text-[#E43136]'
                            }`}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* 2. BOOKMARKS, HIGHLIGHTS & NOTES DRAWER */}
      {annotationsOpen && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-[1px]"
            onClick={() => setAnnotationsOpen(false)}
          />
          <aside
            className={`relative z-50 w-85 sm:w-96 max-w-[92vw] h-full border-l flex flex-col overflow-hidden shadow-2xl ${drawerSurfaceClasses}`}
          >
            <div className="p-4 border-b border-current/10 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">Bookmarks, Highlights & Notes</h3>
                <p className="text-[11px] opacity-70">
                  Synced across devices with your Redcover account
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAnnotationsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-current/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Note Composer for Current Chapter / Page */}
            <div className="p-3.5 border-b border-current/10 space-y-2 bg-current/[0.02]">
              <label className="block text-[11px] font-semibold opacity-80">
                Personal Note for{' '}
                {readingMode === 'pdf'
                  ? `PDF Page ${currentPdfPage}`
                  : `Chapter ${currentChapter.chapterNumber}`}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={personalNote}
                  onChange={(e) => setPersonalNote(e.target.value)}
                  placeholder="Write a thought or study note..."
                  className="flex-1 py-1.5 px-2.5 rounded-lg border border-current/20 bg-transparent text-xs focus:outline-none focus:border-[#E43136]"
                />
                <button
                  type="button"
                  onClick={async () => {
                    if (!personalNote.trim()) return;
                    const newBm: SavedBookmarkItem = {
                      id: `note_${Date.now()}`,
                      mode: readingMode === 'pdf' ? 'pdf' : 'text',
                      chapterIndex: currentChapterIndex,
                      chapterTitle:
                        readingMode === 'pdf'
                          ? `PDF Page ${currentPdfPage}`
                          : currentChapter.title,
                      paragraphIndex: currentParagraphIdx,
                      pdfPage: readingMode === 'pdf' ? currentPdfPage : undefined,
                      snippet:
                        (contentBlocks[currentParagraphIdx] || currentChapter.title)
                          .replace(/^#+\s*/, '')
                          .slice(0, 120),
                      note: personalNote.trim(),
                      createdAt: new Date().toISOString(),
                    };
                    const nextBms = [newBm, ...bookmarksList];
                    setBookmarksList(nextBms);
                    setIsBookmarked(true);
                    await persistReaderStateNow({
                      note: personalNote.trim(),
                      bookmarks: nextBms,
                      bookmarked: true,
                    });
                    addToast('Personal note saved successfully!', 'success');
                  }}
                  className="py-1.5 px-3 rounded-lg bg-[#E43136] text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Save Note
                </button>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="px-4 pt-2.5 flex items-center gap-1.5 border-b border-current/10 text-xs font-semibold">
              {(
                [
                  { id: 'all', label: `All (${bookmarksList.length + highlightsList.length})` },
                  { id: 'bookmarks', label: `Bookmarks (${bookmarksList.length})` },
                  { id: 'highlights', label: `Highlights (${highlightsList.length})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setAnnotationsFilter(tab.id)}
                  className={`pb-2 px-2.5 border-b-2 transition-colors cursor-pointer ${
                    annotationsFilter === tab.id
                      ? 'border-[#E43136] text-[#E43136]'
                      : 'border-transparent opacity-70 hover:opacity-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Saved Items List */}
            <div className="flex-1 min-h-0 overflow-y-auto p-3.5 space-y-3">
              {(annotationsFilter === 'all' || annotationsFilter === 'bookmarks') &&
                bookmarksList.map((bm) => (
                  <div
                    key={bm.id}
                    className="p-3 rounded-xl border border-current/15 bg-current/[0.02] space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (bm.mode === 'pdf' && bm.pdfPage) {
                            handleSwitchMode('pdf');
                            setCurrentPdfPage(bm.pdfPage);
                          } else {
                            handleSwitchMode('text');
                            handleChapterChange(bm.chapterIndex, bm.paragraphIndex);
                          }
                          setAnnotationsOpen(false);
                        }}
                        className="text-xs font-bold text-[#E43136] hover:underline inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Bookmark className="w-3 h-3 fill-[#E43136]" />
                        {bm.chapterTitle}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteBookmark(bm.id)}
                        className="p-1 rounded hover:text-[#D9363E] opacity-60 hover:opacity-100 cursor-pointer"
                        title="Remove bookmark"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-xs opacity-80 line-clamp-2 italic">"{bm.snippet}"</p>
                    {bm.note && (
                      <p className="text-xs font-medium bg-[#E43136]/10 text-[#E43136] px-2.5 py-1.5 rounded-lg">
                        Note: {bm.note}
                      </p>
                    )}
                  </div>
                ))}

              {(annotationsFilter === 'all' || annotationsFilter === 'highlights') &&
                highlightsList.map((hl) => (
                  <div
                    key={hl.id}
                    className="p-3 rounded-xl border border-current/15 bg-current/[0.02] space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          handleSwitchMode('text');
                          handleChapterChange(hl.chapterIndex, hl.paragraphIndex);
                          setAnnotationsOpen(false);
                        }}
                        className="text-xs font-bold text-[#E43136] hover:underline inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Highlighter className="w-3 h-3" />
                        {hl.chapterTitle} · Para {hl.paragraphIndex + 1}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteHighlight(hl.id)}
                        className="p-1 rounded hover:text-[#D9363E] opacity-60 hover:opacity-100 cursor-pointer"
                        title="Delete highlight"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <blockquote className="text-xs border-l-2 border-[#E43136] pl-2.5 py-0.5 italic">
                      "{hl.selectedText}"
                    </blockquote>
                    {hl.note && (
                      <p className="text-xs font-medium bg-current/[0.05] px-2.5 py-1.5 rounded-lg">
                        Note: {hl.note}
                      </p>
                    )}
                  </div>
                ))}

              {bookmarksList.length === 0 && highlightsList.length === 0 && (
                <div className="py-12 text-center space-y-2 opacity-70">
                  <Highlighter className="w-7 h-7 mx-auto text-[#E43136]" />
                  <p className="text-xs font-semibold">No saved bookmarks or highlights yet</p>
                  <p className="text-[11px] max-w-[220px] mx-auto">
                    Select any sentence in the Text Reader to highlight it or click the bookmark icon in the top bar.
                  </p>
                </div>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* 3. SINGLE COMPACT READING SETTINGS DRAWER */}
      {settingsOpen && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-[1px]"
            onClick={() => setSettingsOpen(false)}
          />
          <aside
            className={`relative z-50 w-85 sm:w-96 max-w-[92vw] h-full border-l flex flex-col overflow-hidden shadow-2xl ${drawerSurfaceClasses}`}
          >
            <div className="p-4 border-b border-current/10 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">Reading Settings</h3>
                <p className="text-[11px] opacity-70">
                  Typography, theme, layout & preferences
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-current/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-6 text-xs">
              {/* B. Appearance (Light, Sepia, Dark, Pure Black) */}
              <div className="space-y-2">
                <span className="block font-bold uppercase tracking-wider text-[11px] opacity-75">
                  Appearance Theme
                </span>
                <div className="grid grid-cols-4 gap-2">
                  {(
                    [
                      { id: 'light', label: 'Light', bg: 'bg-white text-[#171717] border-[#DDDCE3]' },
                      { id: 'sepia', label: 'Sepia', bg: 'bg-[#F6EFE2] text-[#2D2419] border-[#DFD2B8]' },
                      { id: 'dark', label: 'Dark', bg: 'bg-[#1A1A22] text-[#E8E8ED] border-[#2C2C36]' },
                      { id: 'black', label: 'Pure Black', bg: 'bg-black text-white border-[#22222A]' },
                    ] as { id: ReaderAppearance; label: string; bg: string }[]
                  ).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        updatePref('appearance', t.id);
                        setTheme(t.id === 'black' || t.id === 'dark' ? 'dark' : 'light');
                      }}
                      className={`py-2.5 px-2 rounded-xl border font-semibold text-center cursor-pointer transition-all ${
                        t.bg
                      } ${
                        prefs.appearance === t.id
                          ? 'ring-2 ring-[#E43136] border-[#E43136]'
                          : ''
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* A. Typography */}
              <div className="space-y-4 pt-4 border-t border-current/10">
                <span className="block font-bold uppercase tracking-wider text-[11px] opacity-75">
                  Typography
                </span>

                {/* Font Size Slider */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-medium opacity-85">Font Size</span>
                    <span className="font-bold text-[#E43136] tabular-nums">{prefs.fontSize}px</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => updatePref('fontSize', Math.max(14, prefs.fontSize - 1))}
                      className="py-1.5 px-3 rounded-lg border border-current/20 font-bold cursor-pointer"
                    >
                      A-
                    </button>
                    <input
                      type="range"
                      min={14}
                      max={28}
                      step={1}
                      value={prefs.fontSize}
                      onChange={(e) => updatePref('fontSize', Number(e.target.value))}
                      className="flex-1 accent-[#E43136] cursor-pointer"
                    />
                    <button
                      type="button"
                      onClick={() => updatePref('fontSize', Math.min(28, prefs.fontSize + 1))}
                      className="py-1.5 px-3 rounded-lg border border-current/20 font-bold cursor-pointer"
                    >
                      A+
                    </button>
                  </div>
                </div>

                {/* Font Family */}
                <div className="space-y-1.5">
                  <span className="block font-medium opacity-85">Font Family</span>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        { id: 'serif', label: 'Literary Serif' },
                        { id: 'classic', label: 'Classic Book' },
                        { id: 'sans', label: 'Clean Sans' },
                        { id: 'mono', label: 'Monospace' },
                      ] as { id: ReaderFontFamily; label: string }[]
                    ).map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => updatePref('fontFamily', f.id)}
                        className={`py-2 px-3 rounded-xl border font-medium text-left cursor-pointer ${
                          prefs.fontFamily === f.id
                            ? 'border-[#E43136] bg-[#E43136]/10 text-[#E43136] font-semibold'
                            : 'border-current/15'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Line Spacing */}
                <div className="space-y-1.5">
                  <span className="block font-medium opacity-85">Line Spacing</span>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(
                      [
                        { id: 'compact', label: '1.5x' },
                        { id: 'comfortable', label: '1.7x' },
                        { id: 'relaxed', label: '1.9x' },
                        { id: 'loose', label: '2.1x' },
                      ] as { id: ReaderLineSpacing; label: string }[]
                    ).map((ls) => (
                      <button
                        key={ls.id}
                        type="button"
                        onClick={() => updatePref('lineSpacing', ls.id)}
                        className={`py-1.5 px-2 rounded-lg border text-center cursor-pointer ${
                          prefs.lineSpacing === ls.id
                            ? 'border-[#E43136] bg-[#E43136]/10 text-[#E43136] font-semibold'
                            : 'border-current/15'
                        }`}
                      >
                        {ls.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Paragraph Spacing & Text Alignment */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="block font-medium opacity-85 mb-1.5">Paragraph Gap</span>
                    <div className="flex rounded-lg border border-current/15 p-0.5">
                      {(['compact', 'standard', 'spacious'] as ReaderParaSpacing[]).map((ps) => (
                        <button
                          key={ps}
                          type="button"
                          onClick={() => updatePref('paraSpacing', ps)}
                          className={`flex-1 py-1 rounded-md capitalize text-[11px] cursor-pointer ${
                            prefs.paraSpacing === ps
                              ? 'bg-[#E43136] text-white font-semibold'
                              : 'opacity-75'
                          }`}
                        >
                          {ps.slice(0, 4)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="block font-medium opacity-85 mb-1.5">Alignment</span>
                    <div className="flex rounded-lg border border-current/15 p-0.5">
                      <button
                        type="button"
                        onClick={() => updatePref('textAlign', 'left')}
                        className={`flex-1 py-1 rounded-md inline-flex items-center justify-center gap-1 cursor-pointer ${
                          prefs.textAlign === 'left'
                            ? 'bg-[#E43136] text-white font-semibold'
                            : 'opacity-75'
                        }`}
                      >
                        <AlignLeft className="w-3 h-3" />
                        Left
                      </button>
                      <button
                        type="button"
                        onClick={() => updatePref('textAlign', 'justify')}
                        className={`flex-1 py-1 rounded-md inline-flex items-center justify-center gap-1 cursor-pointer ${
                          prefs.textAlign === 'justify'
                            ? 'bg-[#E43136] text-white font-semibold'
                            : 'opacity-75'
                        }`}
                      >
                        <AlignJustify className="w-3 h-3" />
                        Justify
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* C. Reading Layout */}
              <div className="space-y-3 pt-4 border-t border-current/10">
                <span className="block font-bold uppercase tracking-wider text-[11px] opacity-75">
                  Reading Layout
                </span>

                <div className="space-y-1.5">
                  <span className="block font-medium opacity-85">Column Width</span>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        { id: 'narrow', label: 'Narrow' },
                        { id: 'standard', label: 'Standard' },
                        { id: 'wide', label: 'Wide' },
                      ] as { id: ReaderColumnWidth; label: string }[]
                    ).map((cw) => (
                      <button
                        key={cw.id}
                        type="button"
                        onClick={() => updatePref('columnWidth', cw.id)}
                        className={`py-2 px-2 rounded-xl border text-center cursor-pointer ${
                          prefs.columnWidth === cw.id
                            ? 'border-[#E43136] bg-[#E43136]/10 text-[#E43136] font-semibold'
                            : 'border-current/15'
                        }`}
                      >
                        {cw.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="block font-medium opacity-85">Pagination Mode</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => updatePref('layoutFlow', 'continuous')}
                      className={`py-2 px-3 rounded-xl border text-center cursor-pointer ${
                        prefs.layoutFlow === 'continuous'
                          ? 'border-[#E43136] bg-[#E43136]/10 text-[#E43136] font-semibold'
                          : 'border-current/15'
                      }`}
                    >
                      Continuous Scroll
                    </button>
                    <button
                      type="button"
                      onClick={() => updatePref('layoutFlow', 'paginated')}
                      className={`py-2 px-3 rounded-xl border text-center cursor-pointer ${
                        prefs.layoutFlow === 'paginated'
                          ? 'border-[#E43136] bg-[#E43136]/10 text-[#E43136] font-semibold'
                          : 'border-current/15'
                      }`}
                    >
                      Paginated Sections
                    </button>
                  </div>
                </div>
              </div>

              {/* D. Reading Preferences */}
              <div className="space-y-2.5 pt-4 border-t border-current/10">
                <span className="block font-bold uppercase tracking-wider text-[11px] opacity-75">
                  Reading Preferences
                </span>

                <label className="flex items-center justify-between py-1 cursor-pointer">
                  <span>Remember last reading position</span>
                  <input
                    type="checkbox"
                    checked={prefs.rememberPosition}
                    onChange={(e) => updatePref('rememberPosition', e.target.checked)}
                    className="accent-[#E43136] w-4 h-4"
                  />
                </label>

                <label className="flex items-center justify-between py-1 cursor-pointer">
                  <span>Auto-advance to next chapter in Audio</span>
                  <input
                    type="checkbox"
                    checked={prefs.autoNextChapter}
                    onChange={(e) => updatePref('autoNextChapter', e.target.checked)}
                    className="accent-[#E43136] w-4 h-4"
                  />
                </label>

                <label className="flex items-center justify-between py-1 cursor-pointer">
                  <span>Keep screen awake while reading</span>
                  <input
                    type="checkbox"
                    checked={prefs.keepScreenAwake}
                    onChange={(e) => updatePref('keepScreenAwake', e.target.checked)}
                    className="accent-[#E43136] w-4 h-4"
                  />
                </label>

                <label className="flex items-center justify-between py-1 cursor-pointer">
                  <span>Show Wattpad-style inline paragraph comments</span>
                  <input
                    type="checkbox"
                    checked={showInlineComments}
                    onChange={(e) => setShowInlineComments(e.target.checked)}
                    className="accent-[#E43136] w-4 h-4"
                  />
                </label>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* 4. BOOK, CHAPTER & PARAGRAPH DISCUSSION DRAWER */}
      {discussionOpen && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-[1px]"
            onClick={() => setDiscussionOpen(false)}
          />
          <aside
            className={`relative z-50 w-96 sm:w-[440px] max-w-[94vw] h-full border-l flex flex-col overflow-hidden shadow-2xl ${drawerSurfaceClasses}`}
          >
            <div className="p-4 border-b border-current/10 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-sm font-bold flex items-center gap-1.5">
                  <MessageCircle className="w-4 h-4 text-[#E43136]" />
                  <span>Reader Discussions & Comments</span>
                </h3>
                <p className="text-[11px] opacity-70 truncate">
                  {book.title} · Ch. {currentChapter.chapterNumber}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDiscussionOpen(false)}
                className="p-1.5 rounded-lg hover:bg-current/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Discussion Drawer Tabs */}
            <div className="px-3 pt-2.5 flex items-center gap-1 border-b border-current/10 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setDiscussionDrawerTab('chapter')}
                className={`pb-2 px-2.5 border-b-2 transition-colors cursor-pointer ${
                  discussionDrawerTab === 'chapter'
                    ? 'border-[#E43136] text-[#E43136]'
                    : 'border-transparent opacity-70 hover:opacity-100'
                }`}
              >
                Ch. {currentChapter.chapterNumber} ({chapterLevelCommentsCount})
              </button>
              <button
                type="button"
                onClick={() => setDiscussionDrawerTab('book')}
                className={`pb-2 px-2.5 border-b-2 transition-colors cursor-pointer ${
                  discussionDrawerTab === 'book'
                    ? 'border-[#E43136] text-[#E43136]'
                    : 'border-transparent opacity-70 hover:opacity-100'
                }`}
              >
                Book Club ({bookLevelCommentsCount})
              </button>
              <button
                type="button"
                onClick={() => setDiscussionDrawerTab('paragraphs')}
                className={`pb-2 px-2.5 border-b-2 transition-colors cursor-pointer ${
                  discussionDrawerTab === 'paragraphs'
                    ? 'border-[#E43136] text-[#E43136]'
                    : 'border-transparent opacity-70 hover:opacity-100'
                }`}
              >
                Para Reactions ({totalChapterParagraphCommentsCount})
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-4">
              {discussionDrawerTab === 'chapter' && (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl border border-current/10 bg-current/[0.03]">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-[#E43136]">
                      Chapter {currentChapter.chapterNumber} Discussion
                    </div>
                    <div className="text-xs font-semibold mt-0.5">{currentChapter.title}</div>
                  </div>
                  <CommentThread
                    postId={chapterCommentPostId}
                    postAuthorId={book.authorId}
                    postAuthorName={book.authorName}
                    targetTitle={`${book.title} · Chapter ${currentChapter.chapterNumber}`}
                    postLink={`/read/${book.id}?mode=text&ch=${currentChapter.chapterNumber}`}
                    expanded={true}
                    onToggleExpand={() => {}}
                    quickReactions={BOOK_DISCUSSION_REACTIONS}
                    placeholder={`Share your thoughts on Chapter ${currentChapter.chapterNumber}...`}
                    emptyMessage={`No comments on Chapter ${currentChapter.chapterNumber} yet. Start the chapter discussion!`}
                  />
                </div>
              )}

              {discussionDrawerTab === 'book' && (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl border border-current/10 bg-current/[0.03]">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-[#E43136]">
                      Overall Book Discussion
                    </div>
                    <div className="text-xs font-semibold mt-0.5">
                      Discuss {book.title} with the Redcover community
                    </div>
                  </div>
                  <CommentThread
                    postId={bookCommentPostId}
                    postAuthorId={book.authorId}
                    postAuthorName={book.authorName}
                    targetTitle={book.title}
                    postLink={`/book/${book.id}`}
                    expanded={true}
                    onToggleExpand={() => {}}
                    quickReactions={BOOK_DISCUSSION_REACTIONS}
                    placeholder={`Write a review, theory, or comment about "${book.title}"...`}
                    emptyMessage="No overall book comments yet. Be the first reader to share your thoughts!"
                  />
                </div>
              )}

              {discussionDrawerTab === 'paragraphs' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold opacity-80">
                      Paragraph Reactions in Ch. {currentChapter.chapterNumber}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowInlineComments((v) => !v)}
                      className="text-[11px] font-semibold text-[#E43136] hover:underline cursor-pointer"
                    >
                      {showInlineComments ? 'Hide Inline Bubbles' : 'Show Inline Bubbles'}
                    </button>
                  </div>

                  {Array.from(paragraphCommentsByIdx.entries()).length === 0 ? (
                    <div className="py-10 text-center space-y-2 opacity-75">
                      <MessageCircle className="w-7 h-7 mx-auto text-[#E43136]" />
                      <p className="text-xs font-semibold">
                        No paragraph reactions in this chapter yet
                      </p>
                      <p className="text-[11px] max-w-[240px] mx-auto">
                        Click the comment bubble under any paragraph in the Text Reader to leave a Wattpad-style reaction!
                      </p>
                    </div>
                  ) : (
                    Array.from(paragraphCommentsByIdx.entries())
                      .sort((a, b) => a[0] - b[0])
                      .map(([pIdx, pComments]) => {
                        const snippet = (contentBlocks[pIdx] || '')
                          .replace(/^#+\s*/, '')
                          .slice(0, 120);
                        return (
                          <div
                            key={pIdx}
                            className="p-3 rounded-xl border border-current/15 bg-current/[0.02] space-y-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] font-bold text-[#E43136]">
                                Paragraph #{pIdx + 1} · {pComments.length}{' '}
                                {pComments.length === 1 ? 'Comment' : 'Comments'}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  handleSwitchMode('text');
                                  setShowInlineComments(true);
                                  setExpandedParagraphComments((prev) => ({
                                    ...prev,
                                    [pIdx]: true,
                                  }));
                                  setDiscussionOpen(false);
                                  window.setTimeout(() => {
                                    paragraphRefs.current[pIdx]?.scrollIntoView({
                                      behavior: 'smooth',
                                      block: 'center',
                                    });
                                  }, 120);
                                }}
                                className="text-[11px] font-semibold text-[#E43136] hover:underline cursor-pointer"
                              >
                                Jump to Paragraph →
                              </button>
                            </div>
                            {snippet && (
                              <blockquote className="text-[11px] italic opacity-75 border-l-2 border-[#E43136] pl-2 line-clamp-2">
                                "{snippet}"
                              </blockquote>
                            )}
                            <div className="space-y-1.5 pt-1">
                              {pComments.slice(0, 3).map((c) => (
                                <div
                                  key={c.id}
                                  className="text-xs bg-current/[0.04] rounded-lg px-2.5 py-1.5"
                                >
                                  <span className="font-bold mr-1.5">{c.userName}:</span>
                                  <span className="opacity-90">{c.text}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* ====================================================================
          4. SIMPLE PARAGRAPH COMMENTS DRAWER (`selectedSimpleParagraphIdx !== null`)
          Dedicated, ultra-clean comment thread for this specific paragraph
         ==================================================================== */}
      {selectedSimpleParagraphIdx !== null && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-black/45 backdrop-blur-[2px] transition-opacity"
            onClick={() => setSelectedSimpleParagraphIdx(null)}
          />
          <aside
            className={`relative z-50 w-full sm:w-[440px] max-w-full h-full border-l flex flex-col shadow-2xl animate-in slide-in-from-right duration-200 ${drawerSurfaceClasses}`}
          >
            {/* Header */}
            <div className="p-4 border-b border-current/10 flex items-center justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                    Paragraph #{selectedSimpleParagraphIdx + 1}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-semibold border border-blue-200 dark:border-blue-900/50">
                    {paragraphCommentsByIdx.get(selectedSimpleParagraphIdx)?.length || 0} Comments
                  </span>
                </div>
                <h3 className="text-sm font-bold truncate mt-0.5">
                  Ch. {currentChapter.chapterNumber} · {currentChapter.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSimpleParagraphIdx(null)}
                className="p-1.5 rounded-lg hover:bg-current/10 text-xs inline-flex items-center gap-1 opacity-75 hover:opacity-100 cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quote Snippet of the Paragraph */}
            <div className="p-3.5 border-b border-current/10 bg-blue-500/[0.04] shrink-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 block mb-1">
                Paragraph Excerpt:
              </span>
              <p className="text-xs italic leading-relaxed opacity-85 line-clamp-3">
                "{contentBlocks[selectedSimpleParagraphIdx]?.replace(/^#+\s*/, '')}"
              </p>
            </div>

            {/* Comments List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {(paragraphCommentsByIdx.get(selectedSimpleParagraphIdx) || []).length === 0 ? (
                <div className="py-14 text-center space-y-2 opacity-75">
                  <MessageCircle className="w-8 h-8 mx-auto text-blue-500/60" />
                  <p className="text-sm font-bold">No comments on this paragraph yet</p>
                  <p className="text-xs max-w-[260px] mx-auto opacity-70">
                    Be the first reader to share a thought, reaction, or question on Paragraph #{selectedSimpleParagraphIdx + 1}!
                  </p>
                </div>
              ) : (
                (paragraphCommentsByIdx.get(selectedSimpleParagraphIdx) || []).map((cmt) => {
                  const authorObj = users.find((u) => u.uid === cmt.userId);
                  const isCmtLiked = postLikes.some(
                    (l) =>
                      l.postId === `cmtlike_${cmt.id}` &&
                      l.userId === (currentUser?.uid || firebaseUser?.uid)
                  );
                  const cmtLikesCount = postLikes.filter((l) => l.postId === `cmtlike_${cmt.id}`).length;
                  const currentUserId = currentUser?.uid || firebaseUser?.uid;
                  const isAuthorOrAdmin = Boolean(currentUserId && (cmt.userId === currentUserId || isAdmin));
                  const isEditingThis = editingCommentId === cmt.id;
                  const isReply = Boolean(cmt.parentId);

                  return (
                    <div
                      key={cmt.id}
                      className={`p-3 rounded-xl border border-current/10 bg-current/[0.02] space-y-2 text-xs transition-all ${
                        isReply ? 'ml-4 sm:ml-6 border-l-2 border-l-blue-500/50 bg-blue-500/[0.02]' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {isReply && <CornerDownRight className="w-3.5 h-3.5 text-blue-500 shrink-0" />}
                          <UserAvatar
                            name={cmt.userName}
                            avatarUrl={cmt.userAvatar || authorObj?.photoURL}
                            membershipPlan={authorObj?.membershipPlan}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <UserName user={authorObj || { displayName: cmt.userName, username: cmt.userUsername, membershipPlan: 'free' }} />
                            <div className="text-[10px] opacity-60">
                              {new Date(cmt.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        </div>

                        {/* Comment Actions: Like, Reply, Edit, Delete, Report */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => toggleLikeComment(cmt)}
                            className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-lg border transition-colors cursor-pointer ${
                              isCmtLiked
                                ? 'border-[#E43136] text-[#E43136] bg-[#E43136]/10'
                                : 'border-current/15 opacity-70 hover:opacity-100'
                            }`}
                            title="Like comment"
                          >
                            <Heart className={`w-3 h-3 ${isCmtLiked ? 'fill-[#E43136]' : ''}`} />
                            <span>{cmtLikesCount || ''}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setReplyingToComment(cmt);
                              setEditingCommentId(null);
                            }}
                            className="p-1 rounded-md hover:bg-current/10 opacity-70 hover:opacity-100 text-blue-500 cursor-pointer"
                            title="Reply to comment"
                          >
                            <Reply className="w-3.5 h-3.5" />
                          </button>

                          {isAuthorOrAdmin ? (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  if (isEditingThis) {
                                    setEditingCommentId(null);
                                    setEditingCommentText('');
                                  } else {
                                    setEditingCommentId(cmt.id);
                                    setEditingCommentText(cmt.text);
                                    setReplyingToComment(null);
                                  }
                                }}
                                className="p-1 rounded-md hover:bg-current/10 opacity-70 hover:opacity-100 text-amber-500 cursor-pointer"
                                title="Edit comment"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteParagraphComment(cmt.id)}
                                className="p-1 rounded-md hover:bg-current/10 opacity-70 hover:opacity-100 text-[#E43136] cursor-pointer"
                                title="Delete comment"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleReportParagraphComment(cmt)}
                              className="p-1 rounded-md hover:bg-current/10 opacity-60 hover:opacity-100 hover:text-red-500 cursor-pointer"
                              title="Report comment"
                            >
                              <Flag className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Content or Inline Edit Form */}
                      {isEditingThis ? (
                        <div className="pl-6 space-y-2 pt-1">
                          <textarea
                            value={editingCommentText}
                            onChange={(e) => setEditingCommentText(e.target.value)}
                            rows={2}
                            className="w-full bg-current/[0.05] border border-blue-500/50 rounded-xl p-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="Edit your comment..."
                          />
                          <div className="flex items-center gap-2 justify-end">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCommentId(null);
                                setEditingCommentText('');
                              }}
                              className="px-2.5 py-1 rounded-lg border border-current/15 text-[11px] opacity-75 hover:opacity-100 cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEditParagraphComment(cmt.id)}
                              disabled={!editingCommentText.trim()}
                              className="px-3 py-1 rounded-lg bg-blue-600 text-white font-semibold text-[11px] disabled:opacity-40 cursor-pointer"
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="leading-relaxed pl-6 break-words text-xs opacity-90">
                          {cmt.replyToUsername && (
                            <span className="text-blue-600 dark:text-blue-400 font-semibold mr-1.5">
                              @{cmt.replyToUsername}
                            </span>
                          )}
                          {cmt.text}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Replying Banner */}
            {replyingToComment && (
              <div className="px-4 py-2 border-t border-current/10 bg-blue-50 dark:bg-blue-950/40 flex items-center justify-between text-xs text-blue-600 dark:text-blue-400 shrink-0">
                <span className="truncate">
                  Replying to <strong>@{replyingToComment.userUsername || replyingToComment.userName}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setReplyingToComment(null)}
                  className="p-1 rounded hover:bg-blue-200/50 dark:hover:bg-blue-900/50 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Quick Reactions Bar */}
            <div className="px-4 py-2 border-t border-current/10 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0 bg-current/[0.02]">
              {['❤️ Loved this', '🔥 Goosebumps', '👏 Brilliant', '🤯 Mindblown', '😂 Hilarious', '💯 So true'].map((reaction) => (
                <button
                  key={reaction}
                  type="button"
                  disabled={isPostingSimpleComment}
                  onClick={() => handlePostSimpleComment(reaction)}
                  className="px-2.5 py-1 rounded-full border border-current/15 text-[11px] font-medium hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 shrink-0 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {reaction}
                </button>
              ))}
            </div>

            {/* Bottom Composer */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handlePostSimpleComment();
              }}
              className="p-3 border-t border-current/10 flex items-center gap-2 shrink-0 bg-current/[0.01]"
            >
              <input
                type="text"
                value={simpleCommentInput}
                onChange={(e) => setSimpleCommentInput(e.target.value)}
                placeholder={
                  replyingToComment
                    ? `Reply to @${replyingToComment.userUsername || replyingToComment.userName}...`
                    : `Comment on Paragraph #${selectedSimpleParagraphIdx + 1}...`
                }
                disabled={isPostingSimpleComment}
                className="flex-1 bg-current/[0.05] border border-current/15 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-blue-500 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!simpleCommentInput.trim() || isPostingSimpleComment}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold disabled:opacity-40 transition-colors cursor-pointer shrink-0"
              >
                {isPostingSimpleComment ? '...' : replyingToComment ? 'Reply' : 'Post'}
              </button>
            </form>
          </aside>
        </div>
      )}

      {/* ====================================================================
          MAIN VIEWPORT AREA:
          - MODE B: ORIGINAL PDF READER (`readingMode === 'pdf'`)
          - MODE C: AUDIO READER (`readingMode === 'audio'`)
          - MODE A: TEXT READER (`readingMode === 'text'`)
         ==================================================================== */}

      {readingMode === 'pdf' ? (
        <PdfCanvasReader
          bookId={book.id}
          bookTitle={book.title}
          authorName={book.authorName}
          fileURL={book.fileURL}
          chapters={chapters}
          initialPage={currentPdfPage}
          readerTheme={prefs.appearance}
          bookmarkedPages={bookmarkedPdfPages}
          onPageChange={(page, total) => {
            setCurrentPdfPage(page);
            setTotalPdfPages(total);
            setMaxPdfPageReached((prev) => Math.max(prev, page));
          }}
          onTogglePageBookmark={() => {
            handleToggleBookmarkCurrentPosition();
          }}
          onSwitchToTextMode={() => handleSwitchMode('text')}
          onTapCenter={() => setImmersiveBarsHidden((h) => !h)}
        />
      ) : readingMode === 'audio' ? (
        /* ==================================================================
            MODE C: DEDICATED AUDIO READER STUDIO & INTERACTIVE TRANSCRIPT
           ================================================================== */
        <main className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-8 py-6">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Audio Player Hero Deck */}
            <div
              className={`rounded-2xl border p-5 sm:p-7 shadow-sm ${
                prefs.appearance === 'black' || prefs.appearance === 'dark'
                  ? 'bg-[#181820] border-[#2C2C38]'
                  : prefs.appearance === 'sepia'
                  ? 'bg-[#EFE5D2] border-[#DFD2B8]'
                  : 'bg-[#FAF9FB] border-[#DDDCE3]'
              }`}
            >
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                <div className="md:col-span-3 flex justify-center">
                  <div className="w-32 sm:w-40 aspect-[3/4] rounded-xl overflow-hidden shadow-md">
                    <BookCover book={book} size="md" className="w-full h-full" />
                  </div>
                </div>

                <div className="md:col-span-9 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[#E43136]">
                        Redcover Audio Reader · Chapter {currentChapter.chapterNumber} of {totalChapters}
                      </span>
                      <h2 className="font-display text-xl sm:text-2xl font-bold mt-0.5">
                        {currentChapter.title}
                      </h2>
                      <p className="text-xs opacity-75">
                        {book.title} · by {book.authorName}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSwitchMode('text')}
                      className="py-1.5 px-3 rounded-lg border border-current/20 hover:border-[#E43136] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <BookOpen className="w-3.5 h-3.5 text-[#E43136]" />
                      Follow in Text Reader
                    </button>
                  </div>

                  {/* Paragraph Progress Scrubber */}
                  <div className="space-y-1.5">
                    <input
                      type="range"
                      min={0}
                      max={Math.max(0, contentBlocks.length - 1)}
                      value={Math.min(activeBlockIdx, Math.max(0, contentBlocks.length - 1))}
                      onChange={(e) => {
                        const target = Number(e.target.value);
                        setActiveBlockIdx(target);
                        activeBlockIdxRef.current = target;
                        setCurrentParagraphIdx(target);
                        if (isPlayingAudio) speakBlockAt(target);
                      }}
                      className="w-full accent-[#E43136] cursor-pointer"
                    />
                    <div className="flex items-center justify-between text-[11px] opacity-75 tabular-nums">
                      <span>
                        Paragraph {Math.min(contentBlocks.length, activeBlockIdx + 1)} of{' '}
                        {Math.max(1, contentBlocks.length)}
                      </span>
                      <span>
                        Voice: {customNativeVoiceURI ? 'Device Voice' : `${selectedPersona.name} (${selectedPersona.role})`} · {playbackSpeed}x
                      </span>
                    </div>
                  </div>

                  {/* Primary Audio Transport Controls */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={currentChapterIndex <= 0}
                        onClick={() => handleChapterChange(currentChapterIndex - 1)}
                        className="p-2.5 rounded-xl border border-current/15 disabled:opacity-35 hover:border-[#E43136] cursor-pointer"
                        title="Previous Chapter"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        disabled={activeBlockIdx <= 0}
                        onClick={() => speakBlockAt(Math.max(0, activeBlockIdx - 1))}
                        className="p-2.5 rounded-xl border border-current/15 disabled:opacity-35 hover:border-[#E43136] cursor-pointer"
                        title="Previous Paragraph"
                      >
                        <SkipBack className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={handleTogglePlayPause}
                        className="py-3 px-6 rounded-xl bg-[#E43136] hover:bg-[#B9272D] text-white text-xs sm:text-sm font-bold inline-flex items-center gap-2 shadow-md cursor-pointer"
                      >
                        {isPlayingAudio && !isPausedAudio ? (
                          <>
                            <Pause className="w-4 h-4" />
                            Pause
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4" />
                            {isPausedAudio ? 'Resume' : 'Play Audio'}
                          </>
                        )}
                      </button>

                      {isPlayingAudio && (
                        <button
                          type="button"
                          onClick={stopAudio}
                          className="p-2.5 rounded-xl border border-current/15 hover:border-[#E43136] hover:text-[#E43136] cursor-pointer"
                          title="Stop Audio"
                        >
                          <Square className="w-4 h-4" />
                        </button>
                      )}

                      <button
                        type="button"
                        disabled={activeBlockIdx >= contentBlocks.length - 1}
                        onClick={() =>
                          speakBlockAt(Math.min(contentBlocks.length - 1, activeBlockIdx + 1))
                        }
                        className="p-2.5 rounded-xl border border-current/15 disabled:opacity-35 hover:border-[#E43136] cursor-pointer"
                        title="Next Paragraph"
                      >
                        <SkipForward className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        disabled={currentChapterIndex >= totalChapters - 1}
                        onClick={() => handleChapterChange(currentChapterIndex + 1)}
                        className="p-2.5 rounded-xl border border-current/15 disabled:opacity-35 hover:border-[#E43136] cursor-pointer"
                        title="Next Chapter"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Speed Selector: 0.75x, 1x, 1.25x, 1.5x, 1.75x, 2x */}
                    <div className="flex items-center gap-1 rounded-xl border border-current/15 p-1 text-[11px] font-semibold">
                      {[0.75, 1, 1.25, 1.5, 1.75, 2].map((spd) => (
                        <button
                          key={spd}
                          type="button"
                          onClick={() => setPlaybackSpeed(spd)}
                          className={`px-2 py-1 rounded-lg cursor-pointer transition-colors ${
                            playbackSpeed === spd
                              ? 'bg-[#E43136] text-white'
                              : 'opacity-75 hover:opacity-100'
                          }`}
                        >
                          {spd}x
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Voice Personas & Native Device Voices */}
              <div className="mt-6 pt-5 border-t border-current/10 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider opacity-75">
                    Select Narrator Voice (Many Voices)
                  </span>
                  {systemVoices.length > 0 && (
                    <select
                      aria-label="Select native device voice"
                      value={customNativeVoiceURI}
                      onChange={(e) => setCustomNativeVoiceURI(e.target.value)}
                      className="max-w-[240px] rounded-lg border border-current/20 bg-transparent px-2.5 py-1 text-xs cursor-pointer"
                    >
                      <option value="" className="text-black">
                        Curated Persona ({selectedPersona.name})
                      </option>
                      {systemVoices.map((v) => (
                        <option key={v.voiceURI} value={v.voiceURI} className="text-black">
                          {v.name} ({v.lang})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="flex items-center gap-2.5 overflow-x-auto pb-1 no-scrollbar">
                  {VOICE_PERSONAS.map((persona) => {
                    const isSelected = !customNativeVoiceURI && selectedPersonaId === persona.id;
                    return (
                      <div
                        key={persona.id}
                        onClick={() => {
                          setCustomNativeVoiceURI('');
                          setSelectedPersonaId(persona.id);
                        }}
                        className={`shrink-0 rounded-xl border px-3.5 py-2.5 cursor-pointer transition-all flex items-center gap-3 ${
                          isSelected
                            ? 'border-[#E43136] bg-[#E43136]/10'
                            : 'border-current/15 hover:border-[#E43136]/50'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold">{persona.name}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-current/10 font-medium">
                              {persona.role}
                            </span>
                          </div>
                          <p className="text-[10px] opacity-70 mt-0.5">{persona.accentLabel}</p>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCustomNativeVoiceURI('');
                            setSelectedPersonaId(persona.id);
                            handlePreviewVoice(persona);
                          }}
                          className="p-1.5 rounded-lg border border-current/15 hover:border-[#E43136] hover:text-[#E43136] text-[10px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Volume2 className="w-3 h-3" />
                          Preview
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* AI Audio Story Text Cleaner Card */}
            <div className="rounded-2xl border border-violet-500/25 bg-gradient-to-r from-violet-500/10 via-purple-500/5 to-transparent p-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 shadow-xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-violet-600 text-white text-[10px] font-bold tracking-wide uppercase">
                    Free Gemini AI
                  </span>
                  <h4 className="text-xs sm:text-sm font-bold flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-violet-500" />
                    <span>PDF to Audio Story Cleaner</span>
                  </h4>
                  {aiNormalizedText && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/20">
                      ✓ AI Clean Active
                    </span>
                  )}
                </div>
                <p className="text-xs opacity-75 max-w-xl leading-relaxed">
                  Converts noisy PDF OCR extracts, broken headers, page numbers, and hyphenated lines into natural, flowing story narration for smooth audiobook listening.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {aiNormalizedText && (
                  <button
                    type="button"
                    onClick={() => {
                      setAiNormalizedText(null);
                      addToast('Reset to original chapter text.', 'info');
                    }}
                    className="px-3 py-1.5 rounded-xl border border-current/20 text-xs font-semibold hover:bg-current/10 cursor-pointer transition-colors"
                  >
                    Reset Original
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleNormalizeAudioWithAI}
                  disabled={isNormalizingAi}
                  className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold inline-flex items-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>
                    {isNormalizingAi
                      ? 'Cleaning with Gemini AI...'
                      : aiNormalizedText
                      ? 'Re-clean Chapter with AI'
                      : 'Clean PDF with Free AI'}
                  </span>
                </button>
              </div>
            </div>

            {/* Live Interactive Audio Transcript */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-xs font-bold uppercase tracking-wider opacity-70">
                  Interactive Chapter Transcript (Tap any paragraph to jump audio)
                </h3>
                <span className="text-xs opacity-70">
                  {contentBlocks.length} paragraphs
                </span>
              </div>
              <div className="space-y-2.5">
                {contentBlocks.map((block, idx) => {
                  const isActive = activeBlockIdx === idx;
                  const cleanPreview = block.replace(/^#+\s*/, '');
                  return (
                    <div
                      key={idx}
                      ref={(el) => {
                        paragraphRefs.current[idx] = el;
                      }}
                      onClick={() => speakBlockAt(idx)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer ${
                        isActive
                          ? 'border-[#E43136] bg-[#E43136]/10 shadow-xs'
                          : 'border-current/10 hover:border-current/30 bg-current/[0.02]'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] opacity-65 mb-1 tabular-nums">
                        <span>Paragraph {idx + 1}</span>
                        {isActive && isPlayingAudio && (
                          <span className="text-[#E43136] font-bold">● Speaking Now</span>
                        )}
                      </div>
                      <p className="font-display text-sm sm:text-base leading-relaxed whitespace-pre-line">
                        {cleanPreview}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* End-of-Chapter Book & Chapter Discussion in Audio Mode */}
            <section className="pt-6 border-t border-current/15 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm sm:text-base font-bold flex items-center gap-2">
                    <MessageCircle className="w-4 h-4 text-[#E43136]" />
                    <span>Chapter & Book Discussion</span>
                  </h3>
                  <p className="text-xs opacity-70">
                    Share your thoughts with other listeners and readers
                  </p>
                </div>
                <div className="inline-flex rounded-xl border border-current/15 p-0.5 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setEndOfChapterTab('chapter')}
                    className={`px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${
                      endOfChapterTab === 'chapter'
                        ? 'bg-[#E43136] text-white'
                        : 'opacity-75 hover:opacity-100'
                    }`}
                  >
                    Chapter {currentChapter.chapterNumber} ({chapterLevelCommentsCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setEndOfChapterTab('book')}
                    className={`px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${
                      endOfChapterTab === 'book'
                        ? 'bg-[#E43136] text-white'
                        : 'opacity-75 hover:opacity-100'
                    }`}
                  >
                    Full Book ({bookLevelCommentsCount})
                  </button>
                </div>
              </div>

              <div className="p-4 sm:p-5 rounded-2xl border border-current/15 bg-current/[0.02]">
                {endOfChapterTab === 'chapter' ? (
                  <CommentThread
                    postId={chapterCommentPostId}
                    postAuthorId={book.authorId}
                    postAuthorName={book.authorName}
                    targetTitle={`${book.title} · Chapter ${currentChapter.chapterNumber}`}
                    postLink={`/read/${book.id}?mode=audio&ch=${currentChapter.chapterNumber}`}
                    expanded={true}
                    onToggleExpand={() => {}}
                    quickReactions={BOOK_DISCUSSION_REACTIONS}
                    placeholder={`Discuss Chapter ${currentChapter.chapterNumber}: "${currentChapter.title}"...`}
                    emptyMessage={`No comments on Chapter ${currentChapter.chapterNumber} yet. Start the conversation!`}
                  />
                ) : (
                  <CommentThread
                    postId={bookCommentPostId}
                    postAuthorId={book.authorId}
                    postAuthorName={book.authorName}
                    targetTitle={book.title}
                    postLink={`/book/${book.id}`}
                    expanded={true}
                    onToggleExpand={() => {}}
                    quickReactions={BOOK_DISCUSSION_REACTIONS}
                    placeholder={`Share your overall review or thoughts on "${book.title}"...`}
                    emptyMessage="No overall book comments yet. Be the first to discuss this book!"
                  />
                )}
              </div>
            </section>
          </div>
        </main>
      ) : (
        /* ==================================================================
            MODE A: PROFESSIONAL TEXT READER (WITH WATTPAD INLINE PARAGRAPH COMMENTS)
           ================================================================== */
        <main
          ref={mainReadingScrollRef}
          onClick={(e) => {
            const targetEl = e.target as HTMLElement;
            const tag = targetEl.tagName;
            if (
              ['BUTTON', 'A', 'INPUT', 'SELECT', 'MARK', 'TEXTAREA'].includes(tag) ||
              targetEl.closest('[data-wattpad-comment-zone="true"]')
            ) {
              return;
            }
            if (window.getSelection()?.toString().trim()) return;
            setImmersiveBarsHidden((h) => !h);
          }}
          className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-8 py-7 sm:py-10"
        >
          {loadingChapters ? (
            <div className={`mx-auto ${widthClass} space-y-5 animate-pulse`}>
              <div className="h-4 w-32 bg-current/10 rounded" />
              <div className="h-9 w-3/4 bg-current/10 rounded" />
              <div className="h-px w-full bg-current/10 my-6" />
              <div className="h-4 w-full bg-current/10 rounded" />
              <div className="h-4 w-11/12 bg-current/10 rounded" />
              <div className="h-4 w-full bg-current/10 rounded" />
              <div className="h-4 w-4/5 bg-current/10 rounded" />
            </div>
          ) : chapterError ? (
            <div className="max-w-md mx-auto my-12 p-6 rounded-2xl border border-current/15 text-center space-y-4">
              <p className="text-sm font-semibold">{chapterError}</p>
              <button
                type="button"
                onClick={loadBookContent}
                className="py-2 px-4 rounded-xl bg-[#E43136] text-white text-xs font-semibold cursor-pointer"
              >
                Retry Loading Book
              </button>
            </div>
          ) : (
            <article className={`mx-auto ${widthClass} pb-12`}>
              {/* Chapter Header */}
              <header className="mb-8 pb-6 border-b border-current/10">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <p className="text-xs uppercase tracking-widest text-[#E43136] font-semibold">
                    Chapter {currentChapter.chapterNumber} of {totalChapters}
                  </p>
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setShowInlineComments((v) => !v)}
                      className={`text-xs font-semibold inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${
                        showInlineComments
                          ? 'border-[#E43136]/40 bg-[#E43136]/10 text-[#E43136]'
                          : 'border-current/15 opacity-75 hover:opacity-100'
                      }`}
                      title="Toggle Wattpad-style paragraph comment bubbles"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>
                        {showInlineComments ? 'Paragraph Comments: ON' : 'Paragraph Comments: OFF'}
                      </span>
                      {totalChapterParagraphCommentsCount > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full bg-[#E43136] text-white text-[10px] font-bold tabular-nums">
                          {totalChapterParagraphCommentsCount}
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleTogglePlayPause()}
                      className="text-xs font-semibold text-[#E43136] hover:underline inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      {isPlayingAudio && !isPausedAudio
                        ? `Pause Audio (${selectedPersona.name})`
                        : `Listen with ${selectedPersona.name}`}
                    </button>
                  </div>
                </div>
                <h2 className="font-display text-2xl sm:text-3xl font-bold leading-snug">
                  {currentChapter.title}
                </h2>
              </header>

              {/* Formatted Book Content with Wattpad-Style Paragraph Comment Sections */}
              <div
                style={{
                  fontSize: `${prefs.fontSize}px`,
                  fontFamily: fontFamilyStyle,
                  textAlign: prefs.textAlign,
                }}
                className={`${lineHeightClass} ${paraSpacingClass}`}
              >
                {visibleBlocksWithOriginalIdx.map(({ block: trimmed, originalIdx: idx }) => {
                  const isNarratingThisBlock = isPlayingAudio && activeBlockIdx === idx;
                  const highlightClass = isNarratingThisBlock
                    ? 'bg-[#E43136]/10 border-l-4 border-[#E43136] pl-3.5 py-1 rounded-r-lg transition-all'
                    : '';

                  // Scene break dividers
                  if (
                    trimmed === '* * *' ||
                    trimmed === '***' ||
                    trimmed === '---' ||
                    trimmed.includes('─── ❖ ───')
                  ) {
                    return (
                      <div
                        key={idx}
                        className="py-6 text-center text-[#E43136] tracking-[0.4em] font-semibold select-none opacity-80"
                      >
                        ─── ❖ ───
                      </div>
                    );
                  }

                  // Page breaks
                  if (trimmed === '=== PAGE BREAK ===' || trimmed === '[pagebreak]') {
                    return (
                      <div
                        key={idx}
                        className="my-8 py-3 border-y border-dashed border-current/20 text-center text-[11px] uppercase tracking-[0.25em] opacity-60 select-none font-sans"
                      >
                        Page Break
                      </div>
                    );
                  }

                  // Inline Manuscript Image: [image:url|size|align|caption]
                  if (trimmed.startsWith('[image:') && trimmed.endsWith(']')) {
                    const raw = trimmed.slice(7, -1);
                    const [imgUrl = '', size = 'md', align = 'center', caption = ''] =
                      raw.split('|');
                    return (
                      <InlineChapterImage
                        key={idx}
                        rawUrl={imgUrl}
                        size={size}
                        align={align}
                        caption={caption}
                      />
                    );
                  }

                  // Markdown Image syntax: ![caption](url)
                  const mdImgMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
                  if (mdImgMatch) {
                    return (
                      <InlineChapterImage
                        key={idx}
                        rawUrl={mdImgMatch[2]}
                        size="lg"
                        align="center"
                        caption={mdImgMatch[1]}
                      />
                    );
                  }

                  // Helper to render the Wattpad-style Inline Paragraph Comment bar & expandable thread right after each paragraph
                  const paraComments = paragraphCommentsByIdx.get(idx) || [];
                  const isParaCommentExpanded =
                    expandedParagraphComments[idx] ?? paraComments.length > 0;
                  const paraPostId = getParagraphCommentPostId(
                    book.id,
                    currentChapter.chapterNumber,
                    idx
                  );
                  const cleanParaSnippet = trimmed.replace(/^#+\s*/, '').slice(0, 140);
                  const renderWattpadParagraphCommentBar = () => null;

                  // Headings
                  if (trimmed.startsWith('### ')) {
                    return (
                      <div key={idx} className="group/para">
                        <h5
                          ref={(el) => {
                            paragraphRefs.current[idx] = el;
                          }}
                          onMouseUp={() => handleTextMouseUp(idx)}
                          className={`font-display text-lg font-bold pt-3 pb-1 tracking-tight ${highlightClass}`}
                        >
                          {renderFormattedParagraphContent(trimmed.slice(4), idx)}
                        </h5>
                        {renderWattpadParagraphCommentBar()}
                      </div>
                    );
                  }
                  if (trimmed.startsWith('## ')) {
                    return (
                      <div key={idx} className="group/para">
                        <h4
                          ref={(el) => {
                            paragraphRefs.current[idx] = el;
                          }}
                          onMouseUp={() => handleTextMouseUp(idx)}
                          className={`font-display text-xl font-bold pt-4 pb-1 tracking-tight ${highlightClass}`}
                        >
                          {renderFormattedParagraphContent(trimmed.slice(3), idx)}
                        </h4>
                        {renderWattpadParagraphCommentBar()}
                      </div>
                    );
                  }
                  if (trimmed.startsWith('# ')) {
                    return (
                      <div key={idx} className="group/para">
                        <h3
                          ref={(el) => {
                            paragraphRefs.current[idx] = el;
                          }}
                          onMouseUp={() => handleTextMouseUp(idx)}
                          className={`font-display text-2xl font-bold pt-5 pb-1 tracking-tight ${highlightClass}`}
                        >
                          {renderFormattedParagraphContent(trimmed.slice(2), idx)}
                        </h3>
                        {renderWattpadParagraphCommentBar()}
                      </div>
                    );
                  }

                  // Bulleted or Numbered Lists
                  const lines = trimmed.split('\n');
                  const isBulletList =
                    lines.length > 0 && lines.every((l) => /^[-*•]\s+/.test(l.trim()));
                  if (isBulletList) {
                    return (
                      <div key={idx} className="group/para">
                        <ul
                          ref={(el) => {
                            paragraphRefs.current[idx] = el;
                          }}
                          onMouseUp={() => handleTextMouseUp(idx)}
                          className={`list-disc pl-6 space-y-1.5 my-3 ${highlightClass}`}
                        >
                          {lines.map((line, lIdx) => (
                            <li key={lIdx}>
                              {renderFormattedParagraphContent(
                                line.trim().replace(/^[-*•]\s+/, ''),
                                idx
                              )}
                            </li>
                          ))}
                        </ul>
                        {renderWattpadParagraphCommentBar()}
                      </div>
                    );
                  }

                  // Blockquote / Epigraph
                  if (trimmed.startsWith('> ')) {
                    const quoteText = trimmed
                      .split('\n')
                      .map((l) => l.replace(/^>\s?/, ''))
                      .join('\n');
                    return (
                      <div key={idx} className="group/para">
                        <blockquote
                          ref={(el) => {
                            paragraphRefs.current[idx] = el;
                          }}
                          onMouseUp={() => handleTextMouseUp(idx)}
                          className={`border-l-4 border-[#E43136] pl-5 py-2 my-4 italic opacity-90 bg-current/[0.03] rounded-r-xl whitespace-pre-line ${highlightClass}`}
                        >
                          {renderFormattedParagraphContent(quoteText, idx)}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedSimpleParagraphIdx(idx);
                              setSimpleCommentInput('');
                            }}
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-semibold text-xs ml-2 not-italic inline-flex items-center gap-0.5 hover:underline cursor-pointer select-none align-baseline whitespace-nowrap transition-colors"
                            title="View comments for this quote"
                          >
                            ~ {paraComments.length} {paraComments.length === 1 ? 'comment' : 'comments'}
                          </button>
                        </blockquote>
                      </div>
                    );
                  }

                  return (
                    <div key={idx} className="group/para">
                      <p
                        ref={(el) => {
                          paragraphRefs.current[idx] = el;
                        }}
                        onMouseUp={() => handleTextMouseUp(idx)}
                        onClick={() => {
                          setCurrentParagraphIdx(idx);
                          if (isPlayingAudio) speakBlockAt(idx);
                        }}
                        className={`whitespace-pre-line clear-both ${highlightClass} ${
                          idx === 0 && !isNarratingThisBlock
                            ? 'first-letter:float-left first-letter:text-4xl sm:first-letter:text-5xl first-letter:font-bold first-letter:pr-3 first-letter:leading-none first-letter:text-[#E43136]'
                            : ''
                        }`}
                      >
                        {renderFormattedParagraphContent(trimmed, idx)}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSimpleParagraphIdx(idx);
                            setSimpleCommentInput('');
                          }}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-semibold text-xs ml-2 inline-flex items-center gap-0.5 hover:underline cursor-pointer select-none align-baseline whitespace-nowrap transition-colors"
                          title="View comments for this paragraph"
                        >
                          ~ {paraComments.length} {paraComments.length === 1 ? 'comment' : 'comments'}
                        </button>
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Paginated Section Switcher (when user selects Paginated Sections in Settings) */}
              {prefs.layoutFlow === 'paginated' && totalPaginatedSections > 1 && (
                <div className="mt-10 pt-5 border-t border-current/15 flex items-center justify-between text-xs font-semibold">
                  <button
                    type="button"
                    disabled={paginatedSectionIdx <= 0}
                    onClick={() => {
                      setPaginatedSectionIdx((s) => Math.max(0, s - 1));
                      mainReadingScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="py-2 px-4 rounded-xl border border-current/20 disabled:opacity-35 cursor-pointer"
                  >
                    ← Previous Page Section
                  </button>
                  <span className="tabular-nums opacity-75">
                    Section {paginatedSectionIdx + 1} of {totalPaginatedSections}
                  </span>
                  <button
                    type="button"
                    disabled={paginatedSectionIdx >= totalPaginatedSections - 1}
                    onClick={() => {
                      setPaginatedSectionIdx((s) => Math.min(totalPaginatedSections - 1, s + 1));
                      mainReadingScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="py-2 px-4 rounded-xl bg-[#E43136] text-white disabled:opacity-35 cursor-pointer"
                  >
                    Next Page Section →
                  </button>
                </div>
              )}

              {/* ============================================================
                  DEDICATED END-OF-CHAPTER & BOOK COMMENT SECTION
                 ============================================================ */}
              <section
                data-wattpad-comment-zone="true"
                className="mt-12 pt-8 border-t border-current/15 space-y-5 font-sans"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#E43136] flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5" />
                      Community Book Club & Chapter Discussions
                    </span>
                    <h3 className="text-base sm:text-lg font-bold mt-0.5">
                      Discuss {endOfChapterTab === 'chapter' ? `Chapter ${currentChapter.chapterNumber}: ${currentChapter.title}` : book.title}
                    </h3>
                  </div>

                  <div className="inline-flex rounded-xl border border-current/15 p-0.5 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setEndOfChapterTab('chapter')}
                      className={`px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${
                        endOfChapterTab === 'chapter'
                          ? 'bg-[#E43136] text-white shadow-2xs'
                          : 'opacity-75 hover:opacity-100'
                      }`}
                    >
                      Chapter {currentChapter.chapterNumber} Comments ({chapterLevelCommentsCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setEndOfChapterTab('book')}
                      className={`px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${
                        endOfChapterTab === 'book'
                          ? 'bg-[#E43136] text-white shadow-2xs'
                          : 'opacity-75 hover:opacity-100'
                      }`}
                    >
                      Overall Book Comments ({bookLevelCommentsCount})
                    </button>
                  </div>
                </div>

                <div className="p-4 sm:p-6 rounded-2xl border border-current/15 bg-current/[0.02]">
                  {endOfChapterTab === 'chapter' ? (
                    <CommentThread
                      postId={chapterCommentPostId}
                      postAuthorId={book.authorId}
                      postAuthorName={book.authorName}
                      targetTitle={`${book.title} · Chapter ${currentChapter.chapterNumber}`}
                      postLink={`/read/${book.id}?mode=text&ch=${currentChapter.chapterNumber}`}
                      expanded={true}
                      onToggleExpand={() => {}}
                      quickReactions={BOOK_DISCUSSION_REACTIONS}
                      placeholder={`Share your thoughts on Chapter ${currentChapter.chapterNumber} ("${currentChapter.title}")...`}
                      emptyMessage={`No comments on Chapter ${currentChapter.chapterNumber} yet. Be the first reader to share your reaction!`}
                    />
                  ) : (
                    <CommentThread
                      postId={bookCommentPostId}
                      postAuthorId={book.authorId}
                      postAuthorName={book.authorName}
                      targetTitle={book.title}
                      postLink={`/book/${book.id}`}
                      expanded={true}
                      onToggleExpand={() => {}}
                      quickReactions={BOOK_DISCUSSION_REACTIONS}
                      placeholder={`Write an overall comment, review, or theory about "${book.title}"...`}
                      emptyMessage="No overall book comments yet. Start the discussion for this book!"
                    />
                  )}
                </div>
              </section>
            </article>
          )}
        </main>
      )}

      {/* ====================================================================
          COMPACT FLOATING AUDIO MINI-BAR WHEN LISTENING IN TEXT MODE
         ==================================================================== */}
      {isPlayingAudio && readingMode === 'text' && (
        <div
          className={`shrink-0 border-t px-4 py-2 flex items-center justify-between gap-3 text-xs ${toolbarClasses}`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2 h-2 rounded-full bg-[#E43136] animate-ping shrink-0" />
            <span className="font-semibold truncate">
              {selectedPersona.name} · Para {activeBlockIdx + 1}/{contentBlocks.length}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => speakBlockAt(Math.max(0, activeBlockIdx - 1))}
              className="p-1.5 rounded-lg border border-current/15 cursor-pointer"
            >
              <SkipBack className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleTogglePlayPause}
              className="py-1 px-3 rounded-lg bg-[#E43136] text-white font-semibold cursor-pointer"
            >
              {isPausedAudio ? 'Resume' : 'Pause'}
            </button>
            <button
              type="button"
              onClick={() => speakBlockAt(Math.min(contentBlocks.length - 1, activeBlockIdx + 1))}
              className="p-1.5 rounded-lg border border-current/15 cursor-pointer"
            >
              <SkipForward className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={stopAudio}
              className="p-1.5 rounded-lg border border-current/15 hover:text-[#E43136] cursor-pointer"
            >
              <Square className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ====================================================================
          FIXED BOTTOM READING BAR
         ==================================================================== */}
      <footer
        className={`shrink-0 z-30 border-t px-3 sm:px-6 h-14 flex items-center justify-between gap-3 transition-all duration-200 ${toolbarClasses} ${
          immersiveBarsHidden ? 'max-md:translate-y-full max-md:h-0 max-md:overflow-hidden max-md:border-0' : ''
        }`}
      >
        <button
          type="button"
          disabled={readingMode === 'pdf' ? currentPdfPage <= 1 : currentChapterIndex <= 0}
          onClick={() => {
            if (readingMode === 'pdf') {
              setCurrentPdfPage((p) => Math.max(1, p - 1));
            } else {
              handleChapterChange(currentChapterIndex - 1);
            }
          }}
          className="py-2 px-3 sm:px-4 rounded-xl border border-current/20 text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-35 hover:border-[#E43136] cursor-pointer shrink-0"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="hidden sm:inline">
            {readingMode === 'pdf' ? 'Previous Page' : 'Previous Chapter'}
          </span>
        </button>

        <div className="flex flex-col items-center gap-1 flex-1 max-w-sm min-w-0">
          <div className="w-full h-1.5 rounded-full bg-current/10 overflow-hidden">
            <div
              style={{ width: `${progressPercentage}%` }}
              className="h-full bg-[#E43136] transition-all duration-200"
            />
          </div>
          <span className="text-[10px] sm:text-[11px] opacity-75 tabular-nums truncate max-w-full">
            {progressPercentage}% Completed ·{' '}
            {readingMode === 'pdf'
              ? `Page ${currentPdfPage} / ${totalPdfPages}`
              : `Chapter ${currentChapterIndex + 1} / ${totalChapters}`}
          </span>
        </div>

        <button
          type="button"
          disabled={
            readingMode === 'pdf'
              ? currentPdfPage >= totalPdfPages
              : currentChapterIndex >= totalChapters - 1
          }
          onClick={() => {
            if (readingMode === 'pdf') {
              setCurrentPdfPage((p) => Math.min(totalPdfPages, p + 1));
            } else {
              handleChapterChange(currentChapterIndex + 1);
            }
          }}
          className="py-2 px-3 sm:px-4 rounded-xl bg-[#E43136] hover:bg-[#B9272D] text-white text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-35 cursor-pointer shrink-0"
        >
          <span className="hidden sm:inline">
            {readingMode === 'pdf' ? 'Next Page' : 'Next Chapter'}
          </span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </footer>
    </div>
  );
};
