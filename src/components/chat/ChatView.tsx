import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Sparkles,
  Info,
  UserPlus,
  ShieldAlert,
  Lock,
  Loader2,
  Edit3,
  Trash2,
  Palette,
  Sliders,
} from 'lucide-react';
import {
  Chat,
  ChatMessage,
  UserProfile,
  Book,
  ChatWallpaperConfig,
  Friendship,
  ChatMessageReply,
} from '../../models/types';
import { UserAvatar } from '../common/UIPrimitives';
import { MessageBubble } from './MessageBubble';
import { ChatComposer } from './ChatComposer';
import { ChatWallpaperModal } from './ChatWallpaperModal';
import { ChatSizeModal } from './ChatSizeModal';
import { ForwardModal } from './ForwardModal';
import { ReportModal } from './ReportModal';
import { subscribeUserPresence, formatPresenceStatus, UserPresenceState } from '../../services/firebase/presenceService';

interface ChatViewProps {
  chat: Chat;
  messages: ChatMessage[];
  currentUserId: string;
  otherUser?: UserProfile;
  allBooks: Book[];
  allFriends: UserProfile[];
  isFriend: boolean;
  friendship?: Friendship;
  onBack?: () => void;
  onSendMessage: (text: string, options?: any) => Promise<void>;
  onSendFriendRequest: (targetUser: UserProfile) => Promise<void>;
  onAcceptFriendRequest: (friendshipId: string) => Promise<void>;
  onReactToMessage: (messageId: string, emoji: string) => Promise<void>;
  onEditMessage: (messageId: string, newText: string) => Promise<void>;
  onUnsendMessage: (messageId: string) => Promise<void>;
  onDeleteForMeMessage: (messageId: string) => Promise<void>;
  onForwardMessage: (messageText: string, recipientUids: string[]) => Promise<void>;
  onSubmitReport: (reason: string, details: string, targetId: string) => Promise<void>;
  partnerNickname?: string;
  onEditNickname?: () => void;
  onDeleteChat?: () => void;
  onInviteToRead?: (book: Book) => Promise<void>;
}

