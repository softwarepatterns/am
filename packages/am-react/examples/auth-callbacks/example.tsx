import { Am, AuthError } from '@softwarepatterns/am';
import { AuthProvider, useAuth } from '@softwarepatterns/am-react';

const am = new Am({ storage: 'localStorage' });

function SessionObserver() {
  const { isReady, session } = useAuth();

  if (!isReady) {
    return null;
  }

  return <pre>{JSON.stringify({ userId: session?.profile.id ?? null }, null, 2)}</pre>;
}

function redirectToSignIn(error: AuthError) {
  console.log('Unauthenticated', error.status, error.title);
  window.location.assign('/sign-in');
}

export function App() {
  return (
    <AuthProvider
      am={am}
      onRefresh={(tokens) => {
        console.log('Token refresh', tokens.expiresAt);
      }}
      onProfileChange={(profile) => {
        console.log('Profile changed', profile.lastUpdatedAt);
      }}
      onSessionChange={(session) => {
        console.log('Session changed', session?.profile.id ?? null);
      }}
      onUnauthenticated={redirectToSignIn}
    >
      <SessionObserver />
    </AuthProvider>
  );
}
