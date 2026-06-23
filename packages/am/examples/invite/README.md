# Invite Acceptance

Use this example when a user lands from an invitation email and your app needs
to convert the invite token into a signed-in session.

## What this example demonstrates

- `acceptInvite()` with `clientId` and the invite token

## Inputs you must provide

- a valid `clientId`
- the invite token from the email link

## What happens next

On success, the user becomes authenticated and you receive an `AuthSession`.
Your app can then redirect them into the invited account or onboarding flow.

## Files

- `example.ts`: invite-token exchange
