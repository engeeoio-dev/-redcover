import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Star,
  Eye,
  Heart,
  Bookmark,
  BookOpen,
  MessageSquare,
  UserPlus,
  UserCheck,
  X,
  CheckCircle2,
  AlertCircle,
  Info,
} from 'lucide-react';
import { Book, UserProfile } from '../../models/types';
import { ToastMessage } from '../../contexts/RedcoverContext';
import { BookCover } from '../books/BookCover';
import { resolveFirebaseCoverUrl } from '../../services/firebase/storageService';
import { subscribeUserPresence } from '../../services/firebase/presenceService';

export { BookCover };

export interface UserAvatarProps {
  user?: (Pick<UserProfile, 'displayName' | 'photoURL'> & {
    uid?: string;
    isOnline?: boolean;
    showOnlineStatus?: boolean;
    membershipPlan?: 'free' | 'premium';
  }) | null;
  photoURL?: string;
  avatarUrl?: string;
  name?: string;
  displayName?: string;
  membershipPlan?: 'free' | 'premium';
  isOnline?: boolean;
  showOnlineStatus?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showPresence?: boolean;
  className?: string;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  user,
  photoURL,
  avatarUrl,
  name,
  displayName,
  membershipPlan,
  isOnline,
  showOnlineStatus,
  size = 'md',
  showPresence = false,
  className = '',
}) => {
  const [imgErr, setImgErr] = useState(false);
  const [resolvedPhoto, setResolvedPhoto] = useState<string>('');
  const [liveIsOnline, setLiveIsOnline] = useState(false);

  const effectivePhoto = user?.photoURL ?? photoURL ?? avatarUrl ?? '';
  const effectiveName = user?.displayName ?? displayName ?? name ?? 'RC';
  const effectiveShowOnline = user?.showOnlineStatus ?? showOnlineStatus ?? true;
  const effectiveOnline = showPresence ? liveIsOnline : (user?.isOnline ?? isOnline ?? false);

  useEffect(() => {
    setLiveIsOnline(false);
    if (!showPresence || !user?.uid || !effectiveShowOnline) return;
    return subscribeUserPresence(user.uid, (presence) => {
      setLiveIsOnline(presence.state === 'online');
    });
  }, [showPresence, user?.uid, effectiveShowOnline]);

  useEffect(() => {
    let active = true;
    const raw = (effectivePhoto || '').trim();
    if (!raw) {
      setResolvedPhoto('');
      setImgErr(false);
      return;
    }
    setImgErr(false);
    resolveFirebaseCoverUrl(raw)
      .then((url) => {
        if (active) setResolvedPhoto(url);
      })
      .catch(() => {
        if (active) setImgErr(true);
      });
    return () => {
      active = false;
    };
  }, [effectivePhoto]);

  const dims =
    size === 'xs'
      ? 'w-6 h-6 text-[10px]'
      : size === 'sm'
      ? 'w-8 h-8 text-xs'
      : size === 'lg'
      ? 'w-14 h-14 text-lg'
      : size === 'xl'
      ? 'w-20 h-20 text-2xl'
      : 'w-10 h-10 text-sm';

  const initials = (effectiveName || 'RC')
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const isMember = (user as any)?.membershipPlan === 'premium' || membershipPlan === 'premium';

  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-full shrink-0 ${dims} ${
        isMember
          ? 'p-[2px] bg-gradient-to-tr from-[#E43136] via-[#FB8500] to-[#E43136] ring-1 ring-[#E43136]/30 shadow-xs'
          : ''
      } ${className}`}
    >
      {resolvedPhoto && !imgErr ? (
        <img
          src={resolvedPhoto}
          alt={effectiveName}
          loading="lazy"
          onError={() => setImgErr(true)}
          className={`w-full h-full rounded-full object-cover ${
            isMember ? 'border-2 border-white dark:border-[#16161A]' : 'border border-[#DDDDE3] dark:border-[#2C2C35]'
          }`}
        />
      ) : (
        <div
          className={`w-full h-full rounded-full bg-[#FBE5E8] dark:bg-[#2D1619] text-[#E43136] font-semibold flex items-center justify-center ${
            isMember ? 'border-2 border-white dark:border-[#16161A]' : 'border border-[#E43136]/20'
          }`}
        >
          {initials || 'RC'}
        </div>
      )}
      {isMember && (
        <span
          title="Redcover Member"
          className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-gradient-to-tr from-amber-500 to-[#E43136] text-[8px] font-black text-white flex items-center justify-center shadow-xs ring-1 ring-white dark:ring-[#16161A]"
        >
          ★
        </span>
      )}
      {showPresence && effectiveShowOnline && effectiveOnline && (
        <span
          title="Online"
          className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#268B62] ring-2 ring-white dark:ring-[#16161A] ${
            isMember ? 'translate-x-0.5' : ''
          }`}
        />
      )}
    </div>
  );
};

