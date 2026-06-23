import React, { useEffect } from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { AuthError } from '@softwarepatterns/am';
import type { Am, AuthSession, SessionProfile, SessionTokens } from '@softwarepatterns/am';
import { AuthProvider, useAuth, useRequiredAuth } from './AuthProvider.js';

type AuthEventName =
  | 'signedIn'
  | 'authLost'
  | 'profileUpdated'
  | 'tokensUpdated'
  | 'reloadRequired';

type AuthEventPayloadMap = {
  signedIn: AuthSession;
  authLost: AuthError;
  profileUpdated: SessionProfile;
  tokensUpdated: SessionTokens;
  reloadRequired: void;
};

type FakeSessionOptions = {
  expired?: boolean;
  refreshImpl?: () => Promise<void>;
};

type FakeAmOptions = {
  restoreSession?: AuthSession | null;
  session?: AuthSession | null;
};

type Snapshot = ReturnType<typeof useAuth>;

type TestRecorder = {
  snapshots: Snapshot[];
  getCurrent: () => Snapshot;
};

function createSession(options: FakeSessionOptions = {}): AuthSession {
  const expired = options.expired ?? false;

  return {
    clear: vi.fn(),
    isExpired: vi.fn(() => expired),
    refresh: vi.fn(options.refreshImpl ?? (async () => {})),
  } as unknown as AuthSession;
}

function createAm(options: FakeAmOptions = {}) {
  const listeners = new Map<AuthEventName, Set<(payload: unknown) => void>>();
  const unsubscribes: Array<ReturnType<typeof vi.fn>> = [];

  const am = {
    on: vi.fn((event: AuthEventName, fn: (payload: unknown) => void) => {
      const eventListeners = listeners.get(event) ?? new Set();
      eventListeners.add(fn);
      listeners.set(event, eventListeners);

      const unsubscribe = vi.fn(() => {
        eventListeners.delete(fn);
      });
      unsubscribes.push(unsubscribe);
      return unsubscribe;
    }),
    restoreSession: vi.fn(() => options.restoreSession ?? null),
    session: options.session ?? null,
  };

  function emit<K extends AuthEventName>(
    event: K,
    payload: AuthEventPayloadMap[K],
  ) {
    const eventListeners = listeners.get(event);
    if (!eventListeners) {
      return;
    }

    for (const listener of eventListeners) {
      listener(payload);
    }
  }

  return {
    am: am as unknown as Am,
    emit,
    on: am.on,
    restoreSession: am.restoreSession,
    setSession(session: AuthSession | null) {
      am.session = session;
    },
    unsubscribes,
  };
}

function createRecorder(): {
  Observer: () => React.JSX.Element;
  recorder: TestRecorder;
} {
  const snapshots: Snapshot[] = [];
  let current: Snapshot | null = null;

  function Observer() {
    const value = useAuth();

    useEffect(() => {
      snapshots.push(value);
      current = value;
    }, [value]);

    return (
      <div
        data-testid="auth-state"
        data-ready={String(value.isReady)}
        data-session={value.session ? 'present' : 'missing'}
      />
    );
  }

  return {
    Observer,
    recorder: {
      snapshots,
      getCurrent() {
        if (!current) {
          throw new Error('Expected auth snapshot');
        }

        return current;
      },
    },
  };
}

async function renderProvider(options: {
  am: ReturnType<typeof createAm>;
  onProfileUpdated?: (profile: SessionProfile) => void;
  onTokensUpdated?: (tokens: SessionTokens) => void;
  onSignedIn?: (session: AuthSession) => void | Promise<void>;
  onAuthLost?: (error: AuthError) => void;
  onReloadRequired?: () => void;
}) {
  const { Observer, recorder } = createRecorder();

  render(
    <AuthProvider
      am={options.am.am}
      onProfileUpdated={options.onProfileUpdated}
      onTokensUpdated={options.onTokensUpdated}
      onSignedIn={options.onSignedIn}
      onAuthLost={options.onAuthLost}
      onReloadRequired={options.onReloadRequired}
    >
      <Observer />
    </AuthProvider>,
  );

  await waitFor(() => {
    expect(recorder.snapshots.length).toBeGreaterThan(0);
  });

  return recorder;
}

