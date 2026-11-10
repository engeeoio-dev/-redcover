import React, { useState, useMemo } from 'react';
import { X, Search, BookOpen, UserPlus, Check, Sparkles } from 'lucide-react';
import { Book, UserProfile } from '../../models/types';
import { UserAvatar, BookCover } from '../common/UIPrimitives';

interface InviteToReadModalProps {
  isOpen: boolean;
  onClose: () => void;
  book: Book;
  friends: UserProfile[];
  allUsers: UserProfile[];
  onInviteToRead: (targetUser: UserProfile, personalMessage: string) => Promise<void>;
}

export const InviteToReadModal: React.FC<InviteToReadModalProps> = ({
  isOpen,
  onClose,
  book,
  friends,
  allUsers,
  onInviteToRead,
}) => {
  const [tab, setTab] = useState<'friends' | 'all'>('friends');
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [personalMessage, setPersonalMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  const candidates = tab === 'friends' ? friends : allUsers;

  const filteredCandidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter(
      (u) =>
        u.displayName.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q)
    );
  }, [candidates, search]);

  if (!isOpen) return null;

  const handleSend = async () => {
    if (!selectedUser || isSending) return;
    setIsSending(true);
    try {
      await onInviteToRead(selectedUser, personalMessage);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-white dark:bg-[#121217] rounded-2xl shadow-2xl border border-[#E5E5EB] dark:border-[#22222A] overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#E5E5EB] dark:border-[#22222A] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#E43136]" />
            <h3 className="font-semibold text-base text-[#202020] dark:text-[#F4F4F6]">
              Invite to Co-Reading Session
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#6E6E77] hover:text-[#202020] dark:hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Book Preview */}
        <div className="p-4 bg-[#FAFAFB] dark:bg-[#0E0E12] border-b border-[#E5E5EB] dark:border-[#22222A] flex items-center gap-3">
          <div className="w-12 h-16 shrink-0 rounded-md overflow-hidden shadow-xs">
            <BookCover coverURL={book.coverURL} title={book.title} className="w-full h-full object-cover" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] uppercase font-bold text-[#E43136] tracking-wider block mb-0.5">
              Synchronized Reading
            </span>
            <h4 className="text-xs font-semibold text-[#202020] dark:text-[#F4F4F6] truncate">
              {book.title}
            </h4>
            <p className="text-[11px] text-[#6E6E77] dark:text-[#9E9EA8] truncate">
              by {book.authorName}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#E5E5EB] dark:border-[#22222A] px-4 pt-2 gap-4">
          <button
            onClick={() => setTab('friends')}
            className={`pb-2 text-xs font-semibold border-b-2 cursor-pointer transition-colors ${
              tab === 'friends'
                ? 'border-[#E43136] text-[#E43136]'
                : 'border-transparent text-[#6E6E77] hover:text-[#202020] dark:hover:text-white'
            }`}
          >
            Friends ({friends.length})
          </button>
          <button
            onClick={() => setTab('all')}
            className={`pb-2 text-xs font-semibold border-b-2 cursor-pointer transition-colors ${
              tab === 'all'
                ? 'border-[#E43136] text-[#E43136]'
                : 'border-transparent text-[#6E6E77] hover:text-[#202020] dark:hover:text-white'
            }`}
          >
            Other Readers
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-[#E5E5EB] dark:border-[#22222A]">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#9E9EA8]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search readers..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-[#F4F4F6] dark:bg-[#1B1B22] outline-none"
            />
          </div>
        </div>

        {/* Reader Selection List */}
        <div className="p-3 overflow-y-auto space-y-1 flex-1">
          {filteredCandidates.length === 0 ? (
            <div className="text-center py-8 text-xs text-[#8E8E98]">
              No readers found.
            </div>
          ) : (
            filteredCandidates.map((user) => {
              const isSelected = selectedUser?.uid === user.uid;
              return (
                <div
                  key={user.uid}
                  onClick={() => setSelectedUser(user)}
                  className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-[#FFF3F4] dark:bg-[#E43136]/10 border border-[#E43136]/40'
                      : 'hover:bg-[#F4F4F6] dark:hover:bg-[#181820]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <UserAvatar photoURL={user.photoURL} name={user.displayName} size="sm" />
                    <div className="truncate">
                      <div className="text-xs font-semibold text-[#202020] dark:text-[#F4F4F6] truncate">
                        {user.displayName}
                      </div>
                      <div className="text-[11px] text-[#8E8E98] truncate">
                        @{user.username}
                      </div>
                    </div>
                  </div>

                  <div
                    className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                      isSelected
                        ? 'bg-[#E43136] border-[#E43136] text-white'
                        : 'border-[#DDDDE3] dark:border-[#33333F]'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3" />}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Personal Note */}
        <div className="p-3 border-t border-[#E5E5EB] dark:border-[#22222A]">
          <input
            type="text"
            value={personalMessage}
            onChange={(e) => setPersonalMessage(e.target.value)}
            placeholder="Personal invitation message..."
            maxLength={180}
            className="w-full px-3 py-2 text-xs rounded-xl bg-[#F4F4F6] dark:bg-[#1B1B22] outline-none"
          />
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#E5E5EB] dark:border-[#22222A] flex items-center justify-between bg-[#FAFAFB] dark:bg-[#0E0E12]">
          <span className="text-xs text-[#6E6E77] dark:text-[#9E9EA8]">
            {selectedUser ? `Selected: ${selectedUser.displayName}` : 'Select a reader'}
          </span>
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
              disabled={!selectedUser || isSending}
              className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-[#E43136] hover:bg-[#D92D32] transition-colors disabled:opacity-50 shadow-xs cursor-pointer inline-flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isSending ? 'Sending Invite...' : 'Send Invitation'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
