import React, { useState, useRef, useEffect } from 'react';
import {
  Reply,
  Forward,
  Smile,
  MoreHorizontal,
  Edit2,
  Trash2,
  Copy,
  Flag,
  Check,
  CheckCheck,
  Clock,
  CornerDownRight,
  FileText,
  Play,
  Pause,
  Download,
  ExternalLink,
  Volume2,
  BookOpen,
  X,
  Plus,
} from 'lucide-react';
import { ChatMessage, ChatMessageReply, UserProfile, Book } from '../../models/types';
import { RedCodeCard } from '../books/RedCodeCard';
import { detectRedCodeInText, findBookByRedCode } from '../../services/firebase/redCodeService';
import { EmojiPickerTray } from './EmojiPickerTray';

interface MessageBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
  currentUserId: string;
  senderProfile?: UserProfile;
  otherUser?: UserProfile;
  allBooks: Book[];
  textScale?: number;
  density?: 'compact' | 'normal' | 'comfortable';
  onReply: (message: ChatMessage) => void;
  onForward: (message: ChatMessage) => void;
  onReact: (messageId: string, emoji: string) => void;
  onEdit: (messageId: string, newText: string) => Promise<void>;
  onUnsend: (messageId: string) => Promise<void>;
  onDeleteForMe: (messageId: string) => Promise<void>;
  onReport: (message: ChatMessage) => void;
  onScrollToMessage?: (messageId: string) => void;
  onInviteToRead?: (book: Book) => void;
}

const QUICK_REACTION_EMOJIS = ['❤️', '👍', '😂', '😮', '😢', '🙏'];

/**
 * Parses attachment tokens like [attachment:image:LABEL|URL] or [attachment:file:...] or [attachment:voice:...]
 */
interface ParsedAttachment {
  type: 'image' | 'file' | 'voice' | 'book' | null;
  url: string;
  label: string;
  extra?: string;
  cleanText: string;
}

function parseMessageAttachment(rawText: string): ParsedAttachment {
  if (!rawText) return { type: null, url: '', label: '', cleanText: '' };

  const match = rawText.match(/^\[attachment:(image|file|voice|book):([^\]]+)\](.*)$/s);
  if (!match) {
    return { type: null, url: '', label: '', cleanText: rawText };
  }

  const [, type, payload, remainder] = match;
  const parts = payload.split('|');
  let url = '';
  let label = '';
  let extra = '';

  if (type === 'image') {
    if (parts.length >= 2) {
      label = parts[0];
      url = parts[1];
    } else {
      url = parts[0];
    }
  } else if (type === 'file') {
    if (parts.length >= 2) {
      label = parts[0];
      url = parts[1];
      extra = parts[2] || '';
    } else {
      url = parts[0];
    }
  } else if (type === 'voice') {
    url = parts[0];
    extra = parts[1] || '0:00';
  } else if (type === 'book') {
    url = parts[0];
    label = parts[1] || '';
    extra = parts[2] || '';
  }

  return {
    type: type as any,
    url,
    label,
    extra,
    cleanText: (remainder || '').trim(),
  };
}

/**
 * Checks whether text consists purely of Unicode emojis.
 * Returns { isEmojiOnly: boolean, count: number }
 */
