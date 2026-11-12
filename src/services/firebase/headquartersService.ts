import { httpsCallable } from 'firebase/functions';
import { functions } from './firebaseConfig';

export type HeadquartersRole =
  | 'owner'
  | 'administrator'
  | 'moderator'
  | 'content_manager'
  | 'community_manager'
  | 'support_staff';

export interface HqMetric {
  available: boolean;
  value: number | null;
}

export interface HqServiceHealth {
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  details: string;
  checkedAt: string;
}

export interface HeadquartersOverview {
  generatedAt: string;
  projectId: string;
  ownerEmail?: string;
  metrics: Record<string, HqMetric>;
  services: Record<string, HqServiceHealth>;
  integrations: Record<string, HqServiceHealth>;
}

export interface HqUser {
  uid: string;
  email: string;
  displayName: string;
  username: string;
  photoURL: string;
  createdAt: string;
  lastSignInAt: string;
  disabled: boolean;
  membershipPlan: string;
  hqRole: HeadquartersRole | null;
  booksCount: number;
}

export interface HqReport {
  id: string;
  targetType: string;
  targetId: string;
  targetTitle: string;
  reason: string;
  description?: string;
  status: string;
  reporterId: string;
  createdAt: string;
}

export interface HqBook {
  id: string;
  title: string;
  description: string;
  authorId: string;
  authorName: string;
  coverURL: string;
  fileURL: string;
  availableModes?: string[];
  status: string;
  category: string;
  createdAt: string;
}

export interface HqEvent {
  id: string;
  service: string;
  category: string;
  operation: string;
  severity: 'info' | 'warning' | 'critical';
  errorCode: string;
  message: string;
  actorUid: string;
  relatedId: string;
  fileCategory: string;
  fileName: string;
  storagePath: string;
  retryStatus: string;
  status: 'new' | 'investigating' | 'resolved' | 'ignored';
  createdAt: string;
}

