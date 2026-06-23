import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearPendingAuthRedirectPath,
  readPendingAuthRedirectPathSafe,
  toAuthRedirectPathSafe,
} from './auth-redirect-target.js';
import { switchAccounts } from './switch-accounts.js';

describe('switchAccounts', () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    const sessionStorage: Storage = {
      get length() {
        return values.size;
      },
      clear() {
        values.clear();
      },
      getItem(key) {
        return values.get(key) ?? null;
      },
      key(index) {
        return Array.from(values.keys())[index] ?? null;
      },
      removeItem(key) {
        values.delete(key);
      },
      setItem(key, value) {
        values.set(key, value);
      },
    };

    vi.stubGlobal('window', { sessionStorage });
    clearPendingAuthRedirectPath();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('persists the pending redirect path before switching accounts', async () => {
    const session = {
      switchAccounts: vi.fn().mockResolvedValue(undefined),
    };
    const redirectPath = toAuthRedirectPathSafe('/accounts/acc_test/console');

    expect(redirectPath).toBe('/accounts/acc_test/console');

    await switchAccounts({
      session,
      accountId: 'acc_test',
      redirectPath,
    });

    expect(session.switchAccounts).toHaveBeenCalledWith({
      accountId: 'acc_test',
      csrfToken: undefined,
    });
    expect(readPendingAuthRedirectPathSafe()).toBe(
      '/accounts/acc_test/console',
    );
  });

  it('clears the pending redirect path when account switching fails', async () => {
    const session = {
      switchAccounts: vi.fn().mockRejectedValue(new Error('switch failed')),
    };
    const redirectPath = toAuthRedirectPathSafe('/accounts/acc_test/console');

    expect(redirectPath).toBe('/accounts/acc_test/console');

    await expect(
      switchAccounts({
        session,
        accountId: 'acc_test',
        redirectPath,
      }),
    ).rejects.toThrow('switch failed');

    expect(readPendingAuthRedirectPathSafe()).toBeNull();
  });
});
