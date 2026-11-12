import React, { useCallback, useEffect, useState } from 'react';
import { Activity, AlertTriangle, BarChart3, Check, Cloud, Gem, ImagePlus, Loader2, Settings2, ShieldAlert, Ticket, Trash2, Upload } from 'lucide-react';
import {
  headquartersService,
  HqAnalyticsData,
  HqBrandCampaign,
  HqPlatformConfig,
  HqSecurityEvent,
  HqSupportTicket,
  HqModerationContent,
} from '../services/firebase/headquartersService';

const card = 'rounded-2xl border border-[#DDDDE3] dark:border-[#2C2C35] bg-white dark:bg-[#15151A]';

export const HeadquartersExtendedPanels: React.FC<{ activeTab: string; rangeDays: number; addToast: (message: string, type?: 'success' | 'error' | 'info') => void }> = ({ activeTab, rangeDays, addToast }) => {
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [analytics, setAnalytics] = useState<HqAnalyticsData | null>(null);
  const [memberships, setMemberships] = useState<Awaited<ReturnType<typeof headquartersService.listMemberships>> | null>(null);
  const [tickets, setTickets] = useState<HqSupportTicket[]>([]);
  const [security, setSecurity] = useState<HqSecurityEvent[]>([]);
  const [config, setConfig] = useState<HqPlatformConfig>({ maintenanceMode: false, registrationEnabled: true, allowBookPublishing: true, communityEnabled: true, announcement: '', featureFlags: {} });
  const [campaigns, setCampaigns] = useState<HqBrandCampaign[]>([]);
  const [name, setName] = useState('');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [priority, setPriority] = useState(0);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [ticketStatus, setTicketStatus] = useState<Record<string, HqSupportTicket['status']>>({});
  const [moderationItems, setModerationItems] = useState<HqModerationContent[]>([]);

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (activeTab === 'analytics') setAnalytics(await headquartersService.getAnalytics(rangeDays === 1 ? 7 : rangeDays));
      else if (activeTab === 'membership') setMemberships(await headquartersService.listMemberships());
      else if (activeTab === 'brand' || activeTab === 'settings') {
        const result = await headquartersService.getPlatformConfig();
        setConfig(result.platform);
        setCampaigns(result.branding.campaigns);
      } else if (activeTab === 'support') setTickets((await headquartersService.listSupportTickets()).tickets);
      else if (activeTab === 'security') setSecurity((await headquartersService.listSecurityEvents()).events);
      else if (['posts', 'reviews', 'comments'].includes(activeTab)) setModerationItems((await headquartersService.listModerationContent(activeTab as HqModerationContent['kind'])).items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Headquarters data could not be loaded.');
    } finally { setLoading(false); }
  }, [activeTab, rangeDays]);

  useEffect(() => { void reload(); }, [reload]);

  const perform = async (action: () => Promise<unknown>, message: string) => {
    setBusy(true);
    setError('');
    try { await action(); addToast(message, 'success'); await reload(); }
    catch (err) { setError(err instanceof Error ? err.message : 'The action failed.'); }
    finally { setBusy(false); }
  };

  const Notice = () => <div className="rounded-xl border border-sky-300/60 bg-sky-50 dark:bg-sky-950/20 dark:border-sky-900/40 p-4 text-xs text-sky-900 dark:text-sky-200">{error || 'Loading live project data…'}</div>;

  if (activeTab === 'analytics') return <div className="space-y-4">
    {error && <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-xs text-red-700">{error}</div>}
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">{(['users', 'books', 'posts', 'comments', 'reports', 'readingSessions', 'errors'] as const).map((key) => {
      const series = analytics?.series[key] || {};
      const days = Object.keys(series).sort();
      const peak = Math.max(1, ...days.map((day) => series[day]));
      const count = days.reduce((sum, day) => sum + series[day], 0);
      const title = key === 'users' ? 'New user profiles' : key === 'readingSessions' ? 'Reading sessions' : key === 'errors' ? 'Reported operation failures' : key[0].toUpperCase() + key.slice(1);
      return <section key={key} className={`${card} p-4`}><div className="flex items-start justify-between"><div><h3 className="text-sm font-semibold">{title}</h3><p className="text-[10px] text-[#777780] mt-1">{analytics?.completeness[key] === false ? 'First 1,000 records only' : `Daily counts · last ${rangeDays} days`}</p></div><span className="text-xl font-bold tabular-nums">{analytics ? count.toLocaleString() : '—'}</span></div><div className="mt-4 h-28 flex items-end gap-1 border-b border-[#DDDDE3] dark:border-[#33333D]" role="img" aria-label={`${title} daily counts`}>{days.length ? days.map((day) => <div key={day} title={`${day}: ${series[day]}`} className="flex-1 min-w-[2px] rounded-t bg-[#E43136]/75 hover:bg-[#E43136]" style={{ height: `${Math.max(3, series[day] / peak * 100)}%` }} />) : <p className="w-full pb-4 text-center text-[11px] text-[#8A8A94]">{loading ? 'Loading…' : 'No timestamped records in this period.'}</p>}</div><div className="mt-2 flex justify-between text-[9px] text-[#8A8A94]"><span>{days[0] || '—'}</span><span>{days.at(-1) || '—'}</span></div></section>;
    })}</div>
    <div className={`${card} p-4 text-xs flex gap-2`}><Cloud className="w-4 h-4 shrink-0 text-[#E43136]" /><span>Billing, Cloudflare traffic, verified active-user analytics, country/device breakdown and long-term trends require external integrations or a historical aggregation pipeline. No estimated figures are shown as actuals.</span></div>
  </div>;

  if (activeTab === 'membership') return <div className="space-y-4">
    {error && <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-xs text-red-700">{error}</div>}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3"><div className={`${card} p-5`}><div className="text-xs text-[#777780]">Premium profiles returned</div><div className="text-2xl font-bold mt-2">{memberships?.entries.length ?? '—'}</div></div><div className={`${card} p-5`}><div className="text-xs text-[#777780]">Revenue</div><div className="text-sm font-semibold mt-2">Unavailable</div></div><div className={`${card} p-5`}><div className="text-xs text-[#777780]">Payment verification</div><div className="text-sm font-semibold mt-2">Not configured</div></div></div>
    <section className={`${card} overflow-hidden`}><div className="p-4 border-b border-[#EEEFF2] dark:border-[#2C2C35]"><h3 className="text-sm font-semibold">Membership profile records</h3><p className="text-[11px] text-[#777780] mt-1">Read-only. Paid access cannot be granted until a payment verification provider is integrated.</p></div><div className="divide-y divide-[#EEEFF2] dark:divide-[#2B2B34]">{memberships?.entries.map((entry) => <div key={entry.uid} className="p-4 flex flex-wrap items-center gap-3"><span className="text-sm font-semibold">{entry.displayName || entry.username || entry.uid}</span><span className="text-xs text-[#777780]">@{entry.username || '—'}</span><span className="ml-auto text-[10px] text-[#8A8A94]">{entry.createdAt ? new Date(entry.createdAt).toLocaleDateString() : 'Date unavailable'}</span></div>)}{!loading && !memberships?.entries.length && <div className="p-8 text-center text-xs text-[#8A8A94]">No premium profiles found.</div>}</div>{memberships?.truncated && <p className="p-3 text-center text-[10px] text-amber-700">Showing the first 100 memberships.</p>}</section>
    <div className={`${card} p-4 text-xs`}>{memberships?.billing.reason || 'Billing details unavailable.'}</div>
  </div>;

  if (activeTab === 'brand') return <div className="space-y-4">
    {error && <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-xs text-red-700">{error}</div>}
    <section className={`${card} p-5 space-y-4`}><div><h3 className="text-sm font-semibold">Scheduled brand campaign</h3><p className="text-[11px] text-[#777780] mt-1">Images are public brand assets. The original wordmark stays as the fallback.</p></div><div className="grid grid-cols-1 md:grid-cols-2 gap-3"><label className="text-xs font-medium">Campaign name<input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Eid, anniversary…" className="mt-1 w-full px-3 py-2 rounded-lg border border-[#DDDDE3] dark:border-[#33333D] bg-transparent" /></label><label className="text-xs font-medium">Priority<input type="number" min={0} max={100} value={priority} onChange={(e) => setPriority(Number(e.target.value))} className="mt-1 w-full px-3 py-2 rounded-lg border border-[#DDDDE3] dark:border-[#33333D] bg-transparent" /></label><label className="text-xs font-medium">Starts<input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-[#DDDDE3] dark:border-[#33333D] bg-transparent" /></label><label className="text-xs font-medium">Ends<input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-[#DDDDE3] dark:border-[#33333D] bg-transparent" /></label></div><div className="flex flex-wrap items-center gap-3"><label className="px-3 py-2 rounded-lg border border-[#DDDDE3] dark:border-[#33333D] text-xs cursor-pointer inline-flex gap-2 items-center"><Upload className="w-4 h-4" />{logoFile?.name || 'Upload logo · PNG/JPEG/WebP ≤2 MB'}<input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} /></label><button type="button" disabled={busy || !name.trim() || !startAt || !endAt} onClick={() => void perform(async () => { const id = `campaign_${Date.now()}`; let logoUrl = ''; if (logoFile) logoUrl = (await headquartersService.uploadBrandAsset(logoFile, id)).url; await headquartersService.updateBranding({ id, name: name.trim(), startAt: new Date(startAt).toISOString(), endAt: new Date(endAt).toISOString(), priority, logoUrl }); setName(''); setStartAt(''); setEndAt(''); setLogoFile(null); }, 'Brand campaign saved.')} className="px-4 py-2 rounded-lg bg-[#E43136] text-white text-xs font-semibold disabled:opacity-50">Save campaign</button></div></section>
    <section className={`${card} overflow-hidden`}><div className="p-4 border-b border-[#EEEFF2] dark:border-[#2C2C35]"><h3 className="text-sm font-semibold">Campaign schedule</h3></div>{campaigns.map((campaign) => { const active = Date.parse(campaign.startAt) <= Date.now() && Date.parse(campaign.endAt) > Date.now(); return <div key={campaign.id} className="p-4 flex flex-wrap items-center gap-3 border-b border-[#EEEFF2] dark:border-[#2B2B34]">{campaign.logoUrl && <img src={campaign.logoUrl} alt="Campaign logo preview" className="max-h-10 max-w-28 object-contain" />}<div className="min-w-0 flex-1"><div className="text-sm font-semibold">{campaign.name}</div><div className="text-[10px] text-[#777780]">{new Date(campaign.startAt).toLocaleString()} – {new Date(campaign.endAt).toLocaleString()} · priority {campaign.priority}</div></div><span className={'text-[9px] font-bold ' + (active ? 'text-emerald-600' : 'text-[#8A8A94]')}>{active ? 'ACTIVE' : 'SCHEDULED / ENDED'}</span><button type="button" disabled={busy} onClick={() => void perform(() => headquartersService.updateBranding({ id: campaign.id, action: 'delete' }), 'Campaign removed.')} className="px-3 py-1.5 rounded-lg border border-[#DDDDE3] dark:border-[#33333D] text-xs"><Trash2 className="w-3.5 h-3.5" /></button></div>})}{!campaigns.length && <div className="p-8 text-center text-xs text-[#8A8A94]">No campaigns scheduled; the original Redcover branding remains active.</div>}</section>
  </div>;

  if (activeTab === 'settings') return <section className={`${card} p-5 space-y-5`}>
    {error && <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-xs text-red-700">{error}</div>}
    <div><h3 className="text-sm font-semibold">Global platform settings</h3><p className="text-[11px] text-[#777780] mt-1">Changes are validated and written by a privileged server function with before/after audit records.</p></div>
    {([['maintenanceMode', 'Maintenance mode', 'Block regular account writes and show a maintenance notice.'], ['registrationEnabled', 'New registrations', 'Auth blocking function prevents new Google accounts while existing users can sign in.'], ['allowBookPublishing', 'Book publishing', 'Permit authors to publish and update books.'], ['communityEnabled', 'Community features', 'Enable new posts, comments and post likes.']] as const).map(([key, title, description]) => <label key={key} className="flex items-center gap-3 p-3 rounded-xl border border-[#EEEFF2] dark:border-[#2B2B34] cursor-pointer"><input type="checkbox" checked={config[key]} onChange={(e) => setConfig((value) => ({ ...value, [key]: e.target.checked }))} className="w-4 h-4 accent-[#E43136]" /><span className="flex-1"><b className="block text-xs">{title}</b><small className="text-[10px] text-[#777780]">{description}</small></span><span className="text-[9px] uppercase font-bold">{config[key] ? 'On' : 'Off'}</span></label>)}
    <label className="block text-xs font-semibold">Platform announcement<textarea value={config.announcement} onChange={(e) => setConfig((value) => ({ ...value, announcement: e.target.value.slice(0, 500) }))} maxLength={500} rows={3} className="mt-1 w-full rounded-lg border border-[#DDDDE3] dark:border-[#33333D] bg-transparent p-3 text-xs" /></label>
    <div className="flex justify-end"><button type="button" disabled={busy} onClick={() => void perform(() => headquartersService.updatePlatformConfig(config), 'Platform settings saved.')} className="px-4 py-2 rounded-lg bg-[#E43136] text-white text-xs font-semibold inline-flex items-center gap-2 disabled:opacity-50"><Check className="w-4 h-4" />Save settings</button></div>
    <p className="text-[10px] text-[#8A8A94]">New registration blocking uses an Auth blocking function and requires Firebase Authentication with Identity Platform (upgrade/enable when prompted). Publishing, community creation and maintenance behavior are also enforced by Firestore rules.</p>
  </section>;

  if (activeTab === 'support') return <section className={`${card} overflow-hidden`}>
    {error && <div role="alert" className="m-4 rounded-xl border border-red-300 bg-red-50 p-3 text-xs text-red-700">{error}</div>}
    <div className="p-4 border-b border-[#EEEFF2] dark:border-[#2C2C35]"><h3 className="text-sm font-semibold">Existing contact requests</h3><p className="text-[11px] text-[#777780] mt-1">Uses Redcover’s current contact form submissions; internal notes are only available to support staff.</p></div>
    {tickets.map((ticket) => <article key={ticket.id} className="p-4 space-y-2 border-b border-[#EEEFF2] dark:border-[#2B2B34]"><div className="flex flex-wrap items-center gap-2"><b className="text-xs">{ticket.subject || 'Contact request'}</b><span className="text-[9px] uppercase text-[#777780]">{ticket.status}</span><span className="ml-auto text-[10px] text-[#8A8A94]">{ticket.createdAt ? new Date(ticket.createdAt).toLocaleString() : '—'}</span></div><p className="text-[10px] text-[#777780]">{ticket.id} · {ticket.userId || 'Contact form'}</p><p className="text-xs whitespace-pre-wrap">{ticket.message}</p><div className="flex flex-wrap gap-2"><select aria-label="Request status" value={ticketStatus[ticket.id] || (ticket.status === 'pending' ? 'open' : ticket.status)} onChange={(e) => setTicketStatus((old) => ({ ...old, [ticket.id]: e.target.value as HqSupportTicket['status'] }))} className="px-2 py-1.5 rounded-lg border border-[#DDDDE3] dark:border-[#33333D] bg-transparent text-[10px]"><option value="open">Open</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option></select><input value={notes[ticket.id] ?? ticket.internalNote ?? ''} onChange={(e) => setNotes((old) => ({ ...old, [ticket.id]: e.target.value.slice(0, 1000) }))} placeholder="Internal note" className="min-w-40 flex-1 px-2 py-1.5 rounded-lg border border-[#DDDDE3] dark:border-[#33333D] bg-transparent text-[10px]" /><button type="button" disabled={busy} onClick={() => void perform(() => headquartersService.updateSupportTicket(ticket.id, ticketStatus[ticket.id] || (ticket.status === 'pending' ? 'open' : ticket.status), notes[ticket.id] ?? ticket.internalNote ?? ''), 'Contact request updated.')} className="px-3 py-1.5 rounded-lg border border-[#DDDDE3] dark:border-[#33333D] text-[10px]">Save</button></div></article>)}
    {!loading && !tickets.length && <div className="p-8 text-center text-xs text-[#8A8A94]">No contact requests have been submitted.</div>}
  </section>;

  if (activeTab === 'security') return <div className="space-y-4">
    {error && <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-xs text-red-700">{error}</div>}
    <div className="rounded-xl border border-amber-300/60 bg-amber-50 dark:bg-amber-950/20 p-4 text-xs">This list records authenticated users who attempted a Headquarters action without permission. Failed Google sign-ins and unauthenticated requests require Identity Platform / Cloud Audit Logs.</div>
    <section className={`${card} overflow-hidden`}><div className="p-4 border-b border-[#EEEFF2] dark:border-[#2C2C35]"><h3 className="text-sm font-semibold">Denied Headquarters access</h3><p className="text-[11px] text-[#777780] mt-1">Latest 100 events. Owner/staff changes are listed in Audit Logs.</p></div>{security.map((event) => <div key={event.id} className="p-4 flex flex-wrap items-center gap-2 border-b border-[#EEEFF2] dark:border-[#2B2B34]"><ShieldAlert className="w-4 h-4 text-amber-600" /><b className="text-xs">{event.uid}</b><span className="text-[10px] text-[#777780]">Attempted {event.attemptedPermission || 'restricted action'} · role {event.role}</span><span className="ml-auto text-[10px] text-[#8A8A94]">{event.createdAt ? new Date(event.createdAt).toLocaleString() : '—'}</span></div>)}{!loading && !security.length && <div className="p-8 text-center text-xs text-[#8A8A94]">No denied actions recorded.</div>}</section>
  </div>;

  if (['posts', 'reviews', 'comments'].includes(activeTab)) {
    const kind = activeTab as HqModerationContent['kind'];
    return <section className={`${card} overflow-hidden`}>
      {error && <div role="alert" className="m-4 rounded-xl border border-red-300 bg-red-50 p-3 text-xs text-red-700">{error}</div>}
      <div className="p-4 border-b border-[#EEEFF2] dark:border-[#2C2C35]"><h3 className="text-sm font-semibold">Latest {kind} · max 100</h3><p className="text-[11px] text-[#777780] mt-1">Private messages are never included. Hide/restore changes are audited and update public visibility.</p></div>
      {moderationItems.map((item) => <article key={item.id} className="p-4 flex flex-col sm:flex-row sm:items-start gap-3 border-b border-[#EEEFF2] dark:border-[#2B2B34]"><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><b className="text-xs">{item.authorName || item.ownerId}</b><span className="text-[9px] uppercase text-[#777780]">{item.status}</span><span className="ml-auto text-[10px] text-[#8A8A94]">{item.createdAt ? new Date(item.createdAt).toLocaleString() : '—'}</span></div>{item.title && <div className="text-[10px] text-[#777780] mt-1">{item.title}</div>}<p className="text-xs whitespace-pre-wrap mt-2">{item.text || '(empty)'}</p><div className="text-[9px] text-[#8A8A94] mt-2">ID {item.id} · User {item.ownerId}</div></div><button type="button" disabled={busy} onClick={() => void perform(() => headquartersService.setModerationContentStatus(item.id, item.kind, item.status === 'hidden' ? 'public' : 'hidden'), item.status === 'hidden' ? 'Content restored.' : 'Content hidden.')} className="shrink-0 px-3 py-2 rounded-lg border border-[#DDDDE3] dark:border-[#33333D] text-[10px] font-semibold disabled:opacity-50">{item.status === 'hidden' ? 'Restore' : 'Hide'}</button></article>)}
      {!loading && !moderationItems.length && <div className="p-8 text-center text-xs text-[#8A8A94]">No {kind} records found.</div>}
    </section>;
  }

  return <div className={`${card} p-6 text-xs text-[#777780] flex items-center gap-2`}><Activity className="w-4 h-4" />{loading ? <><Loader2 className="w-4 h-4 animate-spin" />Loading panel…</> : <Notice />}</div>;
};
