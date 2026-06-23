import React from 'react';
import { expectTypeOf } from 'vitest';
import * as authComponents from './index.js';

describe('@softwarepatterns/am-react-components public API', () => {
  it('exports the auth input surface', () => {
    expect(authComponents.AuthInput).toBeDefined();
    expect(authComponents.UsernameAuthInput).toBeDefined();
    expect(authComponents.EmailAuthInput).toBeDefined();
    expect(authComponents.PasswordAuthInput).toBeDefined();
  });

  it('uses native input props for AuthInput', () => {
    expectTypeOf<authComponents.AuthInputProps>().toMatchTypeOf<
      React.ComponentPropsWithoutRef<'input'>
    >();
  });

  it('exposes passwordMode on PasswordAuthInput props', () => {
    expectTypeOf<authComponents.PasswordAuthInputProps>().toMatchTypeOf<
      React.ComponentPropsWithoutRef<'input'> & {
        passwordMode?: 'current' | 'new';
      }
    >();
  });

  it('does not expose custom value apis on the component props', () => {
    type AuthInputPropNames = keyof authComponents.AuthInputProps;
    type PasswordAuthInputPropNames =
      keyof authComponents.PasswordAuthInputProps;

    const authInputHasOnValueChange: 'onValueChange' extends AuthInputPropNames
      ? true
      : false = false;
    const authInputHasInputProps: 'inputProps' extends AuthInputPropNames
      ? true
      : false = false;
    const passwordInputHasOnValueChange:
      'onValueChange' extends PasswordAuthInputPropNames ? true : false = false;

    expect(authInputHasOnValueChange).toBe(false);
    expect(authInputHasInputProps).toBe(false);
    expect(passwordInputHasOnValueChange).toBe(false);
  });
});
