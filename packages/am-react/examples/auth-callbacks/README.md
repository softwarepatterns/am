# Auth Callbacks

Use this example when your app needs to react to auth lifecycle events without
putting those side effects inside regular rendering logic.

## What this example demonstrates

- `onTokensUpdated` for token refresh side effects
- `onProfileUpdated` for refreshed user/account data
- `onSignedIn` for post-login side effects
- `onAuthLost` for recoverable auth-loss handling
- `onReloadRequired` for hard-navigation transitions

## When to use it

Use these callbacks when application behavior needs to happen at the auth
boundary: redirecting, logging, syncing external stores, reloading after
terminal session transitions, or updating app-shell state.

`onAuthLost` stays inside the current runtime. `onReloadRequired` should
perform a hard navigation.

## Files

- `example.tsx`: provider callback wiring
