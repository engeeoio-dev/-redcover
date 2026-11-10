import React, { useState, useEffect, useRef } from 'react';
import {
  BookOpen,
  Send,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Radio,
  X,
  Lock,
  LogOut,
  Users,
  CornerDownRight,
  Sparkles,
} from 'lucide-react';
import {
  ReadingSession,
  ReadingRemoteRequest,
  Book,
  Chapter,
  UserProfile,
} from '../../models/types';
import { UserAvatar, BookCover } from '../common/UIPrimitives';
import {
  updateReadingPosition,
  requestRemoteControl,
  respondToRemoteRequest,
  endReadingSession,
} from '../../services/firebase/readingSessionService';
import { PdfCanvasReader } from '../reader/PdfCanvasReader';
import { doc, onSnapshot, collection } from 'firebase/firestore';
import { db } from '../../services/firebase/firebaseConfig';

interface SharedReadingSessionViewProps {
  session: ReadingSession;
  book: Book;
  chapters: Chapter[];
  currentUser: UserProfile;
  remoteUser?: UserProfile;
  onExitSession: () => void;
}

interface SessionChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: string;
}

export const SharedReadingSessionView: React.FC<SharedReadingSessionViewProps> = ({
  session,
  book,
  chapters,
  currentUser,
  remoteUser,
  onExitSession,
}) => {
  const [currentSession, setCurrentSession] = useState<ReadingSession>(session);
  const [pendingRequests, setPendingRequests] = useState<ReadingRemoteRequest[]>([]);
  const [chatMessages, setChatMessages] = useState<SessionChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [requestSent, setRequestSent] = useState(false);
  const [requestCooldown, setRequestCooldown] = useState(false);

  const readerContainerRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Real-time synchronization of reading session document
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'readingSessions', session.id), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as ReadingSession;
        setCurrentSession(data);
      }
    });
    return () => unsub();
  }, [session.id]);

  // Real-time synchronization of remote requests
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'readingRemoteRequests'),
      (snap) => {
        const reqs: ReadingRemoteRequest[] = [];
        snap.forEach((d) => {
          const r = d.data() as ReadingRemoteRequest;
          if (r.sessionId === session.id && r.status === 'pending') {
            reqs.push(r);
          }
        });
        setPendingRequests(reqs);
      }
    );
    return () => unsub();
  }, [session.id]);

  const isController = currentSession.activeControllerId === currentUser.uid;
  const currentChapterObj = chapters.find(
    (c) => c.chapterNumber === currentSession.currentChapter
  ) || chapters[0];

  // Controller action: Change chapter
  const handleChapterChange = async (newChapter: number) => {
    if (!isController) return;
    try {
      await updateReadingPosition(
        currentSession.id,
        currentUser.uid,
        newChapter,
        1,
        0
      );
    } catch (err) {
      console.error(err);
    }
  };

  // Controller action: Change PDF page
  const handlePageChange = async (newPage: number) => {
    if (!isController) return;
    try {
      await updateReadingPosition(
        currentSession.id,
        currentUser.uid,
        currentSession.currentChapter,
        newPage,
        0
      );
    } catch (err) {
      console.error(err);
    }
  };

  // Non-controller action: Request remote
  const handleRequestRemote = async () => {
    if (isController || requestCooldown) return;
    setRequestCooldown(true);
    try {
      await requestRemoteControl(currentSession.id, currentUser);
      setRequestSent(true);
      setTimeout(() => setRequestSent(false), 4000);
      setTimeout(() => setRequestCooldown(false), 15000);
    } catch (err) {
      console.error(err);
      setRequestCooldown(false);
    }
  };

  // Controller action: Approve / Reject remote request
  const handleRespondToRequest = async (
    req: ReadingRemoteRequest,
    approve: boolean
  ) => {
    try {
      await respondToRemoteRequest(
        currentSession.id,
        req.id,
        approve,
        req.requesterId,
        req.requesterName
      );
    } catch (err) {
      console.error(err);
    }
  };

  // Local synchronized in-session chat
  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    const newMsg: SessionChatMessage = {
      id: `smsg_${Date.now()}`,
      senderId: currentUser.uid,
      senderName: currentUser.displayName,
      text: inputText.trim(),
      createdAt: new Date().toISOString(),
    };
    setChatMessages((prev) => [...prev, newMsg]);
    setInputText('');
    setTimeout(() => {
      chatScrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  return (
    <div className="h-[100dvh] w-full flex flex-col bg-[#FAFAFB] dark:bg-[#0A0A0D] text-[#202020] dark:text-[#F4F4F6] overflow-hidden">
      {/* Top Session Control Header */}
      <div className="h-14 shrink-0 px-4 bg-white dark:bg-[#121217] border-b border-[#E5E5EB] dark:border-[#22222A] flex items-center justify-between z-30 shadow-2xs">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onExitSession}
            className="p-1.5 rounded-lg text-[#6E6E77] hover:text-[#202020] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
            title="Exit Session"
          >
            <LogOut className="w-4 h-4" />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <h3 className="font-bold text-xs sm:text-sm truncate">
                {book.title}
              </h3>
            </div>
            <p className="text-[10px] text-[#6E6E77] dark:text-[#9E9EA8] truncate">
              Synchronized Co-Reading with {currentSession.participantName || 'Reader'}
            </p>
          </div>
        </div>

        {/* Remote Controller Status Indicator */}
        <div className="flex items-center gap-2">
          <div
            className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 text-xs font-semibold shadow-2xs transition-all ${
              isController
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800'
                : 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border-amber-300 dark:border-amber-800'
            }`}
          >
            <Radio className={`w-3.5 h-3.5 ${isController ? 'text-emerald-600 animate-pulse' : 'text-amber-500'}`} />
            <span>
              Remote is with: <strong>{isController ? 'You' : currentSession.activeControllerName}</strong>
            </span>
          </div>

          {!isController && (
            <button
              onClick={handleRequestRemote}
              disabled={requestCooldown}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white bg-[#E43136] hover:bg-[#D92D32] transition-colors disabled:opacity-50 shadow-2xs cursor-pointer inline-flex items-center gap-1 shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{requestSent ? 'Request Sent!' : 'Request Remote'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Co-Reading Layout (60% Reader / 40% Participants & Chat) */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* ================= 60% BOOK READER AREA ================= */}
        <div
          ref={readerContainerRef}
          className="h-[58%] md:h-full md:w-[62%] flex flex-col bg-white dark:bg-[#0D0D12] border-b md:border-b-0 md:border-r border-[#E5E5EB] dark:border-[#22222A] overflow-hidden relative"
        >
          {/* Reader Sub-bar */}
          <div className="h-10 px-4 bg-[#F9F9FB] dark:bg-[#14141B] border-b border-[#E5E5EB] dark:border-[#22222A] flex items-center justify-between text-xs shrink-0">
            <span className="font-semibold text-[#6E6E77] dark:text-[#9E9EA8] truncate">
              {book.format === 'pdf'
                ? `Page ${currentSession.currentPage}`
                : currentChapterObj?.title || `Chapter ${currentSession.currentChapter}`}
            </span>

            {/* Controller Navigation Controls */}
            {isController ? (
              <div className="flex items-center gap-1.5">
                {book.format === 'pdf' ? (
                  <>
                    <button
                      onClick={() => handlePageChange(Math.max(1, currentSession.currentPage - 1))}
                      disabled={currentSession.currentPage <= 1}
                      className="p-1 rounded bg-white dark:bg-[#1E1E28] border border-[#DDDDE3] dark:border-[#2E2E3A] hover:border-[#E43136] cursor-pointer disabled:opacity-40"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[11px] font-mono px-1">
                      {currentSession.currentPage}
                    </span>
                    <button
                      onClick={() => handlePageChange(currentSession.currentPage + 1)}
                      className="p-1 rounded bg-white dark:bg-[#1E1E28] border border-[#DDDDE3] dark:border-[#2E2E3A] hover:border-[#E43136] cursor-pointer"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() =>
                        handleChapterChange(Math.max(1, currentSession.currentChapter - 1))
                      }
                      disabled={currentSession.currentChapter <= 1}
                      className="p-1 rounded bg-white dark:bg-[#1E1E28] border border-[#DDDDE3] dark:border-[#2E2E3A] hover:border-[#E43136] cursor-pointer disabled:opacity-40"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[11px] font-mono px-1">
                      Ch. {currentSession.currentChapter}
                    </span>
                    <button
                      onClick={() =>
                        handleChapterChange(
                          Math.min(chapters.length || 1, currentSession.currentChapter + 1)
                        )
                      }
                      disabled={currentSession.currentChapter >= chapters.length}
                      className="p-1 rounded bg-white dark:bg-[#1E1E28] border border-[#DDDDE3] dark:border-[#2E2E3A] hover:border-[#E43136] cursor-pointer disabled:opacity-40"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1 text-[11px] text-[#8E8E98]">
                <Lock className="w-3 h-3 text-amber-500" />
                <span>Synchronized with {currentSession.activeControllerName}</span>
              </div>
            )}
          </div>

          {/* Reader Content Screen */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-8">
            {book.format === 'pdf' && book.fileURL ? (
              <PdfCanvasReader
                bookId={book.id}
                bookTitle={book.title}
                authorName={book.authorName}
                fileURL={book.fileURL}
                chapters={chapters}
                initialPage={currentSession.currentPage || 1}
                readerTheme="light"
                bookmarkedPages={[]}
                onPageChange={(page) => {
                  if (isController) handlePageChange(page);
                }}
                onTogglePageBookmark={() => {}}
                onSwitchToTextMode={() => {}}
              />
            ) : (
              <div className="max-w-2xl mx-auto py-4">
                <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#202020] dark:text-[#F4F4F6] mb-6">
                  {currentChapterObj?.title || `Chapter ${currentSession.currentChapter}`}
                </h2>
                <div className="prose dark:prose-invert font-serif text-sm sm:text-base leading-relaxed whitespace-pre-wrap">
                  {currentChapterObj?.content || 'Loading chapter content...'}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ================= 40% CONVERSATION & PARTICIPANTS AREA ================= */}
        <div className="h-[42%] md:h-full md:w-[38%] flex flex-col bg-[#F9F9FB] dark:bg-[#101016] overflow-hidden">
          {/* Participants Bar */}
          <div className="p-3 bg-white dark:bg-[#14141C] border-b border-[#E5E5EB] dark:border-[#22222A] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-4">
              {/* Current User */}
              <div className="flex items-center gap-2">
                <div className="relative">
                  <UserAvatar photoURL={currentUser.photoURL} name={currentUser.displayName} size="sm" />
                  <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 ring-1 ring-white" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-[#202020] dark:text-white truncate">
                    {currentUser.displayName} (You)
                  </div>
                  <div className="text-[10px] text-[#8E8E98]">
                    {isController ? 'Active Controller' : 'Listening'}
                  </div>
                </div>
              </div>

              {/* Remote User */}
              <div className="flex items-center gap-2">
                <div className="relative">
                  <UserAvatar
                    photoURL={remoteUser?.photoURL || currentSession.participantAvatar}
                    name={remoteUser?.displayName || currentSession.participantName || 'Reader'}
                    size="sm"
                  />
                  <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 ring-1 ring-white" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-[#202020] dark:text-white truncate">
                    {remoteUser?.displayName || currentSession.participantName || 'Reader'}
                  </div>
                  <div className="text-[10px] text-[#8E8E98]">
                    {!isController ? 'Active Controller' : 'Listening'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Pending Remote Request Alert (Controller view) */}
          {isController && pendingRequests.length > 0 && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-300 dark:border-amber-800 flex items-center justify-between gap-2 animate-in slide-in-from-top">
              <div className="text-xs text-amber-900 dark:text-amber-200">
                <strong>{pendingRequests[0].requesterName}</strong> requested the remote control.
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => handleRespondToRequest(pendingRequests[0], true)}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-2xs cursor-pointer"
                >
                  Pass Remote
                </button>
                <button
                  onClick={() => handleRespondToRequest(pendingRequests[0], false)}
                  className="px-2 py-1 rounded-lg text-xs font-medium text-[#6E6E77] hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                >
                  Decline
                </button>
              </div>
            </div>
          )}

          {/* Chat Messages Stream */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {chatMessages.length === 0 ? (
              <div className="text-center py-8 text-xs text-[#8E8E98]">
                <p className="font-semibold text-xs text-[#202020] dark:text-white mb-0.5">
                  Live Co-Reading Discussion
                </p>
                <p>Chat with your reading partner in real time while turning pages.</p>
              </div>
            ) : (
              chatMessages.map((msg) => {
                const isMine = msg.senderId === currentUser.uid;
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                  >
                    {!isMine && (
                      <span className="text-[10px] font-semibold text-[#6E6E77] dark:text-[#9E9EA8] ml-1 mb-0.5">
                        {msg.senderName}
                      </span>
                    )}
                    <div
                      className={`px-3 py-1.5 rounded-2xl text-xs max-w-[85%] shadow-2xs ${
                        isMine
                          ? 'bg-[#E43136] text-white rounded-tr-xs'
                          : 'bg-white dark:bg-[#1E1E28] text-[#202020] dark:text-[#F4F4F6] border border-[#E5E5EB] dark:border-[#2C2C3A] rounded-tl-xs'
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatScrollRef} />
          </div>

          {/* Quick Chat Composer */}
          <form
            onSubmit={handleSendChat}
            className="p-2.5 bg-white dark:bg-[#14141C] border-t border-[#E5E5EB] dark:border-[#22222A] flex items-center gap-2"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Chat while reading..."
              maxLength={500}
              className="flex-1 px-3 py-1.5 text-xs rounded-full bg-[#F4F4F6] dark:bg-[#1B1B24] outline-none text-[#202020] dark:text-[#F4F4F6] focus:ring-1 focus:ring-[#E43136]"
            />
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="p-2 rounded-full bg-[#E43136] text-white hover:bg-[#D92D32] transition-colors disabled:opacity-40 cursor-pointer shrink-0 shadow-2xs"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
