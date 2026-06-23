# `@softwarepatterns/am-react` Examples

Each subdirectory is a self-contained React example for one use-case. Every
example has its own `README.md` and local source file.

## How to read these examples

Each example is centered on a React integration pattern that a real app needs.
Open the folder that matches the rendering or routing problem you are solving.

## Example folders

- `basic-provider/`: mount auth state at the app root and render signed-in vs signed-out UI
- `required-auth-route/`: protect a route and only call `useRequiredAuth()` after session gating
- `auth-callbacks/`: attach app-level side effects for refresh, profile updates, session changes, and unauthenticated redirects
