import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search,
  SlidersHorizontal,
  X,
  Clock,
  Compass,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  ArrowLeft,
  BookOpen,
  Sparkles,
  PlusCircle,
  AlertTriangle,
  Trash2,
} from 'lucide-react';
import { collection, query, where, limit, getDocs } from 'firebase/firestore';
import { db, defaultDb } from '../services/firebase/firebaseConfig';
import { normalizeBookDoc } from '../services/firebase/storageService';
import { useRedcover } from '../contexts/RedcoverContext';
import { Book, REDCOVER_CATEGORIES } from '../models/types';
import { BookCard, EmptyState, UserCard } from '../components/common/UIPrimitives';

type SortOption = 'popular' | 'rating' | 'views' | 'likes' | 'recent' | 'alpha';

export interface CategoryMeta {
  name: string;
  description: string;
  aliases: string[];
}

export const EXPLORE_CATEGORY_SECTIONS: CategoryMeta[] = [
  {
    name: 'Romance',
    description: 'Discover romantic stories and emotional fiction.',
    aliases: ['romance', 'love', 'relationships', 'romantic', 'contemporary romance'],
  },
  {
    name: 'Business',
    description: 'Entrepreneurship, leadership, strategy, and company building.',
    aliases: ['business', 'entrepreneurship', 'startup', 'startups', 'management', 'marketing', 'leadership'],
  },
  {
    name: 'Finance',
    description: 'Investing, wealth building, markets, and personal finance.',
    aliases: ['finance', 'investing', 'money', 'wealth', 'economics', 'trading', 'personal finance'],
  },
  {
    name: 'Self Help',
    description: 'Practical guides for mindset, resilience, and everyday improvement.',
    aliases: ['self help', 'self-help', 'selfhelp', 'self improvement', 'self-improvement', 'mental health', 'wellness'],
  },
  {
    name: 'Productivity',
    description: 'Time management, deep work, focus systems, and execution.',
    aliases: ['productivity', 'habits', 'time management', 'focus', 'efficiency', 'workflow'],
  },
  {
    name: 'Education',
    description: 'Academic guides, university preparation, career skills, and learning.',
    aliases: [
      'education',
      'academic',
      'university',
      'college',
      'study',
      'learning',
      'career',
      'linkedin',
      'technology',
      'science',
      'non-fiction',
      'nonfiction',
    ],
  },
  {
    name: 'Fiction',
    description: 'Imaginative storytelling, literary worlds, and contemporary tales.',
    aliases: [
      'fiction',
      'story',
      'stories',
      'novel',
      'drama',
      'fantasy',
      'sci-fi',
      'science fiction',
      'historical',
      'poetry',
      'literature',
      'general',
    ],
  },
  {
    name: 'Mystery',
    description: 'Suspenseful whodunits, detective investigations, and hidden secrets.',
    aliases: ['mystery', 'detective', 'crime', 'whodunit', 'investigation', 'noir'],
  },
  {
    name: 'Thriller',
    description: 'High-stakes tension, psychological twists, and fast-paced action.',
    aliases: ['thriller', 'suspense', 'psychological thriller', 'action', 'horror', 'adventure'],
  },
  {
    name: 'Personal Development',
    description: 'Self-mastery, communication, confidence, and lifelong growth.',
    aliases: [
      'personal development',
      'personal-development',
      'personal growth',
      'mindset',
      'motivation',
      'success',
      'psychology',
      'philosophy',
      'biography',
    ],
  },
];

// In-memory cache for Firebase category-filtered preview queries (up to 10 books per category)
const categoryPreviewCache = new Map<string, Book[]>();

/**
 * Maps any raw Firestore book category string to one of the 10 canonical Redcover categories
 * so existing Firebase books never get lost or create duplicate sections.
 */
export function resolveCanonicalCategory(book: Book): string {
  const rawCat = (book.category || '').trim();
  const lowerCat = rawCat.toLowerCase();

  // 1. Exact or alias match on the book's category field
  for (const section of EXPLORE_CATEGORY_SECTIONS) {
    if (section.name.toLowerCase() === lowerCat) {
      return section.name;
    }
    if (section.aliases.some((alias) => lowerCat === alias || lowerCat.includes(alias))) {
      return section.name;
    }
  }

  // 2. Contextual keyword fallback if category was generic or unmapped
  const combinedText = `${book.title} ${book.shortDescription || ''} ${rawCat}`.toLowerCase();
  for (const section of EXPLORE_CATEGORY_SECTIONS) {
    if (section.aliases.some((alias) => alias.length > 3 && combinedText.includes(alias))) {
      return section.name;
    }
  }

  return 'Fiction';
}

function sortBooksList(list: Book[], sortBy: SortOption): Book[] {
  return [...list].sort((a, b) => {
    switch (sortBy) {
      case 'rating':
        return b.rating - a.rating || b.views - a.views;
      case 'views':
        return b.views - a.views;
      case 'likes':
        return b.likes - a.likes;
      case 'recent':
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case 'alpha':
        return a.title.localeCompare(b.title);
      case 'popular':
      default:
        return b.views + b.likes * 3 - (a.views + a.likes * 3);
    }
  });
}

