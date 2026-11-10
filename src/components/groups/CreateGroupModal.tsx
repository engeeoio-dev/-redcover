import React, { useState } from 'react';
import { X, Users, Check, Image as ImageIcon } from 'lucide-react';
import { UserProfile } from '../../models/types';
import { UserAvatar } from '../common/UIPrimitives';

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  friends: UserProfile[];
  allUsers: UserProfile[];
  onCreateGroup: (
    name: string,
    description: string,
    avatarURL: string,
    initialInvitees: UserProfile[]
  ) => Promise<void>;
}

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
  isOpen,
  onClose,
  friends,
  allUsers,
  onCreateGroup,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [avatarURL, setAvatarURL] = useState('');
  const [search, setSearch] = useState('');
  const [selectedUids, setSelectedUids] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const toggleSelect = (uid: string) => {
    setSelectedUids((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAvatarURL(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const selectedUsers = allUsers.filter((u) => selectedUids.includes(u.uid));
      await onCreateGroup(name.trim(), description.trim(), avatarURL, selectedUsers);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredUsers = allUsers.filter((u) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      u.displayName.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-white dark:bg-[#121217] rounded-2xl shadow-2xl border border-[#E5E5EB] dark:border-[#22222A] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#E5E5EB] dark:border-[#22222A] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-[#E43136]" />
            <h3 className="font-semibold text-base text-[#202020] dark:text-[#F4F4F6]">
              Create Reading Group
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#6E6E77] hover:text-[#202020] dark:hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Group Avatar */}
          <div className="flex items-center gap-4">
            <div className="relative w-16 h-16 rounded-2xl bg-[#F4F4F6] dark:bg-[#1A1A22] border border-[#DDDDE3] dark:border-[#2C2C38] flex items-center justify-center overflow-hidden shrink-0">
              {avatarURL ? (
                <img src={avatarURL} alt="Group" className="w-full h-full object-cover" />
              ) : (
                <Users className="w-7 h-7 text-[#9E9EA8]" />
              )}
            </div>

            <div>
              <label className="px-3 py-1.5 rounded-xl border border-[#DDDDE3] dark:border-[#2C2C38] text-xs font-semibold text-[#202020] dark:text-white hover:border-[#E43136] cursor-pointer inline-flex items-center gap-1.5 transition-colors">
                <ImageIcon className="w-3.5 h-3.5" />
                <span>Upload Group Image</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
              </label>
              <p className="text-[10px] text-[#8E8E98] mt-1">Recommended 1:1 ratio, max 2MB</p>
            </div>
          </div>

          {/* Group Name */}
          <div>
            <label className="block text-xs font-semibold text-[#202020] dark:text-[#F4F4F6] mb-1">
              Group Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Dystopian Fiction Club"
              required
              maxLength={80}
              className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl bg-[#F4F4F6] dark:bg-[#1B1B22] border-none text-[#202020] dark:text-[#F4F4F6] focus:ring-2 focus:ring-[#E43136] outline-none"
            />
          </div>

          {/* Group Description */}
          <div>
            <label className="block text-xs font-semibold text-[#202020] dark:text-[#F4F4F6] mb-1">
              Description (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What books or topics will this group read and discuss?"
              rows={2}
              maxLength={300}
              className="w-full px-3 py-2 text-xs rounded-xl bg-[#F4F4F6] dark:bg-[#1B1B22] border-none text-[#202020] dark:text-[#F4F4F6] focus:ring-2 focus:ring-[#E43136] outline-none resize-none"
            />
          </div>

          {/* Invite Readers */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-[#202020] dark:text-[#F4F4F6]">
                Invite Readers ({selectedUids.length} selected)
              </label>
              <span className="text-[10px] text-[#8E8E98]">
                Invitations must be accepted to join
              </span>
            </div>

            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search readers to invite..."
              className="w-full px-3 py-1.5 text-xs rounded-xl bg-[#F4F4F6] dark:bg-[#1B1B22] outline-none mb-2"
            />

            <div className="max-h-40 overflow-y-auto space-y-1 p-1 border border-[#E5E5EB] dark:border-[#22222A] rounded-xl">
              {filteredUsers.slice(0, 20).map((u) => {
                const isSelected = selectedUids.includes(u.uid);
                return (
                  <div
                    key={u.uid}
                    onClick={() => toggleSelect(u.uid)}
                    className={`flex items-center justify-between p-2 rounded-lg cursor-pointer text-xs ${
                      isSelected
                        ? 'bg-[#FFF3F4] dark:bg-[#E43136]/10'
                        : 'hover:bg-black/5 dark:hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <UserAvatar photoURL={u.photoURL} name={u.displayName} size="sm" />
                      <div className="truncate">
                        <div className="font-medium text-[#202020] dark:text-white truncate">
                          {u.displayName}
                        </div>
                        <div className="text-[10px] text-[#8E8E98]">@{u.username}</div>
                      </div>
                    </div>

                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center ${
                        isSelected
                          ? 'bg-[#E43136] border-[#E43136] text-white'
                          : 'border-[#DDDDE3] dark:border-[#33333F]'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <div className="pt-2 flex justify-end gap-2 border-t border-[#E5E5EB] dark:border-[#22222A]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-medium text-[#6E6E77] hover:bg-[#EDEDF2] dark:hover:bg-[#1C1C24] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || isSubmitting}
              className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-[#E43136] hover:bg-[#D92D32] transition-colors disabled:opacity-50 shadow-xs cursor-pointer"
            >
              {isSubmitting ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
