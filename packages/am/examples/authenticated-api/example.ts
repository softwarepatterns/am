import { Am } from '@softwarepatterns/am';

const am = new Am({ storage: 'localStorage' });

function requireSession() {
  const session = am.restoreSession();
  if (!session) {
    throw new Error('Expected a persisted session');
  }

  return session;
}

export async function callProtectedApi() {
  const session = requireSession();
  const response = await session.fetch('https://app.example.com/api/me');
  return response.json();
}

export async function refreshAndRefetchProfile() {
  const session = requireSession();

  await session.refresh();
  await session.refetchProfile();

  return session.profile;
}

export async function sendVerificationEmail() {
  const session = requireSession();
  await session.sendVerificationEmail();
}
