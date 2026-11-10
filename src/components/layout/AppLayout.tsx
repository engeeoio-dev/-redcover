import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  Search,
  Bell,
  Home,
  Compass,
  PlusCircle,
  Users,
  User,
  LogOut,
  Settings,
  Crown,
  Shield,
  BookMarked,
  Sun,
  Moon,
  TrendingUp,
  BookOpen,
  ChevronRight,
  X,
  Info,
  Mail,
} from 'lucide-react';
import { useRedcover } from '../../contexts/RedcoverContext';
import { ReadingInvitation } from '../../models/types';
import { ToastContainer, UserAvatar } from '../common/UIPrimitives';
import { NotificationCenter } from '../notifications/NotificationCenter';
import { PublicFooter } from './PublicFooter';

export const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    currentUser,
    firebaseUser,
    notifications,
    chats,
    readingInvitations,
    isAdmin,
    logout,
    markNotificationRead,
    markAllNotificationsRead,
    deleteNotification,
    updateFriendshipStatus,
    acceptGroupInvitation,
    declineGroupInvitation,
    toasts,
    addToast,
    dismissToast,
    theme,
    setTheme,
  } = useRedcover();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [activeReadingInvite, setActiveReadingInvite] = useState<ReadingInvitation | null>(null);
  const dismissedInvitesRef = useRef<Set<string>>(new Set());
  const navigate = useNavigate();
  const location = useLocation();

  const unreadCount = notifications.filter((n) => !n.read).length;
  const recentNotifications = notifications.slice(0, 6);

  // Calculate unseen direct messages to show red dot on Hub
  const totalUnreadDirectMessages = useMemo(() => {
    if (!firebaseUser) return 0;
    const uid = firebaseUser.uid;
    return (chats || []).reduce((acc, c) => {
      const isA = c.participantA === uid;
      const unread = isA ? (c.unreadCountA || 0) : (c.unreadCountB || 0);
      return acc + (unread > 0 ? 1 : 0);
    }, 0);
  }, [chats, firebaseUser?.uid]);

  // Floating 5-second Reading Invitation Notification
  useEffect(() => {
    if (!currentUser || !readingInvitations?.length) return;
    const pending = readingInvitations.find(
      (inv) =>
        inv.inviteeId === currentUser.uid &&
        inv.status === 'pending' &&
        !dismissedInvitesRef.current.has(inv.id)
    );
    if (pending) {
      setActiveReadingInvite(pending);
      const timer = setTimeout(() => {
        dismissedInvitesRef.current.add(pending.id);
        setActiveReadingInvite((curr) => (curr?.id === pending.id ? null : curr));
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [readingInvitations, currentUser?.uid]);

  const isReaderRoute = location.pathname.startsWith('/read/');
  const isFixedWorkspaceRoute =
    location.pathname.startsWith('/hub') || location.pathname.startsWith('/create');

  const isChatOpenOnMobile =
    location.pathname.startsWith('/hub') &&
    (location.search.includes('chatId=') || location.search.includes('sessionId='));

  const isDark = theme === 'dark';

  const handleToggleTheme = () => {
    setTheme(isDark ? 'light' : 'dark');
  };

  if (isReaderRoute) {
    return (
      <div className="h-[100dvh] w-full flex flex-col overflow-hidden bg-white dark:bg-black text-[#202020] dark:text-[#F5F5F7]">
        {children}
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </div>
    );
  }

  return (
    <div className="h-[100dvh] w-full flex flex-col overflow-hidden bg-[#FAFAFB] dark:bg-black text-[#202020] dark:text-[#F5F5F7] transition-colors duration-150">
      {/* Fixed Global Top Navigation (h-14) - hidden on mobile when viewing an active chat thread */}
      <header className={`${isChatOpenOnMobile ? 'hidden md:block' : 'block'} h-14 shrink-0 z-40 bg-white dark:bg-[#0A0A0D] border-b border-[#DDDDE3] dark:border-[#22222A] transition-colors duration-150`}>
        <div className="max-w-[1440px] mx-auto px-3 sm:px-6 h-full flex items-center justify-between gap-4">
          {/* Brand Logo */}
          <Link
            to="/"
            className="inline-flex items-center gap-2 font-display text-lg font-bold tracking-tight text-[#E43136] whitespace-nowrap shrink-0"
          >
            <img
              src="/assets/aistudio/WhatsApp_Image_2026-10-24_at_6.29.36_PM_8a2e5d20.jpeg"
              alt="Redcover"
              className="w-7 h-7 rounded-lg object-cover shadow-2xs"
            />
            <span>Redcover</span>
          </Link>

          {/* Desktop Navigation Links (Strictly Home, Explore, Hub, Create) */}
          <nav className="hidden md:flex items-center gap-1 text-sm font-medium text-[#6E6E77] dark:text-[#9E9EA8]">
            {[
              { to: '/', label: 'Home', end: true },
              { to: '/explore', label: 'Explore', end: false },
              { to: '/hub', label: 'Hub', end: false },
              { to: '/create', label: 'Create', end: false },
            ].map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `relative px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0 text-xs sm:text-sm flex items-center gap-1.5 ${
                    isActive
                      ? 'text-[#E43136] font-semibold bg-[#FFF3F4] dark:bg-[#E43136]/15'
                      : 'hover:text-[#202020] dark:hover:text-white hover:bg-[#FAFAFB] dark:hover:bg-[#121217]'
                  }`
                }
              >
                <span>{item.label}</span>
                {item.to === '/hub' && totalUnreadDirectMessages > 0 && (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#E43136]"></span>
                  </span>
                )}
              </NavLink>
            ))}
          </nav>

          {/* Right Action Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={() => navigate('/search')}
              aria-label="Search"
              title="Search"
              className="p-2 rounded-lg text-[#6E6E77] dark:text-[#9E9EA8] hover:text-[#202020] dark:hover:text-white hover:bg-[#F1F1F4] dark:hover:bg-[#121217] transition-colors cursor-pointer"
            >
              <Search className="w-4 h-4" />
            </button>

            {/* Instant Theme Switcher (Light / Black Dark Mode) */}
            <button
              type="button"
              onClick={handleToggleTheme}
              aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              className="p-2 rounded-lg text-[#6E6E77] dark:text-[#9E9EA8] hover:text-[#202020] dark:hover:text-white hover:bg-[#F1F1F4] dark:hover:bg-[#121217] transition-colors cursor-pointer inline-flex items-center gap-1.5"
            >
              {isDark ? (
                <Sun className="w-4 h-4 text-[#E6A02C]" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>

            {/* Notifications */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setNotifOpen((o) => !o);
                  setDropdownOpen(false);
                }}
                aria-label="Notifications"
                title="Notifications"
                className="relative p-2 rounded-lg text-[#6E6E77] dark:text-[#9E9EA8] hover:text-[#202020] dark:hover:text-white hover:bg-[#F1F1F4] dark:hover:bg-[#121217] transition-colors cursor-pointer"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 min-w-[15px] h-3.5 px-1 rounded-full bg-[#E43136] text-white text-[9px] font-bold flex items-center justify-center tabular-nums">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              <NotificationCenter
                notifications={notifications}
                isOpen={notifOpen}
                onClose={() => setNotifOpen(false)}
                onMarkRead={markNotificationRead}
                onMarkAllRead={markAllNotificationsRead}
                onDeleteNotification={deleteNotification}
                onAcceptFriendRequest={async (fId) => {
                  await updateFriendshipStatus(fId, 'accepted');
                }}
                onDeclineFriendRequest={async (fId) => {
                  await updateFriendshipStatus(fId, 'rejected');
                }}
                onAcceptGroupInvite={async (invId, grpId) => {
                  await acceptGroupInvitation(invId, grpId);
                }}
                onDeclineGroupInvite={async (invId, grpId) => {
                  await declineGroupInvitation(invId, grpId);
                }}
                onJoinReadingSession={(sId) => {
                  navigate(`/hub/reading?sessionId=${sId}`);
                }}
              />
            </div>

            {/* User Account Menu */}
            {firebaseUser && currentUser ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setDropdownOpen((o) => !o)}
                  className="flex items-center rounded-full focus:outline-none cursor-pointer"
                >
                  <UserAvatar user={currentUser} size="sm" showPresence />
                </button>

                {dropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setDropdownOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-60 rounded-xl bg-white dark:bg-[#0A0A0D] border border-[#DDDDE3] dark:border-[#22222A] shadow-xl py-1.5 z-50">
                      <div className="px-4 py-2 border-b border-[#F1F1F4] dark:border-[#22222A]">
                        <p className="text-xs font-bold text-[#202020] dark:text-[#F5F5F7] truncate">
                          {currentUser.displayName}
                        </p>
                        <p className="text-[11px] text-[#6E6E77] dark:text-[#9E9EA8] truncate">
                          @{currentUser.username}
                        </p>
                      </div>

                      <Link
                        to={`/profile/${currentUser.uid}`}
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-[#202020] dark:text-[#F5F5F7] hover:bg-[#FFF3F4] dark:hover:bg-[#121217]"
                      >
                        <User className="w-3.5 h-3.5 text-[#6E6E77] dark:text-[#9E9EA8]" />
                        Profile
                      </Link>
                      <Link
                        to="/hub/books"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-[#202020] dark:text-[#F5F5F7] hover:bg-[#FFF3F4] dark:hover:bg-[#121217]"
                      >
                        <BookMarked className="w-3.5 h-3.5 text-[#6E6E77] dark:text-[#9E9EA8]" />
                        Your Books
                      </Link>
                      <Link
                        to="/analytics"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-[#202020] dark:text-[#F5F5F7] hover:bg-[#FFF3F4] dark:hover:bg-[#121217]"
                      >
                        <TrendingUp className="w-3.5 h-3.5 text-[#E43136]" />
                        <span>Book & Account Analytics</span>
                      </Link>
                      <Link
                        to="/settings"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-[#202020] dark:text-[#F5F5F7] hover:bg-[#FFF3F4] dark:hover:bg-[#121217]"
                      >
                        <Settings className="w-3.5 h-3.5 text-[#6E6E77] dark:text-[#9E9EA8]" />
                        Settings
                      </Link>
                      <Link
                        to="/about"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-[#202020] dark:text-[#F5F5F7] hover:bg-[#FFF3F4] dark:hover:bg-[#121217]"
                      >
                        <Info className="w-3.5 h-3.5 text-[#6E6E77] dark:text-[#9E9EA8]" />
                        About Redcover
                      </Link>
                      <Link
                        to="/contact"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-[#202020] dark:text-[#F5F5F7] hover:bg-[#FFF3F4] dark:hover:bg-[#121217]"
                      >
                        <Mail className="w-3.5 h-3.5 text-[#6E6E77] dark:text-[#9E9EA8]" />
                        Contact Us
                      </Link>

                      {/* Theme Switcher inside Account Dropdown */}
                      <div className="px-4 py-2.5 border-t border-[#F1F1F4] dark:border-[#22222A]">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-[#202020] dark:text-[#F5F5F7]">
                            Themes
                          </span>
                          <span className="text-[10px] text-[#6E6E77] dark:text-[#9E9EA8]">Appearance</span>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          {[
                            { id: 'light', label: '☀️ Light', bg: '#FFFFFF', text: '#202020' },
                            { id: 'dark', label: '🌙 Dark', bg: '#0A0A0D', text: '#FFFFFF' },
                          ].map((t) => {
                            const isSelected = theme === t.id;
                            return (
                              <button
                                key={t.id}
                                type="button"
                                onClick={() => setTheme(t.id as any)}
                                className={`px-2 py-1.5 rounded-lg text-[10px] font-semibold flex items-center justify-center transition-all cursor-pointer border ${
                                  isSelected
                                    ? 'border-[#E43136] ring-1 ring-[#E43136]'
                                    : 'border-black/10 dark:border-white/10 hover:border-black/30'
                                }`}
                                style={{ backgroundColor: t.bg, color: t.text }}
                              >
                                <span>{t.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {isAdmin && (
                        <Link
                          to="/admin"
                          onClick={() => setDropdownOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-[#E43136] hover:bg-[#FFF3F4] dark:hover:bg-[#121217]"
                        >
                          <Shield className="w-3.5 h-3.5" />
                          Admin
                        </Link>
                      )}
                      <div className="mt-1 pt-1 border-t border-[#F1F1F4] dark:border-[#22222A]">
                        <button
                          type="button"
                          onClick={() => {
                            setDropdownOpen(false);
                            logout();
                          }}
                          className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-[#D9363E] hover:bg-[#FFF3F4] dark:hover:bg-[#121217] cursor-pointer"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          Sign Out
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <Link
                to="/auth"
                className="py-1.5 px-3.5 rounded-xl border border-[#DDDDE3] dark:border-[#33333F] hover:border-[#E43136] text-[#202020] dark:text-white hover:text-[#E43136] text-xs font-semibold transition-colors whitespace-nowrap shrink-0 shadow-xs"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Application Viewport */}
      {isFixedWorkspaceRoute ? (
        /* Frame-fit workspace for /hub and /create: never scrolls at the outer page level */
        <main className="flex-1 min-h-0 w-full overflow-hidden flex flex-col">
          {children}
        </main>
      ) : (
        /* Scrollable content viewport with PublicFooter at the bottom */
        <main className="flex-1 min-h-0 w-full overflow-y-auto flex flex-col">
          <div className="flex-1 max-w-[1360px] w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
            {children}
          </div>
          <PublicFooter />
        </main>
      )}

      {/* Mobile Bottom Navigation (h-13, shrink-0 so it frames cleanly without overlapping) */}
      <nav
        aria-label="Mobile bottom navigation"
        className={`${
          isChatOpenOnMobile ? 'hidden' : 'md:hidden'
        } h-13 shrink-0 z-40 bg-white dark:bg-[#0A0A0D] border-t border-[#DDDDE3] dark:border-[#22222A] px-2 flex items-center justify-around`}
      >
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium px-2 py-1 ${
              isActive ? 'text-[#E43136]' : 'text-[#6E6E77] dark:text-[#9E9EA8]'
            }`
          }
        >
          <Home className="w-4 h-4" />
          <span>Home</span>
        </NavLink>
        <NavLink
          to="/explore"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium px-2 py-1 ${
              isActive ? 'text-[#E43136]' : 'text-[#6E6E77] dark:text-[#9E9EA8]'
            }`
          }
        >
          <Compass className="w-4 h-4" />
          <span>Explore</span>
        </NavLink>
        <NavLink
          to="/create"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold px-2 py-1 ${
              isActive ? 'text-[#E43136]' : 'text-[#6E6E77] dark:text-[#9E9EA8]'
            }`
          }
        >
          <PlusCircle className="w-4 h-4" />
          <span>Create</span>
        </NavLink>
        <NavLink
          to="/hub"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium px-2 py-1 ${
              isActive ? 'text-[#E43136]' : 'text-[#6E6E77] dark:text-[#9E9EA8]'
            }`
          }
        >
          <div className="relative">
            <Users className="w-4 h-4" />
            {totalUnreadDirectMessages > 0 && (
              <span className="absolute -top-1 -right-1 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#E43136]"></span>
              </span>
            )}
          </div>
          <span>Hub</span>
        </NavLink>
        <NavLink
          to={currentUser ? `/profile/${currentUser.uid}` : '/auth'}
          className={({ isActive }) =>
            `flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium px-2 py-1 ${
              isActive ? 'text-[#E43136]' : 'text-[#6E6E77] dark:text-[#9E9EA8]'
            }`
          }
        >
          <User className="w-4 h-4" />
          <span>Profile</span>
        </NavLink>
      </nav>

      {/* Floating 5-Second Live Reading Invitation Banner */}
      {activeReadingInvite && (
        <div className="fixed top-4 right-4 sm:right-6 z-50 max-w-sm w-full bg-white dark:bg-[#1C1C24] border-2 border-[#E43136] shadow-2xl rounded-2xl p-3.5 flex items-start gap-3 animate-in slide-in-from-top-4 duration-200">
          <div className="w-9 h-9 rounded-full bg-[#E43136]/10 text-[#E43136] flex items-center justify-center shrink-0 mt-0.5">
            <BookOpen className="w-5 h-5" />
          </div>

          <div
            className="flex-1 min-w-0 cursor-pointer"
            onClick={() => {
              const inv = activeReadingInvite;
              dismissedInvitesRef.current.add(inv.id);
              setActiveReadingInvite(null);
              navigate(`/hub/chats`);
            }}
          >
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#202020] dark:text-white truncate">
              <span>{activeReadingInvite.inviterName}</span>
              <span className="text-[10px] font-normal text-[#8E8E98]">invited you</span>
            </div>
            <p className="text-xs text-[#6E6E77] dark:text-[#9E9EA8] truncate mt-0.5">
              Read together: <strong>"{activeReadingInvite.bookTitle}"</strong>
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[11px] font-semibold text-[#E43136] hover:underline flex items-center gap-1">
                <span>View in Chat</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (activeReadingInvite) {
                dismissedInvitesRef.current.add(activeReadingInvite.id);
              }
              setActiveReadingInvite(null);
            }}
            className="p-1 rounded-md text-[#8E8E98] hover:text-[#202020] dark:hover:text-white cursor-pointer"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
};
