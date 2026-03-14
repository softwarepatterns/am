/**
 * Standard error object following RFC 7807 (Problem Details for HTTP APIs).
 *
 * Returned in AuthError.problem when the server responds with application/problem+json.
 *
 * - `type`: A URI reference that identifies the problem type. Often links to human-readable documentation.
 * - `title`: A short, human-readable summary of the problem type.
 * - `status`: The HTTP status code.
 * - `code`: Application-specific error code for programmatic handling. Maps to the final part of the error type.
 * - `detail`: Human-readable explanation specific to this occurrence. Do not rely on this for programmatic handling.
 * - `invalidParams`: Present on validation errors (typically 400). Provides field-level details
 *   for building precise UI feedback and can be used for programmatic handling. Each entry includes:
 *   - `in`: Location of the invalid parameter (body, cookie, header, query, path).
 *   - `path`: Dot-separated path to the invalid parameter.
 *   - `type`: Error type code for this parameter (e.g. "required", "email", "min_length").
 *   - `received`: The actual value received.
 *   - `expected`: (optional) Description of the expected value.
 *
 * @example
 * ```ts
 * catch (e) {
 *   if (e instanceof AuthError && e.invalidParams) {
 *     const errors = e.invalidParams.reduce((acc, p) => {
 *       acc[p.path] = p.type;
 *       return acc;
 *     }, {} as Record<string, string>);
 *     setFieldErrors(errors);
 *   }
 * }
 * ```
 */
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

/**
 * Opaque identifier for a client application.
 *
 * Used to look up client-specific settings on how authentication should be handled.
 *
 * All client-specific operations (invites, branding, rate limits) are scoped to a ClientId.
 */
export type ClientId = `cid${string}`;

/** Identifier for a user. */
export type UserId = `uid${string}`;
/** Identifier for an account (i.e., a billable entity). */
export type AccountId = `acc${string}`;
/** Identifier for a membership linking a user to an account. */
export type MembershipId = `mbr${string}`;
/** Identifier for an application (namespace for users and clients). */
export type ApplicationId = `app${string}`;

/**
 * Possible statuses for an account.
 *
 * - active: Normal operation
 * - trial: In trial period
 * - past_due: Payment failed but grace period active
 * - suspended: Access restricted due to billing or policy
 * - closed: Permanently closed
 */
export type AccountStatus =
  | "active"
  | "trial"
  | "past_due"
  | "suspended"
  | "closed";

/**
 * Accounts are billable entities that can access resources. Users are linked to accounts via memberships with roles.
 *
 * An account with subaccounts is acting as a tenant, and is used to create services with their own billing,
 * accounts, users, memberships, etc. This is useful for SaaS platforms that want to offer isolated environments
 * for different customers, and to allow reselling of their services to other SaaS providers.
 *
 * For example, an email service lets customers sign up. However, some customers want to offer
 * email services to their own clients. Therefore, the email provider has an account for each customer, and those
 * customers have accounts for their own clients as well. Each level is isolated, with separate billing and users.
 */
export type AccountResource = {
  id: AccountId;
  /** Parent application ID - accounts always belong to an application */
  parentId: ApplicationId;
  /** Display name chosen by the account owner */
  name: string | null;
  /** URL to the account's avatar image */
  avatarUrl: string | null;
  /** Current account status */
  status: AccountStatus;
  /** ISO 8601 timestamp until which the account is paid (null if never paid or closed) */
  paidUntil: string | null;
};

/**
 * Possible statuses for a user.
 *
 * - active: Normal operation
 * - trial: In trial period
 * - past_due: Payment failed but grace period active
 * - suspended: Access restricted due to billing or policy
 * - closed: Permanently closed
 */
export type UserStatus = "active" | "disabled" | "suspended" | "deleted";

/**
 * A reference to a user. Will not be deleted even due to GDPR requests or account closures,
 * to maintain referential integrity in audit logs and historical records.
 *
 * Users belong to an Application. They access Accounts via Memberships.
 */
export type UserResource = {
  id: UserId;
  /** The application this user belongs to */
  applicationId: ApplicationId;
  status: UserStatus;
  preferredMembershipId: MembershipId | null;
};

/**
 * Personal identity information (PII) for a user. Will be deleted due to GDPR requests or account
 * closures to respect legal requirements of various regions..
 */
export type UserIdentity = {
  id: UserId;
  avatarUrl: string | null;
  /** External identifier from third-party provider (i.e., SCIM) */
  externalId: string | null;
  givenName: string | null;
  familyName: string | null;
  displayName: string | null;
  /** Preferred language code (en-CA, fr-FR, zh-CN, etc.) */
  preferredLanguage: string | null;
  /** Locale code (e.g., "en-US") */
  locale: string | null;
  timezone: string | null;
};

/**
 * Roles within an account membership.
 *
 * - owner: Full administrative access, may perform destructive actions.
 * - member: Standard non-destructive access
 * - viewer: Read-only access
 */
export type MembershipRole = "owner" | "member" | "viewer";

export type Membership = {
  id: MembershipId;
  userId: UserId;
  accountId: AccountId;
  role: MembershipRole;
};

/**
 * Email credential record attached to a user.
 *
 * Sensitive fields (email) are only included when explicitly requested
 * or when the caller has appropriate permissions.
 */
export type EmailCredential = {
  id: string;
  email: string | null;
  emailVerifiedAt: string | null;
};

export type SessionTokens = {
  /** Signed JWT access token for authenticating API requests */
  accessToken: string;
  /** Opaque refresh token for obtaining new access tokens */
  refreshToken: string;
  tokenType: "Bearer";
  /** Seconds until the access token expires from time of issuance */
  expiresIn: number;
  idToken?: string;
  /** Absolute expiration time (milliseconds since epoch) set by the client library */
  expiresAt: number;
};

/**
 * Complete profile of the currently authenticated user.
 *
 * Combines basic user data with identity, credentials, memberships, and freshness timestamp.
 *
 * `lastUpdatedAt` is updated whenever the profile is fetched from the server.
 */
export type SessionProfile = UserResource & {
  identity: UserIdentity | null;
  credentials: EmailCredential[];
  memberships: (Membership & { account: AccountResource })[];
  /** Currently active membership in the accessToken */
  activeMembership: (Membership & { account: AccountResource }) | null;
  lastUpdatedAt: number;
};

/**
 * Combined authentication state containing tokens and optional profile.
 */
export type Authentication = {
  tokens: SessionTokens;
  profile: SessionProfile;
};

/**
 * Result of checkEmail() indicating whether the email is registered.
 */
export type EmailCheckStatus = "active" | "inactive";

/**
 * Supported login methods for an email address.
 *
 * Currently limited to email/password and magic link flows.
 */
export type LoginMethod = "email_password" | "magic_link";

/**
 * Minimal storage interface required for session persistence.
 *
 * Compatible with localStorage, sessionStorage, AsyncStorage (React Native), or any custom implementation.
 */
export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export type OAuth2LoginMethod = {
  login_method: "oauth2";
  authorize_url: string;
  callback_url: string;
};