export const ChatView: React.FC<ChatViewProps> = ({
  chat,
  messages,
  currentUserId,
  otherUser,
  allBooks,
  allFriends,
  isFriend,
  friendship,
  onBack,
  onSendMessage,
  onSendFriendRequest,
  onAcceptFriendRequest,
  onReactToMessage,
  onEditMessage,
  onUnsendMessage,
  onDeleteForMeMessage,
  onForwardMessage,
  onSubmitReport,
  partnerNickname,
  onEditNickname,
  onDeleteChat,
  onInviteToRead,
}) => {
  const [wallpaperModalOpen, setWallpaperModalOpen] = useState(false);
  const [forwardModalOpen, setForwardModalOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [selectedMessageForForward, setSelectedMessageForForward] = useState<ChatMessage | null>(null);
  const [selectedMessageForReport, setSelectedMessageForReport] = useState<ChatMessage | null>(null);
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const messageScrollRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const [infoOpen, setInfoOpen] = useState(false);
  const [sizeModalOpen, setSizeModalOpen] = useState(false);

  // Chat text & bubble size customizer (defaults smaller on mobile)
  const [chatTextScale, setChatTextScale] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('rc_chat_text_scale');
      if (saved) return Number(saved);
      return typeof window !== 'undefined' && window.innerWidth < 768 ? 12 : 13;
    } catch {
      return 12;
    }
  });

  const [bubbleDensity, setBubbleDensity] = useState<'compact' | 'normal' | 'comfortable'>(() => {
    try {
      const saved = localStorage.getItem('rc_chat_bubble_density');
      if (saved) return saved as any;
      return typeof window !== 'undefined' && window.innerWidth < 768 ? 'compact' : 'normal';
    } catch {
      return 'compact';
    }
  });

  const handleUpdateTextScale = (size: number) => {
    setChatTextScale(size);
    try {
      localStorage.setItem('rc_chat_text_scale', String(size));
    } catch {}
  };

  const handleUpdateDensity = (d: 'compact' | 'normal' | 'comfortable') => {
    setBubbleDensity(d);
    try {
      localStorage.setItem('rc_chat_bubble_density', d);
    } catch {}
  };

  const handleResetSize = () => {
    const defaultScale = typeof window !== 'undefined' && window.innerWidth < 768 ? 12 : 13;
    const defaultDensity = typeof window !== 'undefined' && window.innerWidth < 768 ? 'compact' : 'normal';
    setChatTextScale(defaultScale);
    setBubbleDensity(defaultDensity);
    try {
      localStorage.setItem('rc_chat_text_scale', String(defaultScale));
      localStorage.setItem('rc_chat_bubble_density', defaultDensity);
    } catch {}
  };

  // Per-user wallpaper preference loaded from localStorage
  const wallpaperKey = `redcover_wallpaper_${currentUserId}_${chat.id}`;
  const [wallpaper, setWallpaper] = useState<ChatWallpaperConfig>(() => {
    try {
      const saved = localStorage.getItem(wallpaperKey);
      return saved ? JSON.parse(saved) : { type: 'default', value: '#FAFAFB' };
    } catch {
      return { type: 'default', value: '#FAFAFB' };
    }
  });

  const handleSelectWallpaper = (newWallpaper: ChatWallpaperConfig) => {
    setWallpaper(newWallpaper);
    try {
      localStorage.setItem(wallpaperKey, JSON.stringify(newWallpaper));
    } catch {}
  };

  // Real-time Presence subscription for other user
  const [otherPresence, setOtherPresence] = useState<UserPresenceState | null>(null);

  useEffect(() => {
    if (!otherUser?.uid) return;
    const unsub = subscribeUserPresence(otherUser.uid, (p) => {
      setOtherPresence(p);
    });
    return () => unsub();
  }, [otherUser?.uid]);

  const presenceStatus = formatPresenceStatus(
    otherPresence,
    false,
    otherUser?.showOnlineStatus ?? true
  );

  // Message scroll handling
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    scrollToBottom('auto');
    stickToBottomRef.current = true;
  }, [chat.id]);

  useEffect(() => {
    if (stickToBottomRef.current) scrollToBottom('smooth');
  }, [messages.length]);

  const orderedMessages = [...messages].sort((a, b) => {
    const timeA = Date.parse(a.createdAt || '') || 0;
    const timeB = Date.parse(b.createdAt || '') || 0;
    return timeA - timeB || a.id.localeCompare(b.id);
  });

  const handleScrollToMessage = (messageId: string) => {
    const el = document.getElementById(`msg_${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-[#E43136]');
      setTimeout(() => el.classList.remove('ring-2', 'ring-[#E43136]'), 2000);
    }
  };

  const otherName = otherUser?.displayName || (chat.participantA === currentUserId ? chat.participantBName : chat.participantAName) || 'Reader';
  const otherAvatar = otherUser?.photoURL || (chat.participantA === currentUserId ? chat.participantBAvatar : chat.participantAAvatar) || '';

  // Wallpaper styling
  const getWallpaperStyle = (): React.CSSProperties => {
    if (wallpaper.type === 'solid') {
      return { backgroundColor: wallpaper.value };
    }
    if (wallpaper.type === 'preset') {
      if (wallpaper.value === 'pattern_library') {
        return {
          backgroundImage: 'radial-gradient(rgba(228,49,54,0.15) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        };
      }
      if (wallpaper.value === 'pattern_parchment') {
        return {
          background: 'linear-gradient(135deg, #FBF8F1 0%, #F5EEDB 100%)',
        };
      }
      if (wallpaper.value === 'pattern_crimson_haze') {
        return {
          background: 'linear-gradient(135deg, rgba(228,49,54,0.06) 0%, transparent 60%)',
        };
      }
      if (wallpaper.value === 'pattern_constellations') {
        return {
          backgroundColor: '#09090D',
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.18) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        };
      }
    }
    if (wallpaper.type === 'custom' && wallpaper.value) {
      return {
        backgroundImage: `url(${wallpaper.value})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      };
    }
    return {};
  };

  return (
    <div className="flex-1 h-full flex flex-col relative overflow-hidden bg-[#FAFAFB] dark:bg-[#0E0E12]">
      {/* Fixed Chat Header */}
      <div className="h-12 sm:h-14 shrink-0 px-2 sm:px-4 border-b border-[#E5E5EB] dark:border-[#22222A] bg-white/90 dark:bg-[#121217]/90 backdrop-blur-md flex items-center justify-between z-20">
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
          {onBack && (
            <button
              onClick={onBack}
              className="md:hidden w-8 h-8 -ml-1 rounded-lg text-[#6E6E77] hover:text-[#202020] dark:hover:text-white flex items-center justify-center cursor-pointer active:bg-black/5 dark:active:bg-white/5 transition-colors shrink-0"
              aria-label="Back to conversations"
              title="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}

          <div className="relative shrink-0">
            <UserAvatar user={{ displayName: otherName, photoURL: otherAvatar, isOnline: presenceStatus.isOnline, showOnlineStatus: otherUser?.showOnlineStatus ?? true }} size="sm" />
            {presenceStatus.isOnline && (
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#121217]" />
            )}
          </div>

          <div className="min-w-0">
            <h3 className="text-xs sm:text-sm font-semibold text-[#202020] dark:text-[#F4F4F6] truncate flex items-center gap-1 sm:gap-1.5">
              <span style={otherUser?.nameColor ? { color: otherUser.nameColor } : undefined}>{otherName}</span>
              {partnerNickname && (
                <span className="text-[9px] sm:text-[10px] text-[#6E6E77] font-normal truncate">
                  ({otherUser?.displayName || 'Contact'})
                </span>
              )}
              {onEditNickname && (
                <button
                  type="button"
                  onClick={onEditNickname}
                  className="p-0.5 rounded text-[#8E8E98] hover:text-[#E43136] hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                  title="Edit Contact Nickname"
                >
                  <Edit3 className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                </button>
              )}
              {otherUser?.role === 'author' && (
                <span className="px-1 py-0.2 rounded text-[9px] sm:text-[10px] font-semibold bg-[#E43136]/15 text-[#E43136]">
                  Author
                </span>
              )}
            </h3>
            <p className="text-[10px] sm:text-[11px] text-[#6E6E77] dark:text-[#9E9EA8] truncate">
              {presenceStatus.text || `@${otherUser?.username || 'reader'}`}
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-0.5 sm:gap-1">
          {/* Adjustable Chat Size & Appearance Button */}
          <button
            onClick={() => setSizeModalOpen(true)}
            className="p-1.5 sm:p-2 rounded-xl text-[#6E6E77] hover:text-[#202020] dark:hover:text-white hover:bg-[#F1F1F4] dark:hover:bg-[#1C1C24] transition-colors cursor-pointer flex items-center gap-1"
            title="Adjust Chat Size"
            aria-label="Adjust Chat Size"
          >
            <Sliders className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#E43136]" />
            <span className="text-[10px] font-mono hidden sm:inline">{chatTextScale}px</span>
          </button>

          <button
            onClick={() => setWallpaperModalOpen(true)}
            className="p-1.5 sm:p-2 rounded-xl text-[#6E6E77] hover:text-[#202020] dark:hover:text-white hover:bg-[#F1F1F4] dark:hover:bg-[#1C1C24] transition-colors cursor-pointer"
            title="Chat Wallpaper"
            aria-label="Chat Wallpaper"
          >
            <Palette className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          <button
            onClick={() => setInfoOpen(!infoOpen)}
            className={`p-1.5 sm:p-2 rounded-xl transition-colors cursor-pointer ${
              infoOpen
                ? 'bg-[#FFF3F4] text-[#E43136] dark:bg-[#E43136]/15'
                : 'text-[#6E6E77] hover:text-[#202020] dark:hover:text-white hover:bg-[#F1F1F4] dark:hover:bg-[#1C1C24]'
            }`}
            title="Conversation Details"
            aria-label="Conversation Details"
          >
            <Info className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </div>
      </div>

      {/* Main Body (Messages + Context Drawer) */}
      <div className="flex-1 min-h-0 flex overflow-hidden relative" style={getWallpaperStyle()}>
        {/* Messages Scroll Area */}
         <div
           ref={messageScrollRef}
           onScroll={(event) => {
             const el = event.currentTarget;
             stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
           }}
           className="flex-1 min-w-0 min-h-0 overflow-y-auto px-4 py-4 flex flex-col"
         >
          {/* Messages Stream */}
          <div className="space-y-1">
            {messages.length === 0 ? (
              <div className="text-center py-16 text-xs text-[#8E8E98]">
                <p className="font-semibold text-sm text-[#202020] dark:text-[#E2E2E8] mb-1">
                  Say hello to {otherName}!
                </p>
                <p>Start a discussion or share books using 6-digit RedCodes.</p>
              </div>
            ) : (
              orderedMessages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  isOwn={msg.senderId === currentUserId}
                  currentUserId={currentUserId}
                  senderProfile={msg.senderId === currentUserId ? undefined : otherUser}
                  otherUser={otherUser}
                  allBooks={allBooks}
                  textScale={chatTextScale}
                  density={bubbleDensity}
                  onInviteToRead={onInviteToRead}
                  onReply={(targetMsg) => {
                    let preview = targetMsg.text || 'Message';
                    if (preview.startsWith('[attachment:image:')) {
                      preview = '📷 Photo';
                    } else if (preview.startsWith('[attachment:file:')) {
                      preview = '📎 File attachment';
                    } else if (preview.startsWith('[attachment:voice:')) {
                      preview = '🎤 Voice message';
                    } else if (preview.startsWith('[attachment:book:') || targetMsg.bookAttachment) {
                      preview = `📚 ${targetMsg.bookAttachment?.title || 'Book'}`;
                    }
                    setReplyingTo({
                      id: targetMsg.id,
                      text: preview.slice(0, 300),
                      senderName: targetMsg.senderId === currentUserId ? 'You' : otherName,
                      senderId: targetMsg.senderId,
                    });
                  }}
                  onForward={(targetMsg) => {
                    setSelectedMessageForForward(targetMsg);
                    setForwardModalOpen(true);
                  }}
                  onReact={onReactToMessage}
                  onEdit={onEditMessage}
                  onUnsend={onUnsendMessage}
                  onDeleteForMe={onDeleteForMeMessage}
                  onReport={(targetMsg) => {
                    setSelectedMessageForReport(targetMsg);
                    setReportModalOpen(true);
                  }}
                  onScrollToMessage={handleScrollToMessage}
                />
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Optional Contextual Info Panel (Desktop static column / Mobile & Tablet overlay drawer) */}
        {infoOpen && otherUser && (
          <>
            <div
              className="lg:hidden fixed inset-0 z-30 bg-black/40 backdrop-blur-xs"
              onClick={() => setInfoOpen(false)}
            />
            <div className="fixed inset-y-0 right-0 z-40 w-72 lg:static lg:w-72 shrink-0 border-l border-[#E5E5EB] dark:border-[#22222A] bg-white dark:bg-[#121217] p-5 overflow-y-auto animate-in slide-in-from-right duration-200 shadow-2xl lg:shadow-none">
            <div className="text-center">
              <div className="mx-auto mb-3 flex justify-center">
                <UserAvatar user={{ displayName: otherName, photoURL: otherAvatar, isOnline: presenceStatus.isOnline, showOnlineStatus: otherUser?.showOnlineStatus ?? true }} size="xl" />
              </div>
              <h4 className="font-semibold text-sm text-[#202020] dark:text-[#F4F4F6]">
                {otherName}
              </h4>
              <p className="text-xs text-[#6E6E77] dark:text-[#9E9EA8] mb-3">
                @{otherUser.username}
              </p>
              {otherUser.bio && (
                <p className="text-xs text-[#444] dark:text-[#AAA] leading-relaxed mb-4 p-2.5 rounded-xl bg-[#F8F8FA] dark:bg-[#1A1A24]">
                  "{otherUser.bio}"
                </p>
              )}
            </div>

            <div className="space-y-3 pt-3 border-t border-[#E5E5EB] dark:border-[#22222A] text-xs">
              <div className="flex justify-between text-[#6E6E77] dark:text-[#9E9EA8]">
                <span>Status</span>
                <span className="font-medium text-[#202020] dark:text-white">
                  {presenceStatus.text || 'Offline'}
                </span>
              </div>
              <div className="flex justify-between text-[#6E6E77] dark:text-[#9E9EA8]">
                <span>Friendship</span>
                <span className="font-medium text-emerald-600 dark:text-emerald-400">
                  {isFriend ? 'Accepted Friends' : 'Pending Request'}
                </span>
              </div>
            </div>

            {onEditNickname && (
              <button
                type="button"
                onClick={onEditNickname}
                className="w-full mt-4 py-2 px-3 rounded-xl border border-[#DDDDE3] dark:border-[#2A2A34] text-xs font-semibold hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5"
              >
                <Edit3 className="w-3.5 h-3.5 text-[#E43136]" />
                <span>{partnerNickname ? 'Change Nickname' : 'Set Contact Nickname'}</span>
              </button>
            )}

            {onDeleteChat && (
              <button
                type="button"
                onClick={onDeleteChat}
                className="w-full mt-2 py-2 px-3 rounded-xl border border-red-200 dark:border-red-900/40 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Conversation</span>
              </button>
            )}
          </div>
          </>
        )}
      </div>

      {/* Permission Check Banner & Fixed Message Composer */}
      {!isFriend ? (
        <div className="p-4 bg-[#FFF5F5] dark:bg-[#1F1214] border-t border-[#E43136]/30 text-center">
          <div className="flex items-center justify-center gap-2 text-xs font-semibold text-[#E43136] mb-1.5">
            <Lock className="w-4 h-4" />
            <span>Private Messaging is Restricted to Accepted Friends</span>
          </div>
          <p className="text-[11px] text-[#6E6E77] dark:text-[#9E9EA8] max-w-md mx-auto mb-3">
            To protect reader privacy, conversations require an accepted friendship.
          </p>

          {friendship?.status === 'pending' && friendship.receiverId === currentUserId ? (
            <button
              onClick={() => onAcceptFriendRequest(friendship.id)}
              className="px-4 py-1.5 rounded-xl text-xs font-semibold text-white bg-[#E43136] hover:bg-[#D92D32] transition-colors shadow-xs cursor-pointer"
            >
              Accept Friend Request
            </button>
          ) : friendship?.status === 'pending' && friendship.requesterId === currentUserId ? (
            <div className="flex flex-col items-center gap-2">
              <span className="text-xs font-medium text-[#6E6E77] dark:text-[#9E9EA8]">
                Friend request sent. Waiting for {otherName} to accept.
              </span>
              <button
                onClick={() => onAcceptFriendRequest(friendship.id)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white bg-[#198754] hover:bg-[#157347] transition-colors shadow-xs cursor-pointer"
              >
                Accept & Connect (Instant)
              </button>
            </div>
          ) : otherUser ? (
            <button
              onClick={() => onSendFriendRequest(otherUser)}
              className="px-4 py-1.5 rounded-xl text-xs font-semibold text-white bg-[#E43136] hover:bg-[#D92D32] transition-colors shadow-xs cursor-pointer inline-flex items-center gap-1.5"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Send Friend Request to Chat</span>
            </button>
          ) : null}
        </div>
      ) : (
        <ChatComposer
          onSendMessage={onSendMessage}
          replyingTo={replyingTo}
          onCancelReply={() => setReplyingTo(null)}
          onDropReply={(reply: ChatMessageReply) => setReplyingTo(reply)}
          allBooks={allBooks}
          textScale={chatTextScale}
        />
      )}

      {/* Modals */}
      <ChatSizeModal
        isOpen={sizeModalOpen}
        onClose={() => setSizeModalOpen(false)}
        textScale={chatTextScale}
        density={bubbleDensity}
        onUpdateTextScale={handleUpdateTextScale}
        onUpdateDensity={handleUpdateDensity}
        onReset={handleResetSize}
      />

      <ChatWallpaperModal
        isOpen={wallpaperModalOpen}
        onClose={() => setWallpaperModalOpen(false)}
        currentWallpaper={wallpaper}
        onSelectWallpaper={handleSelectWallpaper}
      />

      <ForwardModal
        isOpen={forwardModalOpen}
        onClose={() => {
          setForwardModalOpen(false);
          setSelectedMessageForForward(null);
        }}
        messageText={selectedMessageForForward?.text || 'Book Attachment'}
        friends={allFriends}
        onForward={async (recipientUids) => {
          if (!selectedMessageForForward) return;
          await onForwardMessage(selectedMessageForForward.text, recipientUids);
        }}
      />

      <ReportModal
        isOpen={reportModalOpen}
        onClose={() => {
          setReportModalOpen(false);
          setSelectedMessageForReport(null);
        }}
        targetType="message"
        targetId={selectedMessageForReport?.id || ''}
        targetTitle={`Message from ${otherName}`}
        onSubmitReport={async (reason, details) => {
          if (!selectedMessageForReport) return;
          await onSubmitReport(reason, details, selectedMessageForReport.id);
        }}
      />
    </div>
  );
};
