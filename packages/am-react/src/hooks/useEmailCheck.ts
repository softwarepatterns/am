import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Am } from '@softwarepatterns/am';
import type {
  ClientId,
  EmailCheckStatus,
  LoginMethod,
} from '@softwarepatterns/am';
import { normalizeEmail, isLikelyEmail } from '../lib/emails.js';

export type EmailState =
  | {
      status: 'active';
      preferred: LoginMethod | null;
      available: LoginMethod[];
    }
  | { status: 'inactive' }
  | null;

export type UseEmailCheckParams = {
  email: string;
  clientId: ClientId;
  csrfToken?: string;
  auth: Am;
  debounceMs?: number;
  enabled?: boolean;
};

export type UseEmailCheckResult = {
  emailState: EmailState;
  isChecking: boolean;
  normalizedEmail: string;
};

export function toEmailState(res: {
  status: EmailCheckStatus;
  preferred: LoginMethod[];
  available: LoginMethod[];
}): EmailState {
  if (res.status === 'inactive') return { status: 'inactive' };
  return {
    status: 'active',
    preferred: res.preferred?.[0] ?? null,
    available: res.available ?? [],
  };
}

export function hasMethod(state: EmailState, method: LoginMethod): boolean {
  if (!state || state.status !== 'active') return false;
  if (state.preferred === method) return true;
  return state.available.includes(method);
}

export type LoginMode = 'email_password' | 'magic_link';

export function pickInitialMode(state: EmailState): LoginMode {
  if (!state || state.status !== 'active') return 'email_password';
  if (state.preferred === 'magic_link') return 'magic_link';
  if (state.preferred === 'email_password') return 'email_password';

  if (state.available.includes('email_password')) return 'email_password';
  if (state.available.includes('magic_link')) return 'magic_link';

  return 'email_password';
}

export function useEmailCheck({
  email,
  clientId,
  csrfToken,
  auth,
  debounceMs = 400,
  enabled = true,
}: UseEmailCheckParams): UseEmailCheckResult {
  const normalizedEmail = useMemo(() => normalizeEmail(email), [email]);
  const isValidEmail = Boolean(
    normalizedEmail && isLikelyEmail(normalizedEmail),
  );
  const emailCheckQuery = useQuery({
    queryKey: [
      'email-check',
      clientId,
      normalizedEmail,
      csrfToken ?? null,
      debounceMs,
    ],
    enabled: enabled && isValidEmail,
    queryFn: async () => {
      await new Promise((resolve) => setTimeout(resolve, debounceMs));
      return auth.checkEmail({
        clientId,
        email: normalizedEmail,
        csrfToken,
      });
    },
    retry: false,
  });

  return {
    emailState:
      enabled && isValidEmail && emailCheckQuery.data
        ? toEmailState(emailCheckQuery.data)
        : null,
    isChecking: enabled && isValidEmail ? emailCheckQuery.isPending : false,
    normalizedEmail,
  };
}
