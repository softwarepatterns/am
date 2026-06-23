import { AuthSession, type Authentication, type SessionProfile } from '@softwarepatterns/am';
import { describe, expect, it } from 'vitest';
import {
  authIdentityKey,
  readAuthIdentityKeySafe,
  readAuthIdentitySafe,
  readProfileActiveMembershipAccountNameSafe,
  readProfileActiveMembershipRoleSafe,
  readProfileActiveMembershipSafe,
  readProfileMembershipByAccountIdSafe,
} from './auth-identity.js';

function sessionProfile(
  overrides: Partial<SessionProfile> = {},
): SessionProfile {
  return {
    id: 'uid_test',
    applicationId: 'app_test',
    status: 'active',
    preferredMembershipId: null,
    identity: null,
    credentials: [],
    memberships: [],
    activeMembership: null,
    lastUpdatedAt: 1,
    ...overrides,
  };
}

function authSession(profile: SessionProfile): AuthSession {
  const authentication: Authentication = {
    tokens: {
      accessToken: 'access',
      refreshToken: 'refresh',
      tokenType: 'Bearer',
      expiresIn: 3600,
      expiresAt: Date.now() + 3600_000,
    },
    profile,
  };

  return new AuthSession(authentication, { storage: null });
}

describe('auth-identity', () => {
  it('derives the user and active account from session profile data', () => {
    const session = authSession(
      sessionProfile({
        id: 'uid_123',
        activeMembership: {
          id: 'mbr_123',
          userId: 'uid_123',
          accountId: 'acc_active',
          role: 'owner',
          account: {
            id: 'acc_active',
            parentId: 'app_test',
            name: 'Active Account',
            avatarUrl: null,
            status: 'active',
            paidUntil: null,
          },
        },
      }),
    );

    expect(readAuthIdentitySafe(session)).toEqual({
      accountId: 'acc_active',
      membershipId: 'mbr_123',
      userId: 'uid_123',
    });
    expect(readAuthIdentityKeySafe(session)).toBe(
      'uid_123::mbr_123::acc_active',
    );
    expect(
      authIdentityKey({
        accountId: 'acc_active',
        membershipId: 'mbr_123',
        userId: 'uid_123',
      }),
    ).toBe('uid_123::mbr_123::acc_active');
  });

  it('returns no active account when no active membership exists', () => {
    const session = authSession(sessionProfile({ id: 'uid_123' }));

    expect(readAuthIdentityKeySafe(session)).toBe(
      'uid_123::no-membership::no-account',
    );
  });

  it('returns null without an authenticated profile', () => {
    expect(readAuthIdentitySafe(null)).toBeNull();
    expect(readAuthIdentityKeySafe(null)).toBeNull();
  });

  it('finds memberships by account id across camelCase and snake_case fields', () => {
    const profile = {
      memberships: [
        {
          account_id: 'acc_snake',
          role: 'viewer',
        },
        {
          accountId: 'acc_camel',
          role: 'owner',
          account: { name: 'Camel Corp' },
        },
      ],
    };

    expect(
      readProfileMembershipByAccountIdSafe(profile, 'acc_snake'),
    )?.toMatchObject({
      account_id: 'acc_snake',
      role: 'viewer',
    });
    expect(
      readProfileMembershipByAccountIdSafe(profile, 'acc_camel'),
    )?.toMatchObject({
      accountId: 'acc_camel',
      role: 'owner',
    });
  });

  it('merges active membership identity with the matching membership record', () => {
    const profile = {
      activeMembership: {
        id: 'mbr_active',
        accountId: 'acc_1',
        role: 'member',
      },
      memberships: [
        {
          id: 'mbr_list',
          accountId: 'acc_1',
          role: 'owner',
          account: { name: 'Acme Inc' },
        },
      ],
    };

    expect(readProfileActiveMembershipSafe(profile)).toEqual({
      id: 'mbr_active',
      accountId: 'acc_1',
      role: 'member',
      account: { name: 'Acme Inc' },
    });
    expect(readProfileActiveMembershipRoleSafe(profile)).toBe('member');
    expect(readProfileActiveMembershipAccountNameSafe(profile)).toBe(
      'Acme Inc',
    );
  });
});
