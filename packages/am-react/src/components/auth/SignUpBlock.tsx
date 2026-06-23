/**
 * Owns the shared sign-up form block. It keeps registration flow state local
 * and uses the core submit button for pending/success presentation.
 */

import {
  Heading,
  SubmitButton,
  Typography,
  type SubmitButtonState,
} from '../ui/index.js';
import type { ClientId } from '@softwarepatterns/am';
import { useState, type FormEvent } from 'react';
import { useAnalyticsSafe } from '../../hooks/useAnalytics.js';
import {
  hasMethod,
  pickInitialMode,
  useEmailCheck,
  type LoginMode,
} from '../../hooks/useEmailCheck.js';
import {
  trackMagicLinkSentSafe,
  trackSignUpSuccessSafe,
} from '../../lib/analytics/auth-events.js';
import { AppNotice } from '../ui/AppNotice.js';
import { cn } from '../../lib/ui/cn.js';
import { useAuth } from './AuthProvider.js';
import { toFieldErrors } from './common.js';
import { EmailInput } from './EmailInput.js';
import type { SignUpBlockLabels } from './labels.js';
import { PasswordInput } from './PasswordInput.js';

export type SignUpBlockProps = React.HTMLAttributes<HTMLDivElement> & {
  clientId: ClientId;
  csrfToken?: string;
  onSuccess?: () => Promise<void>;
  signInHref?: string;
  preferredLanguage?: string | null;
  labels: SignUpBlockLabels;
  enableEmailCheck?: boolean;
};

export function SignUpBlock(props: SignUpBlockProps) {
  const {
    className,
    clientId,
    csrfToken,
    onSuccess,
    signInHref,
    preferredLanguage,
    labels,
    enableEmailCheck = true,
    ...rootProps
  } = props;
  const { auth } = useAuth();
  const analytics = useAnalyticsSafe();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [manualMode, setManualMode] = useState<LoginMode | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<ReturnType<typeof toFieldErrors>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [buttonState, setButtonState] = useState<SubmitButtonState>('idle');

  const { emailState, isChecking, normalizedEmail } = useEmailCheck({
    email,
    clientId,
    csrfToken,
    auth,
    enabled: enableEmailCheck,
  });
  const mode = manualMode ?? pickInitialMode(emailState);

  const serverSupportsPassword = hasMethod(emailState, 'email_password');
  const serverSupportsMagic = hasMethod(emailState, 'magic_link');
  const emailTaken = emailState?.status === 'active';

  const clearFeedback = () => {
    setErrors({});
    setNotice(null);
  };

  const handleEmailChange = (v: string) => {
    setEmail(v);
    setManualMode(null);
    clearFeedback();
  };

  const handlePasswordChange = (v: string) => {
    setPassword(v);
    clearFeedback();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearFeedback();
    setIsSubmitting(true);
    setButtonState('busy');

    try {
      if (mode === 'email_password') {
        const basePayload = {
          clientId,
          email: normalizedEmail,
          password,
          csrfToken,
        };
        const payload = preferredLanguage
          ? { ...basePayload, preferredLanguage }
          : basePayload;
        await auth.signUp(payload);
        trackSignUpSuccessSafe({ analytics, clientId });
        await onSuccess?.();
        setButtonState('success');
      } else {
        const basePayload = {
          clientId,
          email: normalizedEmail,
          csrfToken,
        };
        const payload = preferredLanguage
          ? { ...basePayload, preferredLanguage }
          : basePayload;
        await auth.sendMagicLink(payload);
        trackMagicLinkSentSafe({
          analytics,
          clientId,
          flow: 'sign_up',
        });
        setNotice(labels.magicLinkSent);
      }
      setButtonState('success');
    } catch (err) {
      setErrors(toFieldErrors(err, labels.errors));
      setButtonState('idle');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isPasswordMode = mode === 'email_password';
  const canSwitch =
    (isPasswordMode ? serverSupportsMagic : serverSupportsPassword) &&
    !emailTaken;
  const switchText = isPasswordMode ? labels.useMagicLink : labels.usePassword;

  // Only disable during active submission or when email is already registered
  const submitDisabled = isSubmitting || emailTaken;

  return (
    <div
      {...rootProps}
      className={cn('card bg-base-100 w-full max-w-md shadow', className)}
      data-testid="auth-sign-up"
    >
      <div className="card-body gap-4">
        <Heading as="h1" data-testid="auth-sign-up-title">
          {labels.title}
        </Heading>

        {errors.form && (
          <div data-testid="auth-sign-up-form-error">
            <AppNotice tone="error">{errors.form}</AppNotice>
          </div>
        )}

        {notice && (
          <div>
            <AppNotice tone="success">{notice}</AppNotice>
          </div>
        )}

        {emailTaken && (
          <div data-testid="auth-sign-up-email-taken">
            <AppNotice tone="error">{labels.emailAlreadyRegistered}</AppNotice>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <EmailInput
            email={email}
            error={errors.email}
            isChecking={isChecking}
            isSubmitting={isSubmitting}
            onValueChange={handleEmailChange}
            autoFocus
            className="mb-4"
            labels={labels.emailInput}
            inputProps={{ 'data-testid': 'auth-sign-up-email-input' }}
          />

          {isPasswordMode && (
            <PasswordInput
              password={password}
              error={errors.password}
              isSubmitting={isSubmitting}
              onValueChange={handlePasswordChange}
              className="mb-4"
              labels={labels.passwordInput}
              inputProps={{ 'data-testid': 'auth-sign-up-password-input' }}
            />
          )}

          <SubmitButton
            state={buttonState}
            disabled={submitDisabled}
            className="btn-primary w-full"
            aria-label={isPasswordMode ? labels.signUp : labels.sendMagicLink}
            data-testid="auth-sign-up-submit"
          >
            {isPasswordMode ? labels.signUp : labels.sendMagicLink}
          </SubmitButton>

          {canSwitch && (
            <button
              type="button"
              className="btn btn-link px-0"
              onClick={() =>
                setManualMode(isPasswordMode ? 'magic_link' : 'email_password')
              }
              disabled={isSubmitting}
            >
              {switchText}
            </button>
          )}
        </form>

        {signInHref && (
          <div className="text-center">
            <Typography variant="body">
              {labels.haveAccount}{' '}
              <a
                href={signInHref}
                className="link link-primary"
                data-testid="auth-sign-up-sign-in-link"
              >
                {labels.signIn}
              </a>
            </Typography>
          </div>
        )}
      </div>
    </div>
  );
}
