import React from 'react';
import { render, screen } from '@testing-library/react';
import {
  AuthInput,
  EmailAuthInput,
  PasswordAuthInput,
  UsernameAuthInput,
} from './index.js';

describe('AuthInput', () => {
  it('renders an input and defaults type to text', () => {
    render(<AuthInput aria-label="auth-input" />);

    const input = screen.getByRole('textbox', { name: 'auth-input' });
    expect(input).toHaveAttribute('type', 'text');
  });

  it('passes through native input props', () => {
    render(
      <AuthInput
        aria-label="auth-input"
        name="identifier"
        placeholder="Email or username"
        required
        data-testid="auth-input"
      />,
    );

    const input = screen.getByTestId('auth-input');
    expect(input).toHaveAttribute('name', 'identifier');
    expect(input).toHaveAttribute('placeholder', 'Email or username');
    expect(input).toBeRequired();
  });

  it('forwards refs to the underlying input', () => {
    const ref = React.createRef<HTMLInputElement>();

    render(<AuthInput ref={ref} aria-label="auth-input" />);

    expect(ref.current).toBeInstanceOf(HTMLInputElement);
    expect(ref.current).toHaveAttribute('type', 'text');
  });
});

describe('UsernameAuthInput', () => {
  it('applies username defaults', () => {
    render(<UsernameAuthInput aria-label="username" />);

    const input = screen.getByRole('textbox', { name: 'username' });
    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveAttribute('autocomplete', 'username');
    expect(input).toHaveAttribute('autocapitalize', 'none');
    expect(input).toHaveAttribute('autocorrect', 'off');
    expect(input).toHaveAttribute('spellcheck', 'false');
  });

  it('allows caller overrides', () => {
    render(
      <UsernameAuthInput
        aria-label="username"
        type="search"
        autoComplete="nickname"
        autoCapitalize="sentences"
        autoCorrect="on"
        spellCheck
      />,
    );

    const input = screen.getByRole('searchbox', { name: 'username' });
    expect(input).toHaveAttribute('type', 'search');
    expect(input).toHaveAttribute('autocomplete', 'nickname');
    expect(input).toHaveAttribute('autocapitalize', 'sentences');
    expect(input).toHaveAttribute('autocorrect', 'on');
    expect(input).toHaveAttribute('spellcheck', 'true');
  });

  it('forwards refs', () => {
    const ref = React.createRef<HTMLInputElement>();

    render(<UsernameAuthInput ref={ref} aria-label="username" />);

    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });
});

describe('EmailAuthInput', () => {
  it('applies email defaults', () => {
    render(<EmailAuthInput aria-label="email" />);

    const input = screen.getByLabelText('email');
    expect(input).toHaveAttribute('type', 'email');
    expect(input).toHaveAttribute('inputmode', 'email');
    expect(input).toHaveAttribute('autocomplete', 'email');
    expect(input).toHaveAttribute('autocapitalize', 'none');
    expect(input).toHaveAttribute('autocorrect', 'off');
    expect(input).toHaveAttribute('spellcheck', 'false');
  });

  it('allows caller overrides', () => {
    render(
      <EmailAuthInput
        aria-label="email"
        type="text"
        inputMode="text"
        autoComplete="username"
        autoCapitalize="sentences"
        autoCorrect="on"
        spellCheck
      />,
    );

    const input = screen.getByRole('textbox', { name: 'email' });
    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveAttribute('inputmode', 'text');
    expect(input).toHaveAttribute('autocomplete', 'username');
    expect(input).toHaveAttribute('autocapitalize', 'sentences');
    expect(input).toHaveAttribute('autocorrect', 'on');
    expect(input).toHaveAttribute('spellcheck', 'true');
  });

  it('forwards refs', () => {
    const ref = React.createRef<HTMLInputElement>();

    render(<EmailAuthInput ref={ref} aria-label="email" />);

    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });
});

describe('PasswordAuthInput', () => {
  it('defaults passwordMode to current', () => {
    render(<PasswordAuthInput aria-label="password" />);

    const input = screen.getByLabelText('password');
    expect(input).toHaveAttribute('type', 'password');
    expect(input).toHaveAttribute('autocomplete', 'current-password');
    expect(input).toHaveAttribute('autocapitalize', 'none');
    expect(input).toHaveAttribute('autocorrect', 'off');
    expect(input).toHaveAttribute('spellcheck', 'false');
  });

  it('maps passwordMode=new to new-password autocomplete', () => {
    render(<PasswordAuthInput aria-label="password" passwordMode="new" />);

    const input = screen.getByLabelText('password');
    expect(input).toHaveAttribute('autocomplete', 'new-password');
  });

  it('allows caller overrides and does not leak passwordMode to the dom', () => {
    render(
      <PasswordAuthInput
        aria-label="password"
        passwordMode="new"
        type="text"
        autoComplete="one-time-code"
        spellCheck
      />,
    );

    const input = screen.getByLabelText('password');
    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveAttribute('autocomplete', 'one-time-code');
    expect(input).toHaveAttribute('spellcheck', 'true');
    expect(input).not.toHaveAttribute('passwordMode');
  });

  it('forwards refs', () => {
    const ref = React.createRef<HTMLInputElement>();

    render(<PasswordAuthInput ref={ref} aria-label="password" />);

    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });
});
