import { Component, type PropsWithChildren } from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readProfileActiveAccountIdSafe } from '../../lib/auth/auth-identity.js';
import { AuthProvider, useAuth } from './AuthProvider.js';

type EventName =
  | 'profileChange'
  | 'refresh'
  | 'sessionChange'
  | 'unauthenticated';

function createAmMock(params: {
  session: {
    isExpired: () => boolean;
    profile: Record<string, unknown>;
    refresh: () => Promise<void>;
  } | null;
}) {
  const listeners = new Map<EventName, Set<(value: unknown) => void>>();

  return {
    emit(eventName: EventName, value: unknown) {
      for (const listener of listeners.get(eventName) ?? []) {
        listener(value);
      }
    },
    on(eventName: EventName, listener: (value: unknown) => void) {
      const existing = listeners.get(eventName) ?? new Set();
      existing.add(listener);
      listeners.set(eventName, existing);

      return () => {
        existing.delete(listener);
      };
    },
    restoreSession: vi.fn(),
    session: params.session,
  };
}

function AuthProbe() {
  const { isAuthChanging, isReady, session } = useAuth();

  return (
    <div>
      <div data-testid="auth-changing">{String(isAuthChanging)}</div>
      <div data-testid="ready">{String(isReady)}</div>
      <div data-testid="account-id">
        {String(readProfileActiveAccountIdSafe(session?.profile) ?? 'none')}
      </div>
      <div data-testid="user-id">{String(session?.profile?.id ?? 'none')}</div>
    </div>
  );
}

class TestErrorBoundary extends Component<
  PropsWithChildren,
  { error: Error | null }
> {
  state: { error: Error | null } = {
    error: null,
  };

  static getDerivedStateFromError(error: Error) {
    return {
      error,
    };
  }

  render() {
    if (this.state.error) {
      return <div data-testid="auth-error">{this.state.error.message}</div>;
    }

    return this.props.children;
  }
}

