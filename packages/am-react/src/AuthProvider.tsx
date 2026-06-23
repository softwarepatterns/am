/**
 * Provides the headless React auth context for an `Am` instance.
 *
 * This file owns the provider and hooks that expose the current session to a
 * React tree. It also owns the translation from `am` auth events into React
 * state and callback props.
 *
 * Local invariants:
 * - sessions are obtained from `Am`, never constructed here
 * - `signedIn` is the only event that replaces React session state
 * - `authLost` and `reloadRequired` are forwarded without clearing React state
 * - startup restores or refreshes the current session before marking ready
 */
import React, {
  useMemo,
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react';
import {
  Am,
  AuthError,
  type AuthSession,
} from '@softwarepatterns/am'; // adjust import paths
import type { SessionProfile, SessionTokens } from '@softwarepatterns/am';

export type AuthProviderProps = {
  /**
   * `Am` instance whose session state drives this provider.
   */
  am: Am;

  /**
   * Called when the current session rotates tokens.
   */
  onTokensUpdated?: (newTokens: SessionTokens) => void;

  /**
   * Called when the current session refreshes profile data.
   */
  onProfileUpdated?: (profile: SessionProfile) => void;

  /**
   * Called when auth is lost without requiring a reload.
   */
  onAuthLost?: (e: AuthError) => void;

  /**
   * Called after `Am` establishes the signed-in session.
   */
  onSignedIn?: (session: AuthSession) => void | Promise<void>;

  /**
   * Called when the current session can continue only after a hard reload.
   */
  onReloadRequired?: () => void;
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
    onAuthLost,
    onProfileUpdated,
    onTokensUpdated,
    onSignedIn,
    onReloadRequired,
  } = props;
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const unsubs: Array<() => void> = [];

    unsubs.push(
      am.on('signedIn', (session) => {
        const syncSessionState = async () => {
          if (onSignedIn) {
            await Promise.resolve(onSignedIn(session));
          }
          setSession(session);
        };

        syncSessionState().catch((error) => {
          console.error('Failed to apply signed-in state', error);
          setSession(session);
        });
      }),
    );

    if (onAuthLost) {
      // authLost is recoverable. Forward it to the app without changing the
      // current session state in React.
      unsubs.push(am.on('authLost', onAuthLost));
    }

    if (onProfileUpdated) {
      unsubs.push(am.on('profileUpdated', onProfileUpdated));
    }
    if (onTokensUpdated) {
      unsubs.push(am.on('tokensUpdated', onTokensUpdated));
    }
    if (onReloadRequired) {
      unsubs.push(
        am.on('reloadRequired', () => {
          // Keep the current session in React while the app performs a hard
          // navigation. Clearing it early can crash components during the
          // transition.
          onReloadRequired();
        }),
      );
    }

    (async () => {
      const currentSession = am.restoreSession() ?? am.session;
      if (currentSession?.isExpired()) {
        try {
          await currentSession.refresh();
          setSession(currentSession);
        } catch {
          setSession(null);
        }
      } else {
        // Sync non-expired initial session
        setSession(currentSession);
      }
      setIsReady(true);
    })().catch(console.error);

    return () => unsubs.forEach((u) => u());
  }, [am, onAuthLost, onProfileUpdated, onReloadRequired, onSignedIn, onTokensUpdated]);

  const value = useMemo<AuthContextValue>(
    () => ({ auth: am, session, isReady }),
    [am, session, isReady],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
