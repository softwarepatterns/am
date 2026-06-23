# Magic Link

Use this example when users sign in from an emailed one-time link instead of a
password form.

## What this example demonstrates

- `sendMagicLink()` to start the flow
- `signInWithToken()` to exchange the emailed token for an `AuthSession`

## Inputs you must provide

- a valid `clientId`
- the destination email address
- the one-time token extracted from the callback URL

## What happens next

After exchanging the token, you receive an authenticated `AuthSession`. That is
the point where your app should transition into authenticated UI.

## Files

- `example.ts`: request and token-exchange steps for the magic-link flow
