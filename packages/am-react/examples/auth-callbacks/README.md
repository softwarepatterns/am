# Auth Callbacks

Use this example when your app needs to react to auth lifecycle events without
putting those side effects inside regular rendering logic.

## What this example demonstrates

- `onRefresh` for token refresh side effects
- `onProfileChange` for refreshed user/account data
- `onSessionChange` for session replacement or sign-out transitions
- `onUnauthenticated` for redirecting to sign-in

## When to use it

Use these callbacks when application behavior needs to happen at the auth
boundary: redirecting, logging, syncing external stores, or updating app-shell
state.

## Files

- `example.tsx`: provider callback wiring
