import { headquartersService } from './headquartersService';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): void {
  console.warn('System data operation failed:', operationType, error instanceof Error ? error.name : 'UnknownError');
  void headquartersService.reportEvent({
    service: 'firestore',
    category: 'data_operation',
    operation: operationType,
    severity: 'warning',
    errorCode: String((error as { code?: unknown } | null)?.code || 'firestore/unknown').slice(0, 100),
    message: '',
    relatedId: path?.split('/').filter(Boolean).pop()?.slice(0, 128),
  }).catch(() => {});
}
