import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Users,
  Info,
  UserPlus,
  Shield,
  LogOut,
  X,
  Trash2,
  Crown,
  BookMarked,
  MessageSquare,
  CornerDownRight,
  Reply,
  Smile,
  Sparkles,
} from 'lucide-react';
import {
  Group,
  GroupMessage,
  UserProfile,
  Book,
  ChatMessageReply,
} from '../../models/types';
import { UserAvatar } from '../common/UIPrimitives';
import { RedCodeCard } from '../books/RedCodeCard';
import { detectRedCodeInText, findBookByRedCode } from '../../services/firebase/redCodeService';
import { ChatComposer } from '../chat/ChatComposer';
import { ForwardModal } from '../chat/ForwardModal';
import { ReportModal } from '../chat/ReportModal';

const GROUP_QUICK_REACTIONS = ['❤️', '🔥', '😂', '👏', '🤯', '💯'];

interface GroupChatViewProps {
  group: Group;
  messages: GroupMessage[];
  currentUserId: string;
  allUsers: UserProfile[];
  allBooks: Book[];
  allFriends: UserProfile[];
  onBack?: () => void;
  onSendMessage: (text: string, options?: any) => Promise<void>;
  onReactToMessage?: (groupId: string, messageId: string, emoji: string) => Promise<void>;
  onInviteMember: (targetUser: UserProfile) => Promise<void>;
  onRemoveMember: (memberId: string) => Promise<void>;
  onLeaveGroup: () => Promise<void>;
  onForwardMessage: (messageText: string, recipientUids: string[]) => Promise<void>;
  onSubmitReport: (reason: string, details: string, targetId: string) => Promise<void>;
}

