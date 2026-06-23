import type { AuthSession } from '@softwarepatterns/am';

type SessionProfileMembershipsLike = {
  accountId?: string | null;
  memberships?: SessionMembershipLike[] | null;
  activeMembership?: {
    id?: string | null;
    accountId?: string | null;
    account_id?: string | null;
    role?: string | null;
    account?: {
      name?: string | null;
    } | null;
  } | null;
};

type SessionProfileLike = SessionProfileMembershipsLike & {
  id: string;
};

type SessionMembershipLike = {
  id?: string | null;
  accountId?: string | null;
  account_id?: string | null;
  role?: string | null;
  account?: {
    name?: string | null;
  } | null;
};

type SessionMembershipRole = 'member' | 'owner' | 'viewer';

export type AuthIdentity = {
  accountId: string | null;
  membershipId: string | null;
  userId: string;
};

function readProfileSafe(
  session: AuthSession | null,
): SessionProfileLike | null {
  return session?.profile ?? null;
}

function readOptionalIdSafe(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  return value;
}

function readMembershipAccountIdSafe(
  membership: SessionMembershipLike | null | undefined,
): string | null {
  if (!membership) {
    return null;
  }

  return (
    readOptionalIdSafe(membership.accountId) ??
    readOptionalIdSafe(membership.account_id)
  );
}

function readMembershipRoleSafe(
  membership: SessionMembershipLike | null | undefined,
): SessionMembershipRole | null {
  if (!membership) {
    return null;
  }

  const role = readOptionalIdSafe(membership.role);
  if (role === 'owner' || role === 'member' || role === 'viewer') {
    return role;
  }

  return null;
}

function readMembershipAccountNameSafe(
  membership: SessionMembershipLike | null | undefined,
): string | null {
  if (!membership) {
    return null;
  }

  return readOptionalIdSafe(membership.account?.name);
}

export function readProfileActiveAccountIdSafe(
  profile: SessionProfileMembershipsLike | null | undefined,
): string | null {
  if (!profile) {
    return null;
  }

  return readMembershipAccountIdSafe(profile.activeMembership);
}

export function readProfileMembershipByAccountIdSafe(
  profile: SessionProfileMembershipsLike | null | undefined,
  accountId: string | null | undefined,
): SessionMembershipLike | null {
  if (!profile || !accountId) {
    return null;
  }

  const memberships = profile.memberships ?? [];
  return (
    memberships.find(
      (membership) => readMembershipAccountIdSafe(membership) === accountId,
    ) ?? null
  );
}

export function readProfileActiveMembershipSafe(
  profile: SessionProfileMembershipsLike | null | undefined,
): SessionMembershipLike | null {
  if (!profile?.activeMembership) {
    return null;
  }

  const activeAccountId = readProfileActiveAccountIdSafe(profile);
  const matchingMembership = readProfileMembershipByAccountIdSafe(
    profile,
    activeAccountId,
  );

  if (!matchingMembership) {
    return profile.activeMembership;
  }

  return {
    ...matchingMembership,
    ...profile.activeMembership,
    account:
      matchingMembership.account ?? profile.activeMembership.account ?? null,
  };
}

export function readProfileMembershipRoleSafe(
  profile: SessionProfileMembershipsLike | null | undefined,
  accountId: string | null | undefined,
): SessionMembershipRole | null {
  return readMembershipRoleSafe(
    readProfileMembershipByAccountIdSafe(profile, accountId),
  );
}

export function readProfileMembershipAccountNameSafe(
  profile: SessionProfileMembershipsLike | null | undefined,
  accountId: string | null | undefined,
): string | null {
  return readMembershipAccountNameSafe(
    readProfileMembershipByAccountIdSafe(profile, accountId),
  );
}

export function readProfileActiveMembershipRoleSafe(
  profile: SessionProfileMembershipsLike | null | undefined,
): SessionMembershipRole | null {
  return readMembershipRoleSafe(readProfileActiveMembershipSafe(profile));
}

export function readProfileActiveMembershipAccountNameSafe(
  profile: SessionProfileMembershipsLike | null | undefined,
): string | null {
  return readMembershipAccountNameSafe(readProfileActiveMembershipSafe(profile));
}

export function authIdentityFromProfile(
  profile: SessionProfileLike,
): AuthIdentity {
  return {
    accountId: readProfileActiveAccountIdSafe(profile),
    membershipId: readOptionalIdSafe(profile.activeMembership?.id),
    userId: profile.id,
  };
}

export function readAuthIdentitySafe(
  session: AuthSession | null,
): AuthIdentity | null {
  const profile = readProfileSafe(session);

  if (!profile) {
    return null;
  }

  return authIdentityFromProfile(profile);
}

export function authIdentityKey(identity: AuthIdentity): string {
  return [
    identity.userId,
    identity.membershipId ?? 'no-membership',
    identity.accountId ?? 'no-account',
  ].join('::');
}

export function readAuthIdentityKeySafe(
  session: AuthSession | null,
): string | null {
  const identity = readAuthIdentitySafe(session);

  if (!identity) {
    return null;
  }

  return authIdentityKey(identity);
}
