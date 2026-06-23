import { AuthError } from '@softwarepatterns/am';
import { isLikelyEmail } from '../../lib/emails.js';
import type { EmailState } from '../../hooks/useEmailCheck.js';
import type { AuthErrorLabels } from './labels.js';

export function toFieldErrors(
  e: unknown,
  labels: AuthErrorLabels,
): {
  email?: string;
  password?: string;
  form?: string;
} {
  if (!(e instanceof AuthError)) {
    return { form: labels.networkError };
  }

  const next: {
    email?: string;
    password?: string;
    form?: string;
  } = { form: labels.requestFailed };

  const invalid = e.invalidParams || [];
  for (const p of invalid) {
    if (p.path === 'email') next.email = labels.invalidEmail;
    if (p.path === 'password') next.password = labels.invalidPassword;
  }

  if (e.status === 400) next.form = labels.badRequest;
  if (e.status === 401) next.form = labels.unauthorized;
  if (e.status === 403) next.form = labels.forbidden;
  if (e.status === 409) next.form = labels.conflict;
  if (e.status === 429) next.form = labels.tooManyRequests;
  if (e.status >= 500) next.form = labels.serverError;

  return next;
}

export function canSubmitEmailPassword(args: {
  normalizedEmail: string;
  password: string;
  isChecking: boolean;
  isSubmitting: boolean;
  emailState: EmailState;
  canUsePassword: boolean;
}): boolean {
  const {
    normalizedEmail,
    password,
    isChecking,
    isSubmitting,
    emailState,
    canUsePassword,
  } = args;
  if (isSubmitting || isChecking) return false;
  if (!normalizedEmail || !isLikelyEmail(normalizedEmail)) return false;
  if (!password) return false;
  if (emailState?.status === 'inactive') return false;
  if (!canUsePassword) return false;
  return true;
}

export function canSubmitMagicLink(args: {
  normalizedEmail: string;
  isChecking: boolean;
  isSubmitting: boolean;
  emailState: EmailState;
  canUseMagic: boolean;
}): boolean {
  const { normalizedEmail, isChecking, isSubmitting, emailState, canUseMagic } =
    args;
  if (isSubmitting || isChecking) return false;
  if (!normalizedEmail || !isLikelyEmail(normalizedEmail)) return false;
  if (emailState?.status === 'inactive') return false;
  if (!canUseMagic) return false;
  return true;
}