function createProblem() {
  return new AuthError({
    type: 'https://example.com/problems/unauthenticated',
    title: 'Unauthenticated',
    status: 401,
  });
}

describe('AuthProvider', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('throws when useAuth is called outside AuthProvider', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    function OutsideConsumer() {
      useAuth();
      return <div>unreachable</div>;
    }

    expect(() => render(<OutsideConsumer />)).toThrow(
      'useAuth must be used within <AuthProvider>',
    );

    errorSpy.mockRestore();
  });

  it('throws when useRequiredAuth is called outside AuthProvider', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    function OutsideConsumer() {
      useRequiredAuth();
      return <div>unreachable</div>;
    }

    expect(() => render(<OutsideConsumer />)).toThrow(
      'useAuth must be used within <AuthProvider>',
    );

    errorSpy.mockRestore();
  });

  it('throws when useRequiredAuth is used without a session', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fakeAm = createAm();

    function RequiredObserver() {
      useRequiredAuth();
      return <div>unreachable</div>;
    }

    await expect(async () => {
      render(
        <AuthProvider am={fakeAm.am}>
          <RequiredObserver />
        </AuthProvider>,
      );

      await waitFor(() => {
        expect(fakeAm.restoreSession).toHaveBeenCalledTimes(1);
      });
    }).rejects.toThrow('No session');

    errorSpy.mockRestore();
  });

  it('starts not ready, then restores a non-expired session and becomes ready', async () => {
    const restoredSession = createSession();
    const fakeAm = createAm({ restoreSession: restoredSession });

    const recorder = await renderProvider({ am: fakeAm });

    expect(recorder.snapshots[0]?.isReady).toBe(false);
    await waitFor(() => {
      expect(recorder.getCurrent().isReady).toBe(true);
    });
    expect(recorder.getCurrent().session).toBe(restoredSession);
    expect(fakeAm.restoreSession).toHaveBeenCalledTimes(1);
    expect((restoredSession.isExpired as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(
      1,
    );
  });

  it('falls back to am.session when restoreSession returns null', async () => {
    const currentSession = createSession();
    const fakeAm = createAm({ restoreSession: null, session: currentSession });

    const recorder = await renderProvider({ am: fakeAm });

    await waitFor(() => {
      expect(recorder.getCurrent().isReady).toBe(true);
    });
    expect(recorder.getCurrent().session).toBe(currentSession);
  });

  it('returns a required session when useRequiredAuth is used with a session', async () => {
    const session = createSession();
    const fakeAm = createAm({ restoreSession: session });
    const snapshots: Array<ReturnType<typeof useRequiredAuth>> = [];

    function AuthGate() {
      const auth = useAuth();

      if (!auth.session) {
        return null;
      }

      return <RequiredObserver />;
    }

    function RequiredObserver() {
      const value = useRequiredAuth();

      useEffect(() => {
        snapshots.push(value);
      }, [value]);

      return null;
    }

    render(
      <AuthProvider am={fakeAm.am}>
        <AuthGate />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(snapshots.length).toBeGreaterThan(0);
    });

    expect(snapshots.at(-1)?.session).toBe(session);
  });

  it('refreshes an expired startup session before publishing it', async () => {
    const expiredSession = createSession({ expired: true });
    const fakeAm = createAm({ restoreSession: expiredSession });

    const recorder = await renderProvider({ am: fakeAm });

    await waitFor(() => {
      expect(recorder.getCurrent().isReady).toBe(true);
    });
    expect((expiredSession.refresh as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);
    expect(recorder.getCurrent().session).toBe(expiredSession);
  });

  it('drops an expired startup session when refresh fails and still becomes ready', async () => {
    const expiredSession = createSession({
      expired: true,
      refreshImpl: async () => {
        throw new Error('refresh failed');
      },
    });
    const fakeAm = createAm({ restoreSession: expiredSession });

    const recorder = await renderProvider({ am: fakeAm });

    await waitFor(() => {
      expect(recorder.getCurrent().isReady).toBe(true);
    });
    expect((expiredSession.refresh as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);
    expect((expiredSession.clear as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(0);
    expect(recorder.getCurrent().session).toBeNull();
  });

  it('becomes ready without a session when nothing can be restored', async () => {
    const fakeAm = createAm();

    const recorder = await renderProvider({ am: fakeAm });

    await waitFor(() => {
      expect(recorder.getCurrent().isReady).toBe(true);
    });
    expect(recorder.getCurrent().session).toBeNull();
  });

  it('updates React state when signedIn emits a session', async () => {
    const initialSession = createSession();
    const nextSession = createSession();
    const fakeAm = createAm({ session: initialSession });

    const recorder = await renderProvider({ am: fakeAm });

    await waitFor(() => {
      expect(recorder.getCurrent().session).toBe(initialSession);
    });

    await act(async () => {
      fakeAm.emit('signedIn', nextSession);
    });

    await waitFor(() => {
      expect(recorder.getCurrent().session).toBe(nextSession);
    });
  });

  it('waits for onSignedIn before publishing the new session', async () => {
    const initialSession = createSession();
    const nextSession = createSession();
    const fakeAm = createAm({ session: initialSession });
    let resolveSessionChange: (() => void) | null = null;
    const onSignedIn = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSessionChange = resolve;
        }),
    );

    const recorder = await renderProvider({ am: fakeAm, onSignedIn });

    await waitFor(() => {
      expect(recorder.getCurrent().session).toBe(initialSession);
    });

    await act(async () => {
      fakeAm.emit('signedIn', nextSession);
      await Promise.resolve();
    });

    expect(onSignedIn).toHaveBeenCalledWith(nextSession);
    expect(recorder.getCurrent().session).toBe(initialSession);

    if (!resolveSessionChange) {
      throw new Error('Expected onSignedIn promise resolver');
    }

    await act(async () => {
      resolveSessionChange();
    });

    await waitFor(() => {
      expect(recorder.getCurrent().session).toBe(nextSession);
    });
  });

  it('logs onSignedIn failures and still publishes the new session', async () => {
    const initialSession = createSession();
    const nextSession = createSession();
    const fakeAm = createAm({ session: initialSession });
    const callbackError = new Error('callback failed');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onSignedIn = vi.fn(() => {
      throw callbackError;
    });

    const recorder = await renderProvider({ am: fakeAm, onSignedIn });

    await waitFor(() => {
      expect(recorder.getCurrent().session).toBe(initialSession);
    });

    await act(async () => {
      fakeAm.emit('signedIn', nextSession);
    });

    await waitFor(() => {
      expect(recorder.getCurrent().session).toBe(nextSession);
    });
    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to apply signed-in state',
      callbackError,
    );
  });

  it('forwards profileUpdated only when onProfileUpdated is provided', async () => {
    const profile = {
      id: 'user_123',
      applicationId: 'app_123',
      status: 'active',
      identity: null,
      credentials: [],
      memberships: [],
      activeMembership: null,
      lastUpdatedAt: Date.now(),
    } satisfies SessionProfile;
    const fakeAm = createAm();
    const onProfileUpdated = vi.fn();

    await renderProvider({ am: fakeAm, onProfileUpdated });

    expect(fakeAm.on.mock.calls.map(([event]) => event)).toEqual(
      expect.arrayContaining(['profileUpdated']),
    );

    await act(async () => {
      fakeAm.emit('profileUpdated', profile);
    });

    expect(onProfileUpdated).toHaveBeenCalledWith(profile);
  });

  it('forwards tokensUpdated only when onTokensUpdated is provided', async () => {
    const tokens = {
      accessToken: 'access_token',
      refreshToken: 'refresh_token',
      tokenType: 'Bearer',
      expiresIn: 3600,
      expiresAt: Date.now() + 3600_000,
    } satisfies SessionTokens;
    const fakeAm = createAm();
    const onTokensUpdated = vi.fn();

    await renderProvider({ am: fakeAm, onTokensUpdated });

    expect(fakeAm.on.mock.calls.map(([event]) => event)).toEqual(
      expect.arrayContaining(['tokensUpdated']),
    );

    await act(async () => {
      fakeAm.emit('tokensUpdated', tokens);
    });

    expect(onTokensUpdated).toHaveBeenCalledWith(tokens);
  });

  it('forwards authLost without clearing the core session', async () => {
    const session = createSession();
    const fakeAm = createAm({ session });
    const onAuthLost = vi.fn();
    const problem = createProblem();

    const recorder = await renderProvider({ am: fakeAm, onAuthLost });

    await waitFor(() => {
      expect(recorder.getCurrent().session).toBe(session);
    });

    await act(async () => {
      fakeAm.emit('authLost', problem);
    });

    expect((session.clear as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(0);
    expect(onAuthLost).toHaveBeenCalledWith(problem);
    expect(recorder.getCurrent().session).toBe(session);
  });

  it('handles authLost when am.session is already null', async () => {
    const fakeAm = createAm();
    const onAuthLost = vi.fn();
    const problem = createProblem();

    await renderProvider({ am: fakeAm, onAuthLost });

    await act(async () => {
      fakeAm.emit('authLost', problem);
    });

    expect(onAuthLost).toHaveBeenCalledWith(problem);
  });

  it('forwards reloadRequired without nulling React session state', async () => {
    const session = createSession();
    const fakeAm = createAm({ session });
    const onReloadRequired = vi.fn();

    const recorder = await renderProvider({ am: fakeAm, onReloadRequired });

    await waitFor(() => {
      expect(recorder.getCurrent().session).toBe(session);
    });

    await act(async () => {
      fakeAm.emit('reloadRequired', undefined);
    });

    expect(onReloadRequired).toHaveBeenCalledTimes(1);
    expect(recorder.getCurrent().session).toBe(session);
  });

  it('unsubscribes all registered listeners on unmount', async () => {
    const fakeAm = createAm();
    const onProfileUpdated = vi.fn();
    const onTokensUpdated = vi.fn();
    const onAuthLost = vi.fn();
    const onReloadRequired = vi.fn();
    const { unmount } = render(
      <AuthProvider
        am={fakeAm.am}
        onProfileUpdated={onProfileUpdated}
        onTokensUpdated={onTokensUpdated}
        onAuthLost={onAuthLost}
        onReloadRequired={onReloadRequired}
      >
        <div>child</div>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(fakeAm.unsubscribes).toHaveLength(5);
    });

    unmount();

    expect(fakeAm.unsubscribes[0]).toHaveBeenCalledTimes(1);
    expect(fakeAm.unsubscribes[1]).toHaveBeenCalledTimes(1);
    expect(fakeAm.unsubscribes[2]).toHaveBeenCalledTimes(1);
    expect(fakeAm.unsubscribes[3]).toHaveBeenCalledTimes(1);
    expect(fakeAm.unsubscribes[4]).toHaveBeenCalledTimes(1);
  });

  it('replaces subscriptions when the am instance changes', async () => {
    const firstSession = createSession();
    const secondSession = createSession();
    const firstAm = createAm({ session: firstSession });
    const secondAm = createAm({ session: secondSession });
    const { Observer, recorder } = createRecorder();
    const rendered = render(
      <AuthProvider am={firstAm.am}>
        <Observer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(recorder.getCurrent().session).toBe(firstSession);
    });

    rendered.rerender(
      <AuthProvider am={secondAm.am}>
        <Observer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(secondAm.unsubscribes).toHaveLength(1);
      expect(recorder.getCurrent().session).toBe(secondSession);
    });
    expect(firstAm.unsubscribes[0]).toHaveBeenCalledTimes(1);

    const replacementSession = createSession();

    await act(async () => {
      firstAm.emit('signedIn', replacementSession);
    });

    expect(recorder.getCurrent().session).toBe(secondSession);

    await act(async () => {
      secondAm.emit('signedIn', replacementSession);
    });

    await waitFor(() => {
      expect(recorder.getCurrent().session).toBe(replacementSession);
    });
  });
});
