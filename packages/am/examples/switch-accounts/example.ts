import { Am } from '@softwarepatterns/am';

const am = new Am({ storage: 'localStorage' });

export async function switchAccounts() {
  const session = am.restoreSession();
  if (!session) {
    throw new Error('Expected a persisted session');
  }

  await session.switchAccounts({
    accountId: 'acc_123',
  });

  return session.profile.activeMembership;
}
