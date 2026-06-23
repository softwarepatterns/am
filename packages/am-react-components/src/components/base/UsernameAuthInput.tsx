import React from 'react';
import { AuthInput } from './AuthInput.js';

export type UsernameAuthInputProps = React.ComponentPropsWithoutRef<'input'>;

export const UsernameAuthInput = React.forwardRef<
  HTMLInputElement,
  UsernameAuthInputProps
>(function UsernameAuthInput(props, ref) {
  return (
    <AuthInput
      ref={ref}
      type="text"
      autoComplete="username"
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      {...props}
    />
  );
});
