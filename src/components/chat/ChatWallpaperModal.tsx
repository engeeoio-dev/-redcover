import React, { useState } from 'react';
import { X, Check, Image as ImageIcon, Sparkles } from 'lucide-react';
import { ChatWallpaperConfig, ChatWallpaperType } from '../../models/types';

interface ChatWallpaperModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentWallpaper: ChatWallpaperConfig;
  onSelectWallpaper: (config: ChatWallpaperConfig) => void;
}

const PRESET_SOLID_COLORS = [
  { label: 'Default', value: '#FAFAFB', darkValue: '#0E0E12', type: 'default' as const },
  { label: 'Slate', value: '#F1F5F9', darkValue: '#0F172A', type: 'solid' as const },
  { label: 'Rose Soft', value: '#FFF1F2', darkValue: '#1C0B0E', type: 'solid' as const },
  { label: 'Amber Warm', value: '#FEF3C7', darkValue: '#1C150A', type: 'solid' as const },
  { label: 'Emerald Mint', value: '#ECFDF5', darkValue: '#061A12', type: 'solid' as const },
  { label: 'Sky Blue', value: '#F0F9FF', darkValue: '#081726', type: 'solid' as const },
  { label: 'Midnight Black', value: '#121217', darkValue: '#050507', type: 'solid' as const },
];

const PRESET_PATTERNS = [
  {
    id: 'pattern_library',
    label: 'Old Library',
    preview: 'linear-gradient(135deg, rgba(228,49,54,0.06) 0%, rgba(32,32,32,0.04) 100%)',
    css: 'radial-gradient(#E43136 0.75px, transparent 0.75px), radial-gradient(#6E6E77 0.75px, #FAFAFB 0.75px)',
  },
  {
    id: 'pattern_parchment',
    label: 'Vintage Parchment',
    preview: 'linear-gradient(135deg, #FBF8F1 0%, #F5EEDB 100%)',
    css: 'linear-gradient(135deg, #FBF8F1 0%, #F5EEDB 100%)',
  },
  {
    id: 'pattern_crimson_haze',
    label: 'Redcover Crimson',
    preview: 'linear-gradient(135deg, rgba(228,49,54,0.12) 0%, rgba(20,20,24,0.05) 100%)',
    css: 'linear-gradient(135deg, rgba(228,49,54,0.08) 0%, transparent 60%)',
  },
  {
    id: 'pattern_constellations',
    label: 'Constellations',
    preview: 'linear-gradient(135deg, #09090D 0%, #171722 100%)',
    css: 'radial-gradient(rgba(255,255,255,0.15) 1px, transparent 1px)',
  },
];

export const ChatWallpaperModal: React.FC<ChatWallpaperModalProps> = ({
  isOpen,
  onClose,
  currentWallpaper,
  onSelectWallpaper,
}) => {
  const [selected, setSelected] = useState<ChatWallpaperConfig>(currentWallpaper);

  if (!isOpen) return null;

  const handleCustomUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('Wallpaper image must be under 2MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const config: ChatWallpaperConfig = {
          type: 'custom',
          value: reader.result,
        };
        setSelected(config);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleApply = () => {
    onSelectWallpaper(selected);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-white dark:bg-[#121217] rounded-2xl shadow-2xl border border-[#E5E5EB] dark:border-[#22222A] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#E5E5EB] dark:border-[#22222A] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#E43136]" />
            <h3 className="font-semibold text-base text-[#202020] dark:text-[#F4F4F6]">
              Chat Wallpaper
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#6E6E77] hover:text-[#202020] dark:hover:text-white hover:bg-[#F1F1F4] dark:hover:bg-[#1E1E26] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-6 flex-1">
          {/* Solid Colors */}
          <div>
            <h4 className="text-xs font-semibold text-[#6E6E77] dark:text-[#9E9EA8] uppercase tracking-wider mb-3">
              Solid Colors
            </h4>
            <div className="grid grid-cols-4 gap-3">
              {PRESET_SOLID_COLORS.map((color) => {
                const isSelected =
                  selected.type === color.type &&
                  (selected.value === color.value || selected.value === color.darkValue);
                return (
                  <button
                    key={color.label}
                    onClick={() =>
                      setSelected({
                        type: color.type,
                        value: color.value,
                      })
                    }
                    className={`h-14 rounded-xl border flex flex-col items-center justify-center relative transition-all cursor-pointer ${
                      isSelected
                        ? 'border-[#E43136] ring-2 ring-[#E43136]/30 shadow-sm'
                        : 'border-[#DDDDE3] dark:border-[#2A2A34] hover:scale-102'
                    }`}
                    style={{ backgroundColor: color.value }}
                    title={color.label}
                  >
                    {isSelected && (
                      <span className="w-5 h-5 rounded-full bg-[#E43136] text-white flex items-center justify-center shadow-xs">
                        <Check className="w-3.5 h-3.5" />
                      </span>
                    )}
                    <span className="text-[10px] text-[#444] font-medium mt-1 truncate px-1">
                      {color.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Preset Patterns */}
          <div>
            <h4 className="text-xs font-semibold text-[#6E6E77] dark:text-[#9E9EA8] uppercase tracking-wider mb-3">
              Preset Themes
            </h4>
            <div className="grid grid-cols-2 gap-3">
              {PRESET_PATTERNS.map((p) => {
                const isSelected = selected.type === 'preset' && selected.value === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() =>
                      setSelected({
                        type: 'preset',
                        value: p.id,
                      })
                    }
                    className={`h-20 rounded-xl border p-3 flex flex-col justify-between text-left relative transition-all cursor-pointer ${
                      isSelected
                        ? 'border-[#E43136] ring-2 ring-[#E43136]/30 shadow-sm'
                        : 'border-[#DDDDE3] dark:border-[#2A2A34] hover:scale-102'
                    }`}
                    style={{ background: p.preview }}
                  >
                    <span className="text-xs font-medium text-[#202020] dark:text-[#F4F4F6]">
                      {p.label}
                    </span>
                    {isSelected && (
                      <span className="w-5 h-5 rounded-full bg-[#E43136] text-white flex items-center justify-center self-end shadow-xs">
                        <Check className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Upload */}
          <div>
            <h4 className="text-xs font-semibold text-[#6E6E77] dark:text-[#9E9EA8] uppercase tracking-wider mb-3">
              Custom Image
            </h4>
            <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-[#DDDDE3] dark:border-[#2A2A34] hover:border-[#E43136] dark:hover:border-[#E43136] rounded-xl cursor-pointer text-xs font-medium text-[#6E6E77] dark:text-[#9E9EA8] hover:text-[#E43136] transition-colors">
              <ImageIcon className="w-4 h-4" />
              <span>Upload Custom Wallpaper (max 2MB)</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleCustomUpload}
                className="hidden"
              />
            </label>
            {selected.type === 'custom' && (
              <div className="mt-3 relative w-full h-24 rounded-xl overflow-hidden border border-[#E43136]">
                <img
                  src={selected.value}
                  alt="Custom Wallpaper Preview"
                  className="w-full h-full object-cover"
                />
                <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/70 text-white text-[10px]">
                  Custom Active
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#E5E5EB] dark:border-[#22222A] flex justify-end gap-2 bg-[#FAFAFB] dark:bg-[#0E0E12]">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-[#6E6E77] hover:bg-[#EDEDF2] dark:hover:bg-[#1C1C24] transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-[#E43136] hover:bg-[#D92D32] transition-colors shadow-xs cursor-pointer"
          >
            Apply Wallpaper
          </button>
        </div>
      </div>
    </div>
  );
};
