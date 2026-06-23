import React, {
  createContext,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useMountEffect } from '../../hooks/useMountEffect.js';
import {
  Am,
  AuthSession,
  AuthError,
  type SessionProfile,
  type SessionTokens,
} from '@softwarepatterns/am';
import { readAuthIdentityKeySafe } from '../../lib/auth/auth-identity.js';

export type AuthIdentityChange = {
  nextAuthIdentityKey: string | null;
  nextSession: AuthSession | null;
  previousAuthIdentityKey: string | null;
  previousSession: AuthSession | null;
};

export type AuthContextValue = {
  auth: Am;
  isAuthChanging: boolean;
  session: AuthSession | null;
  isReady: boolean;
};

type SessionState = {
  authIdentityChangeError: Error | null;
  isAuthChanging: boolean;
  pendingAuthIdentityChange: AuthIdentityChange | null;
  revision: number;
  session: AuthSession | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Hook to access authentication state and actions.
 *
 * Must be called within <AuthProvider>.
 *
 * Auth transition rule:
 *
 * - Once authenticated UI has mounted, do not expect logout or unauthenticated
 *   transitions to publish `session = null` here.
 * - Those transitions must keep the current React session stable and finish with
 *   a hard navigation or reload. A null rerender can crash mounted routes
 *   before the browser leaves the page.
 *
 * @example
 *   ```tsx
 *   function Dashboard() {
 *     const { session } = useAuth();
 *
 *     if (!session) return <Spinner />;
 *     if (!session.profile) return <Redirect to="/login" />;
 *
 *     return <div>Welcome, {profile.identity?.displayName}</div>;
 *   }
 *   ```;
 */
export function useAuth(): AuthContextValue {
  const v = useContext(AuthContext);
  if (!v) throw new Error('useAuth must be used within <AuthProvider>');
  return v;
}

export function useRequiredAuth() {
  const auth = useAuth();

  if (!auth.session) {
    throw new Error('No session');
  }

  return {
    ...auth,
    session: auth.session,
  };
}

/**
 * Provider component that makes authentication state available throughout a
 * React tree.
 *
 * Wrap your app (or auth-dependent subtree) with <AuthProvider>.
 *
 * Critical rule:
 *
 * - Once authenticated UI has mounted, logout and unauthenticated transitions
 *   must not publish `session = null` into React state.
 * - Keep the current session stable and let the app root complete the transition
 *   with a hard navigation or reload.
 * - Syncing `null` into mounted app state can crash components and prevent the
 *   intended navigation from completing.
 *
 * @example
 *   ```tsx
 *   const am = new AM({
 *     storage: 'localStorage',
 *   });
 *
 *   function App() {
 *     return (
 *       <AuthProvider am={am}>
 *         <Router />
 *       </AuthProvider>
 *     );
 *   }
 *   ```;
 */
export type AuthProviderProps = {
  am: Am;
  onAuthIdentityChange?: (change: AuthIdentityChange) => void;
  onRefresh?: (newTokens: SessionTokens) => void;
  onProfileChange?: (profile: SessionProfile) => void;
  onUnauthenticated?: (e: AuthError) => void;
};

function PendingAuthIdentityChangeRuntime(props: {
  pendingAuthIdentityChange: AuthIdentityChange;
  setSessionState: React.Dispatch<React.SetStateAction<SessionState>>;
  onAuthIdentityChangeRef: React.MutableRefObject<
    AuthProviderProps['onAuthIdentityChange']
  >;
}) {
  useMountEffect(() => {
    let authIdentityChangeError: Error | null = null;

    try {
      props.onAuthIdentityChangeRef.current?.(props.pendingAuthIdentityChange);
    } catch (error: unknown) {
      authIdentityChangeError =
        error instanceof Error
          ? error
          : new Error('Auth identity change handling failed.');
    }

    props.setSessionState((currentState) => ({
      ...currentState,
      authIdentityChangeError,
      isAuthChanging: false,
      pendingAuthIdentityChange: null,
    }));
  });

  return null;
}

function AuthLifecycleRuntime(props: {
  am: Am;
  isReadyRef: React.MutableRefObject<boolean>;
  onAuthIdentityChangeRef: React.MutableRefObject<
    AuthProviderProps['onAuthIdentityChange']
  >;
  onProfileChangeRef: React.MutableRefObject<
    AuthProviderProps['onProfileChange']
  >;
  onRefreshRef: React.MutableRefObject<AuthProviderProps['onRefresh']>;
  onUnauthenticatedRef: React.MutableRefObject<
    AuthProviderProps['onUnauthenticated']
  >;
  setIsReady: React.Dispatch<React.SetStateAction<boolean>>;
  setSessionState: React.Dispatch<React.SetStateAction<SessionState>>;
}) {
  useMountEffect(() => {
    const unsubs: Array<() => void> = [];
    const syncSession = (session: AuthSession | null) => {
      props.setSessionState((currentState) => {
        const previousAuthIdentityKey = readAuthIdentityKeySafe(
          currentState.session,
        );
        const nextAuthIdentityKey = readAuthIdentityKeySafe(session);
        const hasAuthIdentityChanged =
          props.isReadyRef.current &&
          previousAuthIdentityKey !== nextAuthIdentityKey;
        const shouldHandleAuthIdentityChange =
          hasAuthIdentityChanged &&
          Boolean(props.onAuthIdentityChangeRef.current);

        return {
          authIdentityChangeError: null,
          isAuthChanging:
            currentState.isAuthChanging || shouldHandleAuthIdentityChange,
          pendingAuthIdentityChange: shouldHandleAuthIdentityChange
            ? {
                nextAuthIdentityKey,
                nextSession: session,
                previousAuthIdentityKey,
                previousSession: currentState.session,
              }
            : null,
          revision: currentState.revision + 1,
          session,
        };
      });
    };

    unsubs.push(
      props.am.on('sessionChange', (session) => {
        if (!session) {
          return;
        }

        syncSession(session);
      }),
    );

    unsubs.push(
      props.am.on('unauthenticated', (error) => {
        props.onUnauthenticatedRef.current?.(error);
      }),
    );

    unsubs.push(
      props.am.on('profileChange', (profile) => {
        if (props.am.session) {
          syncSession(props.am.session);
        }

        props.onProfileChangeRef.current?.(profile);
      }),
    );

    unsubs.push(
      props.am.on('refresh', (tokens) => {
        props.onRefreshRef.current?.(tokens);
      }),
    );

    (async () => {
      try {
        props.am.restoreSession();
        const currentSession = props.am.session;

        if (currentSession?.isExpired()) {
          try {
            await currentSession.refresh();
            syncSession(currentSession);
          } catch {
            currentSession.clear();
            syncSession(null);
          }
        } else {
          syncSession(currentSession);
        }
      } catch (error) {
        console.error(error);
        syncSession(null);
      } finally {
        props.setIsReady(true);
      }
    })().catch(console.error);

    return () => unsubs.forEach((unsubscribe) => unsubscribe());
  });

  return null;
}
export function AuthProvider(
  props: React.PropsWithChildren<AuthProviderProps>,
) {
  const {
    children,
    am,
    onAuthIdentityChange,
    onUnauthenticated,
    onProfileChange,
    onRefresh,
  } = props;
  const [sessionState, setSessionState] = useState<SessionState>({
    authIdentityChangeError: null,
    isAuthChanging: false,
    pendingAuthIdentityChange: null,
    revision: 0,
    session: null,
  });
  const [isReady, setIsReady] = useState(false);
  const isReadyRef = useRef(false);
  const onAuthIdentityChangeRef = useRef(onAuthIdentityChange);
  const onProfileChangeRef = useRef(onProfileChange);
  const onRefreshRef = useRef(onRefresh);
  const onUnauthenticatedRef = useRef(onUnauthenticated);

  isReadyRef.current = isReady;
  onAuthIdentityChangeRef.current = onAuthIdentityChange;
  onProfileChangeRef.current = onProfileChange;
  onRefreshRef.current = onRefresh;
  onUnauthenticatedRef.current = onUnauthenticated;

  if (sessionState.authIdentityChangeError) {
    throw sessionState.authIdentityChangeError;
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      auth: am,
      isAuthChanging: sessionState.isAuthChanging,
      session: sessionState.session,
      isReady,
    }),
    [
      am,
      isReady,
      sessionState.isAuthChanging,
      sessionState.revision,
      sessionState.session,
    ],
  );

  return (
    <AuthContext.Provider value={value}>
      <AuthLifecycleRuntime
        am={am}
        isReadyRef={isReadyRef}
        onAuthIdentityChangeRef={onAuthIdentityChangeRef}
        onProfileChangeRef={onProfileChangeRef}
        onRefreshRef={onRefreshRef}
        onUnauthenticatedRef={onUnauthenticatedRef}
        setIsReady={setIsReady}
        setSessionState={setSessionState}
      />
      {sessionState.pendingAuthIdentityChange ? (
        <PendingAuthIdentityChangeRuntime
          key={sessionState.revision}
          onAuthIdentityChangeRef={onAuthIdentityChangeRef}
          pendingAuthIdentityChange={sessionState.pendingAuthIdentityChange}
          setSessionState={setSessionState}
        />
      ) : null}
      {children}
    </AuthContext.Provider>
  );
}
