/**
 * Owns the shared sign-in form block. It keeps authentication flow state local
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
  trackSignInSuccessSafe,
} from '../../lib/analytics/auth-events.js';
import { AppNotice } from '../ui/AppNotice.js';
import { cn } from '../../lib/ui/cn.js';
import { useAuth } from './AuthProvider.js';
import { toFieldErrors } from './common.js';
import { EmailInput } from './EmailInput.js';
import type { SignInBlockLabels } from './labels.js';
import { PasswordInput } from './PasswordInput.js';

export type SignInBlockProps = React.HTMLAttributes<HTMLDivElement> & {
  clientId: ClientId;
  csrfToken?: string;
  onSuccess?: () => Promise<void>;
  signUpHref?: string;
  labels: SignInBlockLabels;
  enableEmailCheck?: boolean;
};

export function SignInBlock(props: SignInBlockProps) {
  const {
    className,
    clientId,
    csrfToken,
    onSuccess,
    signUpHref,
    labels,
    ...rootProps
  } = props;
  const enableEmailCheck = props.enableEmailCheck ?? true;
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

  const canUsePassword = hasMethod(emailState, 'email_password');
  const canUseMagic = hasMethod(emailState, 'magic_link');

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
        await auth.signIn({
          clientId,
          email: normalizedEmail,
          password,
          csrfToken,
        });
        trackSignInSuccessSafe({ analytics, clientId });
        await onSuccess?.();
        setButtonState('success');
      } else {
        await auth.sendMagicLink({
          clientId,
          email: normalizedEmail,
          csrfToken,
        });
        trackMagicLinkSentSafe({
          analytics,
          clientId,
          flow: 'sign_in',
        });
        setNotice(labels.magicLinkSent);
        setButtonState('success');
      }
    } catch (err) {
      setErrors(toFieldErrors(err, labels.errors));
      setButtonState('idle');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isPasswordMode = mode === 'email_password';
  const canSwitch = isPasswordMode ? canUseMagic : canUsePassword;
  const switchText = isPasswordMode ? labels.useMagicLink : labels.usePassword;

  return (
    <div
      {...rootProps}
      className={cn('card bg-base-100 w-full max-w-md shadow', className)}
      data-testid="auth-sign-in"
    >
      <div className="card-body gap-4">
        <Heading as="h1" data-testid="auth-sign-in-title">
          {labels.title}
        </Heading>

        {errors.form && (
          <div data-testid="auth-sign-in-form-error">
            <AppNotice tone="error">{errors.form}</AppNotice>
          </div>
        )}

        {notice && (
          <div>
            <AppNotice tone="success">{notice}</AppNotice>
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
            inputProps={{ 'data-testid': 'auth-sign-in-email-input' }}
          />

          {emailState?.status === 'inactive' && (
            <div>
              <AppNotice tone="warning">{labels.accountInactive}</AppNotice>
            </div>
          )}

          {isPasswordMode ? (
            <>
              {!canUsePassword && emailState?.status === 'active' && (
                <div>
                  <AppNotice tone="warning">
                    {labels.passwordNotAvailable}
                  </AppNotice>
                </div>
              )}

              <PasswordInput
                password={password}
                error={errors.password}
                isSubmitting={isSubmitting}
                onValueChange={handlePasswordChange}
                className="mb-4"
                labels={labels.passwordInput}
                inputProps={{ 'data-testid': 'auth-sign-in-password-input' }}
              />
            </>
          ) : (
            !canUseMagic &&
            emailState?.status === 'active' && (
              <div>
                <AppNotice tone="warning">
                  {labels.magicLinkNotAvailable}
                </AppNotice>
              </div>
            )
          )}

          <SubmitButton
            state={buttonState}
            disabled={isSubmitting}
            className="btn-primary w-full"
            aria-label={isPasswordMode ? labels.signIn : labels.sendMagicLink}
            data-testid="auth-sign-in-submit"
          >
            {isPasswordMode ? labels.signIn : labels.sendMagicLink}
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

        {signUpHref && (
          <div className="text-center">
            <Typography variant="body">
              {labels.noAccount}{' '}
              <a
                href={signUpHref}
                className="link link-primary"
                data-testid="auth-sign-in-sign-up-link"
              >
                {labels.signUp}
              </a>
            </Typography>
          </div>
        )}
      </div>
    </div>
  );
}
