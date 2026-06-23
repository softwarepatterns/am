import React, { useEffect } from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { AuthError } from '@softwarepatterns/am';
import type { Am, AuthSession, SessionProfile, SessionTokens } from '@softwarepatterns/am';
import { AuthProvider, useAuth, useRequiredAuth } from './AuthProvider.js';

type AuthEventName =
  | 'sessionChange'
  | 'unauthenticated'
  | 'profileChange'
  | 'refresh';

type AuthEventPayloadMap = {
  sessionChange: AuthSession | null;
  unauthenticated: AuthError;
  profileChange: SessionProfile;
  refresh: SessionTokens;
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
  onProfileChange?: (profile: SessionProfile) => void;
  onRefresh?: (tokens: SessionTokens) => void;
  onSessionChange?: (session: AuthSession | null) => void | Promise<void>;
  onUnauthenticated?: (error: AuthError) => void;
}) {
  const { Observer, recorder } = createRecorder();

  render(
    <AuthProvider
      am={options.am.am}
      onProfileChange={options.onProfileChange}
      onRefresh={options.onRefresh}
      onSessionChange={options.onSessionChange}
      onUnauthenticated={options.onUnauthenticated}
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

  it('clears an expired startup session when refresh fails and still becomes ready', async () => {
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
    expect((expiredSession.clear as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);
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

  it('updates React state when sessionChange emits a session', async () => {
    const initialSession = createSession();
    const nextSession = createSession();
    const fakeAm = createAm({ session: initialSession });

    const recorder = await renderProvider({ am: fakeAm });

    await waitFor(() => {
      expect(recorder.getCurrent().session).toBe(initialSession);
    });

    await act(async () => {
      fakeAm.emit('sessionChange', nextSession);
    });

    await waitFor(() => {
      expect(recorder.getCurrent().session).toBe(nextSession);
    });
  });

  it('updates React state when sessionChange emits null', async () => {
    const initialSession = createSession();
    const fakeAm = createAm({ session: initialSession });

    const recorder = await renderProvider({ am: fakeAm });

    await waitFor(() => {
      expect(recorder.getCurrent().session).toBe(initialSession);
    });

    await act(async () => {
      fakeAm.emit('sessionChange', null);
    });

    await waitFor(() => {
      expect(recorder.getCurrent().session).toBeNull();
    });
  });

  it('waits for onSessionChange before publishing the new session', async () => {
    const initialSession = createSession();
    const nextSession = createSession();
    const fakeAm = createAm({ session: initialSession });
    let resolveSessionChange: (() => void) | null = null;
    const onSessionChange = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSessionChange = resolve;
        }),
    );

    const recorder = await renderProvider({ am: fakeAm, onSessionChange });

    await waitFor(() => {
      expect(recorder.getCurrent().session).toBe(initialSession);
    });

    await act(async () => {
      fakeAm.emit('sessionChange', nextSession);
      await Promise.resolve();
    });

    expect(onSessionChange).toHaveBeenCalledWith(nextSession);
    expect(recorder.getCurrent().session).toBe(initialSession);

    if (!resolveSessionChange) {
      throw new Error('Expected onSessionChange promise resolver');
    }

    await act(async () => {
      resolveSessionChange();
    });

    await waitFor(() => {
      expect(recorder.getCurrent().session).toBe(nextSession);
    });
  });

  it('logs onSessionChange failures and still publishes the new session', async () => {
    const initialSession = createSession();
    const nextSession = createSession();
    const fakeAm = createAm({ session: initialSession });
    const callbackError = new Error('callback failed');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onSessionChange = vi.fn(() => {
      throw callbackError;
    });

    const recorder = await renderProvider({ am: fakeAm, onSessionChange });

    await waitFor(() => {
      expect(recorder.getCurrent().session).toBe(initialSession);
    });

    await act(async () => {
      fakeAm.emit('sessionChange', nextSession);
    });

    await waitFor(() => {
      expect(recorder.getCurrent().session).toBe(nextSession);
    });
    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to apply session change',
      callbackError,
    );
  });

  it('forwards profileChange only when onProfileChange is provided', async () => {
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
    const onProfileChange = vi.fn();

    await renderProvider({ am: fakeAm, onProfileChange });

    expect(fakeAm.on.mock.calls.map(([event]) => event)).toEqual(
      expect.arrayContaining(['profileChange']),
    );

    await act(async () => {
      fakeAm.emit('profileChange', profile);
    });

    expect(onProfileChange).toHaveBeenCalledWith(profile);
  });

  it('forwards refresh only when onRefresh is provided', async () => {
    const tokens = {
      accessToken: 'access_token',
      refreshToken: 'refresh_token',
      tokenType: 'Bearer',
      expiresIn: 3600,
      expiresAt: Date.now() + 3600_000,
    } satisfies SessionTokens;
    const fakeAm = createAm();
    const onRefresh = vi.fn();

    await renderProvider({ am: fakeAm, onRefresh });

    expect(fakeAm.on.mock.calls.map(([event]) => event)).toEqual(
      expect.arrayContaining(['refresh']),
    );

    await act(async () => {
      fakeAm.emit('refresh', tokens);
    });

    expect(onRefresh).toHaveBeenCalledWith(tokens);
  });

  it('clears the core session on unauthenticated without nulling React session state', async () => {
    const session = createSession();
    const fakeAm = createAm({ session });
    const onUnauthenticated = vi.fn();
    const problem = createProblem();

    const recorder = await renderProvider({ am: fakeAm, onUnauthenticated });

    await waitFor(() => {
      expect(recorder.getCurrent().session).toBe(session);
    });

    await act(async () => {
      fakeAm.emit('unauthenticated', problem);
    });

    expect((session.clear as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);
    expect(onUnauthenticated).toHaveBeenCalledWith(problem);
    expect(recorder.getCurrent().session).toBe(session);
  });

  it('handles unauthenticated when am.session is already null', async () => {
    const fakeAm = createAm();
    const onUnauthenticated = vi.fn();
    const problem = createProblem();

    await renderProvider({ am: fakeAm, onUnauthenticated });

    await act(async () => {
      fakeAm.emit('unauthenticated', problem);
    });

    expect(onUnauthenticated).toHaveBeenCalledWith(problem);
  });

  it('unsubscribes all registered listeners on unmount', async () => {
    const fakeAm = createAm();
    const onProfileChange = vi.fn();
    const onRefresh = vi.fn();
    const { unmount } = render(
      <AuthProvider
        am={fakeAm.am}
        onProfileChange={onProfileChange}
        onRefresh={onRefresh}
      >
        <div>child</div>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(fakeAm.unsubscribes).toHaveLength(4);
    });

    unmount();

    expect(fakeAm.unsubscribes[0]).toHaveBeenCalledTimes(1);
    expect(fakeAm.unsubscribes[1]).toHaveBeenCalledTimes(1);
    expect(fakeAm.unsubscribes[2]).toHaveBeenCalledTimes(1);
    expect(fakeAm.unsubscribes[3]).toHaveBeenCalledTimes(1);
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
      expect(secondAm.unsubscribes).toHaveLength(2);
      expect(recorder.getCurrent().session).toBe(secondSession);
    });
    expect(firstAm.unsubscribes[0]).toHaveBeenCalledTimes(1);
    expect(firstAm.unsubscribes[1]).toHaveBeenCalledTimes(1);

    const replacementSession = createSession();

    await act(async () => {
      firstAm.emit('sessionChange', replacementSession);
    });

    expect(recorder.getCurrent().session).toBe(secondSession);

    await act(async () => {
      secondAm.emit('sessionChange', replacementSession);
    });

    await waitFor(() => {
      expect(recorder.getCurrent().session).toBe(replacementSession);
    });
  });
});
