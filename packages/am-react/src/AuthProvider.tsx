import React, {
  useMemo,
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react';
import {
  Am,
  AuthSession,
  AuthError,
} from '@softwarepatterns/am'; // adjust import paths
import type { SessionProfile, SessionTokens } from '@softwarepatterns/am';

export type AuthProviderProps = {
  am: Am;

  onRefresh?: (newTokens: SessionTokens) => void;
  onProfileChange?: (profile: SessionProfile) => void;
  onUnauthenticated?: (e: AuthError) => void;
  onSessionChange?: (session: AuthSession | null) => void;
};

export type AuthContextValue = {
  auth: Am;
  session: AuthSession | null;
  isReady: boolean;
};

export type RequiredAuthContextValue = Omit<AuthContextValue, 'session'> & {
  session: AuthSession;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Hook to access authentication state and actions.
 *
 * Must be called within <AuthProvider>.
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

export function useRequiredAuth(): RequiredAuthContextValue {
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
export function AuthProvider(
  props: React.PropsWithChildren<AuthProviderProps>,
) {
  const {
    children,
    am,
    onUnauthenticated,
    onProfileChange,
    onRefresh,
    onSessionChange,
  } = props;
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const unsubs: Array<() => void> = [];

    unsubs.push(
      am.on('sessionChange', (session) => {
        const syncSessionState = async () => {
          if (onSessionChange) {
            await Promise.resolve(onSessionChange(session));
          }
          setSession(session);
        };

        syncSessionState().catch((error) => {
          console.error('Failed to apply session change', error);
          setSession(session);
        });
      }),
    );

    unsubs.push(
      am.on('unauthenticated', (e) => {
        // Clear the session to prevent further refresh attempts, but do NOT
        // update React state. The page continues to render during navigation,
        // and clearing the session from React would cause components to crash.
        am.session?.clear();
        if (onUnauthenticated) {
          onUnauthenticated(e);
        }
      }),
    );

    if (onProfileChange) {
      unsubs.push(am.on('profileChange', onProfileChange));
    }
    if (onRefresh) {
      unsubs.push(am.on('refresh', onRefresh));
    }

    (async () => {
      const currentSession = am.restoreSession() ?? am.session;
      if (currentSession?.isExpired()) {
        try {
          await currentSession.refresh();
          setSession(currentSession);
        } catch {
          currentSession.clear();
        }
      } else {
        // Sync non-expired initial session
        setSession(currentSession);
      }
      setIsReady(true);
    })().catch(console.error);

    return () => unsubs.forEach((u) => u());
  }, [am, onProfileChange, onRefresh, onUnauthenticated, onSessionChange]);

  const value = useMemo<AuthContextValue>(
    () => ({ auth: am, session, isReady }),
    [am, session, isReady],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