export const UserName: React.FC<{
  user?: Partial<UserProfile> | null;
  name?: string;
  className?: string;
}> = ({ user, name, className = '' }) => {
  const isMember = user?.membershipPlan === 'premium';
  const customColor = isMember && user?.nameColor ? user.nameColor : undefined;
  const displayName = user?.displayName || name || 'Reader';

  return (
    <span
      className={`font-semibold inline-flex items-center gap-1 ${className}`}
      style={customColor ? { color: customColor } : undefined}
    >
      <span>{displayName}</span>
      {isMember && (
        <span
          title="Redcover Member"
          className="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-gradient-to-r from-red-600 via-rose-500 to-amber-500 text-white leading-none shadow-xs uppercase tracking-wider"
        >
          PRO
        </span>
      )}
    </span>
  );
};

export const BookCard: React.FC<{
  book: Book;
  isSaved?: boolean;
  isLiked?: boolean;
  onToggleSave?: (book: Book) => void;
  onToggleLike?: (book: Book) => void;
}> = ({ book, isSaved = false, isLiked = false, onToggleSave, onToggleLike }) => {
  return (
    <div className="group bg-white dark:bg-[#16161A] rounded-xl sm:rounded-2xl border border-[#DDDDE3] dark:border-[#2C2C35] p-2.5 sm:p-4 flex flex-col justify-between transition-all duration-200 hover:-translate-y-0.5 hover:border-[#E43136]/40 hover:shadow-sm h-full">
      <div>
        {/* Book Cover with Quick Save Overlay */}
        <div className="relative aspect-[3/4] mb-2 sm:mb-3.5 rounded-lg sm:rounded-xl overflow-hidden">
          <Link to={`/book/${book.id}`} className="block w-full h-full">
            <BookCover book={book} size="md" className="w-full h-full" />
          </Link>

          {onToggleSave && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleSave(book);
              }}
              aria-label={isSaved ? 'Remove from library' : 'Save book to library'}
              className={`absolute top-2 right-2 p-1.5 sm:p-2 rounded-lg sm:rounded-xl backdrop-blur-md border transition-colors cursor-pointer ${
                isSaved
                  ? 'bg-[#E43136] border-[#E43136] text-white shadow-xs'
                  : 'bg-white/90 dark:bg-[#16161A]/90 border-black/10 dark:border-white/15 text-[#202020] dark:text-[#F4F4F6] hover:text-[#E43136]'
              }`}
            >
              <Bookmark className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${isSaved ? 'fill-white' : ''}`} />
            </button>
          )}
        </div>

        {/* Category & Rating Row */}
        <div className="flex items-center justify-between gap-1.5 text-[10px] sm:text-xs mb-1 sm:mb-1.5">
          <span className="font-semibold text-[#E43136] truncate">{book.category}</span>
          <span className="inline-flex items-center gap-0.5 sm:gap-1 text-[#202020] dark:text-[#F4F4F6] font-semibold tabular-nums shrink-0">
            <Star className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-[#E6A02C] text-[#E6A02C]" />
            {book.rating.toFixed(1)}
          </span>
        </div>

        {/* Title */}
        <Link
          to={`/book/${book.id}`}
          className="block font-display text-xs sm:text-base font-bold text-[#202020] dark:text-[#F4F4F6] hover:text-[#E43136] transition-colors line-clamp-1 mb-0.5"
        >
          {book.title}
        </Link>

        {/* Author */}
        <Link
          to={`/profile/${book.authorId}`}
          className="block text-[11px] sm:text-xs font-medium text-[#777780] dark:text-[#9E9EA9] hover:text-[#E43136] transition-colors truncate mb-2 sm:mb-3"
        >
          by {book.authorName}
        </Link>
      </div>

      {/* Engagement + Clear Read & Save Actions */}
      <div className="space-y-1.5 sm:space-y-2.5 pt-2 sm:pt-2.5 border-t border-[#F1F1F4] dark:border-[#2C2C35]">
        <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-[#777780] dark:text-[#9E9EA9] tabular-nums">
          <span className="inline-flex items-center gap-1" title="Total reads">
            <Eye className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            {book.views.toLocaleString()}
          </span>

          {onToggleLike ? (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                onToggleLike(book);
              }}
              aria-label="Like book"
              className={`inline-flex items-center gap-1 font-medium transition-colors cursor-pointer ${
                isLiked ? 'text-[#E43136]' : 'hover:text-[#E43136]'
              }`}
            >
              <Heart className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${isLiked ? 'fill-[#E43136]' : ''}`} />
              <span>{book.likes.toLocaleString()}</span>
            </button>
          ) : (
            <span className="inline-flex items-center gap-1">
              <Heart className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              {book.likes.toLocaleString()}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <Link
            to={`/read/${book.id}`}
            className="flex-1 py-1.5 px-2.5 sm:py-2 sm:px-3.5 rounded-lg sm:rounded-xl bg-[#E43136] hover:bg-[#B9272D] text-white text-[11px] sm:text-xs font-semibold inline-flex items-center justify-center gap-1 sm:gap-1.5 transition-colors whitespace-nowrap"
          >
            <BookOpen className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            <span>Read</span>
          </Link>

          {onToggleSave && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                onToggleSave(book);
              }}
              className={`py-1.5 px-2 sm:py-2 sm:px-3 rounded-lg sm:rounded-xl border text-[11px] sm:text-xs font-semibold inline-flex items-center justify-center gap-1 transition-colors whitespace-nowrap cursor-pointer ${
                isSaved
                  ? 'bg-[#FFF3F4] dark:bg-[#2D1619] border-[#E43136] text-[#E43136]'
                  : 'bg-white dark:bg-[#16161A] border-[#DDDDE3] dark:border-[#2C2C35] text-[#202020] dark:text-[#F4F4F6] hover:border-[#E43136] hover:text-[#E43136]'
              }`}
            >
              <Bookmark className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${isSaved ? 'fill-[#E43136]' : ''}`} />
              <span className="hidden sm:inline">{isSaved ? 'Saved' : 'Save'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export const UserCard: React.FC<{
  user: UserProfile;
  isFollowing?: boolean;
  isSelf?: boolean;
  onToggleFollow?: (user: UserProfile) => void;
  onMessage?: (user: UserProfile) => void;
}> = ({ user, isFollowing = false, isSelf = false, onToggleFollow, onMessage }) => {
  return (
    <div className="bg-white dark:bg-[#16161A] rounded-xl border border-[#DDDDE3] dark:border-[#2C2C35] p-3 sm:p-4 flex flex-col justify-between gap-3 sm:gap-4">
      <div className="flex items-start gap-2.5 sm:gap-3">
        <Link to={`/profile/${user.uid}`}>
          <UserAvatar user={user} size="sm" showPresence />
        </Link>
        <div className="min-w-0 flex-1">
          <Link
            to={`/profile/${user.uid}`}
            className="block text-xs sm:text-sm font-semibold text-[#202020] dark:text-[#F4F4F6] hover:text-[#E43136] truncate"
            style={user.nameColor ? { color: user.nameColor } : undefined}
          >
            {user.displayName}
          </Link>
          <p className="text-[11px] sm:text-xs text-[#777780] dark:text-[#9E9EA9] truncate tabular-nums">
            @{user.username} · {user.followersCount.toLocaleString()} followers
          </p>
          <p className="text-[11px] sm:text-xs text-[#777780] dark:text-[#9E9EA9] line-clamp-2 mt-1">
            {user.bio}
          </p>
        </div>
      </div>

      {!isSelf && (
        <div className="flex items-center gap-2 pt-2 border-t border-[#F1F1F4] dark:border-[#2C2C35]">
          {onToggleFollow && (
            <button
              type="button"
              onClick={() => onToggleFollow(user)}
              className={`flex-1 py-1.5 px-2.5 sm:py-2 sm:px-3 rounded-lg text-[11px] sm:text-xs font-medium inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                isFollowing
                  ? 'bg-[#F1F1F4] dark:bg-[#1F1F26] text-[#202020] dark:text-[#F4F4F6] hover:bg-[#DDDDE3]'
                  : 'bg-[#E43136] text-white hover:bg-[#B9272D]'
              }`}
            >
              {isFollowing ? (
                <>
                  <UserCheck className="w-3.5 h-3.5" />
                  Following
                </>
              ) : (
                <>
                  <UserPlus className="w-3.5 h-3.5" />
                  Follow
                </>
              )}
            </button>
          )}
          {onMessage && (
            <button
              type="button"
              onClick={() => onMessage(user)}
              className="py-1.5 px-2.5 sm:py-2 sm:px-3 rounded-lg border border-[#DDDDE3] dark:border-[#2C2C35] text-[11px] sm:text-xs font-medium text-[#202020] dark:text-[#F4F4F6] hover:border-[#E43136] hover:text-[#E43136] inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Message
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export const SectionHeader: React.FC<{
  title: string;
  subtitle?: string;
  actionLabel?: string;
  actionTo?: string;
}> = ({ title, subtitle, actionLabel, actionTo }) => (
  <div className="flex items-end justify-between gap-4 mb-4">
    <div>
      <h2 className="font-display text-[20px] sm:text-[23px] font-semibold text-[#202020] dark:text-[#F4F4F6] tracking-tight">
        {title}
      </h2>
      {subtitle && (
        <p className="text-xs sm:text-sm text-[#777780] dark:text-[#9E9EA9] mt-0.5">{subtitle}</p>
      )}
    </div>
    {actionLabel && actionTo && (
      <Link
        to={actionTo}
        className="text-xs sm:text-sm font-semibold text-[#E43136] hover:text-[#B9272D] whitespace-nowrap shrink-0"
      >
        {actionLabel} →
      </Link>
    )}
  </div>
);

export const EmptyState: React.FC<{
  title: string;
  description: string;
  actionLabel?: string;
  actionTo?: string;
  onAction?: () => void;
}> = ({ title, description, actionLabel, actionTo, onAction }) => (
  <div className="bg-white dark:bg-[#16161A] rounded-xl border border-[#DDDDE3] dark:border-[#2C2C35] p-8 text-center max-w-lg mx-auto my-4">
    <div className="w-11 h-11 rounded-full bg-[#FFF3F4] dark:bg-[#2D1619] text-[#E43136] flex items-center justify-center mx-auto mb-3">
      <BookOpen className="w-5 h-5" />
    </div>
    <h3 className="text-base font-semibold text-[#202020] dark:text-[#F4F4F6] mb-1">{title}</h3>
    <p className="text-sm text-[#777780] dark:text-[#9E9EA9] mb-4">{description}</p>
    {actionLabel && actionTo && (
      <Link
        to={actionTo}
        className="inline-flex items-center justify-center py-2 px-4 rounded-lg bg-[#E43136] text-white text-xs font-medium hover:bg-[#B9272D] transition-colors whitespace-nowrap"
      >
        {actionLabel}
      </Link>
    )}
    {actionLabel && onAction && !actionTo && (
      <button
        type="button"
        onClick={onAction}
        className="inline-flex items-center justify-center py-2 px-4 rounded-lg bg-[#E43136] text-white text-xs font-medium hover:bg-[#B9272D] transition-colors whitespace-nowrap cursor-pointer"
      >
        {actionLabel}
      </button>
    )}
  </div>
);

export const ToastContainer: React.FC<{
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-white dark:bg-[#16161A] border border-[#DDDDE3] dark:border-[#2C2C35] shadow-lg text-sm text-[#202020] dark:text-[#F4F4F6]"
        >
          <div className="flex items-center gap-2.5">
            {t.type === 'success' && <CheckCircle2 className="w-4 h-4 text-[#268B62] shrink-0" />}
            {t.type === 'error' && <AlertCircle className="w-4 h-4 text-[#D9363E] shrink-0" />}
            {t.type === 'info' && <Info className="w-4 h-4 text-[#E43136] shrink-0" />}
            <span>{t.text}</span>
          </div>
          <button
            type="button"
            onClick={() => onDismiss(t.id)}
            className="text-[#777780] hover:text-[#202020] dark:hover:text-white p-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};
