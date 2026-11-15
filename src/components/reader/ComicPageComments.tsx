import React, { useEffect, useState } from 'react';
import { MessageCircle, Send, Pencil, Trash2, ChevronDown, ChevronUp, X } from 'lucide-react';
import { ComicPageComment, UserProfile } from '../../models/types';
import {
  addComicPageComment,
  countComicPageReplies,
  deleteComicPageComment,
  editComicPageComment,
  subscribeComicPageComments,
} from '../../services/firebase/comicPageCommentsService';

type Props = { bookId: string; pageNumber: number; user: UserProfile | null; onAuthRequired: () => void };

export const ComicPageComments: React.FC<Props> = ({ bookId, pageNumber, user, onAuthRequired }) => {
  const [comments, setComments] = useState<ComicPageComment[]>([]);
  const [text, setText] = useState('');
  const [replyingTo, setReplyingTo] = useState<ComicPageComment | null>(null);
  const [editing, setEditing] = useState<ComicPageComment | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [openReplies, setOpenReplies] = useState<Record<string, boolean>>({});
  const [replyCounts, setReplyCounts] = useState<Record<string, number>>({});
  const [replyPages, setReplyPages] = useState<Record<string, number>>({});
  const [replies, setReplies] = useState<Record<string, ComicPageComment[]>>({});

  useEffect(() => subscribeComicPageComments(bookId, pageNumber, '', setComments, (e) => setError(e.message)), [bookId, pageNumber]);
  useEffect(() => {
    let active = true;
    Promise.all(comments.map(async (comment) => [comment.id, await countComicPageReplies(bookId, pageNumber, comment.id)] as const))
      .then((pairs) => { if (active) setReplyCounts(Object.fromEntries(pairs)); })
      .catch((e) => { if (active) setError(e.message || 'Could not load replies.'); });
    return () => { active = false; };
  }, [bookId, pageNumber, comments]);

  useEffect(() => {
    const visibleRoots = comments.filter((comment) => openReplies[comment.id]);
    const unsubs = visibleRoots.map((comment) => subscribeComicPageComments(
      bookId,
      pageNumber,
      comment.id,
      (rows) => setReplies((old) => ({ ...old, [comment.id]: rows })),
      (e) => setError(e.message),
      Math.max(10, (replyPages[comment.id] || 1) * 10)
    ));
    return () => unsubs.forEach((unsubscribe) => unsubscribe());
  }, [bookId, pageNumber, comments, openReplies, replyPages]);

  const submit = async () => {
    if (!user) { onAuthRequired(); return; }
    setBusy(true); setError('');
    try {
      if (editing) await editComicPageComment(editing.id, text);
      else await addComicPageComment(bookId, pageNumber, text, user, replyingTo || undefined);
      setText(''); setReplyingTo(null); setEditing(null);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save comment.'); }
    finally { setBusy(false); }
  };

  const remove = async (comment: ComicPageComment) => {
    if (!window.confirm('Delete this comment and its replies?')) return;
    setError('');
    try { await deleteComicPageComment(comment.id); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not delete comment.'); }
  };

  const beginEdit = (comment: ComicPageComment) => { setEditing(comment); setReplyingTo(null); setText(comment.text); };
  const beginReply = (comment: ComicPageComment) => { setReplyingTo(comment); setEditing(null); setText(''); };

  const renderComment = (comment: ComicPageComment, isReply = false) => (
    <article key={comment.id} className={`py-3 ${isReply ? 'ml-5 border-l border-[#E8E8EC] dark:border-[#303039] pl-3' : 'border-b border-[#E8E8EC] dark:border-[#303039]'}`}>
      <div className="flex items-start gap-2.5">
        {comment.userAvatar ? <img src={comment.userAvatar} alt="" className="w-7 h-7 rounded-full object-cover" /> : <div className="w-7 h-7 rounded-full bg-[#FDEBED] dark:bg-[#37181B]" />}
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold">{comment.userName}<span className="ml-2 text-[10px] font-normal text-[#888891]">{new Date(comment.createdAt).toLocaleDateString()}</span></div>
          <p className="mt-1 text-sm whitespace-pre-wrap break-words">{comment.replyToUserName && <span className="text-[#E43136]">@{comment.replyToUserName} </span>}{comment.text}</p>
          <div className="mt-2 flex gap-3 text-[11px] text-[#777780]">
            {!isReply && <button onClick={() => beginReply(comment)}>Reply</button>}
            {user?.uid === comment.userId && <button onClick={() => beginEdit(comment)} className="inline-flex items-center gap-1"><Pencil size={11} /> Edit</button>}
            {(user?.uid === comment.userId) && <button onClick={() => void remove(comment)} className="inline-flex items-center gap-1"><Trash2 size={11} /> Delete</button>}
          </div>
          {!isReply && (replyCounts[comment.id] || 0) > 0 && (
            <div className="mt-2">
              <button className="text-xs text-[#E43136] inline-flex items-center gap-1" onClick={() => {
                const opening = !openReplies[comment.id];
                setOpenReplies((old) => ({ ...old, [comment.id]: opening }));
                if (opening && !replyPages[comment.id]) setReplyPages((old) => ({ ...old, [comment.id]: 1 }));
              }}>
                {openReplies[comment.id] ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                {openReplies[comment.id] ? 'Hide replies' : `View ${replyCounts[comment.id]} ${replyCounts[comment.id] === 1 ? 'reply' : 'replies'}`}
              </button>
              {openReplies[comment.id] && <div className="mt-1">
                {(replies[comment.id] || []).map((reply) => renderComment(reply, true))}
                {(replyCounts[comment.id] || 0) > (replies[comment.id]?.length || 0) && <button className="text-xs text-[#E43136] py-2" onClick={() => setReplyPages((old) => ({ ...old, [comment.id]: (old[comment.id] || 1) + 1 }))}>View {(replyCounts[comment.id] || 0) - (replies[comment.id]?.length || 0)} more replies</button>}
              </div>}
            </div>
          )}
        </div>
      </div>
    </article>
  );

  return <section className="rounded-2xl border border-[#E8E8EC] dark:border-[#292930] bg-white dark:bg-[#151519] overflow-hidden">
    <header className="px-4 py-3 border-b border-[#E8E8EC] dark:border-[#292930] flex items-center justify-between"><h2 className="text-sm font-semibold inline-flex items-center gap-2"><MessageCircle size={16} /> Page {pageNumber} comments</h2><span className="text-xs text-[#888891]">{comments.length}</span></header>
    <div className="max-h-[360px] overflow-y-auto px-4">
      {!comments.length && <p className="py-6 text-center text-xs text-[#888891]">No comments on this page yet.</p>}
      {comments.map((comment) => renderComment(comment))}
    </div>
    {(editing || replyingTo) && <div className="mx-4 mt-3 px-2 py-1.5 rounded bg-[#F7F7F8] dark:bg-[#202025] text-xs flex items-center justify-between">{editing ? 'Editing comment' : `Replying to ${replyingTo?.userName}`}<button aria-label="Cancel" onClick={() => { setEditing(null); setReplyingTo(null); setText(''); }}><X size={14} /></button></div>}
    {error && <p role="alert" className="px-4 pt-2 text-xs text-red-500">{error}</p>}
    <div className="p-3 flex gap-2"><textarea aria-label="Write a page comment" value={text} onChange={(e) => setText(e.target.value.slice(0, 1000))} placeholder="Add a short comment…" rows={2} className="flex-1 resize-none rounded-xl border border-[#E8E8EC] dark:border-[#303039] bg-transparent px-3 py-2 text-sm outline-none focus:border-[#E43136]" /><button disabled={busy || !text.trim()} onClick={() => void submit()} className="self-end h-10 w-10 rounded-xl bg-[#E43136] text-white disabled:opacity-50 flex items-center justify-center" aria-label="Send comment"><Send size={16} /></button></div>
  </section>;
};
