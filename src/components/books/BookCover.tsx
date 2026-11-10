import React, { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { Book } from '../../models/types';
import { auth } from '../../services/firebase/firebaseConfig';
import {
  discoverBookCoverInStorage,
  isLikelyPdfUrl,
  recoverFirebaseStorageUrlOnError,
  resolveFirebaseCoverUrl,
} from '../../services/firebase/storageService';

export interface BookCoverProps {
  book?: (Pick<Book, 'id' | 'title' | 'authorName' | 'coverURL' | 'category'> & {
    format?: Book['format'];
    fileURL?: string;
  }) | null;
  coverURL?: string;
  title?: string;
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

export const BookCover: React.FC<BookCoverProps> = ({
  book,
  coverURL,
  title,
  className = '',
  size = 'md',
}) => {
  const effectiveBook = book || {
    id: 'book',
    title: title || 'Book',
    authorName: 'Author',
    coverURL: coverURL || '',
    category: 'Book',
  };
  const rawCover = (effectiveBook.coverURL || coverURL || '').trim();
  const hasCandidateCover = Boolean(rawCover && rawCover.length > 3 && !isLikelyPdfUrl(rawCover));

  const [resolvedUrl, setResolvedUrl] = useState<string>('');
  const [resolving, setResolving] = useState<boolean>(true);
  const [imageLoaded, setImageLoaded] = useState<boolean>(false);
  const [imageFailed, setImageFailed] = useState<boolean>(false);
  const [triedRecovery, setTriedRecovery] = useState<boolean>(false);
  const [authUid, setAuthUid] = useState<string | null>(auth.currentUser?.uid || null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setAuthUid(user?.uid || null);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    let active = true;
    const candidate = (effectiveBook.coverURL || coverURL || '').trim();

    setResolving(true);
    setImageLoaded(false);
    setImageFailed(false);
    setTriedRecovery(false);

    async function loadCover() {
      try {
        // 1. If the book already has a coverURL or storage path field, resolve it first
        if (candidate && candidate.length > 3 && !isLikelyPdfUrl(candidate)) {
          const directUrl = await resolveFirebaseCoverUrl(candidate);
          if (!active) return;
          if (directUrl && !isLikelyPdfUrl(directUrl)) {
            setResolvedUrl(directUrl);
            setResolving(false);
            return;
          }
        }

        // 2. Otherwise, inspect defaultDb and Firebase Storage bucket for the original uploaded cover
        if (effectiveBook.id) {
          const discoveredUrl = await discoverBookCoverInStorage({
            id: effectiveBook.id,
            title: effectiveBook.title,
            fileURL: effectiveBook.fileURL,
          });
          if (!active) return;
          if (discoveredUrl && !isLikelyPdfUrl(discoveredUrl)) {
            setResolvedUrl(discoveredUrl);
            setResolving(false);
            return;
          }
        }

        if (!active) return;
        setResolvedUrl('');
        setImageFailed(true);
        setResolving(false);
      } catch (err) {
        if (!active) return;
        console.warn('[Redcover BookCover] Cover resolution error:', {
          bookId: effectiveBook.id,
          title: effectiveBook.title,
          rawCover: candidate,
          error: err,
        });
        setResolvedUrl('');
        setImageFailed(true);
        setResolving(false);
      }
    }

    loadCover();

    return () => {
      active = false;
    };
  }, [effectiveBook.id, effectiveBook.title, effectiveBook.coverURL, effectiveBook.fileURL, coverURL, authUid]);

  const handleImageError = async () => {
    if (!triedRecovery) {
      setTriedRecovery(true);
      if (resolvedUrl) {
        const recovered = await recoverFirebaseStorageUrlOnError(resolvedUrl);
        if (recovered && recovered !== resolvedUrl) {
          setResolvedUrl(recovered);
          return;
        }
      }
      if (effectiveBook.id) {
        const discovered = await discoverBookCoverInStorage({
          id: effectiveBook.id,
          title: effectiveBook.title,
          fileURL: effectiveBook.fileURL,
        });
        if (discovered && discovered !== resolvedUrl) {
          setResolvedUrl(discovered);
          return;
        }
      }
    }
    console.warn('[Redcover BookCover] Cover image failed to load:', {
      bookId: effectiveBook.id,
      title: effectiveBook.title,
      attemptedUrl: resolvedUrl || rawCover,
    });
    setImageFailed(true);
  };

  const showActualImage = Boolean((hasCandidateCover || resolvedUrl) && resolvedUrl && !imageFailed);

  if (showActualImage || resolving) {
    return (
      <div
        className={`relative aspect-[3/4] overflow-hidden rounded-xl bg-[#F1F1F4] dark:bg-[#1E1E26] select-none shadow-xs ${className}`}
      >
        {/* Loading Skeleton while Storage URL resolves or image downloads */}
        {(!imageLoaded || resolving) && (
          <div
            aria-label="Loading book cover"
            className="absolute inset-0 bg-gradient-to-br from-[#FFF3F4] via-[#F1F1F4] to-[#FBE5E8] dark:from-[#1B1B22] dark:via-[#262630] dark:to-[#1B1B22] animate-pulse flex flex-col justify-between p-3"
          >
            <div className="h-2 w-1/3 rounded bg-[#E43136]/15" />
            <div className="space-y-1.5">
              <div className="h-3 w-4/5 rounded bg-[#E43136]/15" />
              <div className="h-3 w-3/5 rounded bg-[#E43136]/15" />
            </div>
            <div className="h-2 w-1/2 rounded bg-[#E43136]/15" />
          </div>
        )}

        {resolvedUrl && (
          <img
            src={resolvedUrl}
            alt={`Cover of ${effectiveBook.title} by ${effectiveBook.authorName}`}
            loading="lazy"
            onLoad={() => setImageLoaded(true)}
            onError={handleImageError}
            className={`w-full h-full object-cover transition-all duration-300 group-hover:scale-[1.03] ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
        )}

        {/* Subtle book spine & edge finish */}
        <div className="absolute inset-y-0 left-0 w-2 bg-gradient-to-r from-black/25 via-white/10 to-transparent pointer-events-none" />
        <div className="absolute inset-0 ring-1 ring-inset ring-black/10 dark:ring-white/10 rounded-xl pointer-events-none" />
      </div>
    );
  }

  // Warm editorial Redcover fallback used ONLY when a book genuinely has no cover image in Firestore or Storage
  const paddingClass =
    size === 'xs'
      ? 'p-2'
      : size === 'sm'
      ? 'p-3'
      : size === 'lg'
      ? 'p-5 sm:p-6'
      : 'p-4';

  return (
    <div
      className={`relative aspect-[3/4] overflow-hidden rounded-xl bg-gradient-to-br from-[#FFF3F4] via-[#FBE5E8] to-[#FCECEF] dark:from-[#261418] dark:via-[#1E1215] dark:to-[#16161A] border border-[#E43136]/25 select-none flex flex-col justify-between shadow-xs ${paddingClass} ${className}`}
    >
      {/* Left spine accent */}
      <div className="absolute inset-y-0 left-0 w-2 bg-[#E43136] pointer-events-none" />

      {/* Top category & Redcover emblem */}
      <div className="relative z-10 flex items-center justify-between gap-1.5 pl-1.5">
        <span
          className={`font-semibold tracking-wider uppercase text-[#E43136] truncate ${
            size === 'xs' ? 'text-[8px]' : size === 'sm' ? 'text-[9px]' : 'text-[10px]'
          }`}
        >
          {effectiveBook.category || 'Redcover'}
        </span>
        <img
          src="/assets/aistudio/WhatsApp_Image_2026-10-24_at_6.29.36_PM_8a2e5d20.jpeg"
          alt="Redcover"
          className={`rounded-sm object-cover shrink-0 ${
            size === 'xs' ? 'w-3 h-3' : size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'
          }`}
        />
      </div>

      {/* Full readable book title */}
      <div className="relative z-10 my-auto py-1 pl-1.5">
        <div className="w-6 h-0.5 bg-[#E43136] rounded-full mb-2" />
        <h4
          className={`font-display font-bold text-[#202020] dark:text-[#F4F4F6] leading-snug break-words ${
            size === 'xs'
              ? 'text-[10px] line-clamp-3'
              : size === 'sm'
              ? 'text-xs line-clamp-4'
              : size === 'lg'
              ? 'text-lg sm:text-xl line-clamp-5'
              : 'text-sm line-clamp-4'
          }`}
        >
          {effectiveBook.title || 'Untitled Book'}
        </h4>
      </div>

      {/* Author attribution */}
      <div className="relative z-10 pt-2 border-t border-[#E43136]/20 pl-1.5 flex items-center justify-between gap-1">
        <span
          className={`truncate font-semibold text-[#777780] dark:text-[#D5C2C5] ${
            size === 'xs' ? 'text-[8px]' : size === 'sm' ? 'text-[10px]' : 'text-xs'
          }`}
        >
          {effectiveBook.authorName || 'Redcover Author'}
        </span>
      </div>
    </div>
  );
};
