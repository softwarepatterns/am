# `@softwarepatterns/am-react`

Headless React auth adapter for **AccountMaker (Am)**.

This package exposes the React provider and hook for an `Am` instance and its
current session.

Examples live in [`examples/`](./examples).

## Install

```bash
bun add @softwarepatterns/am @softwarepatterns/am-react react
```

## Usage

```tsx
import { Am } from '@softwarepatterns/am';
import { AuthProvider, useAuth } from '@softwarepatterns/am-react';

const am = new Am({ storage: 'localStorage' });

function SessionStatus() {
  const { isReady, session } = useAuth();

  if (!isReady) return null;
  return session ? <span>Signed in</span> : <span>Signed out</span>;
}

export function App() {
  return (
    <AuthProvider am={am}>
      <SessionStatus />
    </AuthProvider>
  );
}
```

## Callback props

`AuthProvider` exposes auth lifecycle callbacks that mirror the core `am`
events:

- `onSignedIn`
- `onTokensUpdated`
- `onProfileUpdated`
- `onAuthLost`
- `onReloadRequired`

`onAuthLost` is for recoverable client-side auth loss. `onReloadRequired` is
the terminal transition that should end in a hard navigation.

## Exports

- `AuthProvider`
- `useAuth()`
- `useRequiredAuth()`
- `AuthContextValue`
- `AuthProviderProps`
