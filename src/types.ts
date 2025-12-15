export type ProblemDetails = {
  type: string;
  title: string;
  status: number;
  code?: string;
  detail?: string;
  invalidParams?: {
    in: "body" | "cookie" | "header" | "query" | "path";
    path: string;
    type: string;
    received: unknown;
    expected?: string;
  }[];
};

export type ClientId = `cid${string}`;
export type UserId = `uid${string}`;
export type AccountId = `acc${string}`;
export type MembershipId = `mbr${string}`;

export type AccountStatus =
  | "active"
  | "trial"
  | "past_due"
  | "suspended"
  | "closed";

export type AccountResource = {
  id: AccountId;
  name: string | null;
  avatarUrl: string | null;
  status: AccountStatus;
  paidUntil: string | null;
};

export type UserStatus =
  | "active"
  | "trial"
  | "past_due"
  | "suspended"
  | "closed";

export type UserResource = {
  id: UserId;
  accountId: AccountId;
  status: UserStatus;
  preferredMembershipId: MembershipId | null;
};

export type UserIdentity = {
  id: UserId;
  avatarUrl: string | null;
  externalId: string | null;
  givenName: string | null;
  familyName: string | null;
  displayName: string | null;
  preferredLanguage: string | null;
  locale: string | null;
  timezone: string | null;
};

export type MembershipRole = "owner" | "member" | "viewer";

export type Membership = {
  id: MembershipId;
  userId: UserId;
  accountId: AccountId;
  role: MembershipRole;
};

export type EmailCredential = {
  id: string;
  email: string | null;
  hashedEmail: string | null;
  hashedPassword: string | null;
  emailVerifiedAt: string | null;
};

export type SessionTokens = {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  idToken?: string;
  expiresAt: number;
};

export type ResponseTokens = {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  idToken?: string;
};

export type SessionProfile = UserResource & {
  identity: UserIdentity;
  emailCredentials: EmailCredential[];
  memberships: Membership[];
  activeMembership: Membership | null;
};

export type AuthenticationResponse = {
  tokens: ResponseTokens;
  profile: SessionProfile;
};

export type AuthenticationResult = {
  tokens: SessionTokens;
  profile: SessionProfile;
};

export type EmailCheckStatus = "active" | "inactive";
export type LoginMethod = "email_password" | "magic_link";

export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};
