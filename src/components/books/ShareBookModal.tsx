import React, { useState, useMemo } from 'react';
import { X, Search, Share2, Check, Copy, ExternalLink, KeyRound, Globe, Users, AlertCircle } from 'lucide-react';
import { Book, UserProfile } from '../../models/types';
import { UserAvatar, BookCover } from '../common/UIPrimitives';

interface ShareBookModalProps {
  isOpen: boolean;
  onClose: () => void;
  book: Book;
  friends: UserProfile[];
  onShareToFriends: (
    recipientUids: string[],
    personalMessage: string
  ) => Promise<void>;
}

export const ShareBookModal: React.FC<ShareBookModalProps> = ({
  isOpen,
  onClose,
  book,
  friends,
  onShareToFriends,
}) => {
  const [activeTab, setActiveTab] = useState<'link' | 'friends'>('link');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedUids, setSelectedUids] = useState<string[]>([]);
  const [personalMessage, setPersonalMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const MAX_RECIPIENTS = 10;
  const shareUrl = `${window.location.origin}/book/${book.id}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      // fallback
    }
  };

  const handleCopyCode = async () => {
    if (!book.redCode) return;
    try {
      await navigator.clipboard.writeText(book.redCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    } catch {
      // fallback
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: book.title,
          text: `Read "${book.title}" by ${book.authorName} on Redcover! (RedCode: ${book.redCode || 'N/A'})`,
          url: shareUrl,
        });
      } catch {
        // user dismissed or not supported
      }
    } else {
      handleCopyLink();
    }
  };

  const filteredFriends = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return friends;
    return friends.filter(
      (f) =>
        f.displayName.toLowerCase().includes(q) ||
        f.username.toLowerCase().includes(q)
    );
  }, [friends, search]);

  if (!isOpen) return null;

  const toggleSelect = (uid: string) => {
    setError(null);
    setSelectedUids((prev) => {
      if (prev.includes(uid)) {
        return prev.filter((id) => id !== uid);
      }
      if (prev.length >= MAX_RECIPIENTS) {
        setError(`You can share with a maximum of ${MAX_RECIPIENTS} friends at once.`);
        return prev;
      }
      return [...prev, uid];
    });
  };

  const handleSend = async () => {
    if (selectedUids.length === 0 || isSending) return;
    setIsSending(true);
    setError(null);
    try {
      await onShareToFriends(selectedUids, personalMessage);
      setSelectedUids([]);
      setPersonalMessage('');
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to share book.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-white dark:bg-[#121217] rounded-2xl shadow-2xl border border-[#E5E5EB] dark:border-[#22222A] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#E5E5EB] dark:border-[#22222A] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-[#E43136]" />
            <h3 className="font-semibold text-base text-[#202020] dark:text-[#F4F4F6]">
              Share Book
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#6E6E77] hover:text-[#202020] dark:hover:text-white hover:bg-[#F1F1F4] dark:hover:bg-[#1E1E26] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Book Mini Card */}
        <div className="p-4 bg-[#FAFAFB] dark:bg-[#0E0E12] border-b border-[#E5E5EB] dark:border-[#22222A] flex items-center gap-3">
          <div className="w-12 h-16 shrink-0 rounded-md overflow-hidden shadow-xs">
            <BookCover book={book} className="w-full h-full object-cover" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-xs font-semibold text-[#202020] dark:text-[#F4F4F6] truncate">
              {book.title}
            </h4>
            <p className="text-[11px] text-[#6E6E77] dark:text-[#9E9EA8] truncate">
              by {book.authorName}
            </p>
            {book.redCode && (
              <div className="flex items-center gap-1.5 mt-1">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#E43136] text-white shadow-2xs">
                  <KeyRound className="w-2.5 h-2.5" />
                  RedCode: {book.redCode}
                </span>
                <button
                  onClick={handleCopyCode}
                  className="text-[10px] font-semibold text-[#E43136] hover:underline cursor-pointer"
                >
                  {copiedCode ? 'Copied!' : 'Copy'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Tab Toggle: Web Share Link vs In-App Friends */}
        <div className="flex border-b border-[#E5E5EB] dark:border-[#22222A] bg-[#F7F7FA] dark:bg-[#15151D]">
          <button
            onClick={() => setActiveTab('link')}
            className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'link'
                ? 'border-[#E43136] text-[#E43136] bg-white dark:bg-[#121217]'
                : 'border-transparent text-[#6E6E77] hover:text-[#202020] dark:hover:text-white'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Web Share Link</span>
          </button>
          <button
            onClick={() => setActiveTab('friends')}
            className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'friends'
                ? 'border-[#E43136] text-[#E43136] bg-white dark:bg-[#121217]'
                : 'border-transparent text-[#6E6E77] hover:text-[#202020] dark:hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Send to Friends ({selectedUids.length})</span>
          </button>
        </div>

        {/* TAB 1: WEB SHARE LINK OUTSIDE APP */}
        {activeTab === 'link' && (
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#202020] dark:text-[#F4F4F6] mb-1.5">
                Share Outside App (Public Web Link)
              </label>
              <p className="text-[11px] text-[#6E6E77] dark:text-[#9E9EA8] mb-2.5">
                Anyone with this web link can view book details, read public chapters, and scan the 6-character RedCode.
              </p>

              <div className="flex items-center gap-2 p-2 rounded-xl bg-[#F4F4F6] dark:bg-[#1B1B22] border border-[#DDDDE3] dark:border-[#2C2C35]">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  className="flex-1 bg-transparent text-xs text-[#202020] dark:text-[#F4F4F6] outline-none select-all truncate"
                />
                <button
                  onClick={handleCopyLink}
                  className="px-3 py-1.5 rounded-lg bg-[#E43136] text-white text-xs font-semibold hover:bg-[#D92D32] transition-colors cursor-pointer inline-flex items-center gap-1 shrink-0"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
                </button>
              </div>
            </div>

            {/* Native Web Share Button (WhatsApp, Twitter, Apps) */}
            <div>
              <button
                onClick={handleNativeShare}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#E43136] to-[#FF4D52] hover:opacity-95 text-white text-xs font-semibold transition-all shadow-xs cursor-pointer flex items-center justify-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Share via WhatsApp, Telegram, or other Apps...</span>
              </button>
            </div>

            {/* RedCode quick share card */}
            {book.redCode && (
              <div className="p-3.5 rounded-xl bg-[#FFF5F5] dark:bg-[#1F1215] border border-[#E43136]/25 flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-semibold text-[#E43136] uppercase tracking-wider">
                    Unique RedCode
                  </div>
                  <div className="text-base font-mono font-black text-[#202020] dark:text-white tracking-widest mt-0.5">
                    {book.redCode}
                  </div>
                  <div className="text-[10px] text-[#6E6E77] dark:text-[#9E9EA8]">
                    Readers can paste this code anywhere in chat or search to open this book.
                  </div>
                </div>
                <button
                  onClick={handleCopyCode}
                  className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#2A1619] border border-[#E43136]/30 text-xs font-semibold text-[#E43136] hover:bg-[#FFF0F1] cursor-pointer inline-flex items-center gap-1"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCode ? 'Copied' : 'Copy Code'}</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: IN-APP FRIENDS PRIVATE MESSAGING */}
        {activeTab === 'friends' && (
          <>
            {/* Search Friends */}
            <div className="p-3 border-b border-[#E5E5EB] dark:border-[#22222A]">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#9E9EA8]" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search friends..."
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-[#F4F4F6] dark:bg-[#1B1B22] border-none text-[#202020] dark:text-[#F4F4F6] focus:ring-2 focus:ring-[#E43136] outline-none"
                />
              </div>
            </div>

            {/* Selected Chips */}
            {selectedUids.length > 0 && (
              <div className="px-4 py-2 border-b border-[#E5E5EB] dark:border-[#22222A] flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                {selectedUids.map((uid) => {
                  const friend = friends.find((f) => f.uid === uid);
                  if (!friend) return null;
                  return (
                    <span
                      key={uid}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-[#FFF3F4] text-[#E43136] dark:bg-[#E43136]/15 border border-[#E43136]/30"
                    >
                      {friend.displayName}
                      <button
                        onClick={() => toggleSelect(uid)}
                        className="hover:text-red-700 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}

            {/* Error / Max Warning */}
            {error && (
              <div className="mx-4 mt-2 p-2 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-xs flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Friends List */}
            <div className="p-3 overflow-y-auto space-y-1 flex-1">
              {filteredFriends.length === 0 ? (
                <div className="text-center py-8 text-xs text-[#9E9EA8]">
                  {friends.length === 0
                    ? 'You do not have any accepted friends yet. Connect with other readers to share books!'
                    : 'No matching friends found.'}
                </div>
              ) : (
                filteredFriends.map((friend) => {
                  const isSelected = selectedUids.includes(friend.uid);
                  return (
                    <div
                      key={friend.uid}
                      onClick={() => toggleSelect(friend.uid)}
                      className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-[#FFF3F4] dark:bg-[#E43136]/10'
                          : 'hover:bg-[#F4F4F6] dark:hover:bg-[#181820]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <UserAvatar user={friend} size="sm" />
                        <div>
                          <div className="text-xs font-semibold text-[#202020] dark:text-[#F4F4F6]">
                            {friend.displayName}
                          </div>
                          <div className="text-[11px] text-[#6E6E77] dark:text-[#9E9EA8]">
                            @{friend.username}
                          </div>
                        </div>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                          isSelected
                            ? 'bg-[#E43136] border-[#E43136] text-white'
                            : 'border-[#DDDDE3] dark:border-[#33333F]'
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5" />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Personal Message Input */}
            <div className="p-3 border-t border-[#E5E5EB] dark:border-[#22222A]">
              <label className="block text-xs font-semibold text-[#202020] dark:text-[#F4F4F6] mb-1.5">
                Personal Note (Optional)
              </label>
              <input
                type="text"
                value={personalMessage}
                onChange={(e) => setPersonalMessage(e.target.value)}
                placeholder="e.g. Check out this amazing book!"
                maxLength={200}
                className="w-full px-3 py-2 text-xs rounded-xl bg-[#F4F4F6] dark:bg-[#1B1B22] border-none text-[#202020] dark:text-[#F4F4F6] focus:ring-2 focus:ring-[#E43136] outline-none"
              />
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-[#E5E5EB] dark:border-[#22222A] flex items-center justify-between bg-[#FAFAFB] dark:bg-[#0E0E12]">
              <div className="text-xs text-[#6E6E77] dark:text-[#9E9EA8]">
                {selectedUids.length}/{MAX_RECIPIENTS} recipients
              </div>
              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  disabled={isSending}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-[#6E6E77] hover:bg-[#EDEDF2] dark:hover:bg-[#1C1C24] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSend}
                  disabled={selectedUids.length === 0 || isSending}
                  className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-[#E43136] hover:bg-[#D92D32] transition-colors disabled:opacity-50 shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>{isSending ? 'Sending...' : 'Send Privately'}</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
