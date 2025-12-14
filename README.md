# `@softwarepatterns/am`

Authentication client SDK for **AccountMaker (Am)**.

This package provides a small, stable client for interacting with the AccountMaker authentication API. It is designed for **Node.js applications** and **modern bundlers**, with explicit support for both **ESM** and **CommonJS** consumers.

The SDK focuses on correctness, predictable behavior, and minimal surface area.

---

## Features

* ESM and CommonJS support
* TypeScript-first API with bundled `.d.ts`
* Explicit error modeling using Problem Details
* Token-based authenticated sessions
* Automatic access-token refresh
* No runtime dependencies
* No side effects on import

---

## Requirements

* **Node.js ≥ 18**
* A runtime with a global `fetch` implementation
  (Node 18+, Bun, Deno, or a custom `fetchFn`)

---

## Installation

```bash
npm install @softwarepatterns/am
```

---

## Importing

### ESM

```ts
import { Am } from "@softwarepatterns/am";
```

### CommonJS

```js
const { Am } = require("@softwarepatterns/am");
```

---

## Basic usage

### Create a client

```ts
import { Am } from "@softwarepatterns/am";

const am = new Am({
  baseUrl: "https://api.accountmaker.com"
});
```

If no configuration is provided, the client defaults to:

* `baseUrl: https://api.accountmaker.com`
* `fetchFn: globalThis.fetch`

---

## Authentication flows

### Login with email and password

```ts
const result = await am.login({
  email: "user@example.com",
  password: "password"
});
```

The result contains both session tokens and the authenticated profile.

```ts
result.session;
result.profile;
```

---

### Create an authenticated session

```ts
const session = am.createAuthSession(result.session);
```

An `AuthSession` represents an authenticated user and handles token refresh automatically.

---

### Fetch the current user

```ts
const me = await session.me();
```

---

### Refresh tokens explicitly

```ts
await session.refresh();
```

---

## Error handling

All API errors are surfaced as `AuthError`.

```ts
import { AuthError } from "@softwarepatterns/am";

try {
  await am.login({ email, password });
} catch (err) {
  if (err instanceof AuthError) {
    console.log(err.status);
    console.log(err.title);
    console.log(err.detail);
  }
}
```

Errors follow the **Problem Details** format (`application/problem+json`).

Unknown or unsupported error responses are converted into a generic problem shape without exposing raw response bodies.

---

## Custom fetch implementation

If the runtime does not provide a global `fetch`, supply one explicitly.

```ts
const am = new Am({
  fetchFn: fetch,
  baseUrl: "https://api.accountmaker.com"
});
```

This is useful for:

* Older Node versions
* Instrumented HTTP clients
* Testing

---

## TypeScript support

This package ships with bundled type definitions.

```ts
import type { AuthenticationResult } from "@softwarepatterns/am";
```

The public API is fully typed. Internal implementation details are not exposed.

---

## Browser support

This SDK does **not currently claim browser runtime support**.

However:

* The package is free of Node-only runtime APIs
* It can be bundled by modern tools (Vite, Rollup, Webpack)

Browser runtime support may be added in a future release, along with explicit guarantees and tests.

---

## Stability guarantees

The following are guaranteed:

* Stable ESM and CommonJS entry points
* Stable TypeScript types for exported symbols
* Compatibility with Node 18, 20, and 22
* Deterministic build and publish artifacts

The following are **not** guaranteed yet:

* Browser runtime behavior
* Backward compatibility prior to `1.0.0`

---

## Versioning

This package follows semantic versioning.

* `0.x` releases may introduce breaking changes
* `1.0.0` will mark a frozen public API

---

## License

MIT
