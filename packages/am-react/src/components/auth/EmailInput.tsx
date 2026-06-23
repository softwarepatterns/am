import { ReloadIcon } from '@radix-ui/react-icons';
import { cn } from '../../lib/ui/cn.js';
import type { EmailInputLabels } from './labels.js';

type EmailInputElementProps = React.InputHTMLAttributes<HTMLInputElement> & {
  'data-testid'?: string;
};

export type EmailInputProps = React.HTMLAttributes<HTMLDivElement> & {
  email: string;
  error?: string;
  isChecking: boolean;
  isSubmitting: boolean;
  onValueChange: (value: string) => void;
  autoFocus?: boolean;
  labels: EmailInputLabels;
  inputProps?: EmailInputElementProps;
  'data-testid'?: string;
};
export function EmailInput(props: EmailInputProps) {
  const {
    className,
    email,
    error,
    isChecking,
    isSubmitting,
    onValueChange,
    autoFocus,
    labels,
    inputProps,
    'data-testid': dataTestId,
    ...rootProps
  } = props;
  const { className: inputClassName, ...restInputProps } = inputProps ?? {};

  const inputId = 'email-input';
  const errorId = 'email-error';

  return (
    <div
      {...rootProps}
      className={cn('form-control w-full', className)}
      data-testid={dataTestId}
    >
      <label className="label" htmlFor={inputId}>
        <span className="label-text">{labels.email}</span>
        {isChecking && (
          <span className="label-text-alt text-info flex items-center gap-1">
            <ReloadIcon className="h-3.5 w-3.5 animate-spin" />
            <span className="text-xs">{labels.checkingAvailability}</span>
          </span>
        )}
      </label>

      <input
        {...restInputProps}
        id={inputId}
        type="email"
        className={cn(
          'input input-bordered w-full',
          error && 'input-error',
          inputClassName,
        )}
        value={email}
        onChange={(e) => onValueChange(e.target.value)}
        disabled={isSubmitting}
        autoComplete="email"
        required
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={error ? errorId : undefined}
        autoFocus={autoFocus}
      />

      {error && (
        <label className="label">
          <span id={errorId} className="label-text-alt text-error">
            {error}
          </span>
        </label>
      )}
    </div>
  );
}
