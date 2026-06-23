import { trackSafeEvent } from './track-safe-event.js';
import type { AnalyticsClient } from './ga-types.js';

export type ClientIdKind = 'prod' | 'sandbox' | 'custom';

function resolveClientIdKind(clientId: string): ClientIdKind {
  if (clientId.startsWith('cid_prod')) return 'prod';
  if (clientId.includes('sandbox')) return 'sandbox';
  return 'custom';
}

export function trackSignInSuccessSafe(params: {
  analytics: AnalyticsClient | null | undefined;
  clientId: string;
}): void {
  trackSafeEvent({
    analytics: params.analytics,
    eventName: 'auth_sign_in_success',
    eventParams: {
      method: 'password',
      client_id_kind: resolveClientIdKind(params.clientId),
    },
  });
}

export function trackSignUpSuccessSafe(params: {
  analytics: AnalyticsClient | null | undefined;
  clientId: string;
}): void {
  trackSafeEvent({
    analytics: params.analytics,
    eventName: 'auth_sign_up_success',
    eventParams: {
      method: 'password',
      client_id_kind: resolveClientIdKind(params.clientId),
    },
  });
}

export function trackMagicLinkSentSafe(params: {
  analytics: AnalyticsClient | null | undefined;
  clientId: string;
  flow: 'sign_in' | 'sign_up';
}): void {
  trackSafeEvent({
    analytics: params.analytics,
    eventName: 'auth_magic_link_sent',
    eventParams: {
      flow: params.flow,
      client_id_kind: resolveClientIdKind(params.clientId),
    },
  });
}
