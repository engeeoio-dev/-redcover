import React from 'react';
import { X, Sliders, Type, Check, RotateCcw } from 'lucide-react';

export interface ChatSizeModalProps {
  isOpen: boolean;
  onClose: () => void;
  textScale: number;
  density: 'compact' | 'normal' | 'comfortable';
  onUpdateTextScale: (size: number) => void;
  onUpdateDensity: (density: 'compact' | 'normal' | 'comfortable') => void;
  onReset: () => void;
}

export const ChatSizeModal: React.FC<ChatSizeModalProps> = ({
  isOpen,
  onClose,
  textScale,
  density,
  onUpdateTextScale,
  onUpdateDensity,
  onReset,
}) => {
  if (!isOpen) return null;

  const presets = [
    { label: 'Small', size: 11, desc: 'Ultra compact for phones' },
    { label: 'Normal', size: 12, desc: 'Compact & clean' },
    { label: 'Medium', size: 14, desc: 'Balanced reading' },
    { label: 'Large', size: 16, desc: 'Large & spacious' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#16161D] border border-[#DDDDE3] dark:border-[#2A2A36] p-4 sm:p-5 shadow-2xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-[#F0F0F3] dark:border-[#262632]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#E43136]/10 text-[#E43136] flex items-center justify-center">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-[#202020] dark:text-white">
                Chat Size & Display
              </h3>
              <p className="text-[10px] text-[#6E6E77] dark:text-[#9E9EA8]">
                Adjust bubble, text and icon sizes
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8E8E98] hover:text-[#202020] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Live Preview Box */}
        <div className="p-3 rounded-xl bg-[#FAFAFB] dark:bg-[#0E0E12] border border-[#E5E5EB] dark:border-[#22222A] space-y-2">
          <div className="text-[10px] font-semibold text-[#8E8E98] uppercase tracking-wider">
            Live Preview
          </div>
          {/* Incoming Preview */}
          <div className="flex justify-start">
            <div
              className={`rounded-xl bg-white dark:bg-[#1E1E28] text-[#202020] dark:text-white border border-[#E5E5EB] dark:border-[#282834] ${
                density === 'compact'
                  ? 'px-2.5 py-1.5'
                  : density === 'comfortable'
                  ? 'px-4 py-2.5'
                  : 'px-3 py-2'
              }`}
            >
              <p style={{ fontSize: `${textScale}px`, lineHeight: 1.35 }}>
                Hey! How do the messages look?
              </p>
              <span
                style={{ fontSize: `${Math.max(9, textScale - 3)}px` }}
                className="text-[#8E8E98] block text-right mt-0.5"
              >
                10:45 AM
              </span>
            </div>
          </div>
          {/* Outgoing Preview */}
          <div className="flex justify-end">
            <div
              className={`rounded-xl bg-[#E43136] text-white ${
                density === 'compact'
                  ? 'px-2.5 py-1.5'
                  : density === 'comfortable'
                  ? 'px-4 py-2.5'
                  : 'px-3 py-2'
              }`}
            >
              <p style={{ fontSize: `${textScale}px`, lineHeight: 1.35 }}>
                Perfect! Small, sleek & clean.
              </p>
              <span
                style={{ fontSize: `${Math.max(9, textScale - 3)}px` }}
                className="text-white/75 block text-right mt-0.5"
              >
                10:46 AM ✓✓
              </span>
            </div>
          </div>
        </div>

        {/* Text Size Presets */}
        <div>
          <label className="text-[11px] font-bold text-[#6E6E77] dark:text-[#9E9EA8] block mb-2">
            Text & Bubble Size ({textScale}px)
          </label>
          <div className="grid grid-cols-4 gap-1.5">
            {presets.map((p) => {
              const active = textScale === p.size;
              return (
                <button
                  key={p.size}
                  type="button"
                  onClick={() => onUpdateTextScale(p.size)}
                  className={`py-1.5 px-1 rounded-xl text-center text-xs font-semibold transition-all cursor-pointer ${
                    active
                      ? 'bg-[#E43136] text-white shadow-xs'
                      : 'bg-[#F4F4F6] dark:bg-[#20202A] text-[#202020] dark:text-[#C5C5D0] hover:bg-black/10 dark:hover:bg-white/10'
                  }`}
                >
                  <div>{p.label}</div>
                  <div className={`text-[9px] font-normal ${active ? 'text-white/80' : 'text-[#8E8E98]'}`}>
                    {p.size}px
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Fine Tuning Slider */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-[#6E6E77] dark:text-[#9E9EA8]">
            <span className="flex items-center gap-1">
              <Type className="w-3 h-3" />
              <span>Fine slider</span>
            </span>
            <span className="font-mono font-bold text-[#E43136] text-[11px]">
              {textScale}px
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onUpdateTextScale(Math.max(10, textScale - 1))}
              className="w-7 h-7 rounded-lg border border-[#DDDDE3] dark:border-[#2C2C36] flex items-center justify-center text-xs font-bold text-[#202020] dark:text-white cursor-pointer hover:bg-black/5 dark:hover:bg-white/5"
            >
              A-
            </button>
            <input
              type="range"
              min={10}
              max={18}
              step={1}
              value={textScale}
              onChange={(e) => onUpdateTextScale(Number(e.target.value))}
              className="flex-1 accent-[#E43136] cursor-pointer"
            />
            <button
              type="button"
              onClick={() => onUpdateTextScale(Math.min(18, textScale + 1))}
              className="w-7 h-7 rounded-lg border border-[#DDDDE3] dark:border-[#2C2C36] flex items-center justify-center text-xs font-bold text-[#202020] dark:text-white cursor-pointer hover:bg-black/5 dark:hover:bg-white/5"
            >
              A+
            </button>
          </div>
        </div>

        {/* Bubble Padding Density */}
        <div>
          <label className="text-[11px] font-bold text-[#6E6E77] dark:text-[#9E9EA8] block mb-2">
            Bubble Density & Spacing
          </label>
          <div className="grid grid-cols-3 gap-1.5 text-xs">
            {[
              { id: 'compact', label: 'Compact' },
              { id: 'normal', label: 'Balanced' },
              { id: 'comfortable', label: 'Spacious' },
            ].map((d) => {
              const active = density === d.id;
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => onUpdateDensity(d.id as any)}
                  className={`py-1.5 px-2 rounded-xl text-center font-medium transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#202020] dark:bg-white text-white dark:text-[#202020] font-semibold'
                      : 'bg-[#F4F4F6] dark:bg-[#20202A] text-[#6E6E77] dark:text-[#9E9EA8] hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-[#F0F0F3] dark:border-[#262632]">
          <button
            type="button"
            onClick={onReset}
            className="flex items-center gap-1.5 text-xs text-[#8E8E98] hover:text-[#E43136] transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Default</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-[#E43136] hover:bg-[#D92D32] text-white text-xs font-semibold shadow-xs cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
