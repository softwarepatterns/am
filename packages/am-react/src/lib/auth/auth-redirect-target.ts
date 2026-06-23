function getSessionStorageSafe(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

const PENDING_AUTH_REDIRECT_PATH_KEY = 'pending-auth-redirect-path';
declare const AUTH_REDIRECT_PATH: unique symbol;

export type AuthRedirectPath = string & {
  readonly [AUTH_REDIRECT_PATH]: true;
};

export function isSafeAuthRedirectPath(path: string): boolean {
  return path.startsWith('/') && !path.startsWith('//');
}

export function toAuthRedirectPathSafe(path: string): AuthRedirectPath | null {
  if (!isSafeAuthRedirectPath(path)) {
    return null;
  }

  return path as AuthRedirectPath;
}

export function readPendingAuthRedirectPathSafe(): AuthRedirectPath | null {
  const storage = getSessionStorageSafe();
  const path = storage?.getItem(PENDING_AUTH_REDIRECT_PATH_KEY) ?? null;
  const redirectPath = path ? toAuthRedirectPathSafe(path) : null;

  if (!redirectPath) {
    storage?.removeItem(PENDING_AUTH_REDIRECT_PATH_KEY);
    return null;
  }

  return redirectPath;
}

export function writePendingAuthRedirectPath(path: AuthRedirectPath): void {
  const storage = getSessionStorageSafe();
  storage?.setItem(PENDING_AUTH_REDIRECT_PATH_KEY, path);
}

export function clearPendingAuthRedirectPath(): void {
  const storage = getSessionStorageSafe();
  storage?.removeItem(PENDING_AUTH_REDIRECT_PATH_KEY);
}

export function consumePendingAuthRedirectPathSafe(): AuthRedirectPath | null {
  const path = readPendingAuthRedirectPathSafe();

  if (path) {
    clearPendingAuthRedirectPath();
  }

  return path;
}
