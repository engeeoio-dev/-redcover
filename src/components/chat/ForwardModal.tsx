import React, { useState, useMemo } from 'react';
import { X, Search, Forward, Check, User } from 'lucide-react';
import { UserProfile } from '../../models/types';
import { UserAvatar } from '../common/UIPrimitives';

interface ForwardModalProps {
  isOpen: boolean;
  onClose: () => void;
  messageText: string;
  friends: UserProfile[];
  onForward: (recipientUids: string[]) => Promise<void>;
}

export const ForwardModal: React.FC<ForwardModalProps> = ({
  isOpen,
  onClose,
  messageText,
  friends,
  onForward,
}) => {
  const [search, setSearch] = useState('');
  const [selectedUids, setSelectedUids] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);

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
    setSelectedUids((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const handleSend = async () => {
    if (selectedUids.length === 0 || isSending) return;
    setIsSending(true);
    try {
      await onForward(selectedUids);
      setSelectedUids([]);
      onClose();
    } catch (err) {
      console.error('Failed to forward message:', err);
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
            <Forward className="w-5 h-5 text-[#E43136]" />
            <h3 className="font-semibold text-base text-[#202020] dark:text-[#F4F4F6]">
              Forward Message
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#6E6E77] hover:text-[#202020] dark:hover:text-white hover:bg-[#F1F1F4] dark:hover:bg-[#1E1E26] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Message Snippet */}
        <div className="px-5 py-3 bg-[#FAFAFB] dark:bg-[#0E0E12] border-b border-[#E5E5EB] dark:border-[#22222A]">
          <div className="text-[11px] font-medium text-[#6E6E77] dark:text-[#9E9EA8] uppercase tracking-wider mb-1">
            Message Preview
          </div>
          <p className="text-xs text-[#202020] dark:text-[#F4F4F6] line-clamp-2 italic bg-white dark:bg-[#181820] p-2.5 rounded-lg border border-[#E5E5EB] dark:border-[#262632]">
            "{messageText}"
          </p>
        </div>

        {/* Search */}
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

        {/* Friends List */}
        <div className="p-3 overflow-y-auto space-y-1 flex-1">
          {filteredFriends.length === 0 ? (
            <div className="text-center py-8 text-xs text-[#9E9EA8]">
              No friends found.
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
                    <UserAvatar
                      user={friend}
                      size="sm"
                    />
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

        {/* Footer */}
        <div className="p-4 border-t border-[#E5E5EB] dark:border-[#22222A] flex items-center justify-between bg-[#FAFAFB] dark:bg-[#0E0E12]">
          <div className="text-xs text-[#6E6E77] dark:text-[#9E9EA8]">
            {selectedUids.length} friend{selectedUids.length === 1 ? '' : 's'} selected
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
              <Forward className="w-3.5 h-3.5" />
              <span>{isSending ? 'Forwarding...' : 'Send'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
