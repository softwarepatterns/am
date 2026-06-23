# Email Discovery

Use this example before rendering the final sign-in UI when your application
needs to decide whether to show password, magic-link, or other login choices.

## What this example demonstrates

- `checkEmail()` to learn how a specific email should authenticate
- `loginMethods()` to load the client-level enabled login methods
- `csrfSession()` and `csrfToken()` to prepare unauthenticated POST requests

## Inputs you must provide

- a valid `clientId`
- the email address the user entered

## What happens next

Use the results to choose which form or button set to render. If your next step
is a POST that requires CSRF protection, fetch the CSRF token first.

## Files

- `example.ts`: login-method discovery and CSRF preparation
