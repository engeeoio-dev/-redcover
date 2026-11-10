import React, { useState, useMemo } from 'react';
import {
  Users,
  UserCheck,
  UserPlus,
  Clock,
  Search,
  MessageSquare,
  UserMinus,
  Check,
  X,
  Sparkles,
  BookOpen,
} from 'lucide-react';
import { UserProfile, Friendship, Book } from '../../models/types';
import { UserAvatar } from '../common/UIPrimitives';
import { generateFriendSuggestions, computeMutualFriends } from '../../services/social/discoveryService';
import { isSystemAccount } from '../../models/types';

interface SocialHubTabProps {
  currentUserId: string;
  currentUser: UserProfile;
  allUsers: UserProfile[];
  friendships: Friendship[];
  allBooks: Book[];
  onSendFriendRequest: (targetUser: UserProfile) => Promise<void>;
  onAcceptFriendRequest: (friendshipId: string) => Promise<void>;
  onDeclineFriendRequest: (friendshipId: string) => Promise<void>;
  onCancelFriendRequest: (friendshipId: string) => Promise<void>;
  onRemoveFriendship: (friendshipId: string) => Promise<void>;
  onStartChat: (targetUser: UserProfile) => void;
}

export const SocialHubTab: React.FC<SocialHubTabProps> = ({
  currentUserId,
  currentUser,
  allUsers,
  friendships,
  allBooks,
  onSendFriendRequest,
  onAcceptFriendRequest,
  onDeclineFriendRequest,
  onCancelFriendRequest,
  onRemoveFriendship,
  onStartChat,
}) => {
  const [subTab, setSubTab] = useState<'friends' | 'requests' | 'suggestions' | 'search'>('friends');
  const [searchQuery, setSearchQuery] = useState('');

  const userMap = useMemo(() => {
    const map = new Map<string, UserProfile>();
    allUsers.forEach((u) => map.set(u.uid, u));
    return map;
  }, [allUsers]);

  // Index accepted friendships
  const { acceptedFriends, incomingRequests, outgoingRequests } = useMemo(() => {
    const friends: { user: UserProfile; friendship: Friendship }[] = [];
    const incoming: { user: UserProfile; friendship: Friendship }[] = [];
    const outgoing: { user: UserProfile; friendship: Friendship }[] = [];

    friendships.forEach((f) => {
      if (f.status === 'accepted') {
        const otherUid = f.requesterId === currentUserId ? f.receiverId : f.requesterId;
        const u = userMap.get(otherUid);
        if (u) friends.push({ user: u, friendship: f });
      } else if (f.status === 'pending') {
        if (f.receiverId === currentUserId) {
          const u = userMap.get(f.requesterId);
          if (u) incoming.push({ user: u, friendship: f });
        } else if (f.requesterId === currentUserId) {
          const u = userMap.get(f.receiverId);
          if (u) outgoing.push({ user: u, friendship: f });
        }
      }
    });

    return {
      acceptedFriends: friends,
      incomingRequests: incoming,
      outgoingRequests: outgoing,
    };
  }, [friendships, currentUserId, userMap]);

  // Generate friend suggestions based on social graph
  const suggestions = useMemo(() => {
    return generateFriendSuggestions(
      currentUserId,
      allUsers,
      friendships,
      allBooks,
      ['Fiction', 'Self Help', 'Finance', 'Business']
    );
  }, [currentUserId, allUsers, friendships, allBooks]);

  // Public search excluding system account and self
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return allUsers.filter(
      (u) =>
        u.uid !== currentUserId &&
        !isSystemAccount(u.uid) &&
        !isSystemAccount(u.username) &&
        (u.displayName.toLowerCase().includes(q) || u.username.toLowerCase().includes(q))
    );
  }, [allUsers, searchQuery, currentUserId]);

  const getRelationshipStatus = (targetUid: string) => {
    const f = friendships.find(
      (rel) =>
        (rel.requesterId === currentUserId && rel.receiverId === targetUid) ||
        (rel.receiverId === currentUserId && rel.requesterId === targetUid)
    );
    return f?.status || 'none';
  };

  return (
    <div className="h-full flex flex-col bg-[#FAFAFB] dark:bg-[#0E0E12] overflow-y-auto">
      {/* Sub-navigation Header */}
      <div className="p-4 bg-white dark:bg-[#121217] border-b border-[#E5E5EB] dark:border-[#22222A] shrink-0">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[#202020] dark:text-[#F4F4F6] flex items-center gap-2">
              <Users className="w-5 h-5 text-[#E43136]" />
              <span>Social Discovery & Friends</span>
            </h2>
            <p className="text-xs text-[#6E6E77] dark:text-[#9E9EA8]">
              Connect with fellow readers, explore mutual friendships, and read together.
            </p>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto">
            {[
              { id: 'friends', label: `Friends (${acceptedFriends.length})` },
              {
                id: 'requests',
                label: `Requests ${
                  incomingRequests.length > 0 ? `(${incomingRequests.length})` : ''
                }`,
              },
              { id: 'suggestions', label: 'Suggestions' },
              { id: 'search', label: 'Search Users' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSubTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  subTab === tab.id
                    ? 'bg-[#E43136] text-white shadow-2xs'
                    : 'bg-[#F4F4F6] dark:bg-[#1B1B22] text-[#6E6E77] dark:text-[#9E9EA8] hover:text-[#202020] dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-4xl mx-auto w-full p-4 sm:p-6 flex-1">
        {/* TAB 1: FRIENDS LIST */}
        {subTab === 'friends' && (
          <div>
            {acceptedFriends.length === 0 ? (
              <div className="text-center py-16 bg-white dark:bg-[#121217] rounded-2xl border border-[#E5E5EB] dark:border-[#22222A] p-6">
                <UserPlus className="w-10 h-10 text-[#E43136] mx-auto mb-2 opacity-80" />
                <h3 className="font-semibold text-sm text-[#202020] dark:text-white mb-1">
                  No friends yet
                </h3>
                <p className="text-xs text-[#6E6E77] dark:text-[#9E9EA8] max-w-sm mx-auto mb-4">
                  Check out friend suggestions or search for readers to share books and start private discussions!
                </p>
                <button
                  onClick={() => setSubTab('suggestions')}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#E43136] hover:bg-[#D92D32] transition-colors cursor-pointer"
                >
                  Explore Friend Suggestions
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {acceptedFriends.map(({ user, friendship }) => (
                  <div
                    key={user.uid}
                    className="p-4 rounded-2xl bg-white dark:bg-[#121217] border border-[#E5E5EB] dark:border-[#22222A] flex items-center justify-between gap-3 shadow-2xs hover:shadow-xs transition-shadow"
                  >
                    <div
                      onClick={() => onStartChat(user)}
                      className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                    >
                      <div className="relative">
                        <UserAvatar photoURL={user.photoURL} name={user.displayName} size="md" />
                        {user.isOnline && (
                          <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#121217]" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs sm:text-sm font-semibold text-[#202020] dark:text-[#F4F4F6] truncate">
                          {user.displayName}
                        </h4>
                        <p className="text-[11px] text-[#6E6E77] dark:text-[#9E9EA8] truncate">
                          @{user.username}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => onStartChat(user)}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#FFF3F4] text-[#E43136] dark:bg-[#E43136]/15 hover:bg-[#E43136] hover:text-white transition-colors cursor-pointer inline-flex items-center gap-1"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Chat</span>
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveFriendship(friendship.id);
                        }}
                        className="p-2 rounded-xl text-[#8E8E98] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors cursor-pointer"
                        title="Remove Friend"
                      >
                        <UserMinus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: REQUESTS (INCOMING & OUTGOING) */}
        {subTab === 'requests' && (
          <div className="space-y-6">
            {/* Incoming Requests */}
            <div>
              <h3 className="text-xs font-bold text-[#6E6E77] dark:text-[#9E9EA8] uppercase tracking-wider mb-3">
                Received Requests ({incomingRequests.length})
              </h3>
              {incomingRequests.length === 0 ? (
                <div className="p-6 text-center bg-white dark:bg-[#121217] rounded-2xl border border-[#E5E5EB] dark:border-[#22222A] text-xs text-[#8E8E98]">
                  No pending received requests.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {incomingRequests.map(({ user, friendship }) => (
                    <div
                      key={friendship.id}
                      className="p-4 rounded-2xl bg-white dark:bg-[#121217] border border-[#E5E5EB] dark:border-[#22222A] flex items-center justify-between gap-3 shadow-2xs"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <UserAvatar photoURL={user.photoURL} name={user.displayName} size="md" />
                        <div className="min-w-0">
                          <h4 className="text-xs sm:text-sm font-semibold text-[#202020] dark:text-white truncate">
                            {user.displayName}
                          </h4>
                          <p className="text-[11px] text-[#8E8E98] truncate">
                            @{user.username}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => onAcceptFriendRequest(friendship.id)}
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white bg-[#E43136] hover:bg-[#D92D32] transition-colors cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Accept</span>
                        </button>
                        <button
                          onClick={() => onDeclineFriendRequest(friendship.id)}
                          className="p-2 rounded-xl text-[#8E8E98] hover:text-[#202020] dark:hover:text-white hover:bg-[#F4F4F6] dark:hover:bg-[#1C1C24] transition-colors cursor-pointer"
                          title="Decline Request"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Outgoing Requests */}
            <div>
              <h3 className="text-xs font-bold text-[#6E6E77] dark:text-[#9E9EA8] uppercase tracking-wider mb-3">
                Sent Requests ({outgoingRequests.length})
              </h3>
              {outgoingRequests.length === 0 ? (
                <div className="p-6 text-center bg-white dark:bg-[#121217] rounded-2xl border border-[#E5E5EB] dark:border-[#22222A] text-xs text-[#8E8E98]">
                  No pending sent requests.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {outgoingRequests.map(({ user, friendship }) => (
                    <div
                      key={friendship.id}
                      className="p-4 rounded-2xl bg-white dark:bg-[#121217] border border-[#E5E5EB] dark:border-[#22222A] flex items-center justify-between gap-3 shadow-2xs"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <UserAvatar photoURL={user.photoURL} name={user.displayName} size="md" />
                        <div className="min-w-0">
                          <h4 className="text-xs sm:text-sm font-semibold text-[#202020] dark:text-white truncate">
                            {user.displayName}
                          </h4>
                          <p className="text-[11px] text-[#8E8E98] truncate">
                            Pending confirmation...
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => onCancelFriendRequest(friendship.id)}
                        className="px-3 py-1.5 rounded-xl text-xs font-medium text-[#8E8E98] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: SUGGESTED USERS & MUTUAL FRIENDS */}
        {subTab === 'suggestions' && (
          <div>
            <div className="mb-4">
              <h3 className="text-xs font-bold text-[#6E6E77] dark:text-[#9E9EA8] uppercase tracking-wider">
                People You May Know
              </h3>
              <p className="text-xs text-[#8E8E98]">
                Recommended based on mutual friends, reading tastes, and active literary discussions.
              </p>
            </div>

            {suggestions.length === 0 ? (
              <div className="text-center py-16 bg-white dark:bg-[#121217] rounded-2xl border border-[#E5E5EB] dark:border-[#22222A] text-xs text-[#8E8E98]">
                No new suggestions at this time.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {suggestions.map((item) => (
                  <div
                    key={item.user.uid}
                    className="p-4 rounded-2xl bg-white dark:bg-[#121217] border border-[#E5E5EB] dark:border-[#22222A] flex items-center justify-between gap-3 shadow-2xs hover:border-[#E43136]/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <UserAvatar photoURL={item.user.photoURL} name={item.user.displayName} size="md" />
                      <div className="min-w-0">
                        <h4 className="text-xs sm:text-sm font-semibold text-[#202020] dark:text-white truncate">
                          {item.user.displayName}
                        </h4>
                        <div className="flex items-center gap-1.5 text-[11px] text-[#E43136] font-medium">
                          <Sparkles className="w-3 h-3" />
                          <span>{item.reason}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => onSendFriendRequest(item.user)}
                      className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white bg-[#E43136] hover:bg-[#D92D32] transition-colors cursor-pointer inline-flex items-center gap-1 shadow-2xs shrink-0"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Add Friend</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: SEARCH USERS */}
        {subTab === 'search' && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9E9EA8]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search readers by name or @username..."
                className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm rounded-2xl bg-white dark:bg-[#161620] border border-[#DDDDE3] dark:border-[#2A2A38] text-[#202020] dark:text-[#F4F4F6] focus:ring-2 focus:ring-[#E43136] outline-none shadow-2xs"
                autoFocus
              />
            </div>

            {searchQuery.trim() === '' ? (
              <div className="text-center py-12 text-xs text-[#8E8E98]">
                Type in the search bar above to discover readers and authors.
              </div>
            ) : searchResults.length === 0 ? (
              <div className="text-center py-12 text-xs text-[#8E8E98]">
                No users found matching "{searchQuery}".
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {searchResults.map((user) => {
                  const status = getRelationshipStatus(user.uid);
                  const { count: mutualCount } = computeMutualFriends(
                    currentUserId,
                    user.uid,
                    friendships,
                    allUsers
                  );

                  return (
                    <div
                      key={user.uid}
                      className="p-4 rounded-2xl bg-white dark:bg-[#121217] border border-[#E5E5EB] dark:border-[#22222A] flex items-center justify-between gap-3 shadow-2xs"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <UserAvatar photoURL={user.photoURL} name={user.displayName} size="md" />
                        <div className="min-w-0">
                          <h4 className="text-xs sm:text-sm font-semibold text-[#202020] dark:text-white truncate">
                            {user.displayName}
                          </h4>
                          <p className="text-[11px] text-[#8E8E98] truncate">
                            @{user.username}
                          </p>
                          {mutualCount > 0 && (
                            <p className="text-[10px] text-[#E43136] font-medium">
                              {mutualCount} mutual friend{mutualCount > 1 ? 's' : ''}
                            </p>
                          )}
                        </div>
                      </div>

                      <div>
                        {status === 'accepted' ? (
                          <button
                            onClick={() => onStartChat(user)}
                            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#FFF3F4] text-[#E43136] dark:bg-[#E43136]/15 hover:bg-[#E43136] hover:text-white transition-colors cursor-pointer inline-flex items-center gap-1"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>Chat</span>
                          </button>
                        ) : status === 'pending' ? (
                          <span className="text-xs text-[#8E8E98] font-medium px-2 py-1 bg-black/5 dark:bg-white/5 rounded-lg">
                            Request Pending
                          </span>
                        ) : (
                          <button
                            onClick={() => onSendFriendRequest(user)}
                            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white bg-[#E43136] hover:bg-[#D92D32] transition-colors cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            <span>Add Friend</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
