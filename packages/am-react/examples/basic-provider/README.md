# Basic Provider

Use this example for the app-root integration: create one `Am` instance, mount
`AuthProvider` once, and let child components read auth state with `useAuth()`.

## What this example demonstrates

- `AuthProvider` at the root
- `useAuth()` to read `isReady` and `session`
- a simple loading state before startup finishes
- signed-in vs signed-out rendering after startup

## When to use it

Use this as the baseline shape for any React app that wants auth state in the
component tree.

## Files

- `example.tsx`: minimal provider + consumer pattern
