import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, ShieldCheck } from 'lucide-react';
import { reauthenticateWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { useRedcover } from '../contexts/RedcoverContext';
import { PdfCanvasReader } from '../components/reader/PdfCanvasReader';
import { ComicPageComments } from '../components/reader/ComicPageComments';
import { googleProvider } from '../services/firebase/firebaseConfig';
import { verifyGoogleAccountAge, VerifiedAgeBand } from '../services/firebase/ageVerificationService';

const ageRank: Record<VerifiedAgeBand, number> = { under12: 0, '12plus': 12, '16plus': 16, '18plus': 18 };
const ratingRank = { all: 0, '12+': 12, '16+': 16, '18+': 18 } as const;

export const GraphicNovelReaderPage: React.FC = () => {
  const { bookId = '' } = useParams();
  const navigate = useNavigate();
  const { books, booksLoading, currentUser, firebaseUser, theme, addToast, loginWithGoogle, isAdmin } = useRedcover();
  const book = useMemo(() => books.find((item) => item.id === bookId), [books, bookId]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [ageBand, setAgeBand] = useState<VerifiedAgeBand | ''>('');
  const [checkingAge, setCheckingAge] = useState(false);
  const [ageError, setAgeError] = useState('');

  useEffect(() => {
    let active = true;
    if (!firebaseUser) { setAgeBand(''); return; }
    firebaseUser.getIdTokenResult().then(({ claims }) => {
      if (active) setAgeBand(typeof claims.redcoverAgeBand === 'string' ? claims.redcoverAgeBand as VerifiedAgeBand : '');
    }).catch(() => { if (active) setAgeBand(''); });
    return () => { active = false; };
  }, [firebaseUser]);

  const verifyAge = async () => {
    if (!firebaseUser) { await loginWithGoogle(); return; }
    setCheckingAge(true); setAgeError('');
    try {
      const credentialResult = await reauthenticateWithPopup(firebaseUser, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(credentialResult);
      const band = await verifyGoogleAccountAge(credential?.accessToken || '');
      await firebaseUser.getIdToken(true);
      setAgeBand(band);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Age verification could not be completed.';
      setAgeError(message);
      addToast('Age verification could not be completed. Check Google birthday permission and try again.', 'error');
    } finally { setCheckingAge(false); }
  };

  if (booksLoading && !book) return <div className="min-h-[50vh] grid place-items-center"><div className="text-center"><div className="mx-auto mb-3 h-8 w-8 rounded-full border-2 border-[#E43136] border-t-transparent animate-spin"/><p className="text-sm text-[#777780]">Loading graphic novel…</p></div></div>;
  if (!book || book.contentType !== 'graphic_novel') return <div className="max-w-lg mx-auto my-16 rounded-2xl border border-[#E8E8EC] dark:border-[#292930] p-8 text-center"><h1 className="font-semibold text-xl">Graphic novel not found</h1><button onClick={() => navigate('/explore')} className="mt-4 text-sm text-[#E43136]">Browse books</button></div>;

  const rating = book.ageRating || 'all';
  const published = book.status === 'published';
  const owner = firebaseUser?.uid === book.authorId;
  const ageAllowed = ratingRank[rating] === 0 || owner || isAdmin || (!!ageBand && ageRank[ageBand] >= ratingRank[rating]);
  const accessDenied = !published && !owner;
  if (accessDenied) return <div className="max-w-lg mx-auto my-16 rounded-2xl border border-[#E8E8EC] dark:border-[#292930] p-8 text-center"><ShieldCheck className="mx-auto text-[#E43136]"/><h1 className="mt-3 font-semibold text-xl">This graphic novel is private</h1><p className="mt-2 text-sm text-[#777780]">Only its author can open an unpublished book.</p><button onClick={() => navigate(-1)} className="mt-4 text-sm text-[#E43136]">Go back</button></div>;

  if (!firebaseUser || !ageAllowed) return <div className="max-w-lg mx-auto my-16 rounded-2xl border border-[#E8E8EC] dark:border-[#292930] p-8 text-center"><ShieldCheck className="mx-auto text-[#E43136]"/><p className="mt-3 text-xs uppercase tracking-wider text-[#E43136]">Age rating · {rating === 'all' ? 'All ages' : rating}</p><h1 className="mt-2 font-semibold text-xl">Verify your age to read</h1><p className="mt-2 text-sm text-[#777780]">Redcover checks your Google account’s birthday. It stores an age band only, not your birth date.</p><button disabled={checkingAge} onClick={() => void verifyAge()} className="mt-5 rounded-xl bg-[#E43136] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{checkingAge ? 'Checking…' : !firebaseUser ? 'Continue with Google' : 'Verify with Google'}</button>{ageError && <p className="mt-3 text-xs text-red-500 break-words">{ageError}</p>}</div>;

  const episodes = books.filter((item) => item.status === 'published' && item.contentType === 'graphic_novel' && book.seriesId && item.seriesId === book.seriesId).sort((a,b) => (a.episodeNumber || 0) - (b.episodeNumber || 0));
  return <div className="mx-auto w-full max-w-[1400px] space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E8E8EC] dark:border-[#292930] bg-white dark:bg-[#151519] px-4 py-3">
      <div className="flex min-w-0 items-center gap-3"><button onClick={() => navigate(`/book/${book.id}`)} className="rounded-lg p-2 hover:bg-black/5 dark:hover:bg-white/5" aria-label="Back to book"><ArrowLeft size={18}/></button><div className="min-w-0"><h1 className="truncate font-semibold">{book.title}</h1><p className="text-xs text-[#777780]">{book.authorName} · {rating === 'all' ? 'All ages' : rating}{book.episodeNumber ? ` · Episode ${book.episodeNumber}` : ''}</p></div></div>
      {episodes.length > 1 && <label className="flex items-center gap-2 text-xs"><BookOpen size={15}/><select value={book.id} onChange={(e) => navigate(`/graphic-novel/${e.target.value}`)} className="max-w-48 rounded-lg border border-[#E8E8EC] dark:border-[#303039] bg-transparent px-2 py-2">{episodes.map((episode) => <option key={episode.id} value={episode.id}>{episode.episodeNumber ? `Episode ${episode.episodeNumber}: ` : ''}{episode.title}</option>)}</select></label>}
    </div>
    <div className="h-[min(72vh,900px)] min-h-[420px] overflow-hidden rounded-2xl border border-[#E8E8EC] dark:border-[#292930] bg-[#F2F2F4] dark:bg-[#101014]">
      <PdfCanvasReader bookId={book.id} bookTitle={book.title} authorName={book.authorName} fileURL={book.fileURL} chapters={[]} initialPage={1} readerTheme={theme === 'dark' ? 'dark' : 'light'} bookmarkedPages={[]} onPageChange={(current, total) => { setPage(current); setTotalPages(total); }} onTogglePageBookmark={() => {}} onSwitchToTextMode={() => navigate(`/read/${book.id}?mode=text`)} />
    </div>
    <div className="max-w-3xl mx-auto"><ComicPageComments bookId={book.id} pageNumber={page} user={currentUser} onAuthRequired={() => void loginWithGoogle()}/>{totalPages > 0 && <p className="pt-2 text-center text-[11px] text-[#888891]">Comments are attached to page {page} of {totalPages}.</p>}</div>
  </div>;
};
