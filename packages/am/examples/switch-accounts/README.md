# Switch Accounts

Use this example when one user belongs to multiple accounts and your app lets
them change the active account without reauthenticating.

## What this example demonstrates

- `session.switchAccounts()` with the target `accountId`

## Inputs you must provide

- an existing authenticated session
- the target `accountId` to activate

## What happens next

After the switch completes, the session tokens and profile are updated in place
to reflect the new active membership.

## Files

- `example.ts`: account-switch flow for an existing session