/**
 * Independent Horizontal Category Carousel
 * - Desktop: ~5–6 cards visible + Prev/Next arrow controls + trackpad/wheel support
 * - Tablet: ~3–4 cards visible
 * - Mobile: ~1.8–2.3 cards visible + touch swipe scrolling
 * - Displays up to 10 real Firebase books followed by a final [Show More →] card
 */
const CategoryCarouselSection: React.FC<{
  category: CategoryMeta;
  books: Book[];
  savedSet: Set<string>;
  likedSet: Set<string>;
  onToggleSave: (book: Book) => void;
  onToggleLike: (book: Book) => void;
  onSelectCategory: (categoryName: string) => void;
}> = ({
  category,
  books,
  savedSet,
  likedSet,
  onToggleSave,
  onToggleLike,
  onSelectCategory,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  // Maximum 10 books in each initial category preview
  const previewBooks = useMemo(() => books.slice(0, 10), [books]);
  const totalAvailable = books.length;

  const updateScrollButtons = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 8);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 8);
  }, []);

  useEffect(() => {
    updateScrollButtons();
    const el = scrollContainerRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateScrollButtons, { passive: true });
    window.addEventListener('resize', updateScrollButtons);
    return () => {
      el.removeEventListener('scroll', updateScrollButtons);
      window.removeEventListener('resize', updateScrollButtons);
    };
  }, [updateScrollButtons, previewBooks.length]);

  const handleScrollBy = (direction: 'left' | 'right') => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const scrollAmount = Math.max(280, Math.floor(el.clientWidth * 0.78));
    el.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  return (
    <section
      aria-label={`${category.name} Books`}
      className="bg-white dark:bg-[#16161A] rounded-2xl border border-[#DDDDE3] dark:border-[#2C2C35] p-4 sm:p-6 space-y-4 transition-colors"
    >
      {/* 7. SECTION HEADER */}
      <div className="flex items-start sm:items-end justify-between gap-3 border-b border-[#F1F1F4] dark:border-[#2C2C35] pb-3.5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <h2 className="font-display text-lg sm:text-2xl font-bold text-[#202020] dark:text-[#F4F4F6] tracking-tight">
              {category.name}
            </h2>
            <span className="text-xs font-medium text-[#777780] dark:text-[#9E9EA9] tabular-nums">
              · {totalAvailable} {totalAvailable === 1 ? 'book' : 'books'}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#777780] dark:text-[#9E9EA9] mt-0.5 line-clamp-1">
            {category.description}
          </p>
        </div>

        {/* Right Controls: View All Link + Desktop Carousel Navigation Arrows */}
        <div className="flex items-center gap-2 shrink-0">
          <Link
            to={`/explore?category=${encodeURIComponent(category.name)}`}
            onClick={(e) => {
              e.preventDefault();
              onSelectCategory(category.name);
            }}
            className="py-1.5 px-3 rounded-lg text-xs sm:text-sm font-semibold text-[#E43136] hover:bg-[#FFF3F4] dark:hover:bg-[#2D1619] inline-flex items-center gap-1 transition-colors whitespace-nowrap"
          >
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>

          {previewBooks.length > 0 && (
            <div className="hidden sm:flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleScrollBy('left')}
                disabled={!canScrollLeft}
                aria-label={`Scroll ${category.name} left`}
                className="w-8 h-8 rounded-lg border border-[#DDDDE3] dark:border-[#2C2C35] bg-[#FAFAFB] dark:bg-[#0F0F12] text-[#202020] dark:text-[#F4F4F6] hover:border-[#E43136] hover:text-[#E43136] disabled:opacity-35 disabled:pointer-events-none flex items-center justify-center transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handleScrollBy('right')}
                disabled={!canScrollRight}
                aria-label={`Scroll ${category.name} right`}
                className="w-8 h-8 rounded-lg border border-[#DDDDE3] dark:border-[#2C2C35] bg-[#FAFAFB] dark:bg-[#0F0F12] text-[#202020] dark:text-[#F4F4F6] hover:border-[#E43136] hover:text-[#E43136] disabled:opacity-35 disabled:pointer-events-none flex items-center justify-center transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 4. INDEPENDENT HORIZONTAL CAROUSEL */}
      {previewBooks.length > 0 ? (
        <div className="relative group/carousel">
          {/* Desktop Floating Previous Button */}
          {canScrollLeft && (
            <button
              type="button"
              onClick={() => handleScrollBy('left')}
              aria-label={`Previous ${category.name} books`}
              className="hidden lg:flex absolute -left-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white dark:bg-[#16161A] border border-[#DDDDE3] dark:border-[#2C2C35] shadow-md text-[#202020] dark:text-[#F4F4F6] hover:bg-[#E43136] hover:text-white hover:border-[#E43136] items-center justify-center opacity-0 group-hover/carousel:opacity-100 transition-all cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}

          {/* Desktop Floating Next Button */}
          {canScrollRight && (
            <button
              type="button"
              onClick={() => handleScrollBy('right')}
              aria-label={`Next ${category.name} books`}
              className="hidden lg:flex absolute -right-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white dark:bg-[#16161A] border border-[#DDDDE3] dark:border-[#2C2C35] shadow-md text-[#202020] dark:text-[#F4F4F6] hover:bg-[#E43136] hover:text-white hover:border-[#E43136] items-center justify-center opacity-0 group-hover/carousel:opacity-100 transition-all cursor-pointer"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          )}

          <div
            ref={scrollContainerRef}
            className="flex items-stretch gap-3 sm:gap-4 overflow-x-auto no-scrollbar scroll-smooth snap-x snap-mandatory py-1"
          >
            {/* Up to 10 Real Books in this Category */}
            {previewBooks.map((book) => (
              <div
                key={book.id}
                className="w-[43vw] min-w-[146px] max-w-[172px] sm:w-[184px] sm:max-w-none md:w-[194px] lg:w-[200px] xl:w-[206px] shrink-0 snap-start"
              >
                <BookCard
                  book={book}
                  isSaved={savedSet.has(book.id)}
                  isLiked={likedSet.has(book.id)}
                  onToggleSave={onToggleSave}
                  onToggleLike={onToggleLike}
                />
              </div>
            ))}

            {/* 6. MANDATORY FINAL "SHOW MORE →" CARD AT THE END OF THE CAROUSEL */}
            <div className="w-[43vw] min-w-[146px] max-w-[172px] sm:w-[184px] sm:max-w-none md:w-[194px] lg:w-[200px] xl:w-[206px] shrink-0 snap-start flex">
              <Link
                to={`/explore?category=${encodeURIComponent(category.name)}`}
                onClick={(e) => {
                  e.preventDefault();
                  onSelectCategory(category.name);
                }}
                className="w-full rounded-xl sm:rounded-2xl bg-gradient-to-br from-[#FFF3F4] via-[#FBE5E8]/70 to-white dark:from-[#2D1619] dark:via-[#1F1214] dark:to-[#16161A] border border-[#E43136]/30 hover:border-[#E43136] p-4 sm:p-5 flex flex-col justify-between text-left group/more transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm"
              >
                <div className="space-y-2.5">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-[#E43136] text-white flex items-center justify-center shadow-xs group-hover/more:scale-105 transition-transform">
                    <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>

                  <div className="pt-1">
                    <span className="text-[11px] font-semibold text-[#E43136] tracking-wide">
                      {category.name}
                    </span>
                    <h3 className="font-display text-sm sm:text-lg font-bold text-[#202020] dark:text-[#F4F4F6] mt-0.5 leading-snug">
                      Explore All {category.name} Books
                    </h3>
                    <p className="text-[11px] sm:text-xs text-[#777780] dark:text-[#9E9EA9] mt-1.5 leading-relaxed line-clamp-3">
                      {totalAvailable > 10
                        ? `Browse all ${totalAvailable} published titles in ${category.name}.`
                        : `View the dedicated ${category.name} catalog (${totalAvailable} ${
                            totalAvailable === 1 ? 'book' : 'books'
                          }).`}
                    </p>
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-[#E43136]/20 flex items-center justify-between text-xs sm:text-sm font-bold text-[#E43136]">
                  <span>Show More</span>
                  <ArrowRight className="w-4 h-4 transition-transform group-hover/more:translate-x-1" />
                </div>
              </Link>
            </div>
          </div>
        </div>
      ) : (
        /* Graceful Empty Category Handling — Never Fabricates Fake Books */
        <div className="rounded-xl bg-[#FAFAFB] dark:bg-[#0F0F12] border border-[#F1F1F4] dark:border-[#2C2C35] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FFF3F4] dark:bg-[#2D1619] text-[#E43136] flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-semibold text-[#202020] dark:text-[#F4F4F6]">
                No published books in {category.name} yet
              </p>
              <p className="text-[11px] sm:text-xs text-[#777780] dark:text-[#9E9EA9]">
                Be the first Redcover author to publish a story or PDF book in {category.name}.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link
              to="/create"
              className="py-2 px-3.5 rounded-xl bg-[#FFF3F4] dark:bg-[#2D1619] text-[#E43136] hover:bg-[#E43136] hover:text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Publish in {category.name}</span>
            </Link>
            <Link
              to={`/explore?category=${encodeURIComponent(category.name)}`}
              onClick={(e) => {
                e.preventDefault();
                onSelectCategory(category.name);
              }}
              className="py-2 px-3.5 rounded-xl border border-[#DDDDE3] dark:border-[#2C2C35] text-xs font-semibold text-[#202020] dark:text-[#F4F4F6] hover:border-[#E43136] hover:text-[#E43136] inline-flex items-center gap-1 transition-colors whitespace-nowrap"
            >
              <span>Show More</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}
    </section>
  );
};

export const ExplorePage: React.FC = () => {
  const { books, booksLoading, savedBooks, likedBooks, toggleSaveBook, toggleLikeBook } =
    useRedcover();
  const [searchParams, setSearchParams] = useSearchParams();

  const categoryFromUrl = searchParams.get('category') || 'All';

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>(categoryFromUrl);
  const [selectedFormat, setSelectedFormat] = useState<'all' | 'story' | 'pdf'>('all');
  const [sortBy, setSortBy] = useState<SortOption>('popular');
  const [categoryPageLimit, setCategoryPageLimit] = useState<number>(18);
  const [queriedPreviewBooks, setQueriedPreviewBooks] = useState<Record<string, Book[]>>({});

  // Keep selectedCategory synchronized with URL query param (?category=Romance)
  useEffect(() => {
    const paramCat = searchParams.get('category') || 'All';
    setSelectedCategory(paramCat);
    setCategoryPageLimit(18);
  }, [searchParams]);

  const handleSelectCategory = useCallback(
    (categoryName: string) => {
      setSelectedCategory(categoryName);
      setCategoryPageLimit(18);
      if (categoryName === 'All') {
        searchParams.delete('category');
        setSearchParams(searchParams);
      } else {
        setSearchParams({ category: categoryName });
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [searchParams, setSearchParams]
  );

  // 8. DATA & PERFORMANCE: Execute lightweight Firebase queries filtered by category (limit 10)
  // and cache them in memory so category previews are fast and accurate.
  useEffect(() => {
    let active = true;

    async function loadCategoryPreviews() {
      const result: Record<string, Book[]> = {};
      await Promise.all(
        EXPLORE_CATEGORY_SECTIONS.map(async (cat) => {
          if (categoryPreviewCache.has(cat.name)) {
            result[cat.name] = categoryPreviewCache.get(cat.name)!;
            return;
          }
          const fetchedMap = new Map<string, Book>();
          try {
            const qApplet = query(
              collection(db, 'books'),
              where('status', '==', 'published'),
              where('category', '==', cat.name),
              limit(10)
            );
            const snap = await getDocs(qApplet);
            snap.docs.forEach((d) => {
              fetchedMap.set(d.id, normalizeBookDoc(d.id, d.data(), 'applet'));
            });
          } catch {
            // Non-blocking fallback if composite index is still building
          }

          try {
            const qDefault = query(
              collection(defaultDb, 'books'),
              where('category', '==', cat.name),
              limit(10)
            );
            const snapDef = await getDocs(qDefault);
            snapDef.docs.forEach((d) => {
              if (!fetchedMap.has(d.id)) {
                fetchedMap.set(d.id, normalizeBookDoc(d.id, d.data(), 'default'));
              }
            });
          } catch {
            // Non-blocking fallback
          }

          const arr = Array.from(fetchedMap.values());
          if (arr.length > 0) {
            categoryPreviewCache.set(cat.name, arr);
            result[cat.name] = arr;
          }
        })
      );

      if (active && Object.keys(result).length > 0) {
        setQueriedPreviewBooks((prev) => ({ ...prev, ...result }));
      }
    }

    loadCategoryPreviews();
    return () => {
      active = false;
    };
  }, []);

  const savedSet = useMemo(() => new Set(savedBooks.map((s) => s.bookId)), [savedBooks]);
  const likedSet = useMemo(() => new Set(likedBooks.map((l) => l.bookId)), [likedBooks]);

  // All published books filtered by format & search query
  const basePublishedBooks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return books.filter((b) => {
      if (b.status !== 'published') return false;
      if (selectedFormat !== 'all' && b.format !== selectedFormat) {
        return false;
      }
      if (q) {
        const matchTitle = b.title.toLowerCase().includes(q);
        const matchAuthor = b.authorName.toLowerCase().includes(q);
        const matchCat = b.category.toLowerCase().includes(q);
        const matchDesc = b.description.toLowerCase().includes(q);
        return matchTitle || matchAuthor || matchCat || matchDesc;
      }
      return true;
    });
  }, [books, selectedFormat, searchQuery]);

  // Group books into the 10 canonical Category Sections without duplicates across sections
  const categoryBuckets = useMemo(() => {
    const map = new Map<string, Map<string, Book>>();
    EXPLORE_CATEGORY_SECTIONS.forEach((sec) => {
      map.set(sec.name, new Map<string, Book>());
    });

    // 1. Seed from direct Firestore category queries if matching format/search
    const q = searchQuery.trim().toLowerCase();
    Object.entries(queriedPreviewBooks).forEach(([catName, catBooks]) => {
      const bucket = map.get(catName);
      if (!bucket) return;
      catBooks.forEach((b) => {
        if (b.status !== 'published') return;
        if (selectedFormat !== 'all' && b.format !== selectedFormat) return;
        if (
          q &&
          !b.title.toLowerCase().includes(q) &&
          !b.authorName.toLowerCase().includes(q) &&
          !b.category.toLowerCase().includes(q)
        ) {
          return;
        }
        bucket.set(b.id, b);
      });
    });

    // 2. Merge live published books mapped to their canonical category (ensures zero duplicate books across carousels)
    basePublishedBooks.forEach((book) => {
      const canonicalCat = resolveCanonicalCategory(book);
      const bucket = map.get(canonicalCat) || map.get('Fiction')!;
      bucket.set(book.id, book);
    });

    const sortedBuckets = new Map<string, Book[]>();
    EXPLORE_CATEGORY_SECTIONS.forEach((sec) => {
      const arr = Array.from(map.get(sec.name)?.values() || []);
      sortedBuckets.set(sec.name, sortBooksList(arr, sortBy));
    });

    return sortedBuckets;
  }, [basePublishedBooks, queriedPreviewBooks, selectedFormat, searchQuery, sortBy]);

  // Order category sections so populated categories appear first, followed by empty categories
  const orderedCategorySections = useMemo(() => {
    const withBooks: CategoryMeta[] = [];
    const empty: CategoryMeta[] = [];
    EXPLORE_CATEGORY_SECTIONS.forEach((sec) => {
      const count = categoryBuckets.get(sec.name)?.length || 0;
      if (count > 0) {
        withBooks.push(sec);
      } else {
        empty.push(sec);
      }
    });
    return [...withBooks, ...empty];
  }, [categoryBuckets]);

  // Books for Dedicated Single-Category View (/explore?category=Romance) or active search
  const activeCategoryBooks = useMemo(() => {
    if (selectedCategory === 'All') {
      return sortBooksList(basePublishedBooks, sortBy);
    }
    const targetLower = selectedCategory.toLowerCase();
    const canonicalMatch = EXPLORE_CATEGORY_SECTIONS.find(
      (s) => s.name.toLowerCase() === targetLower
    );
    if (canonicalMatch) {
      return categoryBuckets.get(canonicalMatch.name) || [];
    }
    // Fallback for any custom category name
    const filtered = basePublishedBooks.filter(
      (b) =>
        b.category.toLowerCase() === targetLower ||
        resolveCanonicalCategory(b).toLowerCase() === targetLower
    );
    return sortBooksList(filtered, sortBy);
  }, [selectedCategory, basePublishedBooks, categoryBuckets, sortBy]);

  const activeCategoryMeta = useMemo(
    () =>
      EXPLORE_CATEGORY_SECTIONS.find(
        (s) => s.name.toLowerCase() === selectedCategory.toLowerCase()
      ) || null,
    [selectedCategory]
  );

  const isDedicatedCategoryOrSearchView =
    selectedCategory !== 'All' || searchQuery.trim().length > 0;

  return (
    <div className="space-y-5">
      {/* ================================================================= */}
      {/* 1. TOP EXPLORE HEADER, SEARCH, FORMAT, SORT & GENRE FILTERS       */}
      {/* ================================================================= */}
      <div className="bg-white dark:bg-[#16161A] rounded-2xl border border-[#DDDDE3] dark:border-[#2C2C35] p-4 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-xl sm:text-2xl font-bold text-[#202020] dark:text-[#F4F4F6]">
              Explore
            </h1>
            <p className="text-xs text-[#777780] dark:text-[#9E9EA9]">
              Find your next read.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Format filters: All Formats, Stories, PDF Books */}
            <div className="flex items-center p-1 rounded-xl bg-[#F1F1F4] dark:bg-[#1F1F26]">
              {(['all', 'story', 'pdf'] as const).map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => setSelectedFormat(fmt)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    selectedFormat === fmt
                      ? 'bg-white dark:bg-[#16161A] text-[#202020] dark:text-[#F4F4F6] shadow-2xs'
                      : 'text-[#777780] hover:text-[#202020] dark:hover:text-white'
                  }`}
                >
                  {fmt === 'all' ? 'All Formats' : fmt === 'pdf' ? 'PDF Books' : 'Stories'}
                </button>
              ))}
            </div>

            {/* Sorting dropdown */}
            <div className="flex items-center gap-2 bg-[#FAFAFB] dark:bg-[#0F0F12] border border-[#DDDDE3] dark:border-[#2C2C35] rounded-xl px-3 py-2">
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#777780] shrink-0" />
              <select
                aria-label="Sort books by"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="text-xs font-semibold bg-transparent text-[#202020] dark:text-[#F4F4F6] focus:outline-none cursor-pointer"
              >
                <option value="popular">Most Popular</option>
                <option value="rating">Highest Rated</option>
                <option value="views">Most Viewed</option>
                <option value="likes">Most Liked</option>
                <option value="recent">Recently Published</option>
                <option value="alpha">Alphabetical (A–Z)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Search bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-[#777780] absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by book title, author name, genre, or topic..."
            className="w-full pl-11 pr-10 py-2.5 sm:py-3 rounded-xl bg-[#FAFAFB] dark:bg-[#0F0F12] border border-[#DDDDE3] dark:border-[#2C2C35] text-xs sm:text-sm text-[#202020] dark:text-[#F4F4F6] focus:bg-white dark:focus:bg-[#16161A] focus:outline-none focus:border-[#E43136] transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search query"
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#777780] hover:text-[#202020] dark:hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Genre Filters */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-0.5">
          {REDCOVER_CATEGORIES.map((cat) => {
            const count =
              cat === 'All'
                ? basePublishedBooks.length
                : categoryBuckets.get(cat)?.length || 0;
            const isSelected = selectedCategory.toLowerCase() === cat.toLowerCase();

            return (
              <button
                key={cat}
                type="button"
                onClick={() => handleSelectCategory(cat)}
                className={`py-1.5 px-3.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 cursor-pointer ${
                  isSelected
                    ? 'bg-[#E43136] text-white'
                    : 'bg-[#FAFAFB] dark:bg-[#0F0F12] text-[#202020] dark:text-[#F4F4F6] border border-[#DDDDE3] dark:border-[#2C2C35] hover:border-[#E43136]'
                }`}
              >
                <span>{cat}</span>
                {count > 0 && (
                  <span
                    className={`text-[10px] tabular-nums ${
                      isSelected ? 'text-white/90' : 'text-[#777780] dark:text-[#9E9EA9]'
                    }`}
                  >
                    ({count})
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ================================================================= */}
      {/* 2. LOADING SKELETON                                               */}
      {/* ================================================================= */}
      {booksLoading ? (
        <div className="space-y-6">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div
              key={idx}
              className="bg-white dark:bg-[#16161A] rounded-2xl border border-[#DDDDE3] dark:border-[#2C2C35] p-5 space-y-4 animate-pulse"
            >
              <div className="h-6 w-48 bg-[#EAEAEF] dark:bg-[#22222A] rounded" />
              <div className="flex gap-4 overflow-hidden">
                {Array.from({ length: 5 }).map((__, cardIdx) => (
                  <div
                    key={cardIdx}
                    className="w-44 shrink-0 aspect-[3/4] rounded-xl bg-[#EAEAEF] dark:bg-[#22222A]"
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : isDedicatedCategoryOrSearchView ? (
        /* ================================================================= */
        /* 3. DEDICATED CATEGORY RESULTS PAGE (/explore?category=Romance)    */
        /* ================================================================= */
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#16161A] rounded-2xl border border-[#DDDDE3] dark:border-[#2C2C35] p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  handleSelectCategory('All');
                }}
                className="text-xs font-semibold text-[#E43136] hover:underline inline-flex items-center gap-1 cursor-pointer mb-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to All Category Carousels</span>
              </button>

              <div className="flex flex-wrap items-baseline gap-2.5">
                <h2 className="font-display text-xl sm:text-2xl font-bold text-[#202020] dark:text-[#F4F4F6]">
                  {selectedCategory !== 'All'
                    ? `${selectedCategory} Books`
                    : `Search Results for “${searchQuery}”`}
                </h2>
                <span className="text-xs font-medium text-[#777780] dark:text-[#9E9EA9] tabular-nums">
                  · {activeCategoryBooks.length}{' '}
                  {activeCategoryBooks.length === 1 ? 'book' : 'books'} available
                </span>
              </div>

              {activeCategoryMeta && (
                <p className="text-xs sm:text-sm text-[#777780] dark:text-[#9E9EA9]">
                  {activeCategoryMeta.description}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                handleSelectCategory('All');
              }}
              className="py-2 px-4 rounded-xl border border-[#DDDDE3] dark:border-[#2C2C35] text-xs font-semibold text-[#202020] dark:text-[#F4F4F6] hover:border-[#E43136] hover:text-[#E43136] self-start sm:self-center whitespace-nowrap cursor-pointer"
            >
              View All Categories
            </button>
          </div>

          {activeCategoryBooks.length > 0 ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 sm:gap-5">
                {activeCategoryBooks.slice(0, categoryPageLimit).map((book) => (
                  <BookCard
                    key={book.id}
                    book={book}
                    isSaved={savedSet.has(book.id)}
                    isLiked={likedSet.has(book.id)}
                    onToggleSave={toggleSaveBook}
                    onToggleLike={toggleLikeBook}
                  />
                ))}
              </div>

              {categoryPageLimit < activeCategoryBooks.length && (
                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => setCategoryPageLimit((prev) => prev + 18)}
                    className="py-2.5 px-6 rounded-xl bg-white dark:bg-[#16161A] border border-[#DDDDE3] dark:border-[#2C2C35] hover:border-[#E43136] text-xs font-semibold text-[#202020] dark:text-[#F4F4F6] transition-colors cursor-pointer"
                  >
                    Load More Books ({activeCategoryBooks.length - categoryPageLimit} remaining)
                  </button>
                </div>
              )}
            </div>
          ) : (
            <EmptyState
              title={
                selectedCategory !== 'All'
                  ? `No books found in ${selectedCategory}`
                  : 'No matching books found'
              }
              description="Try clearing your filters, browsing all category carousels, or publishing the first book in this genre."
              actionLabel="Back to All Categories"
              onAction={() => {
                setSearchQuery('');
                setSelectedFormat('all');
                handleSelectCategory('All');
              }}
            />
          )}
        </div>
      ) : (
        /* ================================================================= */
        /* 4. HORIZONTAL CATEGORY BOOK CAROUSELS (DEFAULT EXPLORE VIEW)      */
        /* ================================================================= */
        <div className="space-y-6 sm:space-y-8">
          {orderedCategorySections.map((categorySection) => {
            const sectionBooks = categoryBuckets.get(categorySection.name) || [];
            return (
              <CategoryCarouselSection
                key={categorySection.name}
                category={categorySection}
                books={sectionBooks}
                savedSet={savedSet}
                likedSet={likedSet}
                onToggleSave={toggleSaveBook}
                onToggleLike={toggleLikeBook}
                onSelectCategory={handleSelectCategory}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

export const SearchPage: React.FC = () => {
  const {
    books,
    users,
    currentUser,
    follows,
    savedBooks,
    likedBooks,
    recentSearches,
    addRecentSearch,
    clearRecentSearches,
    toggleSaveBook,
    toggleLikeBook,
    toggleFollowUser,
    startOrGetChat,
    executeMasterWipe,
  } = useRedcover();

  const navigate = useNavigate();
  const [queryText, setQueryText] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'books' | 'authors' | 'genres'>('all');
  const [showSecretWipeModal, setShowSecretWipeModal] = useState(false);
  const [isSecretWiping, setIsSecretWiping] = useState(false);

  const SECRET_WIPE_CODE = 'muzammil-please-delete-everything-232006';

  const savedSet = useMemo(() => new Set(savedBooks.map((s) => s.bookId)), [savedBooks]);
  const likedSet = useMemo(() => new Set(likedBooks.map((l) => l.bookId)), [likedBooks]);
  const followingSet = useMemo(
    () => new Set(follows.filter((f) => f.followerId === currentUser?.uid).map((f) => f.followingId)),
    [follows, currentUser?.uid]
  );

  const q = queryText.trim().toLowerCase();

  const matchedBooks = useMemo(() => {
    const pub = books.filter((b) => b.status === 'published');
    if (!q) return pub.slice(0, 6);
    return pub.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        b.authorName.toLowerCase().includes(q) ||
        b.category.toLowerCase().includes(q) ||
        b.description.toLowerCase().includes(q)
    );
  }, [books, q]);

  const matchedUsers = useMemo(() => {
    if (!q) return users.slice(0, 6);
    return users.filter(
      (u) =>
        u.displayName.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        u.bio.toLowerCase().includes(q)
    );
  }, [users, q]);

  const matchedGenres = useMemo(() => {
    const cats = REDCOVER_CATEGORIES.filter((c) => c !== 'All');
    if (!q) return cats;
    return cats.filter((c) => c.toLowerCase().includes(q));
  }, [q]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (queryText.trim() === SECRET_WIPE_CODE) {
      setShowSecretWipeModal(true);
      return;
    }
    if (queryText.trim()) {
      addRecentSearch(queryText.trim());
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#202020] dark:text-[#F4F4F6]">
          Global Search
        </h1>
        <p className="text-sm text-[#777780] dark:text-[#9E9EA9] mt-1">
          Search across books, independent authors, community readers, and literary genres.
        </p>
      </div>

      <form onSubmit={handleSearchSubmit} className="relative">
        <Search className="w-5 h-5 text-[#777780] absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={queryText}
          onChange={(e) => {
            const val = e.target.value;
            setQueryText(val);
            if (val.trim() === SECRET_WIPE_CODE) {
              setShowSecretWipeModal(true);
            }
          }}
          placeholder="Search books, @usernames, authors, or genres..."
          autoFocus
          className="w-full pl-12 pr-24 py-3.5 rounded-xl bg-white dark:bg-[#16161A] border border-[#DDDDE3] dark:border-[#2C2C35] text-sm text-[#202020] dark:text-[#F4F4F6] focus:outline-none focus:border-[#E43136]"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {queryText && (
            <button
              type="button"
              onClick={() => setQueryText('')}
              className="p-1.5 text-[#777780] hover:text-[#202020] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            type="submit"
            className="py-1.5 px-3 rounded-lg bg-[#E43136] text-white text-xs font-semibold hover:bg-[#B9272D] cursor-pointer"
          >
            Search
          </button>
        </div>
      </form>

      {/* Recent Searches */}
      {recentSearches.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-[#777780] inline-flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              Recent:
            </span>
            {recentSearches.map((term) => (
              <button
                key={term}
                type="button"
                onClick={() => setQueryText(term)}
                className="text-xs py-1 px-2.5 rounded-md bg-white dark:bg-[#16161A] border border-[#DDDDE3] dark:border-[#2C2C35] text-[#202020] dark:text-[#F4F4F6] hover:border-[#E43136] cursor-pointer"
              >
                {term}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={clearRecentSearches}
            className="text-xs text-[#777780] hover:text-[#E43136] cursor-pointer"
          >
            Clear history
          </button>
        </div>
      )}

      {/* Search Result Tabs */}
      <div className="flex items-center gap-2 border-b border-[#DDDDE3] dark:border-[#2C2C35] pb-3 overflow-x-auto no-scrollbar">
        {(
          [
            { id: 'all', label: 'All Results' },
            { id: 'books', label: `Books (${matchedBooks.length})` },
            { id: 'authors', label: `Authors & Readers (${matchedUsers.length})` },
            { id: 'genres', label: `Genres (${matchedGenres.length})` },
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

      {(activeTab === 'all' || activeTab === 'books') && (
        <section className="space-y-4">
          <h2 className="text-base font-semibold text-[#202020] dark:text-[#F4F4F6]">
            Books ({matchedBooks.length})
          </h2>
          {matchedBooks.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              {matchedBooks.map((book) => (
                <BookCard
                  key={book.id}
                  book={book}
                  isSaved={savedSet.has(book.id)}
                  isLiked={likedSet.has(book.id)}
                  onToggleSave={toggleSaveBook}
                  onToggleLike={toggleLikeBook}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No books matched your search"
              description="Try searching for a broader keyword or author name."
            />
          )}
        </section>
      )}

      {(activeTab === 'all' || activeTab === 'authors') && (
        <section className="space-y-4">
          <h2 className="text-base font-semibold text-[#202020] dark:text-[#F4F4F6]">
            Authors & Readers ({matchedUsers.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {matchedUsers.map((u) => (
              <UserCard
                key={u.uid}
                user={u}
                isSelf={currentUser?.uid === u.uid}
                isFollowing={followingSet.has(u.uid)}
                onToggleFollow={toggleFollowUser}
                onMessage={async (target) => {
                  try {
                    const chatId = await startOrGetChat(target);
                    navigate(`/hub/chats?chatId=${chatId}`);
                  } catch {
                    navigate('/auth');
                  }
                }}
              />
            ))}
          </div>
        </section>
      )}

      {(activeTab === 'all' || activeTab === 'genres') && (
        <section className="space-y-4">
          <h2 className="text-base font-semibold text-[#202020] dark:text-[#F4F4F6]">
            Genres ({matchedGenres.length})
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {matchedGenres.map((genre) => (
              <button
                key={genre}
                type="button"
                onClick={() => {
                  navigate(`/explore?category=${encodeURIComponent(genre)}`);
                }}
                className="p-4 rounded-xl bg-white dark:bg-[#16161A] border border-[#DDDDE3] dark:border-[#2C2C35] hover:border-[#E43136] text-left flex items-center justify-between cursor-pointer"
              >
                <span className="text-sm font-semibold text-[#202020] dark:text-[#F4F4F6]">
                  {genre}
                </span>
                <Compass className="w-4 h-4 text-[#E43136]" />
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Secret Master Wipe Confirmation Modal */}
      {showSecretWipeModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#15151C] border border-red-500/50 p-6 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 mx-auto flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-bold text-[#202020] dark:text-white">
                Secret Master Wipe Triggered
              </h3>
              <p className="text-xs text-[#6E6E77] dark:text-[#9E9EA8] leading-relaxed">
                You entered the master reset key. This action will permanently erase all books, chapters, comments, chats, messages, and accounts from the system and reset Redcover completely.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 text-[11px] text-red-700 dark:text-red-300 font-mono">
              {SECRET_WIPE_CODE}
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                disabled={isSecretWiping}
                onClick={() => {
                  setShowSecretWipeModal(false);
                  setQueryText('');
                }}
                className="flex-1 py-2.5 px-4 rounded-xl border border-[#DDDDE3] dark:border-[#2C2C35] text-xs font-semibold text-[#6E6E77] hover:text-black dark:hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSecretWiping}
                onClick={async () => {
                  setIsSecretWiping(true);
                  try {
                    await executeMasterWipe(SECRET_WIPE_CODE);
                    setQueryText('');
                    setShowSecretWipeModal(false);
                  } catch (err: any) {
                    alert(err?.message || 'Wipe failed.');
                    setIsSecretWiping(false);
                  }
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-bold shadow-md cursor-pointer inline-flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                {isSecretWiping ? 'Wiping Database...' : 'Erase All Data'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
