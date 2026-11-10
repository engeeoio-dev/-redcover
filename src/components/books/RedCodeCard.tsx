import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, KeyRound, Sparkles } from 'lucide-react';
import { BookCover } from '../common/UIPrimitives';

interface RedCodeCardProps {
  bookId: string;
  title: string;
  author: string;
  coverURL?: string;
  description?: string;
  redCode?: string;
  personalMessage?: string;
  compact?: boolean;
}

export const RedCodeCard: React.FC<RedCodeCardProps> = ({
  bookId,
  title,
  author,
  coverURL,
  description,
  redCode,
  personalMessage,
  compact = false,
}) => {
  const navigate = useNavigate();

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        navigate(`/book/${bookId}`);
      }}
      className={`rounded-2xl border transition-all cursor-pointer overflow-hidden ${
        compact
          ? 'p-2.5 bg-white dark:bg-[#1A1A24] border-[#E5E5EB] dark:border-[#2A2A38] hover:border-[#E43136]'
          : 'p-3.5 bg-gradient-to-br from-white to-[#FAFAFB] dark:from-[#161620] dark:to-[#111118] border-[#E2E2E8] dark:border-[#262634] shadow-sm hover:shadow-md hover:border-[#E43136]'
      }`}
    >
      {personalMessage && (
        <div className="mb-2 text-xs text-[#202020] dark:text-[#E2E2E8] bg-[#FFF5F5] dark:bg-[#E43136]/10 p-2 rounded-xl border border-[#E43136]/20 italic">
          "{personalMessage}"
        </div>
      )}

      <div className="flex gap-3">
        {/* Cover */}
        <div className="w-14 sm:w-16 shrink-0 aspect-[2/3] rounded-lg overflow-hidden shadow-xs">
          <BookCover book={{ id: bookId, title, authorName: author || 'Author', coverURL: coverURL || '', category: 'Book' }} className="w-full h-full object-cover" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              {redCode && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-[#E43136] text-white shadow-2xs">
                  <KeyRound className="w-2.5 h-2.5" />
                  {redCode}
                </span>
              )}
              <span className="text-[10px] font-medium text-[#777782] dark:text-[#9A9AA6] uppercase tracking-wider">
                Book Card
              </span>
            </div>
            <h4 className="text-xs sm:text-sm font-semibold text-[#202020] dark:text-[#F4F4F6] truncate">
              {title}
            </h4>
            <p className="text-[11px] text-[#6E6E77] dark:text-[#9E9EA8] truncate">
              by {author}
            </p>
            {description && !compact && (
              <p className="text-[11px] text-[#555] dark:text-[#BBB] line-clamp-2 mt-1">
                {description}
              </p>
            )}
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/read/${bookId}`);
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#E43136] hover:bg-[#D92D32] transition-colors inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Read Now</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
