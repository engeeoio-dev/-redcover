import React, { useState, useMemo } from 'react';
import { Search, Smile, Heart, ThumbsUp, BookOpen, PartyPopper, Sparkles, X } from 'lucide-react';

interface EmojiPickerTrayProps {
  onSelectEmoji: (emoji: string) => void;
  onClose?: () => void;
  title?: string;
  className?: string;
}

interface EmojiCategory {
  id: string;
  name: string;
  icon: React.ReactNode;
  emojis: string[];
}

const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    id: 'popular',
    name: 'Top Picks',
    icon: <Sparkles className="w-3.5 h-3.5" />,
    emojis: [
      '❤️', '👍', '🔥', '😂', '😮', '👏', '🙏', '😍', '🥺', '🎉',
      '✨', '🙌', '💯', '🥰', '😎', '🤔', '☕', '📚', '🌟', '💡'
    ],
  },
  {
    id: 'smileys',
    name: 'Smileys',
    icon: <Smile className="w-3.5 h-3.5" />,
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃',
      '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😋',
      '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐',
      '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌',
      '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧',
      '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '😎', '🤓', '🧐'
    ],
  },
  {
    id: 'gestures',
    name: 'Gestures',
    icon: <ThumbsUp className="w-3.5 h-3.5" />,
    emojis: [
      '👍', '👎', '👊', '✊', '🤛', '🤜', '🤞', '✌️', '🤟', '🤘',
      '👌', '🤌', '🤏', '👈', '👉', '👆', '👇', '☝️', '✋', '🤚',
      '🖐️', '🖖', '👋', '🤙', '💪', '🦾', '🙏', '👏', '🙌', '👐',
      '🤲', '🤝', '✍️', '💅', '🤳'
    ],
  },
  {
    id: 'hearts',
    name: 'Hearts',
    icon: <Heart className="w-3.5 h-3.5" />,
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
      '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '💌',
      '💋', '🌹', '🥀', '🌺', '🌸', '🌼', '✨', '⭐', '🌟', '💫'
    ],
  },
  {
    id: 'reading',
    name: 'Books',
    icon: <BookOpen className="w-3.5 h-3.5" />,
    emojis: [
      '📚', '📖', '📕', '📗', '📘', '📙', '📓', '📔', '📒', '📑',
      '📜', '📝', '✏️', '✒️', '🖋️', '🔍', '🔎', '💡', '🧠', '🧐',
      '☕', '🍵', '🎓', '👓', '🕰️', '🕯️', ' bookmark'
    ].filter(e => !e.includes(' ')),
  },
  {
    id: 'celebrate',
    name: 'Fun',
    icon: <PartyPopper className="w-3.5 h-3.5" />,
    emojis: [
      '🎉', '🎊', '🎈', '🎂', '🍰', '🧁', '🍾', '🥂', '🍻', '🍺',
      '🍹', '🍸', '🔥', '💥', '🌈', '☀️', '🌙', '🪐', '🚀', '🏆',
      '🥇', '🥈', '🥉', '🎯', '🎮', '🎲', '🎨', '🎭', '🎬', '🎤'
    ],
  },
];

export const EmojiPickerTray: React.FC<EmojiPickerTrayProps> = ({
  onSelectEmoji,
  onClose,
  title = 'Reactions & Emojis',
  className = '',
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('popular');
  const [search, setSearch] = useState<string>('');

  const displayedEmojis = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q) {
      const all = EMOJI_CATEGORIES.flatMap((c) => c.emojis);
      return Array.from(new Set(all));
    }
    const cat = EMOJI_CATEGORIES.find((c) => c.id === activeCategory);
    return cat ? cat.emojis : EMOJI_CATEGORIES[0].emojis;
  }, [search, activeCategory]);

  return (
    <div
      className={`w-80 rounded-2xl bg-white dark:bg-[#1A1A22] border border-[#E5E5EB] dark:border-[#2C2C3A] shadow-2xl overflow-hidden flex flex-col z-50 animate-in fade-in zoom-in-95 duration-150 ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 pt-3 pb-2 border-b border-[#E5E5EB]/60 dark:border-[#262634]">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-[#202020] dark:text-[#F4F4F6]">
          <Smile className="w-4 h-4 text-[#E43136]" />
          <span>{title}</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 rounded-md text-[#8E8E98] hover:text-[#202020] dark:hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Search Input */}
      <div className="px-3 py-2 border-b border-[#E5E5EB]/60 dark:border-[#262634] bg-[#FAFAFB] dark:bg-[#14141B]">
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 text-[#8E8E98] absolute left-2.5 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search emoji..."
            className="w-full pl-8 pr-2.5 py-1 text-xs rounded-lg bg-white dark:bg-[#20202B] border border-[#E5E5EB] dark:border-[#2E2E3E] text-[#202020] dark:text-[#F4F4F6] outline-none focus:border-[#E43136] transition-colors placeholder:text-[#9A9AA6]"
            autoFocus
          />
        </div>
      </div>

      {/* Category Tabs (hidden during search) */}
      {!search && (
        <div className="flex items-center gap-1 px-2 py-1.5 border-b border-[#E5E5EB]/60 dark:border-[#262634] bg-white dark:bg-[#1A1A22] overflow-x-auto no-scrollbar">
          {EMOJI_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all shrink-0 cursor-pointer ${
                activeCategory === cat.id
                  ? 'bg-[#FFF0F1] dark:bg-[#E43136]/15 text-[#E43136]'
                  : 'text-[#6E6E77] dark:text-[#9E9EA8] hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              {cat.icon}
              <span className="text-[11px]">{cat.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Emoji Grid */}
      <div className="p-2.5 max-h-56 overflow-y-auto grid grid-cols-7 gap-1">
        {displayedEmojis.map((emoji, idx) => (
          <button
            key={`${emoji}-${idx}`}
            onClick={() => {
              onSelectEmoji(emoji);
              if (onClose) onClose();
            }}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-lg hover:bg-black/5 dark:hover:bg-white/10 active:scale-90 hover:scale-120 transition-all cursor-pointer"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
};
