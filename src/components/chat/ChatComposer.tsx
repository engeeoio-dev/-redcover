import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Smile,
  BookMarked,
  X,
  Sparkles,
  Paperclip,
  Image as ImageIcon,
  FileText,
  Mic,
  Trash2,
  Loader2,
} from 'lucide-react';
import { ChatMessageReply, Book, ChatMessageBookAttachment } from '../../models/types';
import { detectRedCodeInText, findBookByRedCode } from '../../services/firebase/redCodeService';
import { EmojiPickerTray } from './EmojiPickerTray';

interface ChatComposerProps {
  onSendMessage: (
    text: string,
    options?: {
      replyTo?: ChatMessageReply;
      bookAttachment?: ChatMessageBookAttachment;
      redCode?: string;
    }
  ) => Promise<void>;
  replyingTo: ChatMessageReply | null;
  onCancelReply: () => void;
  allBooks: Book[];
  disabled?: boolean;
  disabledReason?: string;
  textScale?: number;
}

interface PendingMediaAttachment {
  type: 'image' | 'file';
  name: string;
  url: string;
  size: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

async function compressImage(file: File): Promise<{ dataUrl: string; sizeStr: string }> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = (e.target?.result as string) || '';
      const img = new window.Image();
      img.onload = () => {
        const maxDim = 1200;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
          const sizeKb = Math.round((dataUrl.length * 3) / 4 / 1024);
          resolve({ dataUrl, sizeStr: `${sizeKb} KB` });
        } else {
          resolve({ dataUrl: src, sizeStr: formatBytes(file.size) });
        }
      };
      img.onerror = () => resolve({ dataUrl: src, sizeStr: formatBytes(file.size) });
      img.src = src;
    };
    reader.onerror = () => resolve({ dataUrl: '', sizeStr: '0 KB' });
    reader.readAsDataURL(file);
  });
}

