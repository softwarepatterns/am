# Authenticated API

Use this example after the user is already signed in and you need to work with
the active session.

## What this example demonstrates

- `session.fetch()` for authenticated API calls
- `session.refresh()` to rotate tokens explicitly
- `session.refetchProfile()` to refresh user/account state
- `session.sendVerificationEmail()` for email verification flows

## Inputs you must provide

- a persisted or otherwise active session
- the protected API URL you want to call

## What happens next

If no session exists, the example fails fast. If a session exists, the SDK
handles token freshness and returns authenticated results.

## Files

- `example.ts`: common authenticated-session operations
