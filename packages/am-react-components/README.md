# `@softwarepatterns/am-react-components`

Unstyled React auth input components for **AccountMaker (Am)**.

This package provides small input primitives for auth pages. The components use
the native input API, apply auth-friendly browser defaults, and still allow
callers to override those defaults when needed.

Examples live in [`examples/`](./examples).

## Install

```bash
bun add @softwarepatterns/am-react-components react
```

## Exports

- `AuthInput`
- `UsernameAuthInput`
- `EmailAuthInput`
- `PasswordAuthInput`

## Usage

```tsx
import {
  EmailAuthInput,
  PasswordAuthInput,
} from '@softwarepatterns/am-react-components';

function SignInForm() {
  return (
    <form>
      <EmailAuthInput
        name="email"
        autoFocus
        placeholder="name@example.com"
      />

      <PasswordAuthInput
        name="password"
        passwordMode="current"
      />
    </form>
  );
}
```

## Defaults

`AuthInput` defaults `type` to `text`.

`UsernameAuthInput` defaults:

- `type="text"`
- `autoComplete="username"`
- `autoCapitalize="none"`
- `autoCorrect="off"`
- `spellCheck={false}`

`EmailAuthInput` defaults:

- `type="email"`
- `inputMode="email"`
- `autoComplete="email"`
- `autoCapitalize="none"`
- `autoCorrect="off"`
- `spellCheck={false}`

`PasswordAuthInput` defaults:

- `type="password"`
- `passwordMode="current"`
- `autoComplete="current-password"` for `passwordMode="current"`
- `autoComplete="new-password"` for `passwordMode="new"`
- `autoCapitalize="none"`
- `autoCorrect="off"`
- `spellCheck={false}`

Caller props are applied last, so explicit overrides win:

```tsx
<EmailAuthInput autoComplete="username" type="text" />
```

## License

MIT
