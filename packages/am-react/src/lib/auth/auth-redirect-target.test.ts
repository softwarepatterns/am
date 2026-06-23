import { describe, expect, it } from 'vitest';
import {
  isSafeAuthRedirectPath,
  toAuthRedirectPathSafe,
} from './auth-redirect-target.js';

describe('auth-redirect-target', () => {
  it('accepts absolute in-app paths', () => {
    expect(isSafeAuthRedirectPath('/accounts/acc_1/console')).toBe(true);
    expect(isSafeAuthRedirectPath('/switch-accounts?returnTo=%2Ffoo')).toBe(
      true,
    );
    expect(toAuthRedirectPathSafe('/accounts/acc_1/console')).toBe(
      '/accounts/acc_1/console',
    );
  });

  it('rejects external or ambiguous paths', () => {
    expect(isSafeAuthRedirectPath('https://example.com')).toBe(false);
    expect(isSafeAuthRedirectPath('//example.com')).toBe(false);
    expect(isSafeAuthRedirectPath('accounts/acc_1')).toBe(false);
    expect(toAuthRedirectPathSafe('//example.com')).toBeNull();
  });
});
