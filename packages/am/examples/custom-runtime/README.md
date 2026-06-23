# Custom Runtime

Use this example when you are not in a standard browser environment or when you
need to control persistence and network behavior explicitly.

## What this example demonstrates

- a custom `storage` object implementing `getItem`, `setItem`, and `removeItem`
- a custom `fetchFn`
- constructing `Am` with those runtime dependencies injected

## Inputs you must provide

- your runtime-specific `fetchFn`
- your runtime-specific storage implementation

## What happens next

The resulting `Am` instance behaves like the standard SDK client, but uses your
runtime integrations instead of browser defaults.

## Files

- `example.ts`: custom runtime wiring for `Am`
