import { Am } from '@softwarepatterns/am';

const am = new Am({ storage: 'localStorage' });

export function restorePersistedSession() {
  return am.restoreSession();
}

export function createSessionFromServerAuthentication() {
  return am.createSession({
    tokens: {
      accessToken: 'access_token',
      refreshToken: 'refresh_token',
      tokenType: 'Bearer',
      expiresIn: 3600,
      expiresAt: Date.now() + 3_600_000,
    },
    profile: {
      id: 'uid_123',
      applicationId: 'app_123',
      status: 'active',
      preferredMembershipId: null,
      identity: null,
      credentials: [],
      memberships: [],
      activeMembership: null,
      lastUpdatedAt: Date.now(),
    },
  });
}

export function subscribeToAuthEvents() {
  const stopSessionChange = am.on('sessionChange', (session) => {
    console.log('sessionChange', session?.profile.id ?? null);
  });

  const stopUnauthenticated = am.on('unauthenticated', (error) => {
    console.log('unauthenticated', error.status, error.title);
  });

  const stopProfileChange = am.on('profileChange', (profile) => {
    console.log('profileChange', profile.lastUpdatedAt);
  });

  const stopRefresh = am.on('refresh', (tokens) => {
    console.log('refresh', tokens.expiresAt);
  });

  return () => {
    stopSessionChange();
    stopUnauthenticated();
    stopProfileChange();
    stopRefresh();
  };
}
