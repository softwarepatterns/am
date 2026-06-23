# Required Auth Route

Use this example for protected routes or authenticated panels where downstream
components should be allowed to assume a session exists.

## What this example demonstrates

- gate on `useAuth()` first
- render loading while auth startup is incomplete
- render sign-in UI when there is no session
- call `useRequiredAuth()` only inside the authenticated branch

## Why the extra gate matters

`useRequiredAuth()` is intentionally strict and throws when no session exists.
That is useful for authenticated branches, but it means the parent route must
prove the session exists before rendering children that use it.

## Files

- `example.tsx`: protected-route pattern using both hooks