export interface HqStaff {
  uid: string;
  email: string;
  displayName: string;
  role: HeadquartersRole;
  permissions: string[];
  photoURL: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface HqAuditEntry {
  id: string;
  actorUid: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId: string;
  previousValue: unknown;
  newValue: unknown;
  result: string;
  createdAt: string;
}

export interface HqPlatformConfig {
  maintenanceMode: boolean;
  registrationEnabled: boolean;
  allowBookPublishing: boolean;
  communityEnabled: boolean;
  announcement: string;
  featureFlags: Record<string, boolean>;
}
export interface HqBrandCampaign { id: string; name: string; startAt: string; endAt: string; priority: number; logoUrl: string; }
export interface HqAnalyticsData { rangeDays: number; series: Record<string, Record<string, number>>; completeness: Record<string, boolean>; membershipProfiles: number | null; billing: { available: boolean; reason: string }; cloudflare: { available: boolean; reason: string }; }
export interface HqSupportTicket { id: string; userId: string; requesterName: string; requesterEmail: string; subject: string; message: string; status: 'pending' | 'open' | 'in_progress' | 'resolved'; createdAt: string; assignedTo?: string; internalNote?: string; }
export interface HqSecurityEvent { id: string; uid: string; attemptedPermission: string; role: string; outcome: string; createdAt: string; }
export interface HqModerationContent { id: string; kind: 'posts' | 'reviews' | 'comments'; ownerId: string; authorName: string; title: string; text: string; status: string; createdAt: string; }
export interface HqUserDetails { user: HqUser & { restrictions: string[] }; books: Array<{ id: string; title: string; status: string; createdAt: string }>; posts: Array<{ id: string; text: string; visibility: string; createdAt: string }>; reports: Array<{ id: string; targetTitle: string; reason: string; status: string; createdAt: string }>; activity: Array<{ id: string; action: string; result: string; createdAt: string }>; }

async function call<T>(name: string, data: Record<string, unknown> = {}): Promise<T> {
  const result = await httpsCallable<Record<string, unknown>, T>(functions, name)(data);
  return result.data;
}

export const headquartersService = {
  getOverview: (rangeDays = 7, startDate?: string, endDate?: string) => call<HeadquartersOverview>('hqGetOverview', { rangeDays, startDate, endDate }),
  listUsers: (search = '', pageToken?: string, filters: { status?: string; role?: string; membershipPlan?: string; createdFrom?: string; createdTo?: string } = {}) => call<{ users: HqUser[]; nextPageToken: string | null }>('hqListUsers', { search, pageToken, pageSize: 25, ...filters }),
  listStaff: () => call<{ staff: HqStaff[] }>('hqListStaff'),
  setStaffRole: (uid: string, role: HeadquartersRole | null) => call<{ ok: boolean; role: HeadquartersRole | null }>('hqSetStaffRole', { uid, role }),
  setAccountSuspended: (uid: string, suspended: boolean) => call<{ ok: boolean }>('hqSetAccountStatus', { uid, suspended }),
  getUserDetails: (uid: string) => call<HqUserDetails>('hqGetUserDetails', { uid }),
  setUserRestrictions: (uid: string, restrictions: string[]) => call<{ ok: boolean; restrictions: string[] }>('hqSetUserRestrictions', { uid, restrictions }),
  prepareUserDeletion: (uid: string) => call<{ token: string; preview: { books: number; posts: number; email: string }; expiresInSeconds: number }>('hqPrepareUserDeletion', { uid }),
  deleteUserAccount: (uid: string, token: string) => call<{ ok: boolean; authoredContentPreserved: boolean }>('hqDeleteUserAccount', { uid, token }),
  listReports: (status = 'open') => call<{ reports: HqReport[] }>('hqListReports', { status }),
  listBooks: (search = '', status = '', pageToken?: string) => call<{ books: HqBook[]; nextPageToken: string | null }>('hqListBooks', { search, status, pageToken, pageSize: 25 }),
  updateBookStatus: (id: string, status: 'draft' | 'published' | 'pending' | 'removed') => call<{ ok: boolean }>('hqUpdateBookStatus', { id, status }),
  listModerationContent: (kind: HqModerationContent['kind']) => call<{ items: HqModerationContent[] }>('hqListModerationContent', { kind }),
  setModerationContentStatus: (id: string, kind: HqModerationContent['kind'], status: 'hidden' | 'public') => call<{ ok: boolean; status: string }>('hqSetModerationContentStatus', { id, kind, status }),
  resolveReport: (id: string, status: 'investigating' | 'resolved' | 'dismissed', notes = '') => call<{ ok: boolean }>('hqResolveReport', { id, status, notes }),
  listEvents: (status = '') => call<{ events: HqEvent[] }>('hqListEvents', { status }),
  updateEvent: (id: string, status: 'investigating' | 'resolved' | 'ignored', notes = '') => call<{ ok: boolean }>('hqUpdateEvent', { id, status, notes }),
  getAuditLogs: () => call<{ entries: HqAuditEntry[] }>('hqGetAuditLogs'),
  getPlatformConfig: () => call<{ platform: HqPlatformConfig; branding: { campaigns: HqBrandCampaign[]; activeCampaignId: string } }>('hqGetPlatformConfig'),
  updatePlatformConfig: (config: Partial<HqPlatformConfig>) => call<{ ok: boolean }>('hqUpdatePlatformConfig', config as Record<string, unknown>),
  updateBranding: (campaign: Partial<HqBrandCampaign> & { action?: 'save' | 'delete' }) => call<{ ok: boolean; id: string }>('hqUpdateBranding', campaign as Record<string, unknown>),
  uploadBrandAsset: async (file: File, campaignId: string) => {
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Brand image could not be read.'));
      reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
      reader.readAsDataURL(file);
    });
    return call<{ ok: boolean; url: string; path: string }>('hqUploadBrandAsset', { base64, contentType: file.type, campaignId });
  },
  getAnalytics: (rangeDays = 30) => call<HqAnalyticsData>('hqGetAnalytics', { rangeDays }),
  listMemberships: () => call<{ entries: Array<{ uid: string; displayName: string; username: string; plan: string; createdAt: string; expiry: string }>; truncated: boolean; billing: { available: boolean; reason: string } }>('hqListMemberships'),
  listSupportTickets: (status = '') => call<{ tickets: HqSupportTicket[] }>('hqListSupportTickets', { status }),
  updateSupportTicket: (id: string, status: HqSupportTicket['status'], internalNote = '') => call<{ ok: boolean }>('hqUpdateSupportTicket', { id, status, internalNote }),
  listSecurityEvents: () => call<{ events: HqSecurityEvent[]; total: number | null }>('hqListSecurityEvents'),
  submitContactMessage: (input: { name: string; email: string; subject: string; message: string }) => call<{ ok: boolean; referenceId: string }>('submitContactMessage', input),
  reportEvent: (event: { eventId?: string; service: string; category: string; operation: string; severity?: 'info' | 'warning' | 'critical'; errorCode?: string; message?: string; relatedId?: string; fileCategory?: string; fileName?: string; storagePath?: string }) => call<{ ok: boolean; eventId: string }>('hqReportClientEvent', event),
};