describe('AuthProvider', () => {
  afterEach(() => {
    cleanup();
  });

  it('keeps the current session during unauthenticated redirects', async () => {
    const session = {
      isExpired: () => false,
      profile: {
        activeMembership: { accountId: 'acc_1' },
        id: 'usr_1',
      },
      refresh: vi.fn(),
    };
    const am = createAmMock({ session });
    const onUnauthenticated = vi.fn();

    render(
      <AuthProvider am={am as never} onUnauthenticated={onUnauthenticated}>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('ready').textContent).toBe('true');
    });

    act(() => {
      am.emit('unauthenticated', new Error('unauthenticated'));
    });

    expect(screen.getByTestId('user-id').textContent).toBe('usr_1');
    expect(onUnauthenticated).toHaveBeenCalledTimes(1);
  });

  it('rerenders when profile data changes on the same session object', async () => {
    const session = {
      isExpired: () => false,
      profile: {
        activeMembership: { accountId: 'acc_1' },
        id: 'usr_1',
      },
      refresh: vi.fn(),
    };
    const am = createAmMock({ session });

    render(
      <AuthProvider am={am as never}>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('account-id').textContent).toBe('acc_1');
    });

    act(() => {
      session.profile.activeMembership = { accountId: 'acc_2' };
      am.emit('profileChange', session.profile);
    });

    expect(screen.getByTestId('account-id').textContent).toBe('acc_2');
  });

  it('exposes auth identity changes without clearing the current session first', async () => {
    const firstSession = {
      isExpired: () => false,
      profile: {
        activeMembership: { accountId: 'acc_1' },
        id: 'usr_1',
      },
      refresh: vi.fn(),
    };
    const secondSession = {
      isExpired: () => false,
      profile: {
        activeMembership: { accountId: 'acc_2' },
        id: 'usr_2',
      },
      refresh: vi.fn(),
    };
    const am = createAmMock({ session: firstSession });
    const onAuthIdentityChange = vi.fn();

    render(
      <AuthProvider
        am={am as never}
        onAuthIdentityChange={onAuthIdentityChange}
      >
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('ready').textContent).toBe('true');
    });

    act(() => {
      am.emit('sessionChange', secondSession);
    });

    expect(screen.getByTestId('user-id').textContent).toBe('usr_2');
    await waitFor(() => {
      expect(screen.getByTestId('auth-changing').textContent).toBe('false');
      expect(onAuthIdentityChange).toHaveBeenCalledTimes(1);
      expect(onAuthIdentityChange).toHaveBeenCalledWith({
        nextAuthIdentityKey: 'usr_2::no-membership::acc_2',
        nextSession: secondSession,
        previousAuthIdentityKey: 'usr_1::no-membership::acc_1',
        previousSession: firstSession,
      });
    });
  });

  it('ignores sessionChange(null) after authenticated UI has mounted', async () => {
    const session = {
      isExpired: () => false,
      profile: {
        activeMembership: { accountId: 'acc_1' },
        id: 'usr_1',
      },
      refresh: vi.fn(),
    };
    const am = createAmMock({ session });

    render(
      <AuthProvider am={am as never}>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('ready').textContent).toBe('true');
    });

    act(() => {
      am.emit('sessionChange', null);
    });

    expect(screen.getByTestId('user-id').textContent).toBe('usr_1');
    expect(screen.getByTestId('auth-changing').textContent).toBe('false');
  });

  it('does not latch auth changing when no auth identity handler is configured', async () => {
    const firstSession = {
      isExpired: () => false,
      profile: {
        activeMembership: { accountId: 'acc_1' },
        id: 'usr_1',
      },
      refresh: vi.fn(),
    };
    const secondSession = {
      isExpired: () => false,
      profile: {
        activeMembership: { accountId: 'acc_2' },
        id: 'usr_2',
      },
      refresh: vi.fn(),
    };
    const am = createAmMock({ session: firstSession });

    render(
      <AuthProvider am={am as never}>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('ready').textContent).toBe('true');
    });

    act(() => {
      am.emit('sessionChange', secondSession);
    });

    expect(screen.getByTestId('user-id').textContent).toBe('usr_2');
    expect(screen.getByTestId('auth-changing').textContent).toBe('false');
  });

  it('surfaces auth identity handler failures without re-latching auth changing', async () => {
    const firstSession = {
      isExpired: () => false,
      profile: {
        activeMembership: { accountId: 'acc_1' },
        id: 'usr_1',
      },
      refresh: vi.fn(),
    };
    const secondSession = {
      isExpired: () => false,
      profile: {
        activeMembership: { accountId: 'acc_2' },
        id: 'usr_2',
      },
      refresh: vi.fn(),
    };
    const am = createAmMock({ session: firstSession });
    const onAuthIdentityChange = vi.fn(() => {
      throw new Error('identity_change_failed');
    });
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    render(
      <TestErrorBoundary>
        <AuthProvider
          am={am as never}
          onAuthIdentityChange={onAuthIdentityChange}
        >
          <AuthProbe />
        </AuthProvider>
      </TestErrorBoundary>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('ready').textContent).toBe('true');
    });

    act(() => {
      am.emit('sessionChange', secondSession);
    });

    await waitFor(() => {
      expect(screen.getByTestId('auth-error').textContent).toBe(
        'identity_change_failed',
      );
    });
    expect(onAuthIdentityChange).toHaveBeenCalledTimes(1);
    consoleError.mockRestore();
  });

  it('becomes ready even when restoreSession throws', async () => {
    const am = createAmMock({ session: null });
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    am.restoreSession.mockImplementation(() => {
      throw new Error('restore_failed');
    });

    render(
      <AuthProvider am={am as never}>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('ready').textContent).toBe('true');
    });
    expect(screen.getByTestId('user-id').textContent).toBe('none');
    consoleError.mockRestore();
  });
});
