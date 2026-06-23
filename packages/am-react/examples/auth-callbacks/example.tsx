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
  console.log('Auth lost', error.status, error.title);
  window.location.assign('/sign-in');
}

export function App() {
  return (
    <AuthProvider
      am={am}
      onTokensUpdated={(tokens) => {
        console.log('Tokens updated', tokens.expiresAt);
      }}
      onProfileUpdated={(profile) => {
        console.log('Profile updated', profile.lastUpdatedAt);
      }}
      onSignedIn={(session) => {
        console.log('Signed in', session.profile.id);
      }}
      onAuthLost={redirectToSignIn}
      onReloadRequired={() => {
        window.location.assign(window.location.href);
      }}
    >
      <SessionObserver />
    </AuthProvider>
  );
}
