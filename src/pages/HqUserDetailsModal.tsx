import React, { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import { HqUser, HqUserDetails, headquartersService } from '../services/firebase/headquartersService';

const restrictions = [
  { id: 'publish', label: 'Book publishing', note: 'Blocks book create/publish changes through Firestore rules.' },
  { id: 'community', label: 'Community posting', note: 'Blocks new posts, comments and post likes.' },
  { id: 'chat', label: 'Chat', note: 'Blocks starting chats and sending or editing messages.' },
];

export const HqUserDetailsModal: React.FC<{ user: HqUser; isOwner: boolean; onClose: () => void; onDeleted: () => void; addToast: (message: string, type?: 'success' | 'error' | 'info') => void }> = ({ user, isOwner, onClose, onDeleted, addToast }) => {
  const [details, setDetails] = useState<HqUserDetails | null>(null);
  const [selectedRestrictions, setSelectedRestrictions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [deletionToken, setDeletionToken] = useState('');
  const [deletionPreview, setDeletionPreview] = useState<{ books: number; posts: number; email: string } | null>(null);
  const [confirmText, setConfirmText] = useState('');

  const reload = async () => {
    setLoading(true); setError('');
    try {
      const result = await headquartersService.getUserDetails(user.uid);
      setDetails(result); setSelectedRestrictions(result.user.restrictions || []);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not load account details.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void reload(); }, [user.uid]);

  const saveRestrictions = async () => {
    setBusy(true); setError('');
    try { await headquartersService.setUserRestrictions(user.uid, selectedRestrictions); addToast('Account restrictions updated.', 'success'); await reload(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Restrictions could not be saved.'); }
    finally { setBusy(false); }
  };

  const prepareDelete = async () => {
    setBusy(true); setError('');
    try {
      const result = await headquartersService.prepareUserDeletion(user.uid);
      setDeletionToken(result.token); setDeletionPreview(result.preview); setConfirmText('');
    } catch (err) { setError(err instanceof Error ? err.message : 'Deletion could not be prepared.'); }
    finally { setBusy(false); }
  };

  const deleteAccount = async () => {
    setBusy(true); setError('');
    try { await headquartersService.deleteUserAccount(user.uid, deletionToken); addToast('Account deleted. Published books and public content were preserved.', 'success'); onDeleted(); onClose(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Account deletion failed.'); }
    finally { setBusy(false); }
  };

  const activityGroups: Array<{ label: string; rows: Array<{ id: string; title?: string; text?: string; targetTitle?: string; status?: string; visibility?: string; reason?: string; action?: string; createdAt?: string }> }> = details ? [
    { label: 'Published books', rows: details.books.filter((item) => item.status === 'published') },
    { label: 'Posts', rows: details.posts },
    { label: 'Reports', rows: details.reports },
    { label: 'Admin activity', rows: details.activity.map((item) => ({ ...item, title: item.action })) },
  ] : [];

  return <div className="fixed inset-0 z-[100] bg-black/60 p-3 sm:p-6 flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="hq-user-dialog-title">
    <div className="w-full max-w-4xl max-h-[92dvh] overflow-y-auto rounded-2xl border border-[#DDDDE3] dark:border-[#33333D] bg-white dark:bg-[#15151A] shadow-2xl">
      <div className="sticky top-0 z-10 bg-white dark:bg-[#15151A] p-4 border-b border-[#EEEFF2] dark:border-[#2C2C35] flex items-start gap-3"><div className="min-w-0 flex-1"><h2 id="hq-user-dialog-title" className="text-base font-bold">Account details</h2><p className="text-[10px] text-[#777780] mt-1">{user.displayName} · {user.email} · UID {user.uid}</p></div><button type="button" onClick={onClose} aria-label="Close account details"><X className="w-5 h-5" /></button></div>
      <div className="p-4 sm:p-5 space-y-5">
        {error && <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-xs text-red-700">{error}</div>}
        {loading ? <div className="p-8 text-center text-xs text-[#777780]"><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Loading account activity…</div> : details && <>
          <section className="grid grid-cols-2 md:grid-cols-4 gap-2">{[['Status', details.user.disabled ? 'Suspended' : 'Active'], ['Membership', details.user.membershipPlan], ['Joined', details.user.createdAt ? new Date(details.user.createdAt).toLocaleDateString() : 'Unavailable'], ['Last sign-in', details.user.lastSignInAt ? new Date(details.user.lastSignInAt).toLocaleDateString() : 'Unavailable']].map(([label, value]) => <div key={label} className="rounded-xl border border-[#EEEFF2] dark:border-[#2B2B34] p-3"><div className="text-[10px] text-[#777780]">{label}</div><div className="text-xs font-semibold mt-1">{value}</div></div>)}</section>
          <section className="grid grid-cols-1 md:grid-cols-2 gap-3">{activityGroups.map((group) => <div key={group.label} className="rounded-xl border border-[#EEEFF2] dark:border-[#2B2B34] p-3"><h3 className="text-xs font-semibold">{group.label} ({group.rows.length})</h3><div className="mt-2 space-y-2 max-h-40 overflow-y-auto">{group.rows.map((item) => <div key={item.id} className="text-[10px] border-t border-[#EEEFF2] dark:border-[#2B2B34] pt-2"><div className="font-medium line-clamp-2">{item.title || item.text || item.targetTitle || item.reason || item.id}</div><div className="text-[#8A8A94] mt-0.5">{item.status || item.visibility || ''} {item.createdAt ? `· ${new Date(item.createdAt).toLocaleDateString()}` : ''}</div></div>)}{group.rows.length === 0 && <p className="text-[10px] text-[#8A8A94]">No records.</p>}</div></div>)}</section>
          {isOwner && <section className="rounded-xl border border-[#DDDDE3] dark:border-[#33333D] p-4 space-y-3"><div><h3 className="text-xs font-semibold">Account restrictions</h3><p className="text-[10px] text-[#777780] mt-1">Rules are checked server-side against the account control record.</p></div>{restrictions.map((item) => <label key={item.id} className="flex gap-3 items-start text-xs"><input type="checkbox" checked={selectedRestrictions.includes(item.id)} onChange={(e) => setSelectedRestrictions((old) => e.target.checked ? [...old, item.id] : old.filter((value) => value !== item.id))} className="accent-[#E43136] mt-0.5" /><span><b className="block">{item.label}</b><small className="text-[10px] text-[#777780]">{item.note}</small></span></label>)}<button type="button" disabled={busy || details.user.hqRole === 'owner'} onClick={() => void saveRestrictions()} className="px-3 py-2 rounded-lg bg-[#E43136] text-white text-xs font-semibold disabled:opacity-50">Save restrictions</button></section>}
          {isOwner && <section className="rounded-xl border border-red-300 dark:border-red-900/50 p-4 space-y-3"><div className="flex gap-2 items-start"><AlertTriangle className="w-4 h-4 text-red-600 shrink-0" /><div><h3 className="text-xs font-semibold text-red-700 dark:text-red-300">Permanently delete account access</h3><p className="text-[10px] text-[#777780] mt-1">This deletes the sign-in account and profile/private settings. Published books, posts, comments, reports, followers, and associated files remain; this action does not erase authored content.</p></div></div>{!deletionToken ? <button type="button" disabled={busy || details.user.hqRole === 'owner'} onClick={() => void prepareDelete()} className="px-3 py-2 rounded-lg border border-red-300 text-red-700 text-xs font-semibold disabled:opacity-50">Prepare deletion review</button> : <div className="space-y-2"><div className="text-[10px]">Review: {deletionPreview?.books} books and {deletionPreview?.posts} posts will be preserved. Confirmation expires in 5 minutes.</div><label className="block text-[10px] font-semibold">Type DELETE to confirm<input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} className="mt-1 block w-full rounded-lg border border-red-300 bg-transparent px-3 py-2 text-xs" /></label><div className="flex gap-2"><button type="button" disabled={busy || confirmText !== 'DELETE'} onClick={() => void deleteAccount()} className="px-3 py-2 rounded-lg bg-red-600 text-white text-xs font-semibold disabled:opacity-50">Delete account permanently</button><button type="button" onClick={() => { setDeletionToken(''); setDeletionPreview(null); }} className="px-3 py-2 rounded-lg border border-[#DDDDE3] text-xs">Cancel</button></div></div>}</section>}
        </>}
      </div>
    </div>
  </div>;
};
