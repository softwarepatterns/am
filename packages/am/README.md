# `@softwarepatterns/am`

Authentication client SDK for **AccountMaker (Am)**.

This package provides a small, stable client for interacting with the AccountMaker authentication API. It is designed with explicit support for both ESM and CommonJS consumers.

---

## Features

* Automatic access-token refresh
* TypeScript-first API with bundled `.d.ts`
* Explicit error modeling via RFC 9457 Problem Details
* Automatic access-token refresh
* No runtime dependencies or side effects on import
* ESM and CommonJS support

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

const am = new Am();
```

Examples live in [`examples/`](./examples).

---

## Authentication flows

### Sign in with email and password

```ts
const session = await am.signIn({
  clientId: "your-client-id",
  email: "user@example.com",
  password: "password"
});
```

### Sign up (register) a new user with email and password

```ts
const session = await am.signUp({
  clientId: "your-client-id",
  email: "user@example.com",
  password: "password"
});
```

### Accept an invite from an email link

```ts
const session = await am.acceptInvite({
  clientId: "your-client-id",
  token: "token-from-email",
});
```

### Sign in with a token from an email link

```ts
const session = await am.signInWithToken({
  clientId: "your-client-id",
  token: "token-from-email",
});
```

## Usage

A session represents an authenticated user and handles token refresh automatically.

```ts
// Automatically adds Authorization header, will refresh tokens as needed, 
const res = await session.fetch("https://yourdomain.com/some/protected/resource");
```

You can also use the access token yourself.

```ts
if (session.isExpired()) {
  await session.refresh();
}
await fetch("https://yourdomain.com/your/own/protected/api", {
  headers: {
    Authorization: `Bearer ${session.accessToken()}`
  }
});
```

Your own services can validate the access token using AM's public keys.

```ts
import * as jose from 'jose';

// Will auto fetch, cache, and rotate keys as needed
const jwksUrl = new URL('https://auth.yourdomain.com/.well-known/jwks.json');

// if not using a custom auth domain:
// const jwksUrl = new URL('https://api.accountmaker.com/.well-known/jwks.json?client_id=your-client-id');

const JWKS = jose.createRemoteJWKSet(jwksUrl);

export const validateAccessToken = async (token: string) =>  {
  const { payload } = await jose.jwtVerify(token, JWKS);

  console.log('Account Id:', payload.acc);
  console.log('User Id:', payload.uid);
  console.log('User Account Role:', payload.role);
}

``` 

By default, tokens are saved in memory only.

```ts
const am = new Am({
  storage: null // disable storage, default is in-memory
});
```

Set to "localStorage" to persist sessions across reloads.

```ts
const am = new Am({
  storage: "localStorage"
});
const session = am.restoreSession();
```

Or implement your own storage mechanism by implementing the Storage interface.

---

## Error handling

All API errors throw as `AuthError`.

```ts
import { AuthError } from "@softwarepatterns/am";

try {
  await am.signIn({ email, password });
} catch (err) {
  if (err instanceof AuthError) {
    console.log(err.status);
    console.log(err.title);
    console.log(err.detail);
  }
}
```

Errors follow **RFC 9457 Problem Details** format (`application/problem+json`).

Unknown or unsupported error responses are converted into a generic problem shape without exposing raw response bodies. All non-HTTP errors (such as network or parsing errors) are left alone to bubble up.

---

## Custom fetch

For mocking or for custom fetch implementations, you can provide your own.

```ts
const am = new Am({
  fetchFn: fetch,
});
```

---

## Stability guarantees

The following are guaranteed:

* Stable ESM and CommonJS entry points
* Stable TypeScript types for exported symbols
* Compatibility with Node 18, 20, and 22

This package follows semantic versioning.

* `0.x` releases may introduce breaking changes
* `1.0.0` will mark a frozen public API

---

## Development and Testing

### Prerequisites

Integration tests require credentials stored in the repository root `.env`.
The encrypted version `.env.enc` is committed at the repository root.

### Decrypting credentials

```bash
# From the repository root
sops -d .env.enc > .env
```

### Running tests

```bash
# Unit tests
bun run --filter @softwarepatterns/am test:unit

# Integration tests (requires .env)
bun run --filter @softwarepatterns/am test:integration
```

The package integration script reads credentials from the repository root
`.env` file.

### Re-encrypting after changes

```bash
# From the repository root
sops -e .env > .env.enc
```

---

## License

MIT
