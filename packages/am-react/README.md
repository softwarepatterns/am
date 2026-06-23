# @softwarepatterns/am-react

React bindings and auth UI helpers for `@softwarepatterns/am`.

## Install

```bash
bun add @softwarepatterns/am @softwarepatterns/am-react react
```

## Usage

```tsx
import { Am } from "@softwarepatterns/am";
import { AuthProvider, useAuth } from "@softwarepatterns/am-react";

const am = new Am({ storage: "localStorage" });

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

The package exports:

* `AuthProvider`, `useAuth`, and `useRequiredAuth`
* `SignInBlock` and `SignUpBlock`
* email/password input components and label types
* auth identity, redirect, and account-switching helpers
