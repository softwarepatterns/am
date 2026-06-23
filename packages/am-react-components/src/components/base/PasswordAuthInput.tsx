import React from 'react';
import { AuthInput } from './AuthInput.js';

export type PasswordMode = 'current' | 'new';

export type PasswordAuthInputProps = React.ComponentPropsWithoutRef<'input'> & {
  passwordMode?: PasswordMode;
};

export const PasswordAuthInput = React.forwardRef<
  HTMLInputElement,
  PasswordAuthInputProps
>(function PasswordAuthInput(props, ref) {
  const {
    passwordMode = 'current',
    ...rest
  } = props;

  return (
    <AuthInput
      ref={ref}
      type="password"
      autoComplete={
        passwordMode === 'new' ? 'new-password' : 'current-password'
      }
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      {...rest}
    />
  );
});
