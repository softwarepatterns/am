# Password Sign-In

Use this example when your application has a standard email/password form.
It covers both the existing-user sign-in path and the new-user sign-up path.

## What this example demonstrates

- `signIn()` with `clientId`, `email`, and `password`
- `signUp()` with the same inputs for new-user registration
- the return value in both cases is an authenticated `AuthSession`

## Inputs you must provide

- a valid `clientId`
- the user email address
- the password from your form

## What happens next

On success, you receive an `AuthSession`. That session is what you use for
authenticated API calls, profile refreshes, and persisted login state.

## Files

- `example.ts`: minimal email/password sign-in and sign-up calls
