# Session Persistence

Use this example when you need to resume a browser session after reload, or
when your backend already completed authentication and hands the frontend an
authentication payload.

## What this example demonstrates

- `restoreSession()` for client-side persistence
- `createSession()` for server-provided tokens/profile
- `on()` for `sessionChange`, `unauthenticated`, `profileChange`, and `refresh`

## Inputs you must provide

- browser storage or a storage implementation
- if using `createSession()`, a full `{ tokens, profile }` authentication object

## What happens next

After restore or creation, the returned `AuthSession` becomes the active session
on the `Am` instance. Event subscriptions let the rest of your app react to
auth changes.

## Files

- `example.ts`: persistence restore, server-driven session creation, and subscriptions
