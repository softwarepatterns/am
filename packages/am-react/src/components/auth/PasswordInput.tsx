import { useState } from 'react';
import { EyeIcon, EyeClosedIcon } from 'lucide-react';
import { cn } from '../../lib/ui/cn.js';
import type { PasswordInputLabels } from './labels.js';

type PasswordInputElementProps =
  React.InputHTMLAttributes<HTMLInputElement> & {
    'data-testid'?: string;
  };

export type PasswordInputProps = React.HTMLAttributes<HTMLDivElement> & {
  password: string;
  error?: string;
  isSubmitting: boolean;
  onValueChange: (value: string) => void;
  labels: PasswordInputLabels;
  inputProps?: PasswordInputElementProps;
  toggleButtonProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
  'data-testid'?: string;
};
export function PasswordInput(props: PasswordInputProps) {
  const {
    className,
    password,
    error,
    isSubmitting,
    onValueChange,
    labels,
    inputProps,
    toggleButtonProps,
    'data-testid': dataTestId,
    ...rootProps
  } = props;
  const [showPassword, setShowPassword] = useState(false);
  const { className: inputClassName, ...restInputProps } = inputProps ?? {};
  const { className: toggleClassName, ...restToggleButtonProps } =
    toggleButtonProps ?? {};

  const inputId = 'password-input';
  const errorId = 'password-error';

  return (
    <div
      {...rootProps}
      className={cn('form-control w-full', className)}
      data-testid={dataTestId}
    >
      <label className="label" htmlFor={inputId}>
        <span className="label-text">{labels.password}</span>
      </label>

      <div className="relative">
        <input
          {...restInputProps}
          id={inputId}
          type={showPassword ? 'text' : 'password'}
          className={cn(
            'input input-bordered w-full pe-10',
            error && 'input-error',
            inputClassName,
          )}
          value={password}
          onChange={(e) => onValueChange(e.target.value)}
          disabled={isSubmitting}
          autoComplete="current-password"
          required
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? errorId : undefined}
        />

        <button
          {...restToggleButtonProps}
          type="button"
          className={cn(
            'text-base-content/60 hover:text-base-content absolute inset-y-0 right-0 flex items-center pr-3',
            toggleClassName,
          )}
          onClick={() => setShowPassword(!showPassword)}
          aria-label={showPassword ? labels.hidePassword : labels.showPassword}
          tabIndex={-1}
        >
          {showPassword ? (
            <EyeClosedIcon className="h-5 w-5" />
          ) : (
            <EyeIcon className="h-5 w-5" />
          )}
        </button>
      </div>

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
