import React, { useState, useMemo } from 'react';
import { Search, Plus, MessageSquare, CheckCheck, User, Users } from 'lucide-react';
import { Chat, UserProfile } from '../../models/types';
import { UserAvatar } from '../common/UIPrimitives';

interface ConversationListProps {
  chats: Chat[];
  selectedChatId: string | null;
  currentUserId: string;
  allUsers: UserProfile[];
  allFriends: UserProfile[];
  onSelectChat: (chatId: string) => void;
  onStartNewChatWithFriend: (friend: UserProfile) => void;
}

export const ConversationList: React.FC<ConversationListProps> = ({
  chats,
  selectedChatId,
  currentUserId,
  allUsers,
  allFriends,
  onSelectChat,
  onStartNewChatWithFriend,
}) => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread' | 'friends'>('all');
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [friendSearch, setFriendSearch] = useState('');

  const userMap = useMemo(() => {
    const map = new Map<string, UserProfile>();
    allUsers.forEach((u) => map.set(u.uid, u));
    return map;
  }, [allUsers]);

  const filteredChats = useMemo(() => {
    return chats.filter((chat) => {
      const isA = chat.participantA === currentUserId;
      const otherUid = isA ? chat.participantB : chat.participantA;
      const otherUser = userMap.get(otherUid);
      const otherName = (isA ? chat.participantBName : chat.participantAName) || otherUser?.displayName || 'Reader';

      // Text search
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matchesName = otherName.toLowerCase().includes(q);
        const matchesLastMsg = chat.lastMessage?.toLowerCase().includes(q);
        if (!matchesName && !matchesLastMsg) return false;
      }

      // Filter by unread
      if (filter === 'unread') {
        const unread = isA ? chat.unreadCountA : chat.unreadCountB;
        if (!unread || unread <= 0) return false;
      }

      // Filter by friends only
      if (filter === 'friends') {
        const isFriend = allFriends.some((f) => f.uid === otherUid);
        if (!isFriend) return false;
      }

      return true;
    });
  }, [chats, currentUserId, userMap, search, filter, allFriends]);

  const filteredFriendsToChat = useMemo(() => {
    const q = friendSearch.trim().toLowerCase();
    if (!q) return allFriends;
    return allFriends.filter(
      (f) =>
        f.displayName.toLowerCase().includes(q) ||
        f.username.toLowerCase().includes(q)
    );
  }, [allFriends, friendSearch]);

  const formatChatTime = (iso: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const now = new Date();
    const isSameDay =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();
    if (isSameDay) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-[#121217] border-r border-[#E5E5EB] dark:border-[#22222A]">
      {/* Header */}
      <div className="p-3.5 border-b border-[#E5E5EB] dark:border-[#22222A] flex items-center justify-between">
        <h2 className="font-semibold text-base text-[#202020] dark:text-[#F4F4F6] flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-[#E43136]" />
          <span>Messages</span>
        </h2>
        <button
          onClick={() => setShowNewChatModal(true)}
          className="p-1.5 rounded-lg bg-[#FFF3F4] text-[#E43136] dark:bg-[#E43136]/15 hover:bg-[#E43136] hover:text-white transition-colors cursor-pointer"
          title="New Message"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Search Input */}
      <div className="p-3 border-b border-[#E5E5EB] dark:border-[#22222A]">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#9E9EA8]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-[#F4F4F6] dark:bg-[#1B1B22] border-none text-[#202020] dark:text-[#F4F4F6] focus:ring-2 focus:ring-[#E43136] outline-none"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex gap-1.5 mt-2">
          {(['all', 'unread', 'friends'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3 py-1 rounded-lg text-[11px] font-medium capitalize transition-colors cursor-pointer ${
                filter === tab
                  ? 'bg-[#E43136] text-white shadow-2xs'
                  : 'bg-[#F4F4F6] dark:bg-[#1C1C24] text-[#6E6E77] dark:text-[#9E9EA8] hover:text-[#202020] dark:hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Conversations Stream */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#E5E5EB]/50 dark:divide-[#22222A]/50">
        {filteredChats.length === 0 ? (
          <div className="text-center py-12 px-4 text-xs text-[#8E8E98]">
            {chats.length === 0
              ? 'No conversations yet. Start a chat with one of your friends!'
              : 'No matching conversations found.'}
          </div>
        ) : (
          filteredChats.map((chat) => {
            const isA = chat.participantA === currentUserId;
            const otherUid = isA ? chat.participantB : chat.participantA;
            const otherUser = userMap.get(otherUid);
            const otherName = (isA ? chat.participantBName : chat.participantAName) || otherUser?.displayName || 'Reader';
            const otherAvatar = (isA ? chat.participantAAvatar : chat.participantBAvatar) || otherUser?.photoURL || '';
            const unread = isA ? chat.unreadCountA : chat.unreadCountB;
            const isSelected = chat.id === selectedChatId;

            return (
              <div
                key={chat.id}
                onClick={() => onSelectChat(chat.id)}
                className={`flex items-center gap-3 p-3.5 cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-[#FFF3F4] dark:bg-[#E43136]/10 border-l-3 border-[#E43136]'
                    : 'hover:bg-[#F9F9FB] dark:hover:bg-[#181820]'
                }`}
              >
                <div className="relative shrink-0">
                  <UserAvatar user={{ displayName: otherName, photoURL: otherAvatar, isOnline: otherUser?.isOnline, showOnlineStatus: otherUser?.showOnlineStatus ?? true }} size="md" />
                  {otherUser?.isOnline && (
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#121217]" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between mb-0.5">
                    <h4
                      className={`text-xs font-semibold truncate ${
                        isSelected
                          ? 'text-[#E43136]'
                          : 'text-[#202020] dark:text-[#F4F4F6]'
                      }`}
                    >
                      {otherName}
                    </h4>
                    <span className="text-[10px] text-[#8E8E98] shrink-0">
                      {formatChatTime(chat.updatedAt || chat.createdAt)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <p className="text-[11px] text-[#6E6E77] dark:text-[#9E9EA8] truncate pr-2">
                      {chat.lastMessage || 'No messages yet'}
                    </p>
                    {unread > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-[#E43136] text-white shrink-0">
                        {unread}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* New Chat Modal */}
      {showNewChatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-white dark:bg-[#121217] rounded-2xl shadow-2xl border border-[#E5E5EB] dark:border-[#22222A] overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-4 border-b border-[#E5E5EB] dark:border-[#22222A] flex items-center justify-between">
              <h3 className="font-semibold text-sm text-[#202020] dark:text-white">
                New Message
              </h3>
              <button
                onClick={() => setShowNewChatModal(false)}
                className="text-xs text-[#8E8E98] hover:text-[#202020] dark:hover:text-white"
              >
                Close
              </button>
            </div>

            <div className="p-3 border-b border-[#E5E5EB] dark:border-[#22222A]">
              <input
                type="text"
                value={friendSearch}
                onChange={(e) => setFriendSearch(e.target.value)}
                placeholder="Search friends..."
                className="w-full px-3 py-1.5 text-xs rounded-xl bg-[#F4F4F6] dark:bg-[#1B1B22] outline-none text-[#202020] dark:text-[#F4F4F6]"
                autoFocus
              />
            </div>

            <div className="p-2 overflow-y-auto space-y-1 flex-1">
              {filteredFriendsToChat.length === 0 ? (
                <div className="text-center py-8 text-xs text-[#8E8E98]">
                  {allFriends.length === 0
                    ? 'You have no accepted friends yet. Send friend requests in the Social tab to start messaging!'
                    : 'No friends matching your search.'}
                </div>
              ) : (
                filteredFriendsToChat.map((f) => (
                  <div
                    key={f.uid}
                    onClick={() => {
                      onStartNewChatWithFriend(f);
                      setShowNewChatModal(false);
                    }}
                    className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-[#F4F4F6] dark:hover:bg-[#181820] cursor-pointer"
                  >
                    <UserAvatar user={f} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-[#202020] dark:text-white truncate">
                        {f.displayName}
                      </div>
                      <div className="text-[11px] text-[#8E8E98] truncate">
                        @{f.username}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
