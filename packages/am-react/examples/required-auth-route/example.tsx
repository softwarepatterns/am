import { Am } from '@softwarepatterns/am';
import {
  AuthProvider,
  useAuth,
  useRequiredAuth,
} from '@softwarepatterns/am-react';

const am = new Am({ storage: 'localStorage' });

function AccountName() {
  const { session } = useRequiredAuth();

  return <span>{session.profile.identity?.displayName ?? session.profile.id}</span>;
}

function AccountRoute() {
  const { isReady, session } = useAuth();

  if (!isReady) {
    return null;
  }

  if (!session) {
    return <a href="/sign-in">Sign in</a>;
  }

  return <AccountName />;
}

export function App() {
  return (
    <AuthProvider am={am}>
      <AccountRoute />
    </AuthProvider>
  );
}