function getEmojiOnlyInfo(text: string): { isEmojiOnly: boolean; count: number } {
  if (!text) return { isEmojiOnly: false, count: 0 };
  const trimmed = text.trim();
  if (!trimmed) return { isEmojiOnly: false, count: 0 };

  // Strip all recognized emoji characters, modifiers, joiners, variation selectors
  const cleaned = trimmed.replace(
    /(?:\p{Extended_Pictographic}|\p{Emoji_Presentation}|\p{Emoji}\uFE0F|\u200D|\uFE0F|\p{Emoji_Modifier}|\s)+/gu,
    ''
  );
  if (cleaned.length > 0) {
    return { isEmojiOnly: false, count: 0 };
  }

  // Count individual emoji units
  let count = 0;
  if (typeof Intl !== 'undefined' && (Intl as any).Segmenter) {
    const segmenter = new (Intl as any).Segmenter('en', { granularity: 'grapheme' });
    const segments = Array.from(segmenter.segment(trimmed));
    count = segments.filter((s: any) => s.segment.trim().length > 0).length;
  } else {
    const matches = trimmed.match(/\p{Extended_Pictographic}|\p{Emoji_Presentation}/gu);
    count = matches ? matches.length : 0;
  }

  return { isEmojiOnly: true, count };
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isOwn,
  currentUserId,
  senderProfile,
  otherUser,
  allBooks,
  textScale = 12,
  density = 'compact',
  onReply,
  onForward,
  onReact,
  onEdit,
  onUnsend,
  onDeleteForMe,
  onReport,
  onScrollToMessage,
  onInviteToRead,
}) => {
  if (message.deletedForUsers && message.deletedForUsers.includes(currentUserId)) {
    return null;
  }

  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.text);
  const [showFullEmojiPicker, setShowFullEmojiPicker] = useState(false);
  const [showActionDropdown, setShowActionDropdown] = useState(false);
  const [showReactionDetails, setShowReactionDetails] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // Audio Voice Player state
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  const [voiceProgress, setVoiceProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const bubbleWrapperRef = useRef<HTMLDivElement | null>(null);

  const [menuDirection, setMenuDirection] = useState<'up' | 'down'>('up');
  const [menuAlign, setMenuAlign] = useState<'left' | 'right'>('right');

  const openActionMenu = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (bubbleWrapperRef.current) {
      const rect = bubbleWrapperRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      // If less than 280px below and more space above, open UPWARDS
      if (spaceBelow < 280 && spaceAbove > 200) {
        setMenuDirection('up');
      } else {
        setMenuDirection('down');
      }
      setMenuAlign(isOwn ? 'right' : 'left');
    }
    setShowActionDropdown(true);
  };

  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const isSwiping = useRef<boolean>(false);
  const longPressTimer = useRef<any>(null);

  const attachment = parseMessageAttachment(message.text || '');
  const displayText = attachment.type ? attachment.cleanText : (message.text || '');

  // Detect whether this message should be rendered without a bubble (1 to 4 emojis like Instagram)
  const emojiInfo = getEmojiOnlyInfo(displayText);
  const isFramelessEmoji =
    !attachment.type &&
    !message.bookAttachment &&
    !message.replyTo &&
    emojiInfo.isEmojiOnly &&
    emojiInfo.count > 0 &&
    emojiInfo.count < 5;

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const toggleVoicePlayback = (audioUrl: string) => {
    if (!audioRef.current) {
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.ontimeupdate = () => {
        if (audio.duration) {
          setVoiceProgress((audio.currentTime / audio.duration) * 100);
        }
      };

      audio.onended = () => {
        setIsPlayingVoice(false);
        setVoiceProgress(0);
      };
    }

    if (isPlayingVoice) {
      audioRef.current.pause();
      setIsPlayingVoice(false);
    } else {
      audioRef.current.play().then(() => {
        setIsPlayingVoice(true);
      }).catch((e) => {
        console.warn('Audio play failed:', e);
      });
    }
  };

  // Check if message is unsent for everyone
  if (message.isDeletedForEveryone) {
    return (
      <div className={`flex w-full my-0.5 sm:my-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
        <div
          style={{ fontSize: `${Math.max(10, textScale - 2)}px` }}
          className="px-2.5 py-1 rounded-lg bg-[#F0F0F3] dark:bg-[#1A1A22] text-[#8E8E98] italic border border-[#E5E5EB] dark:border-[#22222A]"
        >
          This message was unsent
        </div>
      </div>
    );
  }

  // Touch swipe to reply
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isSwiping.current = false;

    longPressTimer.current = setTimeout(() => {
      if (!isSwiping.current) {
        openActionMenu();
      }
    }, 450);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const diffX = e.touches[0].clientX - touchStartX.current;
    const diffY = e.touches[0].clientY - touchStartY.current;

    if (Math.abs(diffY) > 10) {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
      setSwipeOffset(0);
      return;
    }

    if (diffX > 20 && diffX < 80) {
      isSwiping.current = true;
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
      setSwipeOffset(diffX);
    }
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    if (swipeOffset > 45) {
      onReply(message);
    }
    setSwipeOffset(0);
    isSwiping.current = false;
  };

  const handleSaveEdit = async () => {
    if (!editText.trim()) return;
    try {
      await onEdit(message.id, editText.trim());
      setIsEditing(false);
    } catch (err) {
      console.error(err);
    }
  };

  // Detect 6-digit redcode if not already attached
  const detectedCode = !message.bookAttachment ? detectRedCodeInText(displayText) : null;
  const detectedBook = detectedCode ? findBookByRedCode(detectedCode, allBooks) : undefined;

  // Format timestamp
  const formatTime = (iso: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    return isNaN(d.getTime())
      ? ''
      : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div
      id={`msg_${message.id}`}
      className={`group relative flex flex-col my-1 transition-all select-none ${
        isOwn ? 'items-end' : 'items-start'
      }`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        transform: swipeOffset ? `translateX(${swipeOffset}px)` : undefined,
      }}
    >
      {/* Forwarded Header */}
      {message.isForwarded && (
        <div className="flex items-center gap-1 text-[11px] text-[#777782] dark:text-[#9A9AA6] italic mb-0.5 px-1">
          <Forward className="w-3 h-3 text-[#E43136]" />
          <span>Forwarded</span>
        </div>
      )}

      {/* Quoted Reply Preview */}
      {message.replyTo && (
        <div
          onClick={() => onScrollToMessage && onScrollToMessage(message.replyTo!.id)}
          style={{ fontSize: `${Math.max(10, textScale - 2)}px` }}
          className={`flex items-start gap-1.5 mb-1 px-2.5 py-1 rounded-xl bg-black/5 dark:bg-white/5 border-l-2 border-[#E43136] max-w-sm cursor-pointer hover:opacity-85 ${
            isOwn ? 'self-end' : 'self-start'
          }`}
        >
          <CornerDownRight className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-[#E43136] shrink-0 mt-0.5" />
          <div className="truncate text-left">
            <span className="font-semibold text-[#E43136] block text-[9px] sm:text-[10px]">
              {message.replyTo.senderName}
            </span>
            <span className="text-[#6E6E77] dark:text-[#9E9EA8] truncate text-[10px] sm:text-[11px]">
              {message.replyTo.text}
            </span>
          </div>
        </div>
      )}

      {/* Bubble Row with Floating Toolbar */}
      <div
        ref={bubbleWrapperRef}
        className={`relative flex items-center gap-1.5 ${isOwn ? 'flex-row' : 'flex-row-reverse'}`}
      >
        {/* Floating Quick Action Menu (Desktop Hover only: strictly hidden below lg: 1024px to prevent horizontal scroll) */}
        <div
          className={`hidden lg:flex opacity-0 group-hover:opacity-100 transition-opacity items-center gap-0.5 px-2 py-1 rounded-full bg-white dark:bg-[#1E1E28] shadow-lg border border-[#E5E5EB] dark:border-[#2E2E3C] z-10 shrink-0 ${
            isOwn ? 'mr-1' : 'ml-1'
          }`}
        >
          {/* Quick Reaction Emojis */}
          <div className="flex items-center gap-0.5 mr-1 pr-1 border-r border-[#E5E5EB] dark:border-[#2A2A36]">
            {QUICK_REACTION_EMOJIS.slice(0, 4).map((emoji) => (
              <button
                key={emoji}
                onClick={() => onReact(message.id, emoji)}
                className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-xs transition-transform hover:scale-130 active:scale-95 cursor-pointer"
              >
                {emoji}
              </button>
            ))}
            <button
              onClick={() => setShowFullEmojiPicker(!showFullEmojiPicker)}
              title="All Emojis"
              className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-[#6E6E77] text-xs transition-transform hover:scale-120 cursor-pointer"
            >
              <Smile className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={() => onReply(message)}
            title="Reply"
            className="p-1 rounded-full text-[#6E6E77] hover:text-[#202020] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
          >
            <Reply className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => onForward(message)}
            title="Forward"
            className="p-1 rounded-full text-[#6E6E77] hover:text-[#202020] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
          >
            <Forward className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={(e) => openActionMenu(e)}
            title="More Options"
            className="p-1 rounded-full text-[#6E6E77] hover:text-[#202020] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Full Emoji Picker Popover with Outside Click Dismiss */}
        {showFullEmojiPicker && (
          <>
            <div
              className="fixed inset-0 z-30"
              onClick={() => setShowFullEmojiPicker(false)}
            />
            <div className={`absolute bottom-full mb-2 z-40 ${isOwn ? 'right-0' : 'left-0'}`}>
              <EmojiPickerTray
                onSelectEmoji={(emoji) => {
                  onReact(message.id, emoji);
                  setShowFullEmojiPicker(false);
                }}
                onClose={() => setShowFullEmojiPicker(false)}
                title="React with Emoji"
              />
            </div>
          </>
        )}

        {/* Action Menu Dropdown with Outside Click Dismiss */}
        {showActionDropdown && (
          <>
            <div
              className="fixed inset-0 z-30"
              onClick={() => setShowActionDropdown(false)}
            />
            <div
              className={`absolute z-40 w-56 max-w-[calc(100vw-2rem)] rounded-2xl bg-white dark:bg-[#1E1E28] shadow-2xl border border-[#DDDDE3] dark:border-[#2E2E3C] py-1 text-xs overflow-hidden animate-in fade-in zoom-in-95 duration-150 ${
                menuDirection === 'up' ? 'bottom-full mb-2' : 'top-full mt-2'
              } ${menuAlign === 'right' ? 'right-0' : 'left-0'}`}
            >
              {/* Quick Reaction Emojis Bar at top of dropdown (Desktop & Mobile) */}
              <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-[#F0F0F3] dark:border-[#2A2A36] bg-[#FAFAFC] dark:bg-[#181822]">
                <div className="flex items-center gap-1">
                  {QUICK_REACTION_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => {
                        onReact(message.id, emoji);
                        setShowActionDropdown(false);
                      }}
                      className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-sm transition-transform hover:scale-125 active:scale-95 cursor-pointer"
                      title={emoji}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => {
                    setShowActionDropdown(false);
                    setShowFullEmojiPicker(true);
                  }}
                  title="More reactions"
                  className="w-6 h-6 flex items-center justify-center rounded-full text-[#777] hover:text-[#222] dark:hover:text-white hover:bg-black/10 dark:hover:bg-white/10 text-xs cursor-pointer ml-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              <button
                onClick={() => {
                  onReply(message);
                  setShowActionDropdown(false);
                }}
                className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer font-medium"
              >
                <Reply className="w-3.5 h-3.5 text-[#E43136]" />
                <span>Reply</span>
              </button>

            <button
              onClick={() => {
                onForward(message);
                setShowActionDropdown(false);
              }}
              className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
            >
              <Forward className="w-3.5 h-3.5" />
              <span>Forward</span>
            </button>

            <button
              onClick={() => {
                navigator.clipboard.writeText(displayText || message.text);
                setShowActionDropdown(false);
              }}
              className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copy text</span>
            </button>

            {isOwn && !attachment.type && (
              <button
                onClick={() => {
                  setIsEditing(true);
                  setShowActionDropdown(false);
                }}
                className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5 text-blue-500" />
                <span>Edit message</span>
              </button>
            )}

            <button
              onClick={() => {
                onDeleteForMe(message.id);
                setShowActionDropdown(false);
              }}
              className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5 text-amber-500" />
              <span>Delete for me</span>
            </button>

            {isOwn && (
              <button
                onClick={() => {
                  onUnsend(message.id);
                  setShowActionDropdown(false);
                }}
                className="w-full px-3 py-2 text-left flex items-center gap-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Unsend for everyone</span>
              </button>
            )}

            <button
              onClick={() => {
                onReport(message);
                setShowActionDropdown(false);
              }}
              className="w-full px-3 py-2 text-left flex items-center gap-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 cursor-pointer"
            >
              <Flag className="w-3.5 h-3.5" />
              <span>Report</span>
            </button>
          </div>
          </>
        )}

        {/* Message Bubble Body or Frameless Emoji (Instagram style) */}
        {isFramelessEmoji ? (
          <div className="flex flex-col select-text">
            <div
              className={`leading-none select-none tracking-tight ${
                emojiInfo.count === 1
                  ? 'text-6xl my-1'
                  : emojiInfo.count === 2
                  ? 'text-5xl my-1'
                  : 'text-4xl my-0.5'
              }`}
            >
              {displayText}
            </div>
            <div
              className={`flex items-center gap-1 text-[10px] text-[#8E8E98] mt-0.5 whitespace-nowrap shrink-0 leading-none ${
                isOwn ? 'justify-end' : 'justify-start'
              }`}
            >
              <span className="whitespace-nowrap shrink-0">{formatTime(message.createdAt)}</span>
              {isOwn && (
                <span>
                  {message.status === 'sending' && <Clock className="w-2.5 h-2.5 animate-spin" />}
                  {message.status === 'sent' && <Check className="w-3 h-3" />}
                  {message.status === 'delivered' && <CheckCheck className="w-3 h-3 text-[#8E8E98]" />}
                  {message.status === 'read' && <CheckCheck className="w-3 h-3 text-sky-500" />}
                </span>
              )}
            </div>
          </div>
        ) : (
          <div
            className={`max-w-[82%] sm:max-w-md min-w-[76px] [overflow-wrap:anywhere] break-words rounded-xl sm:rounded-2xl relative shadow-2xs ${
              density === 'compact'
                ? 'px-2.5 py-1.5 sm:px-3 sm:py-2'
                : density === 'comfortable'
                ? 'px-4 py-2.5 sm:px-4 sm:py-3'
                : 'px-3 py-2 sm:px-3.5 sm:py-2.5'
            } ${
              isOwn
                ? 'bg-[#E43136] text-white rounded-tr-xs'
                : 'bg-white dark:bg-[#1A1A22] text-[#202020] dark:text-[#F4F4F6] border border-[#E5E5EB] dark:border-[#282834] rounded-tl-xs'
            }`}
          >
            {/* Inline Edit Mode */}
            {isEditing ? (
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white/20 text-white outline-none placeholder:text-white/60"
                  autoFocus
                />
                <div className="flex justify-end gap-1.5">
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-2 py-0.5 rounded text-[11px] bg-black/20 hover:bg-black/30 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    className="px-2.5 py-0.5 rounded text-[11px] bg-white text-[#E43136] font-semibold cursor-pointer"
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* 1. Photo Attachment Preview */}
                {attachment.type === 'image' && attachment.url && (
                  <div className="mb-2 rounded-xl overflow-hidden shadow-xs border border-black/10">
                    <img
                      src={attachment.url}
                      alt={attachment.label || 'Photo'}
                      onClick={() => setLightboxOpen(true)}
                      className="max-h-72 w-full object-cover hover:scale-102 transition-transform cursor-pointer"
                    />
                  </div>
                )}

                {/* 2. Document Attachment Card */}
                {attachment.type === 'file' && attachment.url && (
                  <a
                    href={attachment.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center gap-3 p-2.5 mb-2 rounded-xl border transition-colors ${
                      isOwn
                        ? 'bg-white/10 hover:bg-white/20 border-white/20 text-white'
                        : 'bg-[#F4F4F6] dark:bg-[#20202A] hover:bg-[#EDEDF0] dark:hover:bg-[#282834] border-[#E5E5EB] dark:border-[#2E2E3E] text-[#202020] dark:text-white'
                    }`}
                  >
                    <div className="w-9 h-9 rounded-lg bg-[#E43136]/15 flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5 text-[#E43136]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold truncate">
                        {attachment.label || 'Document'}
                      </div>
                      <div className="text-[10px] opacity-75 truncate">
                        {attachment.extra || 'Click to download / view'}
                      </div>
                    </div>
                    <Download className="w-4 h-4 shrink-0 opacity-80" />
                  </a>
                )}

                {/* 3. Interactive Voice Note Audio Player */}
                {attachment.type === 'voice' && attachment.url && (
                  <div
                    className={`flex items-center gap-2 sm:gap-2.5 p-1.5 sm:p-2 mb-1.5 sm:mb-2 rounded-xl border w-full min-w-0 max-w-full ${
                      isOwn
                        ? 'bg-white/10 border-white/20 text-white'
                        : 'bg-[#F4F4F6] dark:bg-[#20202A] border-[#E5E5EB] dark:border-[#2E2E3E] text-[#202020] dark:text-white'
                    }`}
                  >
                    <button
                      onClick={() => toggleVoicePlayback(attachment.url)}
                      className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center shrink-0 shadow-xs cursor-pointer transition-transform hover:scale-105 active:scale-95 ${
                        isOwn ? 'bg-white text-[#E43136]' : 'bg-[#E43136] text-white'
                      }`}
                    >
                      {isPlayingVoice ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-0.5 sm:gap-1 h-3.5 sm:h-4 flex-1 min-w-0">
                        {[40, 70, 30, 90, 60, 45, 80, 50, 75, 35, 95, 60, 40, 85, 55].map((h, i) => {
                          const active = (i / 15) * 100 <= voiceProgress;
                          return (
                            <div
                              key={i}
                              style={{ height: `${h}%` }}
                              className={`w-0.5 sm:w-1 flex-1 max-w-[3px] sm:max-w-[4px] rounded-full transition-colors ${
                                active
                                  ? isOwn
                                    ? 'bg-white'
                                    : 'bg-[#E43136]'
                                  : isOwn
                                  ? 'bg-white/30'
                                  : 'bg-black/20 dark:bg-white/20'
                              }`}
                            />
                          );
                        })}
                      </div>
                      <div className="flex items-center justify-between text-[9px] sm:text-[10px] opacity-80 mt-1">
                        <span className="flex items-center gap-1 font-mono truncate">
                          <Volume2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" /> Voice Note
                        </span>
                        <span className="font-mono shrink-0 ml-1">{attachment.extra || '0:15'}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Plain Message Text / Caption */}
                {displayText && (
                  <p
                    style={{ fontSize: `${textScale}px`, lineHeight: 1.35 }}
                    className="whitespace-pre-wrap break-words select-text"
                  >
                    {displayText}
                  </p>
                )}

                {/* Explicit Book Attachment */}
                {message.bookAttachment && (
                  <div className="mt-2">
                    <RedCodeCard
                      bookId={message.bookAttachment.id || message.bookAttachment.bookId || ''}
                      title={message.bookAttachment.title}
                      author={message.bookAttachment.author || message.bookAttachment.authorName || 'Author'}
                      coverURL={message.bookAttachment.coverURL}
                      description={message.bookAttachment.description}
                      redCode={message.bookAttachment.redCode}
                      compact
                    />
                    {isOwn && onInviteToRead && (
                      <button
                        type="button"
                        onClick={() => {
                          const bId = message.bookAttachment?.id || message.bookAttachment?.bookId || '';
                          const found = allBooks.find((b) => b.id === bId);
                          const bookObj: Book = (found || {
                            id: bId,
                            title: message.bookAttachment?.title || 'Book',
                            authorName: message.bookAttachment?.author || message.bookAttachment?.authorName || 'Author',
                            coverURL: message.bookAttachment?.coverURL || '',
                            format: 'story',
                            authorId: '',
                            category: 'Fiction',
                            status: 'published',
                            likes: 0,
                            views: 0,
                            shares: 0,
                            rating: 0,
                            reviewsCount: 0,
                            createdAt: '',
                            updatedAt: '',
                          }) as unknown as Book;
                          onInviteToRead(bookObj);
                        }}
                        className="w-full mt-2 py-1.5 px-3 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer active:scale-95 border border-white/25"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>Invite for Read</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Auto-detected RedCode Book Card */}
                {detectedBook && !message.bookAttachment && (
                  <div className="mt-2">
                    <RedCodeCard
                      bookId={detectedBook.id}
                      title={detectedBook.title}
                      author={detectedBook.authorName}
                      coverURL={detectedBook.coverURL}
                      description={detectedBook.shortDescription}
                      redCode={detectedCode!}
                      compact
                    />
                    {isOwn && onInviteToRead && (
                      <button
                        type="button"
                        onClick={() => onInviteToRead(detectedBook)}
                        className="w-full mt-2 py-1.5 px-3 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer active:scale-95 border border-white/25"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>Invite for Read</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Timestamp & Meta Indicators */}
                <div
                  style={{ fontSize: `${Math.max(9, textScale - 3)}px` }}
                  className={`flex items-center justify-end gap-1 mt-1 font-mono select-none whitespace-nowrap shrink-0 leading-none ${
                    isOwn ? 'text-white/80' : 'text-[#8E8E98]'
                  }`}
                >
                  {message.isEdited && <span className="italic mr-0.5 whitespace-nowrap shrink-0">Edited</span>}
                  <span className="whitespace-nowrap shrink-0">{formatTime(message.createdAt)}</span>

                  {/* Delivery State Icons (Own messages) */}
                  {isOwn && (
                    <span className="shrink-0 flex items-center">
                      {message.status === 'sending' && <Clock className="w-2.5 h-2.5 animate-spin" />}
                      {message.status === 'sent' && <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3" />}
                      {message.status === 'delivered' && <CheckCheck className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white/70" />}
                      {message.status === 'read' && <CheckCheck className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-sky-300" />}
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Emoji Reactions Bar */}
      {message.reactions && Object.keys(message.reactions).length > 0 && (
        <div className="relative flex flex-wrap gap-1 mt-0.5 sm:mt-1 max-w-[78%] sm:max-w-md">
          {Object.entries(message.reactions).map(([emoji, uids]) => {
            if (!uids || uids.length === 0) return null;
            const hasReacted = uids.includes(currentUserId);
            return (
              <button
                key={emoji}
                type="button"
                onClick={() => setShowReactionDetails(!showReactionDetails)}
                style={{ fontSize: `${Math.max(10, textScale - 2)}px` }}
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border shadow-2xs transition-transform hover:scale-110 cursor-pointer ${
                  hasReacted
                    ? 'bg-[#FFF3F4] dark:bg-[#E43136]/20 border-[#E43136]/40 text-[#E43136]'
                    : 'bg-white dark:bg-[#1A1A22] border-[#E5E5EB] dark:border-[#2C2C38] text-[#444] dark:text-[#AAA]'
                }`}
                title="View reactions & options"
              >
                <span>{emoji}</span>
                <span className="font-semibold text-[9px] sm:text-[10px]">{uids.length}</span>
              </button>
            );
          })}

          {/* Reaction Details Toggle Popover */}
          {showReactionDetails && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setShowReactionDetails(false)}
              />
              <div
                className={`absolute bottom-full mb-1 z-40 w-64 max-w-[90vw] rounded-2xl bg-white dark:bg-[#1C1C24] border border-[#DDDDE3] dark:border-[#2C2C38] shadow-2xl p-2.5 text-xs animate-in fade-in duration-150 ${
                  isOwn ? 'right-0' : 'left-0'
                }`}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#F0F0F3] dark:border-[#2C2C38]">
                  <span className="font-semibold text-[#202020] dark:text-white text-xs">
                    Reactions
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowReactionDetails(false)}
                    className="p-1 rounded-md text-[#8E8E98] hover:text-[#202020] dark:hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-1.5 max-h-48 overflow-y-auto no-scrollbar">
                  {Object.entries(message.reactions || {}).flatMap(([emoji, uids]) =>
                    (uids || []).map((uid) => {
                      const isMe = uid === currentUserId;
                      const userName = isMe ? 'You' : otherUser?.displayName || 'Reader';

                      return (
                        <div
                          key={`${emoji}_${uid}`}
                          className="flex items-center justify-between gap-2 p-1.5 rounded-lg hover:bg-[#FAFAFB] dark:hover:bg-[#252530]"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-base shrink-0">{emoji}</span>
                            <span className="font-medium text-[#202020] dark:text-[#E8E8EE] truncate">
                              {userName}
                            </span>
                          </div>

                          {isMe ? (
                            <button
                              type="button"
                              onClick={() => {
                                onReact(message.id, emoji);
                                setShowReactionDetails(false);
                              }}
                              className="text-[11px] font-semibold text-red-500 hover:text-red-600 hover:underline shrink-0 cursor-pointer"
                            >
                              Remove
                            </button>
                          ) : (
                            <span className="text-[10px] text-[#8E8E98] shrink-0">Reacted</span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Lightbox Modal for Photo */}
      {lightboxOpen && attachment.url && (
        <div
          onClick={() => setLightboxOpen(false)}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 cursor-zoom-out animate-in fade-in duration-150"
        >
          <img
            src={attachment.url}
            alt={attachment.label || 'Photo preview'}
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-xl shadow-2xl"
          />
        </div>
      )}
    </div>
  );
};
