# AccountMaker SDK Monorepo

Public SDK packages for AccountMaker authentication.

## Packages

* `packages/am`: `@softwarepatterns/am`, the core TypeScript auth SDK.
* `packages/am-react`: `@softwarepatterns/am-react`, headless React auth adapter for `@softwarepatterns/am`.
* `packages/am-astro`: planned Astro integration for `@softwarepatterns/am`.

## Development

Install dependencies from the repository root:

```bash
bun install
```

Run workspace checks from the repository root:

```bash
bun run build
bun run test
bun run typecheck
bun run lint
```

Package-specific docs live in each package directory.
