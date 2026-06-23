import React from 'react';
import { AuthInput } from './AuthInput.js';

export type EmailAuthInputProps = React.ComponentPropsWithoutRef<'input'>;

export const EmailAuthInput = React.forwardRef<
  HTMLInputElement,
  EmailAuthInputProps
>(function EmailAuthInput(props, ref) {
  return (
    <AuthInput
      ref={ref}
      type="email"
      inputMode="email"
      autoComplete="email"
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      {...props}
    />
  );
});
