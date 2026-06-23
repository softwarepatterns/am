import type { QueryClient } from '@tanstack/react-query';
import { consumePendingAuthRedirectPathSafe } from './auth-redirect-target.js';

function clearQueryClientBeforeHardAuthNavigation(
  queryClient: QueryClient,
): void {
  // This intentionally clears the entire QueryClient, not just authenticated
  // queries. These helpers are used only when we are about to hard navigate or
  // reload due to auth drift; once that happens, we do not trust any in-memory
  // app state from the old session.
  queryClient.clear();
}

export function reloadForAuthChange(queryClient: QueryClient): void {
  clearQueryClientBeforeHardAuthNavigation(queryClient);
  const pendingRedirectPath = consumePendingAuthRedirectPathSafe();

  if (pendingRedirectPath) {
    window.location.replace(pendingRedirectPath);
    return;
  }

  window.location.reload();
}

export function redirectForUnauthenticated(params: {
  queryClient: QueryClient;
  url: string;
}): void {
  const { queryClient, url } = params;
  clearQueryClientBeforeHardAuthNavigation(queryClient);
  window.location.replace(url);
}
