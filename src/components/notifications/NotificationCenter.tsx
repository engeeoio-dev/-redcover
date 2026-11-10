import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Heart,
  MessageSquare,
  UserPlus,
  UserCheck,
  BookOpen,
  Users,
  Sparkles,
  ShieldAlert,
  Check,
  X,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import { NotificationItem, UserProfile } from '../../models/types';
import { UserAvatar } from '../common/UIPrimitives';

interface NotificationCenterProps {
  notifications: NotificationItem[];
  isOpen: boolean;
  onClose: () => void;
  onMarkRead: (notificationId: string) => Promise<void>;
  onMarkAllRead: () => Promise<void>;
  onDeleteNotification: (notificationId: string) => Promise<void>;
  onAcceptFriendRequest?: (friendshipId: string) => Promise<void>;
  onDeclineFriendRequest?: (friendshipId: string) => Promise<void>;
  onAcceptGroupInvite?: (invitationId: string, groupId: string) => Promise<void>;
  onDeclineGroupInvite?: (invitationId: string, groupId: string) => Promise<void>;
  onJoinReadingSession?: (sessionId: string) => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  notifications,
  isOpen,
  onClose,
  onMarkRead,
  onMarkAllRead,
  onDeleteNotification,
  onAcceptFriendRequest,
  onDeclineFriendRequest,
  onAcceptGroupInvite,
  onDeclineGroupInvite,
  onJoinReadingSession,
}) => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  if (!isOpen) return null;

  const filtered = notifications.filter((n) => (filter === 'unread' ? !n.read : true));
  const unreadCount = notifications.filter((n) => !n.read).length;

  const getNotificationIcon = (category: string, type?: string) => {
    switch (type || category) {
      case 'book_like':
        return <Heart className="w-4 h-4 text-rose-500" />;
      case 'book_comment':
      case 'comment_reply':
        return <MessageSquare className="w-4 h-4 text-blue-500" />;
      case 'friend_request':
        return <UserPlus className="w-4 h-4 text-[#E43136]" />;
      case 'friend_accept':
        return <UserCheck className="w-4 h-4 text-emerald-500" />;
      case 'follow':
        return <UserCheck className="w-4 h-4 text-purple-500" />;
      case 'reading_invite':
        return <BookOpen className="w-4 h-4 text-amber-500" />;
      case 'group_invite':
        return <Users className="w-4 h-4 text-indigo-500" />;
      case 'friend_suggestion':
        return <Sparkles className="w-4 h-4 text-amber-500" />;
      case 'system_announcement':
      case 'system':
        return <ShieldAlert className="w-4 h-4 text-[#E43136]" />;
      default:
        return <Bell className="w-4 h-4 text-[#E43136]" />;
    }
  };

  const handleNotificationClick = async (notif: NotificationItem) => {
    if (!notif.read) {
      await onMarkRead(notif.id);
    }
    if (notif.link) {
      navigate(notif.link);
      onClose();
    }
  };

  const formatRelativeTime = (iso: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    const diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end sm:p-4 pt-14 bg-black/40 backdrop-blur-2xs animate-in fade-in duration-150">
      <div
        className="w-full sm:max-w-md h-[calc(100dvh-3.5rem)] sm:h-[650px] bg-white dark:bg-[#121217] sm:rounded-2xl shadow-2xl border border-[#E5E5EB] dark:border-[#22222A] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-[#E5E5EB] dark:border-[#22222A] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-[#E43136]" />
            <h3 className="font-bold text-base text-[#202020] dark:text-[#F4F4F6]">
              Notifications
            </h3>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#E43136] text-white">
                {unreadCount} new
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={onMarkAllRead}
                className="text-xs font-semibold text-[#E43136] hover:underline cursor-pointer"
              >
                Mark all read
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-[#8E8E98] hover:text-[#202020] dark:hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="px-4 py-2 bg-[#FAFAFB] dark:bg-[#0E0E12] border-b border-[#E5E5EB] dark:border-[#22222A] flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
              filter === 'all'
                ? 'bg-[#E43136] text-white'
                : 'text-[#6E6E77] hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`px-3 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
              filter === 'unread'
                ? 'bg-[#E43136] text-white'
                : 'text-[#6E6E77] hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            Unread ({unreadCount})
          </button>
        </div>

        {/* Notifications Stream */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#E5E5EB]/60 dark:divide-[#22222A]/60">
          {filtered.length === 0 ? (
            <div className="text-center py-20 text-xs text-[#8E8E98]">
              <Bell className="w-8 h-8 text-[#CCC] dark:text-[#444] mx-auto mb-2" />
              <p>No notifications to display.</p>
            </div>
          ) : (
            filtered.map((notif) => (
              <div
                key={notif.id}
                onClick={() => handleNotificationClick(notif)}
                className={`p-3.5 flex gap-3 cursor-pointer transition-colors ${
                  !notif.read
                    ? 'bg-[#FFF9F9] dark:bg-[#E43136]/5 hover:bg-[#FFF2F2] dark:hover:bg-[#E43136]/10'
                    : 'hover:bg-[#FAFAFB] dark:hover:bg-[#181820]'
                }`}
              >
                <div className="shrink-0 mt-0.5">
                  <div className="w-9 h-9 rounded-xl bg-white dark:bg-[#1A1A22] border border-[#E5E5EB] dark:border-[#2A2A38] flex items-center justify-center shadow-2xs">
                    {getNotificationIcon(notif.category, notif.type)}
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-1 mb-0.5">
                    <h4 className="text-xs font-semibold text-[#202020] dark:text-[#F4F4F6]">
                      {notif.title}
                    </h4>
                    <span className="text-[10px] text-[#8E8E98] shrink-0">
                      {formatRelativeTime(notif.createdAt)}
                    </span>
                  </div>

                  <p className="text-xs text-[#555] dark:text-[#AAA] leading-relaxed line-clamp-2">
                    {notif.body}
                  </p>

                  {/* Inline Action Buttons for Interactive Invitations */}
                  {notif.type === 'friend_request' && onAcceptFriendRequest && onDeclineFriendRequest && (
                    <div
                      className="mt-2.5 flex items-center gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={async () => {
                          if (notif.targetId) await onAcceptFriendRequest(notif.targetId);
                          await onMarkRead(notif.id);
                        }}
                        className="px-3 py-1 rounded-lg text-xs font-semibold text-white bg-[#E43136] hover:bg-[#D92D32] transition-colors cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Accept</span>
                      </button>
                      <button
                        onClick={async () => {
                          if (notif.targetId) await onDeclineFriendRequest(notif.targetId);
                          await onDeleteNotification(notif.id);
                        }}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium text-[#6E6E77] hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                      >
                        Decline
                      </button>
                    </div>
                  )}

                  {notif.type === 'group_invite' && onAcceptGroupInvite && onDeclineGroupInvite && (
                    <div
                      className="mt-2.5 flex items-center gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={async () => {
                          if (notif.targetId) {
                            const [_, groupId] = notif.targetId.split('_');
                            await onAcceptGroupInvite(notif.targetId, groupId || notif.targetId);
                          }
                          await onMarkRead(notif.id);
                        }}
                        className="px-3 py-1 rounded-lg text-xs font-semibold text-white bg-[#E43136] hover:bg-[#D92D32] transition-colors cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Join Group</span>
                      </button>
                      <button
                        onClick={async () => {
                          if (notif.targetId) {
                            const [_, groupId] = notif.targetId.split('_');
                            await onDeclineGroupInvite(notif.targetId, groupId || notif.targetId);
                          }
                          await onDeleteNotification(notif.id);
                        }}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium text-[#6E6E77] hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                      >
                        Decline
                      </button>
                    </div>
                  )}

                  {notif.type === 'reading_invite' && (
                    <div
                      className="mt-2.5 flex items-center gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => {
                          if (notif.link) navigate(notif.link);
                          onClose();
                        }}
                        className="px-3 py-1 rounded-lg text-xs font-semibold text-white bg-[#E43136] hover:bg-[#D92D32] transition-colors cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>Join Reading</span>
                      </button>
                    </div>
                  )}
                </div>

                <div className="shrink-0 flex flex-col items-center justify-between">
                  {!notif.read && (
                    <span className="w-2 h-2 rounded-full bg-[#E43136]" />
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteNotification(notif.id);
                    }}
                    className="p-1 rounded-md text-[#8E8E98] hover:text-red-500 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity cursor-pointer"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
