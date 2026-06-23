import { Am } from '@softwarepatterns/am';
import { AuthProvider, useAuth } from '@softwarepatterns/am-react';

const am = new Am({ storage: 'localStorage' });

function SessionStatus() {
  const { isReady, session } = useAuth();

  if (!isReady) {
    return <span>Loading...</span>;
  }

  return session ? <span>Signed in</span> : <span>Signed out</span>;
}

export function App() {
  return (
    <AuthProvider am={am}>
      <SessionStatus />
    </AuthProvider>
  );
}