export const ChatComposer: React.FC<ChatComposerProps> = ({
  onSendMessage,
  replyingTo,
  onCancelReply,
  allBooks,
  disabled = false,
  disabledReason,
  textScale = 12,
}) => {
  const [text, setText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showBookPicker, setShowBookPicker] = useState(false);
  const [attachedBook, setAttachedBook] = useState<Book | null>(null);
  const [bookSearch, setBookSearch] = useState('');
  const [isSending, setIsSending] = useState(false);
  const isSubmittingRef = useRef(false);

  // Attachment states
  const [pendingMedia, setPendingMedia] = useState<PendingMediaAttachment | null>(null);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);

  // Voice recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Audio recording refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Auto-expand textarea on input
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 128)}px`;
    }
  }, [text]);

  // Focus input when replyingTo changes
  useEffect(() => {
    if (replyingTo && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [replyingTo]);

  // Clean up recording on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // Detect 6-digit RedCode typed into composer
  const detectedCode = detectRedCodeInText(text);
  const detectedBook = detectedCode ? findBookByRedCode(detectedCode, allBooks) : undefined;

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = text.trim();
    if ((!clean && !attachedBook && !pendingMedia) || disabled) {
      return;
    }

    const currentText = clean;
    const currentAttachedBook = attachedBook;
    const currentPendingMedia = pendingMedia;
    const currentReplyingTo = replyingTo;

    // Instantly reset composer UI for lightning-fast responsiveness
    setText('');
    setAttachedBook(null);
    setPendingMedia(null);
    if (replyingTo) onCancelReply();
    setShowEmojiPicker(false);
    setShowBookPicker(false);
    setShowAttachMenu(false);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.focus();
    }

    try {
      let bookAttachment: ChatMessageBookAttachment | undefined = undefined;
      const targetBook = currentAttachedBook || detectedBook;

      if (targetBook) {
        bookAttachment = {
          id: targetBook.id,
          title: targetBook.title,
          author: targetBook.authorName,
          coverURL: targetBook.coverURL || '',
          description: targetBook.shortDescription || '',
          redCode: targetBook.redCode,
        };
      }

      // Format payload with media attachment token if present
      let messagePayload = currentText;
      if (currentPendingMedia) {
        if (currentPendingMedia.type === 'image') {
          messagePayload = `[attachment:image:${currentPendingMedia.name}|${currentPendingMedia.url}] ${currentText}`.trim();
        } else if (currentPendingMedia.type === 'file') {
          messagePayload = `[attachment:file:${currentPendingMedia.name}|${currentPendingMedia.url}|${currentPendingMedia.size}] ${currentText}`.trim();
        }
      }

      // Dispatch optimistic send in background without blocking composer input
      onSendMessage(messagePayload, {
        replyTo: currentReplyingTo || undefined,
        bookAttachment,
        redCode: targetBook?.redCode,
      }).catch((err) => {
        console.error('Send message dispatch notice:', err);
      });
    } catch (err) {
      console.error('Failed to prepare send:', err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Image File Picked
  const handleImageSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setIsUploadingMedia(true);
    setShowAttachMenu(false);
    try {
      const { dataUrl, sizeStr } = await compressImage(file);
      let finalUrl = dataUrl;

      // Try Firebase Storage upload in background if available
      try {
        const { uploadFileToRedcoverStorage } = await import('../../services/firebase/storageService');
        const uploaded = await uploadFileToRedcoverStorage('chat_attachments', 'chat_media', file);
        if (uploaded) finalUrl = uploaded;
      } catch {
        // Fallback to compressed Data URL
      }

      setPendingMedia({
        type: 'image',
        name: file.name,
        url: finalUrl,
        size: sizeStr,
      });
      textareaRef.current?.focus();
    } catch (err) {
      console.error('Image attach error:', err);
    } finally {
      setIsUploadingMedia(false);
    }
  };

  // Document File Picked
  const handleDocumentSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      alert('File size exceeds 20MB limit.');
      return;
    }

    setIsUploadingMedia(true);
    setShowAttachMenu(false);
    try {
      let finalUrl = '';
      try {
        const { uploadFileToRedcoverStorage } = await import('../../services/firebase/storageService');
        finalUrl = await uploadFileToRedcoverStorage('chat_attachments', 'chat_media', file);
      } catch {
        const reader = new FileReader();
        finalUrl = await new Promise<string>((resolve) => {
          reader.onload = () => resolve((reader.result as string) || '');
          reader.onerror = () => resolve('');
          reader.readAsDataURL(file);
        });
      }

      setPendingMedia({
        type: 'file',
        name: file.name,
        url: finalUrl,
        size: formatBytes(file.size),
      });
      textareaRef.current?.focus();
    } catch (err) {
      console.error('Document attach error:', err);
    } finally {
      setIsUploadingMedia(false);
    }
  };

  // Start Voice Recording
  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Microphone recording is not supported in this browser.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      let mimeType = 'audio/webm';
      if (typeof MediaRecorder !== 'undefined' && !MediaRecorder.isTypeSupported('audio/webm')) {
        if (MediaRecorder.isTypeSupported('audio/mp4')) mimeType = 'audio/mp4';
        else if (MediaRecorder.isTypeSupported('audio/ogg')) mimeType = 'audio/ogg';
        else mimeType = '';
      }

      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.start(100);
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.warn('Microphone permission or start error:', err);
      alert('Please grant microphone permission to record voice messages.');
    }
  };

  // Cancel Voice Recording
  const cancelRecording = () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsRecording(false);
    setRecordingSeconds(0);
    audioChunksRef.current = [];
  };

  // Stop & Send Voice Recording
  const finishRecordingAndSend = async () => {
    if (!mediaRecorderRef.current || isSending) return;
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);

    const durationSec = recordingSeconds;
    const durationStr = formatTimer(durationSec || 1);

    setIsSending(true);

    const recorder = mediaRecorderRef.current;
    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
      if (recorder.state !== 'inactive') {
        try {
          recorder.stop();
        } catch {
          resolve();
        }
      } else {
        resolve();
      }
    });

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsRecording(false);
    setRecordingSeconds(0);

    const audioBlob = new Blob(audioChunksRef.current, {
      type: recorder.mimeType || 'audio/webm',
    });
    audioChunksRef.current = [];

    if (audioBlob.size === 0) {
      setIsSending(false);
      return;
    }

    try {
      let finalAudioUrl = '';
      try {
        const { uploadFileToRedcoverStorage } = await import('../../services/firebase/storageService');
        const audioFile = new File([audioBlob], `voice_${Date.now()}.webm`, {
          type: audioBlob.type,
        });
        finalAudioUrl = await uploadFileToRedcoverStorage('chat_attachments', 'chat_voice', audioFile);
      } catch {
        const reader = new FileReader();
        finalAudioUrl = await new Promise<string>((resolve) => {
          reader.onload = () => resolve((reader.result as string) || '');
          reader.onerror = () => resolve('');
          reader.readAsDataURL(audioBlob);
        });
      }

      if (finalAudioUrl) {
        await onSendMessage(`[attachment:voice:${finalAudioUrl}|${durationStr}]`, {
          replyTo: replyingTo || undefined,
        });
        if (replyingTo) onCancelReply();
      }
    } catch (err) {
      console.error('Failed to send voice message:', err);
    } finally {
      setIsSending(false);
    }
  };

  const filteredBooks = allBooks.filter((b) => {
    const q = bookSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      b.title.toLowerCase().includes(q) ||
      b.authorName.toLowerCase().includes(q) ||
      (b.redCode && b.redCode.includes(q))
    );
  });

  if (disabled) {
    return (
      <div className="p-3 bg-[#F4F4F6] dark:bg-[#121217] border-t border-[#E5E5EB] dark:border-[#22222A] text-center text-xs text-[#8E8E98]">
        {disabledReason || 'Messaging is currently restricted.'}
      </div>
    );
  }

  const hasContentToSend = Boolean(text.trim() || attachedBook || pendingMedia);

  return (
    <div className="shrink-0 z-20 w-full relative border-t border-[#E5E5EB] dark:border-[#22222A] bg-white dark:bg-[#101015] pb-[max(0.35rem,env(safe-area-inset-bottom))]">
      {/* Hidden File Inputs */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageSelected}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.txt,.epub,.zip"
        className="hidden"
        onChange={handleDocumentSelected}
      />

      {/* Quoted Reply Banner */}
      {replyingTo && (
        <div className="shrink-0 flex items-center justify-between px-4 py-2 bg-[#FFF4F5] dark:bg-[#1C1418] border-b border-[#E43136]/30">
          <div className="text-xs truncate mr-2 flex-1 min-w-0">
            <span className="font-semibold text-[#E43136] mr-1.5 shrink-0">
              Replying to {replyingTo.senderName}:
            </span>
            <span className="text-[#6E6E77] dark:text-[#C5C5D0] truncate">
              {replyingTo.text}
            </span>
          </div>
          <button
            onClick={onCancelReply}
            className="p-1 rounded-md text-[#8E8E98] hover:text-[#202020] dark:hover:text-white cursor-pointer shrink-0 ml-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Explicit Attached Book Pill */}
      {attachedBook && (
        <div className="flex items-center justify-between px-4 py-1.5 bg-[#FFF3F4] dark:bg-[#E43136]/10 border-b border-[#E43136]/20">
          <div className="flex items-center gap-2 text-xs truncate">
            <BookMarked className="w-3.5 h-3.5 text-[#E43136]" />
            <span className="font-medium text-[#202020] dark:text-white truncate">
              Attaching: {attachedBook.title}
            </span>
            {attachedBook.redCode && (
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-[#E43136] text-white">
                {attachedBook.redCode}
              </span>
            )}
          </div>
          <button
            onClick={() => setAttachedBook(null)}
            className="p-1 text-[#E43136] hover:text-red-700 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Pending Media Attachment Chip / Banner */}
      {pendingMedia && (
        <div className="flex items-center justify-between px-4 py-2 bg-[#F6F7F9] dark:bg-[#1A1A24] border-b border-[#E5E5EB] dark:border-[#262632]">
          <div className="flex items-center gap-2.5 truncate mr-2">
            {pendingMedia.type === 'image' ? (
              <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 border border-black/10 bg-black/5">
                <img
                  src={pendingMedia.url}
                  alt={pendingMedia.name}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-[#E43136]/10 text-[#E43136]">
                <FileText className="w-5 h-5" />
              </div>
            )}
            <div className="truncate text-xs">
              <p className="font-medium text-[#202020] dark:text-white truncate">
                {pendingMedia.name}
              </p>
              <p className="text-[11px] text-[#8E8E98]">
                {pendingMedia.size} • Ready to send
              </p>
            </div>
          </div>
          <button
            onClick={() => setPendingMedia(null)}
            className="p-1 text-[#8E8E98] hover:text-[#202020] dark:hover:text-white cursor-pointer"
            title="Remove attachment"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Loading Upload Indicator */}
      {isUploadingMedia && (
        <div className="flex items-center gap-2 px-4 py-2 bg-sky-50 dark:bg-sky-950/20 text-sky-700 dark:text-sky-300 text-xs border-b border-sky-100 dark:border-sky-900/30">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-500" />
          <span>Processing attachment...</span>
        </div>
      )}

      {/* Auto-detected RedCode Notice */}
      {detectedBook && !attachedBook && (
        <div className="px-4 py-1 bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 text-[11px] flex items-center justify-between border-b border-amber-200 dark:border-amber-900/30">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-amber-500" />
            <span>
              RedCode <strong>{detectedCode}</strong> recognized: <em>"{detectedBook.title}"</em>
            </span>
          </div>
          <span className="text-[10px] text-amber-600 dark:text-amber-500">
            Rich card will be shared
          </span>
        </div>
      )}

      {/* Professional Tabbed Emoji Picker Popover */}
      {showEmojiPicker && (
        <div className="absolute bottom-full left-3 mb-2 z-40">
          <EmojiPickerTray
            onSelectEmoji={(emoji) => {
              setText((prev) => prev + emoji);
              textareaRef.current?.focus();
            }}
            onClose={() => setShowEmojiPicker(false)}
            title="Pick an Emoji"
          />
        </div>
      )}

      {/* Attachment Menu Popover */}
      {showAttachMenu && (
        <div className="absolute bottom-full left-12 mb-2 w-48 rounded-2xl bg-white dark:bg-[#1E1E28] shadow-2xl border border-[#DDDDE3] dark:border-[#2E2E3C] py-1.5 z-40 animate-in fade-in duration-150">
          <button
            type="button"
            onClick={() => {
              setShowAttachMenu(false);
              imageInputRef.current?.click();
            }}
            className="w-full px-3.5 py-2.5 flex items-center gap-2.5 text-xs text-[#202020] dark:text-white hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer text-left font-medium"
          >
            <div className="w-7 h-7 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-500 flex items-center justify-center">
              <ImageIcon className="w-4 h-4" />
            </div>
            <span>Photo / Image</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setShowAttachMenu(false);
              fileInputRef.current?.click();
            }}
            className="w-full px-3.5 py-2.5 flex items-center gap-2.5 text-xs text-[#202020] dark:text-white hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer text-left font-medium"
          >
            <div className="w-7 h-7 rounded-full bg-purple-50 dark:bg-purple-900/30 text-purple-500 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <span>Document / PDF</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setShowAttachMenu(false);
              setShowBookPicker(true);
            }}
            className="w-full px-3.5 py-2.5 flex items-center gap-2.5 text-xs text-[#202020] dark:text-white hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer text-left font-medium border-t border-[#E5E5EB] dark:border-[#2A2A36] mt-1 pt-2"
          >
            <div className="w-7 h-7 rounded-full bg-rose-50 dark:bg-rose-900/30 text-[#E43136] flex items-center justify-center">
              <BookMarked className="w-4 h-4" />
            </div>
            <span>Book / RedCode</span>
          </button>
        </div>
      )}

      {/* Book Picker Popover */}
      {showBookPicker && (
        <div className="absolute bottom-full left-12 mb-2 w-80 max-h-72 rounded-2xl bg-white dark:bg-[#1E1E28] shadow-2xl border border-[#DDDDE3] dark:border-[#2E2E3C] overflow-hidden flex flex-col z-40">
          <div className="p-2.5 border-b border-[#E5E5EB] dark:border-[#2A2A36] flex items-center justify-between">
            <input
              type="text"
              value={bookSearch}
              onChange={(e) => setBookSearch(e.target.value)}
              placeholder="Search book title, author, or RedCode..."
              className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-[#F4F4F6] dark:bg-[#161620] outline-none text-[#202020] dark:text-[#F4F4F6]"
              autoFocus
            />
            <button
              onClick={() => setShowBookPicker(false)}
              className="ml-2 p-1 text-[#8E8E98] hover:text-[#202020] dark:hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="p-1 overflow-y-auto space-y-1 flex-1">
            {filteredBooks.slice(0, 15).map((b) => (
              <div
                key={b.id}
                onClick={() => {
                  setAttachedBook(b);
                  setShowBookPicker(false);
                }}
                className="flex items-center justify-between p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer text-xs"
              >
                <div className="truncate mr-2">
                  <div className="font-semibold text-[#202020] dark:text-white truncate">
                    {b.title}
                  </div>
                  <div className="text-[11px] text-[#6E6E77] dark:text-[#9E9EA8] truncate">
                    {b.authorName}
                  </div>
                </div>
                {b.redCode && (
                  <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[#E43136] text-white">
                    {b.redCode}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Composer Bar */}
      {isRecording ? (
        /* Active Voice Recording Bar (WhatsApp / Telegram style) */
        <div className="p-2 sm:p-3 flex items-center justify-between gap-3 bg-red-50/50 dark:bg-red-950/20">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-[#E43136]"></span>
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-[#E43136]">Recording Voice:</span>
              <span className="font-mono text-xs font-bold text-[#202020] dark:text-white">
                {formatTimer(recordingSeconds)}
              </span>
            </div>
            {/* Animated Waveform Bars */}
            <div className="hidden sm:flex items-center gap-0.5 h-4 ml-2">
              <span className="w-0.5 h-2 bg-[#E43136] animate-pulse"></span>
              <span className="w-0.5 h-4 bg-[#E43136] animate-bounce"></span>
              <span className="w-0.5 h-3 bg-[#E43136] animate-pulse"></span>
              <span className="w-0.5 h-4 bg-[#E43136] animate-bounce"></span>
              <span className="w-0.5 h-2 bg-[#E43136] animate-pulse"></span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={cancelRecording}
              className="p-2 rounded-full text-[#6E6E77] hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors cursor-pointer"
              title="Cancel recording"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={finishRecordingAndSend}
              disabled={isSending}
              className="px-3.5 py-1.5 rounded-full bg-[#E43136] text-white hover:bg-[#D92D32] transition-colors flex items-center gap-1.5 text-xs font-semibold shadow-xs cursor-pointer"
              title="Send voice note"
            >
              {isSending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span>Send</span>
            </button>
          </div>
        </div>
      ) : (
        /* Normal Message Input Bar */
        <form onSubmit={handleSend} className="p-1.5 sm:p-2.5 flex items-end gap-1 sm:gap-2">
          {/* Emoji Tray Button */}
          <button
            type="button"
            onClick={() => {
              setShowEmojiPicker(!showEmojiPicker);
              setShowAttachMenu(false);
              setShowBookPicker(false);
            }}
            className={`min-h-[36px] min-w-[36px] sm:min-h-[44px] sm:min-w-[44px] w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
              showEmojiPicker
                ? 'bg-[#FFF3F4] text-[#E43136] dark:bg-[#E43136]/15'
                : 'text-[#6E6E77] dark:text-[#9E9EA8] hover:text-[#202020] dark:hover:text-white hover:bg-[#F1F1F4] dark:hover:bg-[#1C1C24]'
            }`}
            title="Emoji Picker"
            aria-label="Emoji Picker"
          >
            <Smile className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          {/* Attachment Menu Button */}
          <button
            type="button"
            onClick={() => {
              setShowAttachMenu(!showAttachMenu);
              setShowEmojiPicker(false);
              setShowBookPicker(false);
            }}
            className={`min-h-[36px] min-w-[36px] sm:min-h-[44px] sm:min-w-[44px] w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
              showAttachMenu
                ? 'bg-[#FFF3F4] text-[#E43136] dark:bg-[#E43136]/15'
                : 'text-[#6E6E77] dark:text-[#9E9EA8] hover:text-[#E43136] hover:bg-[#F1F1F4] dark:hover:bg-[#1C1C24]'
            }`}
            title="Attach Media or File"
            aria-label="Attach Media or File"
          >
            <Paperclip className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          {/* Book / RedCode Quick Button */}
          <button
            type="button"
            onClick={() => {
              setShowBookPicker(!showBookPicker);
              setShowEmojiPicker(false);
              setShowAttachMenu(false);
            }}
            className="min-h-[36px] min-w-[36px] sm:min-h-[44px] sm:min-w-[44px] w-9 h-9 sm:w-10 sm:h-10 rounded-full text-[#6E6E77] dark:text-[#9E9EA8] hover:text-[#E43136] hover:bg-[#F1F1F4] dark:hover:bg-[#1C1C24] transition-colors cursor-pointer hidden sm:flex items-center justify-center shrink-0"
            title="Attach Book / RedCode"
            aria-label="Attach Book / RedCode"
          >
            <BookMarked className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          {/* Auto-expanding Multiline Textarea Input */}
          <div className="flex-1 min-w-0 flex items-center min-h-[36px] sm:min-h-[44px] bg-[#F4F4F6] dark:bg-[#181820] rounded-xl sm:rounded-2xl px-2.5 sm:px-3 py-0.5 sm:py-1 border border-[#DDDDE3] dark:border-[#282834] focus-within:border-[#E43136] focus-within:ring-1 focus-within:ring-[#E43136]/30 transition-all">
            <textarea
              ref={textareaRef}
              rows={1}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              style={{ fontSize: `${textScale}px` }}
              placeholder="Message or RedCode..."
              maxLength={2000}
              className="w-full bg-transparent text-[#202020] dark:text-[#F4F4F6] outline-none resize-none leading-relaxed max-h-32 placeholder:text-[#9E9EA8] overflow-y-auto no-scrollbar py-1"
            />
          </div>

          {/* Right Action: Send OR Mic (Voice Recording) */}
          {hasContentToSend ? (
            <button
              type="submit"
              disabled={isSending}
              className="min-h-[36px] min-w-[36px] sm:min-h-[44px] sm:min-w-[44px] w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#E43136] text-white hover:bg-[#D92D32] transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-xs cursor-pointer shrink-0 flex items-center justify-center active:scale-95"
              title="Send message"
              aria-label="Send message"
            >
              {isSending ? (
                <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={startRecording}
              className="min-h-[36px] min-w-[36px] sm:min-h-[44px] sm:min-w-[44px] w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#F4F4F6] dark:bg-[#1C1C24] text-[#6E6E77] dark:text-[#9E9EA8] hover:text-[#E43136] hover:bg-[#FFF3F4] dark:hover:bg-[#E43136]/15 transition-all shadow-xs cursor-pointer shrink-0 flex items-center justify-center active:scale-95"
              title="Record voice note"
              aria-label="Record voice note"
            >
              <Mic className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          )}
        </form>
      )}
    </div>
  );
};
