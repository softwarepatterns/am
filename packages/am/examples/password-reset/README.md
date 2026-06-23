# Password Reset

Use this example when your application offers a “forgot password” flow.
It covers both the request step and the final password change from the email
link.

## What this example demonstrates

- `sendPasswordReset()` to email the reset link
- `resetPassword()` to complete the reset with the one-time token

## Inputs you must provide

- a valid `clientId` for the request step
- the email address to reset
- the reset token from the callback URL
- the new password chosen by the user

## What happens next

After `resetPassword()` succeeds, the password is changed. Your app should then
send the user back through a normal sign-in flow.

## Files

- `example.ts`: request and completion steps for password reset