export const GroupChatView: React.FC<GroupChatViewProps> = ({
  group,
  messages,
  currentUserId,
  allUsers,
  allBooks,
  allFriends,
  onBack,
  onSendMessage,
  onReactToMessage,
  onInviteMember,
  onRemoveMember,
  onLeaveGroup,
  onForwardMessage,
  onSubmitReport,
}) => {
  const [infoOpen, setInfoOpen] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteSearch, setInviteSearch] = useState('');
  const [replyingTo, setReplyingTo] = useState<ChatMessageReply | null>(null);
  const [forwardModalOpen, setForwardModalOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [selectedMessageForForward, setSelectedMessageForForward] = useState<GroupMessage | null>(null);
  const [selectedMessageForReport, setSelectedMessageForReport] = useState<GroupMessage | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, group.id]);

  const isAdmin = group.admins.includes(currentUserId) || group.creatorId === currentUserId;
  const isMember = group.members.includes(currentUserId);

  const userMap = new Map<string, UserProfile>();
  allUsers.forEach((u) => userMap.set(u.uid, u));

  const activeMembers = group.members.map((uid) => userMap.get(uid)).filter(Boolean) as UserProfile[];
  const pendingInvitees = group.pendingInvitees.map((uid) => userMap.get(uid)).filter(Boolean) as UserProfile[];

  const nonMemberCandidates = allUsers.filter(
    (u) =>
      !group.members.includes(u.uid) &&
      !group.pendingInvitees.includes(u.uid) &&
      (u.displayName.toLowerCase().includes(inviteSearch.toLowerCase()) ||
        u.username.toLowerCase().includes(inviteSearch.toLowerCase()))
  );

  return (
    <div className="flex-1 h-full flex flex-col relative overflow-hidden bg-[#FAFAFB] dark:bg-[#0E0E12]">
      {/* Group Header */}
      <div className="h-14 shrink-0 px-4 border-b border-[#E5E5EB] dark:border-[#22222A] bg-white/90 dark:bg-[#121217]/90 backdrop-blur-md flex items-center justify-between z-20">
        <div className="flex items-center gap-3 min-w-0">
          {onBack && (
            <button
              onClick={onBack}
              className="md:hidden p-1.5 -ml-1.5 rounded-lg text-[#6E6E77] hover:text-[#202020] dark:hover:text-white cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          <div className="w-10 h-10 rounded-xl bg-[#E43136]/10 text-[#E43136] flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden shadow-2xs">
            {group.avatarURL ? (
              <img src={group.avatarURL} alt={group.name} className="w-full h-full object-cover" />
            ) : (
              <Users className="w-5 h-5" />
            )}
          </div>

          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-[#202020] dark:text-[#F4F4F6] truncate">
              {group.name}
            </h3>
            <p className="text-[11px] text-[#6E6E77] dark:text-[#9E9EA8] truncate">
              {group.members.length} member{group.members.length === 1 ? '' : 's'}
              {group.pendingInvitees.length > 0 && ` • ${group.pendingInvitees.length} pending`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {isAdmin && (
            <button
              onClick={() => setShowInviteModal(true)}
              className="px-2.5 py-1.5 rounded-xl bg-[#FFF3F4] text-[#E43136] dark:bg-[#E43136]/15 hover:bg-[#E43136] hover:text-white text-xs font-semibold transition-colors cursor-pointer inline-flex items-center gap-1"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Invite</span>
            </button>
          )}

          <button
            onClick={() => setInfoOpen(!infoOpen)}
            className={`p-2 rounded-xl transition-colors cursor-pointer ${
              infoOpen
                ? 'bg-[#FFF3F4] text-[#E43136] dark:bg-[#E43136]/15'
                : 'text-[#6E6E77] hover:text-[#202020] dark:hover:text-white hover:bg-[#F1F1F4] dark:hover:bg-[#1C1C24]'
            }`}
            title="Group Info"
          >
            <Info className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Body */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Messages Stream */}
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col justify-between">
          <div className="space-y-3">
            {/* Fun Group Reading Spotlight & Discussion Starters */}
            <div className="mb-3 px-3 py-2 rounded-xl bg-gradient-to-r from-[#FFF3F4] to-[#FFF8F8] dark:from-[#E43136]/10 dark:to-[#1A1A24] border border-[#E43136]/20 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
              <div className="flex items-center gap-2 text-xs">
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#E43136] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#E43136]"></span>
                </span>
                <span className="font-bold text-[#E43136]">Book Club Hub</span>
                <span className="text-[#6E6E77] dark:text-[#9E9EA8] hidden sm:inline">• Share opinions & connect with readers</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => onSendMessage('📚 What book is everyone reading this week?')}
                  className="px-2.5 py-1 rounded-lg bg-white dark:bg-[#20202A] text-[11px] font-medium text-[#202020] dark:text-white hover:text-[#E43136] shadow-2xs transition-colors cursor-pointer"
                >
                  📖 Current Reads?
                </button>
                <button
                  type="button"
                  onClick={() => onSendMessage('⭐ Drop your top book recommendation!')}
                  className="px-2.5 py-1 rounded-lg bg-white dark:bg-[#20202A] text-[11px] font-medium text-[#202020] dark:text-white hover:text-[#E43136] shadow-2xs transition-colors cursor-pointer"
                >
                  ⭐ Recommendations
                </button>
              </div>
            </div>

            {messages.length === 0 ? (
              <div className="text-center py-16 text-xs text-[#8E8E98]">
                <Users className="w-10 h-10 text-[#E43136] mx-auto mb-2 opacity-80" />
                <p className="font-semibold text-sm text-[#202020] dark:text-white mb-1">
                  Welcome to {group.name}!
                </p>
                <p>Send messages, share book recommendations, and discuss stories together.</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isOwn = msg.senderId === currentUserId;
                const detectedCode = !msg.bookAttachment ? detectRedCodeInText(msg.text) : null;
                const detectedBook = detectedCode ? findBookByRedCode(detectedCode, allBooks) : undefined;

                return (
                  <div
                    key={msg.id}
                    className={`group/gmsg relative flex gap-2.5 ${isOwn ? 'justify-end' : 'justify-start'}`}
                  >
                    {!isOwn && (
                      <UserAvatar
                        photoURL={msg.senderAvatar}
                        name={msg.senderName}
                        size="sm"
                        className="mt-1 shrink-0"
                      />
                    )}

                    <div className={`max-w-[85vw] sm:max-w-md ${isOwn ? 'items-end' : 'items-start'}`}>
                      {!isOwn && (
                        <div className="text-[11px] font-semibold text-[#6E6E77] dark:text-[#9E9EA8] mb-0.5 ml-1 flex items-center gap-1.5">
                          <span>{msg.senderName}</span>
                          {group.creatorId === msg.senderId && (
                            <span className="text-[9px] px-1 py-0.2 rounded font-bold bg-[#E43136]/15 text-[#E43136]">
                              Admin
                            </span>
                          )}
                        </div>
                      )}

                      <div className="relative group">
                        <div
                          className={`p-3 rounded-2xl relative shadow-2xs ${
                            isOwn
                              ? 'bg-[#E43136] text-white rounded-tr-xs'
                              : 'bg-white dark:bg-[#1A1A22] text-[#202020] dark:text-[#F4F4F6] border border-[#E5E5EB] dark:border-[#282834] rounded-tl-xs'
                          }`}
                        >
                          {/* Quoted Reply Box */}
                          {msg.replyTo && (
                            <div
                              className={`flex items-start gap-1.5 mb-2 px-2.5 py-1 rounded-xl text-xs border-l-2 ${
                                isOwn
                                  ? 'bg-black/15 text-white/90 border-white'
                                  : 'bg-black/5 dark:bg-white/5 border-[#E43136] text-[#202020] dark:text-white'
                              }`}
                            >
                              <CornerDownRight className="w-3 h-3 text-[#E43136] shrink-0 mt-0.5" />
                              <div className="truncate text-left">
                                <span className="font-semibold block text-[10px] text-[#E43136]">
                                  {msg.replyTo.senderName}
                                </span>
                                <span className="text-xs truncate block opacity-85">
                                  {msg.replyTo.text}
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Message text */}
                          {msg.text && (
                            <p className="text-xs sm:text-sm whitespace-pre-wrap break-words leading-relaxed">
                              {msg.text}
                            </p>
                          )}

                          {/* Book attachment */}
                          {msg.bookAttachment && (
                            <div className="mt-2">
                              <RedCodeCard
                                bookId={msg.bookAttachment.id || msg.bookAttachment.bookId || ''}
                                title={msg.bookAttachment.title}
                                author={msg.bookAttachment.author || msg.bookAttachment.authorName || 'Author'}
                                coverURL={msg.bookAttachment.coverURL}
                                description={msg.bookAttachment.description}
                                redCode={msg.bookAttachment.redCode}
                                compact
                              />
                            </div>
                          )}

                          {/* Detected RedCode Card */}
                          {detectedBook && !msg.bookAttachment && (
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
                            </div>
                          )}

                          <div
                            className={`text-[10px] text-right mt-1 ${
                              isOwn ? 'text-white/75' : 'text-[#8E8E98]'
                            }`}
                          >
                            {new Date(msg.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                        </div>

                        {/* Floating Quick Action Bar (Hover on Desktop) */}
                        <div
                          className={`absolute top-0 -translate-y-1/2 opacity-0 group-hover/gmsg:opacity-100 transition-opacity flex items-center gap-1 px-2 py-1 rounded-full bg-white dark:bg-[#1E1E28] shadow-lg border border-[#E5E5EB] dark:border-[#2E2E3C] z-10 ${
                            isOwn ? 'right-0 -translate-x-2' : 'left-0 translate-x-2'
                          }`}
                        >
                          {/* Quick Emoji Reaction buttons */}
                          {GROUP_QUICK_REACTIONS.slice(0, 4).map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => onReactToMessage?.(group.id, msg.id, emoji)}
                              className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-xs transition-transform hover:scale-130 active:scale-95 cursor-pointer"
                              title={`React with ${emoji}`}
                            >
                              {emoji}
                            </button>
                          ))}

                          <div className="h-3 w-px bg-[#E5E5EB] dark:bg-[#2A2A36] mx-0.5" />

                          {/* Reply Button */}
                          <button
                            type="button"
                            onClick={() => {
                              setReplyingTo({
                                id: msg.id,
                                text: msg.text || 'Shared Book',
                                senderName: msg.senderName,
                                senderId: msg.senderId,
                              });
                            }}
                            title="Reply to message"
                            className="p-1 rounded-full text-[#6E6E77] hover:text-[#202020] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
                          >
                            <Reply className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Reaction Pills below Bubble */}
                      {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                        <div className={`flex flex-wrap gap-1 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                          {Object.entries(msg.reactions).map(([emoji, uids]) => {
                            if (!Array.isArray(uids) || uids.length === 0) return null;
                            const hasReacted = uids.includes(currentUserId);
                            return (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => onReactToMessage?.(group.id, msg.id, emoji)}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-transform hover:scale-105 active:scale-95 cursor-pointer shadow-xs ${
                                  hasReacted
                                    ? 'bg-[#E43136]/15 border border-[#E43136]/40 text-[#E43136] font-bold'
                                    : 'bg-white dark:bg-[#1E1E28] border border-[#E5E5EB] dark:border-[#2A2A36] text-[#202020] dark:text-[#F4F4F6]'
                                }`}
                              >
                                <span>{emoji}</span>
                                <span className="text-[10px] font-semibold">{uids.length}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Group Info Drawer */}
        {infoOpen && (
          <div className="w-80 shrink-0 border-l border-[#E5E5EB] dark:border-[#22222A] bg-white dark:bg-[#121217] p-5 overflow-y-auto animate-in slide-in-from-right duration-200">
            <div className="text-center pb-4 border-b border-[#E5E5EB] dark:border-[#22222A]">
              <div className="w-20 h-20 rounded-2xl bg-[#E43136]/10 text-[#E43136] flex items-center justify-center font-bold text-xl mx-auto mb-3 overflow-hidden shadow-sm">
                {group.avatarURL ? (
                  <img src={group.avatarURL} alt={group.name} className="w-full h-full object-cover" />
                ) : (
                  <Users className="w-10 h-10" />
                )}
              </div>
              <h4 className="font-bold text-base text-[#202020] dark:text-white">
                {group.name}
              </h4>
              {group.description && (
                <p className="text-xs text-[#6E6E77] dark:text-[#9E9EA8] mt-1 leading-relaxed">
                  {group.description}
                </p>
              )}
            </div>

            {/* Members Section */}
            <div className="py-4 border-b border-[#E5E5EB] dark:border-[#22222A]">
              <div className="flex items-center justify-between mb-3">
                <h5 className="text-xs font-bold text-[#6E6E77] dark:text-[#9E9EA8] uppercase tracking-wider">
                  Active Members ({activeMembers.length})
                </h5>
                {isAdmin && (
                  <button
                    onClick={() => setShowInviteModal(true)}
                    className="text-xs text-[#E43136] font-semibold hover:underline"
                  >
                    + Invite
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {activeMembers.map((m) => {
                  const isCreator = m.uid === group.creatorId;
                  const isGroupAdmin = group.admins.includes(m.uid);
                  return (
                    <div key={m.uid} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <UserAvatar photoURL={m.photoURL} name={m.displayName} size="sm" />
                        <div className="truncate">
                          <div className="font-semibold text-[#202020] dark:text-white truncate">
                            {m.displayName}
                          </div>
                          <div className="text-[10px] text-[#8E8E98]">@{m.username}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {isCreator ? (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 inline-flex items-center gap-0.5">
                            <Crown className="w-3 h-3" />
                            Creator
                          </span>
                        ) : isGroupAdmin ? (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-blue-500/15 text-blue-600 dark:text-blue-400 inline-flex items-center gap-0.5">
                            <Shield className="w-3 h-3" />
                            Admin
                          </span>
                        ) : null}

                        {isAdmin && !isCreator && m.uid !== currentUserId && (
                          <button
                            onClick={() => onRemoveMember(m.uid)}
                            className="p-1 text-[#8E8E98] hover:text-red-500 cursor-pointer"
                            title="Remove Member"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Pending Invitees */}
            {pendingInvitees.length > 0 && (
              <div className="py-4 border-b border-[#E5E5EB] dark:border-[#22222A]">
                <h5 className="text-xs font-bold text-[#6E6E77] dark:text-[#9E9EA8] uppercase tracking-wider mb-2">
                  Pending Invitations ({pendingInvitees.length})
                </h5>
                <div className="space-y-1.5">
                  {pendingInvitees.map((p) => (
                    <div key={p.uid} className="flex items-center gap-2 text-xs opacity-70">
                      <UserAvatar photoURL={p.photoURL} name={p.displayName} size="sm" />
                      <span className="truncate">{p.displayName}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="pt-4 space-y-2">
              <button
                onClick={onLeaveGroup}
                className="w-full py-2 px-3 rounded-xl border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 text-xs font-semibold transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Leave Group</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Composer */}
      {isMember ? (
        <ChatComposer
          onSendMessage={onSendMessage}
          replyingTo={replyingTo}
          onCancelReply={() => setReplyingTo(null)}
          allBooks={allBooks}
        />
      ) : (
        <div className="p-3 text-center text-xs text-[#8E8E98] bg-[#F4F4F6] dark:bg-[#121217] border-t border-[#E5E5EB] dark:border-[#22222A]">
          You must be an accepted member of this group to send messages.
        </div>
      )}

      {/* Invite Member Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-white dark:bg-[#121217] rounded-2xl shadow-2xl border border-[#E5E5EB] dark:border-[#22222A] overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-4 border-b border-[#E5E5EB] dark:border-[#22222A] flex items-center justify-between">
              <h4 className="font-semibold text-sm text-[#202020] dark:text-white">
                Invite to {group.name}
              </h4>
              <button
                onClick={() => setShowInviteModal(false)}
                className="text-xs text-[#8E8E98]"
              >
                Close
              </button>
            </div>

            <div className="p-3 border-b border-[#E5E5EB] dark:border-[#22222A]">
              <input
                type="text"
                value={inviteSearch}
                onChange={(e) => setInviteSearch(e.target.value)}
                placeholder="Search readers to invite..."
                className="w-full px-3 py-1.5 text-xs rounded-xl bg-[#F4F4F6] dark:bg-[#1B1B22] outline-none"
              />
            </div>

            <div className="p-2 overflow-y-auto space-y-1 flex-1">
              {nonMemberCandidates.slice(0, 15).map((u) => (
                <div
                  key={u.uid}
                  className="flex items-center justify-between p-2.5 rounded-xl hover:bg-[#F4F4F6] dark:hover:bg-[#181820]"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <UserAvatar photoURL={u.photoURL} name={u.displayName} size="sm" />
                    <div className="truncate">
                      <div className="font-semibold text-xs text-[#202020] dark:text-white truncate">
                        {u.displayName}
                      </div>
                      <div className="text-[10px] text-[#8E8E98]">@{u.username}</div>
                    </div>
                  </div>

                  <button
                    onClick={async () => {
                      await onInviteMember(u);
                      setShowInviteModal(false);
                    }}
                    className="px-3 py-1 rounded-xl text-xs font-semibold text-white bg-[#E43136] hover:bg-[#D92D32] transition-colors cursor-pointer"
                  >
                    Invite
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
