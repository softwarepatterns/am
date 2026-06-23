import type { AccountId, AuthSession } from '@softwarepatterns/am';
import type { AuthRedirectPath } from './auth-redirect-target.js';
import {
  clearPendingAuthRedirectPath,
  writePendingAuthRedirectPath,
} from './auth-redirect-target.js';

export type SwitchAccountsSession = Pick<AuthSession, 'switchAccounts'>;

type SwitchAccountsParams = {
  session: SwitchAccountsSession;
  accountId: AccountId;
  csrfToken?: string;
  redirectPath?: AuthRedirectPath | null;
};

export async function switchAccounts(
  params: SwitchAccountsParams,
): Promise<void> {
  const { accountId, csrfToken, redirectPath, session } = params;

  if (redirectPath) {
    writePendingAuthRedirectPath(redirectPath);
  }

  try {
    await session.switchAccounts({
      accountId,
      csrfToken,
    });
  } catch (error) {
    if (redirectPath) {
      clearPendingAuthRedirectPath();
    }

    throw error;
  }
}
