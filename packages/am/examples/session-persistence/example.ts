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
  const stopSignedIn = am.on('signedIn', (session) => {
    console.log('signedIn', session.profile.id);
  });

  const stopAuthLost = am.on('authLost', (error) => {
    console.log('authLost', error.status, error.title);
  });

  const stopProfileUpdated = am.on('profileUpdated', (profile) => {
    console.log('profileUpdated', profile.lastUpdatedAt);
  });

  const stopTokensUpdated = am.on('tokensUpdated', (tokens) => {
    console.log('tokensUpdated', tokens.expiresAt);
  });

  const stopReloadRequired = am.on('reloadRequired', () => {
    console.log('reloadRequired');
  });

  return () => {
    stopSignedIn();
    stopAuthLost();
    stopProfileUpdated();
    stopTokensUpdated();
    stopReloadRequired();
  };
}
