import { headquartersService } from './headquartersService';

let installed = false;
let windowStart = 0;
let reportsInWindow = 0;

function sendRuntimeDiagnostic(operation: 'uncaught_exception' | 'unhandled_rejection', errorCode: string) {
  const now = Date.now();
  if (now - windowStart >= 60_000) {
    windowStart = now;
    reportsInWindow = 0;
  }
  // Bound client-side reporting too; repeated third-party errors should not flood HQ.
  if (reportsInWindow >= 8) return;
  reportsInWindow += 1;

  void headquartersService.reportEvent({
    service: 'functions',
    category: 'frontend_runtime',
    operation,
    severity: 'critical',
    errorCode: /^[A-Za-z][A-Za-z0-9_]{0,48}$/.test(errorCode) ? errorCode : 'javascript_error',
    // Never send exception messages, stack traces, URLs, or page contents.
    message: 'An uncaught browser runtime error occurred.',
  }).catch(() => {});
}

export function installGlobalErrorMonitoring() {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  window.addEventListener('error', (event) => {
    // Ignore resource load events; they are noisy and may contain private URL details.
    if (!(event instanceof ErrorEvent) || !event.error) return;
    sendRuntimeDiagnostic('uncaught_exception', event.error.name || 'javascript_error');
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const errorCode = reason instanceof Error ? reason.name : 'unhandled_rejection';
    sendRuntimeDiagnostic('unhandled_rejection', errorCode);
  });
}
