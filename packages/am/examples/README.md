# `@softwarepatterns/am` Examples

Each subdirectory is a self-contained example for one use-case. Every example
has its own `README.md` and local source file.

## How to read these examples

Each example is organized around one business use-case, not one SDK method.
Open the folder that matches the flow you are implementing.

## Example folders

- `password-sign-in/`: sign in or sign up with email and password
- `magic-link/`: request a one-time sign-in email, then exchange its token
- `invite/`: accept an invited-user email link
- `email-discovery/`: decide which login UI to show before the user submits credentials
- `password-reset/`: request a reset email and complete the reset from the email link
- `session-persistence/`: restore an existing session, create one from server state, and subscribe to auth events
- `authenticated-api/`: use an authenticated session to call APIs and refresh profile/tokens
- `switch-accounts/`: move an existing session into another account membership
- `custom-runtime/`: run the SDK with custom storage and custom fetch
