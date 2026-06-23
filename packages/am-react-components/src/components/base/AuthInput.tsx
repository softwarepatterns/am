import React from 'react';

export type AuthInputProps = React.ComponentPropsWithoutRef<'input'>;

export const AuthInput = React.forwardRef<HTMLInputElement, AuthInputProps>(
  function AuthInput(props, ref) {
    const { type = 'text', ...rest } = props;

    return <input ref={ref} type={type} {...rest} />;
  },
);
