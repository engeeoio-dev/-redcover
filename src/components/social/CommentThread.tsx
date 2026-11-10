import React, { useState, useRef, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Heart,
  MessageCircle,
  CornerDownRight,
  Edit2,
  Trash2,
  Send,
  X,
  Sparkles,
  ChevronDown,
  ChevronUp,
  UserPlus,
  UserCheck,
  Check,
} from 'lucide-react';
import { Book, PostComment, SocialPost, UserProfile } from '../../models/types';
import { useRedcover } from '../../contexts/RedcoverContext';
import { UserAvatar } from '../common/UIPrimitives';

function formatShortTime(iso: string): string {
  const date = new Date(iso);
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

const QUICK_EMOJIS = ['❤️', '🔥', '👏', '📚', '✨', '🙌'];

const QUICK_REACTIONS = [
  '❤️ Loved this book!',
  '🔥 Absolute masterpiece',
  '👏 Great recommendation',
  '📖 Added to my reading list!',
  '✨ Beautifully written',
];

export interface LikedByBarProps {
  postId: string;
  baseLikesCount: number;
  bookForSync?: Book | null;
}

export const LikedByBar: React.FC<LikedByBarProps> = ({
  postId,
  baseLikesCount,
  bookForSync,
}) => {
  const { postLikes, likedBooks, users, follows, firebaseUser, toggleFollowUser } = useRedcover();
  const [modalOpen, setModalOpen] = useState(false);

  const cleanPostKey = postId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);

  const likerUserIds = useMemo(() => {
    const ids = new Set<string>();
    postLikes
      .filter((l) => l.postId === cleanPostKey)
      .forEach((l) => {
        if (l.userId) ids.add(l.userId);
      });
    if (bookForSync) {
      likedBooks
        .filter((l) => l.bookId === bookForSync.id)
        .forEach((l) => {
          if (l.userId) ids.add(l.userId);
        });
    }
    return Array.from(ids);
  }, [postLikes, likedBooks, cleanPostKey, bookForSync]);

  const likerProfiles = useMemo(() => {
    return likerUserIds.map((uid) => {
      const found = users.find((u) => u.uid === uid);
      if (found) return found;
      return {
        uid,
        username: `reader_${uid.slice(0, 5)}`,
        displayName: 'Redcover Reader',
        photoURL: '',
        coverURL: '',
        bio: 'Community reader on Redcover',
        followersCount: 0,
        followingCount: 0,
        booksCount: 0,
        streakDays: 1,
        points: 100,
        membershipPlan: 'free' as const,
        isOnline: true,
        showOnlineStatus: true,
        publicActivity: true,
        role: 'user' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    });
  }, [likerUserIds, users]);

  const totalLikes = Math.max(baseLikesCount, likerProfiles.length);
  if (totalLikes <= 0 && likerProfiles.length === 0) return null;

  const firstLiker = likerProfiles[0];
  const othersCount = Math.max(0, totalLikes - 1);

  return (
    <>
      <div className="flex items-center justify-between gap-2 pt-0.5">
        <button
          type="button"
          onClick={() => {
            if (likerProfiles.length > 0) setModalOpen(true);
          }}
          className="inline-flex items-center gap-2 text-[11px] sm:text-xs text-[#202020] dark:text-[#F4F4F6] hover:text-[#E43136] transition-colors cursor-pointer group"
        >
          {likerProfiles.length > 0 ? (
            <div className="flex items-center -space-x-1.5 overflow-hidden">
              {likerProfiles.slice(0, 3).map((u) => (
                <div
                  key={u.uid}
                  className="inline-block rounded-full ring-2 ring-white dark:ring-[#16161A]"
                >
                  <UserAvatar user={u} size="xs" />
                </div>
              ))}
            </div>
          ) : (
            <span className="w-4 h-4 rounded-full bg-[#FFF3F4] dark:bg-[#2D1619] text-[#E43136] inline-flex items-center justify-center">
              <Heart className="w-2.5 h-2.5 fill-[#E43136]" />
            </span>
          )}

          <span className="truncate">
            {firstLiker ? (
              <>
                Liked by{' '}
                <strong className="font-semibold group-hover:text-[#E43136]">
                  {firstLiker.uid === firebaseUser?.uid ? 'you' : firstLiker.displayName}
                </strong>
                {othersCount > 0 && (
                  <>
                    {' '}
                    and{' '}
                    <strong className="font-semibold">
                      {othersCount.toLocaleString()} {othersCount === 1 ? 'other' : 'others'}
                    </strong>
                  </>
                )}
              </>
            ) : (
              <strong className="font-semibold">
                {totalLikes.toLocaleString()} {totalLikes === 1 ? 'like' : 'likes'}
              </strong>
            )}
          </span>
        </button>
      </div>

      {/* Liked By Community Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="bg-white dark:bg-[#16161A] rounded-2xl border border-[#DDDDE3] dark:border-[#2C2C35] max-w-md w-full overflow-hidden shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3.5 border-b border-[#F1F1F4] dark:border-[#2C2C35] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Heart className="w-4 h-4 text-[#E43136] fill-[#E43136]" />
                <h3 className="font-display text-sm font-bold text-[#202020] dark:text-[#F4F4F6]">
                  Liked by ({totalLikes.toLocaleString()})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-lg text-[#777780] hover:text-[#202020] dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto divide-y divide-[#F1F1F4] dark:divide-[#2C2C35]">
              {likerProfiles.map((person) => {
                const isMe = firebaseUser?.uid === person.uid;
                const isFollowing = Boolean(
                  firebaseUser &&
                    follows.some(
                      (f) => f.followerId === firebaseUser.uid && f.followingId === person.uid
                    )
                );
                return (
                  <div
                    key={person.uid}
                    className="p-3.5 flex items-center justify-between gap-3 hover:bg-[#FAFAFB] dark:hover:bg-[#1F1F26]"
                  >
                    <Link
                      to={`/profile/${person.uid}`}
                      onClick={() => setModalOpen(false)}
                      className="flex items-center gap-2.5 min-w-0 group"
                    >
                      <UserAvatar user={person} size="sm" showPresence />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[#202020] dark:text-[#F4F4F6] group-hover:text-[#E43136] truncate">
                          {person.displayName} {isMe && '(You)'}
                        </p>
                        <p className="text-[11px] text-[#777780] dark:text-[#9E9EA9] truncate">
                          @{person.username}
                        </p>
                      </div>
                    </Link>

                    {!isMe && (
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
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export interface CommentThreadProps {
  postId: string;
  postAuthorId: string;
  postAuthorName: string;
  backingPost?: SocialPost | null;
  targetTitle?: string;
  postLink?: string;
  expanded: boolean;
  onToggleExpand: (expanded: boolean) => void;
  externalInputRef?: React.RefObject<HTMLInputElement | null>;
  quickReactions?: string[];
  placeholder?: string;
  emptyMessage?: string;
}

type CommentSortMode = 'top' | 'newest' | 'oldest';

export const CommentThread: React.FC<CommentThreadProps> = ({
  postId,
  postAuthorId,
  postAuthorName,
  backingPost,
  targetTitle,
  postLink,
  expanded,
  onToggleExpand,
  externalInputRef,
  quickReactions,
  placeholder,
  emptyMessage,
}) => {
  const {
    firebaseUser,
    currentUser,
    isAdmin,
    users,
    postComments,
    postLikes,
    addPostComment,
    editPostComment,
    deletePostComment,
    toggleLikeComment,
  } = useRedcover();

  const navigate = useNavigate();
  const internalInputRef = useRef<HTMLInputElement | null>(null);
  const inputRef = externalInputRef || internalInputRef;

  const [sortMode, setSortMode] = useState<CommentSortMode>('top');
  const [commentText, setCommentText] = useState('');
  const [composerFocused, setComposerFocused] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Active Reply Target (Nested Reply state)
  const [replyTarget, setReplyTarget] = useState<{
    parentId: string;
    replyToUsername: string;
    replyToUserId: string;
    replyToName: string;
  } | null>(null);

  // Collapsed/Expanded state for nested reply threads
  const [collapsedThreads, setCollapsedThreads] = useState<Record<string, boolean>>({});

  // Inline Edit state
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  // Optimistic pop animation state for comment likes
  const [poppingCommentId, setPoppingCommentId] = useState<string | null>(null);

  const cleanPostKey = postId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);

  // All comments for this postId
  const allItemComments = useMemo(
    () => postComments.filter((c) => c.postId === cleanPostKey),
    [postComments, cleanPostKey]
  );

  // Map of commentId -> likes count & isLikedByMe
  const commentLikesMap = useMemo(() => {
    const map = new Map<string, { count: number; likedByMe: boolean }>();
    allItemComments.forEach((c) => {
      const key = `cmtlike_${c.id}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
      const matches = postLikes.filter((l) => l.postId === key);
      const likedByMe = Boolean(
        firebaseUser && matches.some((l) => l.userId === firebaseUser.uid)
      );
      map.set(c.id, { count: matches.length, likedByMe });
    });
    return map;
  }, [allItemComments, postLikes, firebaseUser]);

  // Separate root comments and nested replies
  const { rootComments, repliesByParentId } = useMemo(() => {
    const roots: PostComment[] = [];
    const replyMap = new Map<string, PostComment[]>();
    const validIds = new Set(allItemComments.map((c) => c.id));

    allItemComments.forEach((c) => {
      if (c.parentId && validIds.has(c.parentId)) {
        const arr = replyMap.get(c.parentId) || [];
        arr.push(c);
        replyMap.set(c.parentId, arr);
      } else {
        roots.push(c);
      }
    });

    // Sort replies chronologically inside each thread
    replyMap.forEach((arr) => {
      arr.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    });

    // Sort root comments according to sortMode
    const sortedRoots = [...roots].sort((a, b) => {
      if (sortMode === 'newest') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sortMode === 'oldest') {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      // 'top': Sort by likes + replies count, then newest
      const aLikes = commentLikesMap.get(a.id)?.count || 0;
      const bLikes = commentLikesMap.get(b.id)?.count || 0;
      const aReplies = (replyMap.get(a.id) || []).length;
      const bReplies = (replyMap.get(b.id) || []).length;
      const aScore = aLikes * 3 + aReplies * 2;
      const bScore = bLikes * 3 + bReplies * 2;
      if (bScore !== aScore) return bScore - aScore;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return { rootComments: sortedRoots, repliesByParentId: replyMap };
  }, [allItemComments, sortMode, commentLikesMap]);

  const visibleRootComments = expanded ? rootComments : rootComments.slice(0, 2);

  const handleStartReply = (comment: PostComment, rootParentId: string) => {
    setReplyTarget({
      parentId: rootParentId,
      replyToUsername: comment.userUsername,
      replyToUserId: comment.userId,
      replyToName: comment.userName,
    });
    onToggleExpand(true);
    setComposerFocused(true);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 40);
  };

  const handleLikeCommentClick = async (comment: PostComment) => {
    setPoppingCommentId(comment.id);
    setTimeout(() => setPoppingCommentId(null), 300);
    await toggleLikeComment(comment, postLink);
  };

  const handleQuickReaction = async (reactionText: string) => {
    setSubmitting(true);
    try {
      await addPostComment(postId, reactionText, backingPost, {
        targetAuthorId: postAuthorId,
        targetTitle,
        link: postLink,
      });
      onToggleExpand(true);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    setSubmitting(true);
    try {
      await addPostComment(postId, commentText.trim(), backingPost, {
        parentId: replyTarget?.parentId,
        replyToUsername: replyTarget?.replyToUsername,
        targetAuthorId: replyTarget ? replyTarget.replyToUserId : postAuthorId,
        targetTitle,
        link: postLink,
      });
      setCommentText('');
      setReplyTarget(null);
      onToggleExpand(true);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveEdit = async (comment: PostComment) => {
    if (!editingText.trim()) return;
    await editPostComment(
      comment.id,
      editingText.trim(),
      comment.parentId,
      comment.replyToUsername
    );
    setEditingCommentId(null);
    setEditingText('');
  };

  // Render rich comment text with clickable @username mentions
  const renderCommentText = (text: string, replyToUsername?: string) => {
    const parts = text.split(/(@[a-zA-Z0-9_]+)/g);
    return (
      <span className="leading-relaxed break-words">
        {replyToUsername && !text.startsWith(`@${replyToUsername}`) && (
          <span className="text-[#E43136] font-semibold mr-1">@{replyToUsername}</span>
        )}
        {parts.map((part, idx) => {
          if (part.startsWith('@') && part.length > 1) {
            const handle = part.slice(1).toLowerCase();
            const matchedUser = users.find((u) => u.username.toLowerCase() === handle);
            if (matchedUser) {
              return (
                <Link
                  key={idx}
                  to={`/profile/${matchedUser.uid}`}
                  className="text-[#E43136] font-semibold hover:underline"
                >
                  {part}
                </Link>
              );
            }
            return (
              <span key={idx} className="text-[#E43136] font-semibold">
                {part}
              </span>
            );
          }
          return <React.Fragment key={idx}>{part}</React.Fragment>;
        })}
      </span>
    );
  };

  const renderSingleComment = (cmt: PostComment, rootParentId: string, isReply = false) => {
    const commenterProfile: UserProfile | undefined = users.find((u) => u.uid === cmt.userId);
    const canModify =
      Boolean(firebaseUser && (firebaseUser.uid === cmt.userId || isAdmin)) ||
      cmt.userId === 'guest_reader';
    const isPostAuthor = cmt.userId === postAuthorId;
    const isEditing = editingCommentId === cmt.id;
    const isEdited =
      cmt.updatedAt &&
      cmt.createdAt &&
      Math.abs(new Date(cmt.updatedAt).getTime() - new Date(cmt.createdAt).getTime()) > 5000;
    const likeInfo = commentLikesMap.get(cmt.id) || { count: 0, likedByMe: false };

    return (
      <div
        key={cmt.id}
        className={`group flex items-start gap-2.5 ${
          isReply
            ? 'pt-2 pl-2.5 sm:pl-3.5 border-l-2 border-[#EAEAEF] dark:border-[#2C2C35] ml-3 sm:ml-5'
            : 'p-2.5 sm:p-3 rounded-xl bg-[#FAFAFB] dark:bg-[#0F0F12] border border-[#F1F1F4] dark:border-[#2C2C35]'
        }`}
      >
        <Link to={`/profile/${cmt.userId}`} className="shrink-0 mt-0.5">
          <UserAvatar
            user={{
              displayName: cmt.userName,
              photoURL: commenterProfile?.photoURL || cmt.userAvatar,
              isOnline: commenterProfile?.isOnline,
              showOnlineStatus: commenterProfile?.showOnlineStatus,
            }}
            size={isReply ? 'xs' : 'sm'}
            showPresence
          />
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                <Link
                  to={`/profile/${cmt.userId}`}
                  className="text-xs font-bold text-[#202020] dark:text-[#F4F4F6] hover:text-[#E43136] transition-colors"
                >
                  {cmt.userName}
                </Link>
                <span className="text-[11px] text-[#777780] dark:text-[#9E9EA9]">
                  @{cmt.userUsername}
                </span>
                {isPostAuthor && (
                  <span className="px-1.5 py-0.2 rounded bg-[#FFF3F4] dark:bg-[#2D1619] text-[#E43136] text-[9px] font-bold uppercase tracking-wider border border-[#E43136]/20">
                    Author
                  </span>
                )}
                <span aria-hidden="true" className="text-[10px] text-[#777780]">
                  ·
                </span>
                <span className="text-[11px] text-[#777780] dark:text-[#9E9EA9] tabular-nums">
                  {formatShortTime(cmt.createdAt)}
                </span>
                {isEdited && (
                  <span className="text-[10px] italic text-[#777780] dark:text-[#9E9EA9]">
                    (edited)
                  </span>
                )}
              </div>

              {isEditing ? (
                <div className="mt-1.5 flex items-center gap-1.5">
                  <input
                    type="text"
                    value={editingText}
                    onChange={(e) => setEditingText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSaveEdit(cmt);
                      } else if (e.key === 'Escape') {
                        setEditingCommentId(null);
                      }
                    }}
                    className="flex-1 py-1.5 px-2.5 rounded-lg bg-white dark:bg-[#16161A] border border-[#E43136] text-xs text-[#202020] dark:text-[#F4F4F6] focus:outline-none"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => handleSaveEdit(cmt)}
                    className="p-1.5 rounded-lg bg-[#E43136] text-white text-xs font-semibold cursor-pointer"
                    title="Save"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingCommentId(null)}
                    className="p-1.5 rounded-lg text-[#777780] hover:text-[#202020] dark:hover:text-white text-xs cursor-pointer"
                    title="Cancel"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <p className="text-xs sm:text-[13px] text-[#202020] dark:text-[#F4F4F6] mt-0.5">
                  {renderCommentText(cmt.text, cmt.replyToUsername)}
                </p>
              )}

              {/* Comment Action Row: Like, Reply, Edit, Delete */}
              <div className="flex items-center gap-3 mt-1.5 text-[11px] font-semibold text-[#777780] dark:text-[#9E9EA9]">
                <button
                  type="button"
                  onClick={() => handleLikeCommentClick(cmt)}
                  className={`inline-flex items-center gap-1 transition-colors cursor-pointer ${
                    likeInfo.likedByMe ? 'text-[#E43136]' : 'hover:text-[#E43136]'
                  }`}
                >
                  <span>{likeInfo.likedByMe ? 'Liked' : 'Like'}</span>
                  {likeInfo.count > 0 && (
                    <span className="tabular-nums">({likeInfo.count})</span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleStartReply(cmt, rootParentId)}
                  className="inline-flex items-center gap-0.5 hover:text-[#E43136] transition-colors cursor-pointer"
                >
                  <CornerDownRight className="w-3 h-3" />
                  <span>Reply</span>
                </button>

                {canModify && !isEditing && (
                  <>
                    {(firebaseUser?.uid === cmt.userId || cmt.userId === 'guest_reader') && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCommentId(cmt.id);
                          setEditingText(cmt.text);
                        }}
                        className="inline-flex items-center gap-0.5 hover:text-[#202020] dark:hover:text-white transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-2.5 h-2.5" />
                        <span>Edit</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => deletePostComment(cmt.id, postId, backingPost)}
                      className="inline-flex items-center gap-0.5 hover:text-[#D9363E] transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                      <span>Delete</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Right-side Instagram-style Heart Button for Comment */}
            <button
              type="button"
              onClick={() => handleLikeCommentClick(cmt)}
              aria-label="Like comment"
              className={`p-1 rounded-full transition-transform cursor-pointer shrink-0 ${
                poppingCommentId === cmt.id ? 'scale-125' : 'scale-100'
              } ${
                likeInfo.likedByMe
                  ? 'text-[#E43136]'
                  : 'text-[#777780]/60 hover:text-[#E43136]'
              }`}
            >
              <Heart
                className={`w-3.5 h-3.5 ${likeInfo.likedByMe ? 'fill-[#E43136]' : ''}`}
              />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="pt-1.5 space-y-2.5">
      {/* Header Bar when Comments Exist: View All Toggle + Sort Selector */}
      {allItemComments.length > 0 && (
        <div className="flex items-center justify-between gap-2">
          {rootComments.length > 2 || allItemComments.length > visibleRootComments.length ? (
            <button
              type="button"
              onClick={() => onToggleExpand(!expanded)}
              className="text-[11px] sm:text-xs font-semibold text-[#777780] dark:text-[#9E9EA9] hover:text-[#E43136] inline-flex items-center gap-1 cursor-pointer"
            >
              {expanded ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5" />
                  <span>Hide comments</span>
                </>
              ) : (
                <>
                  <MessageCircle className="w-3.5 h-3.5 text-[#E43136]" />
                  <span>View all {allItemComments.length} comments</span>
                </>
              )}
            </button>
          ) : (
            <span className="text-[11px] font-semibold text-[#777780] dark:text-[#9E9EA9]">
              {allItemComments.length} {allItemComments.length === 1 ? 'comment' : 'comments'}
            </span>
          )}

          {(expanded || allItemComments.length > 1) && (
            <div className="flex items-center gap-1 text-[10px] sm:text-[11px]">
              {(['top', 'newest', 'oldest'] as CommentSortMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setSortMode(mode)}
                  className={`px-2 py-0.5 rounded-md font-semibold capitalize transition-colors cursor-pointer ${
                    sortMode === mode
                      ? 'bg-[#FFF3F4] dark:bg-[#2D1619] text-[#E43136]'
                      : 'text-[#777780] hover:text-[#202020] dark:hover:text-white'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Threaded Comments List */}
      {visibleRootComments.length > 0 && (
        <div
          className={`space-y-2 ${
            expanded ? 'max-h-[420px] overflow-y-auto pr-1' : ''
          }`}
        >
          {visibleRootComments.map((rootCmt) => {
            const replies = repliesByParentId.get(rootCmt.id) || [];
            const isThreadCollapsed = Boolean(collapsedThreads[rootCmt.id]);
            const visibleReplies = expanded
              ? isThreadCollapsed
                ? []
                : replies
              : replies.slice(-1);

            return (
              <div key={rootCmt.id} className="space-y-1.5">
                {renderSingleComment(rootCmt, rootCmt.id, false)}

                {/* Nested Replies */}
                {replies.length > 0 && (
                  <div className="space-y-1.5">
                    {expanded && replies.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setCollapsedThreads((prev) => ({
                            ...prev,
                            [rootCmt.id]: !prev[rootCmt.id],
                          }))
                        }
                        className="ml-8 text-[11px] font-semibold text-[#777780] hover:text-[#E43136] inline-flex items-center gap-1 cursor-pointer"
                      >
                        {isThreadCollapsed ? (
                          <>
                            <ChevronDown className="w-3 h-3" />
                            <span>
                              View {replies.length}{' '}
                              {replies.length === 1 ? 'reply' : 'replies'}
                            </span>
                          </>
                        ) : (
                          <>
                            <ChevronUp className="w-3 h-3" />
                            <span>Hide replies</span>
                          </>
                        )}
                      </button>
                    )}

                    {visibleReplies.map((replyCmt) =>
                      renderSingleComment(replyCmt, rootCmt.id, true)
                    )}

                    {!expanded && replies.length > 1 && (
                      <button
                        type="button"
                        onClick={() => onToggleExpand(true)}
                        className="ml-8 text-[11px] font-semibold text-[#777780] hover:text-[#E43136] inline-flex items-center gap-1 cursor-pointer"
                      >
                        <CornerDownRight className="w-3 h-3" />
                        <span>View {replies.length - 1} more replies</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {visibleRootComments.length === 0 && emptyMessage && (
        <div className="py-3 px-3.5 rounded-xl bg-[#FAFAFB] dark:bg-[#0F0F12] border border-dashed border-[#DDDDE3] dark:border-[#2C2C35] text-xs text-[#777780] dark:text-[#9E9EA9] flex items-center gap-2">
          <MessageCircle className="w-3.5 h-3.5 text-[#E43136] shrink-0" />
          <span>{emptyMessage}</span>
        </div>
      )}

      {/* Quick 1-Tap Reaction Chips (Shown when expanded or composer focused) */}
      {(expanded || composerFocused) && (
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5">
          <span className="text-[10px] font-semibold text-[#777780] shrink-0 inline-flex items-center gap-0.5">
            <Sparkles className="w-2.5 h-2.5 text-[#E43136]" />
            Quick:
          </span>
          {(quickReactions || QUICK_REACTIONS).map((chip) => (
            <button
              key={chip}
              type="button"
              disabled={submitting}
              onClick={() => handleQuickReaction(chip)}
              className="py-1 px-2.5 rounded-full bg-[#FAFAFB] dark:bg-[#0F0F12] border border-[#DDDDE3] dark:border-[#2C2C35] hover:border-[#E43136] hover:text-[#E43136] text-[10px] sm:text-[11px] font-medium text-[#202020] dark:text-[#F4F4F6] whitespace-nowrap shrink-0 transition-colors cursor-pointer"
            >
              {chip}
            </button>
          ))}
        </div>
      )}

      {/* Active Reply Banner */}
      {replyTarget && (
        <div className="px-3 py-1.5 rounded-lg bg-[#FFF3F4] dark:bg-[#2D1619] border border-[#E43136]/20 flex items-center justify-between gap-2 text-[11px] text-[#E43136]">
          <span className="font-semibold truncate">
            Replying to @{replyTarget.replyToUsername} ({replyTarget.replyToName})
          </span>
          <button
            type="button"
            onClick={() => setReplyTarget(null)}
            className="p-0.5 hover:bg-[#E43136]/10 rounded cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Inline Comment Input with Quick Emoji Bar */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <UserAvatar
          user={{
            displayName: currentUser?.displayName || 'Reader',
            photoURL: currentUser?.photoURL || '',
          }}
          size="xs"
        />

        <div className="flex-1 relative flex items-center">
          <input
            ref={inputRef}
            type="text"
            value={commentText}
            onFocus={() => setComposerFocused(true)}
            onChange={(e) => setCommentText(e.target.value)}
            maxLength={950}
            placeholder={
              replyTarget
                ? `Reply to @${replyTarget.replyToUsername}...`
                : placeholder || `Add a comment for ${postAuthorName.split(' ')[0]}...`
            }
            className="w-full py-1.5 sm:py-2 pl-3 pr-20 sm:pr-28 rounded-xl bg-[#FAFAFB] dark:bg-[#0F0F12] border border-[#DDDDE3] dark:border-[#2C2C35] focus:border-[#E43136] focus:bg-white dark:focus:bg-[#16161A] focus:outline-none text-xs text-[#202020] dark:text-[#F4F4F6] transition-colors"
          />

          {/* Quick Emoji Insertion Buttons inside Input */}
          <div className="absolute right-2 flex items-center gap-0.5">
            {QUICK_EMOJIS.slice(0, 4).map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  setCommentText((prev) => `${prev}${emoji}`);
                  setComposerFocused(true);
                  inputRef.current?.focus();
                }}
                className="p-1 text-xs hover:scale-125 transition-transform cursor-pointer"
                title={`Insert ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting || !commentText.trim()}
          className="py-1.5 sm:py-2 px-3 rounded-xl bg-[#E43136] hover:bg-[#B9272D] text-white text-xs font-semibold inline-flex items-center gap-1 transition-colors disabled:opacity-40 cursor-pointer shrink-0"
        >
          <Send className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          <span>{replyTarget ? 'Reply' : 'Post'}</span>
        </button>
      </form>
    </div>
  );
};
