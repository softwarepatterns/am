import type {
  AccountId,
  Authentication,
  ClientId,
  EmailCheckStatus,
  LoginMethod,
  OAuth2LoginMethod,
  SessionProfile,
  SessionTokens,
} from "./types";
import { camelCaseObj, snakeCaseObj } from "./lib/casing";
import { AuthError } from "./lib/auth-error";
import {
  isProblemDetails,
  type ProblemDetails,
  toGenericProblemDetails,
} from "./lib/problem-details";
import { clearStorage, getStorageLike } from "./lib/storage";
import {
  isProblemJsonResponse,
  readResJsonAsObject,
} from "./lib/http-response";
import { fetchGETHeaders, fetchPOSTHeaders, updateBearer } from "./lib/fetch";
import { createConfig, type Config } from "./lib/config";
import { isSessionStateExpired, type SessionState } from "./lib/session-state";
import {
  readSessionTokens,
  toSessionTokens,
  writeTokensIfNewer,
} from "./lib/session-tokens";
import {
  readSessionProfile,
  toSessionProfile,
  writeProfileIfNewer,
} from "./lib/session-profile";

const SESSION_STATE = Symbol("session_state");
const AUTH_SESSION = Symbol("auth_session");
const AUTH_STATE = Symbol("auth_state");
const EMITTER = Symbol("emitter");

type AuthEventMap = {
  refresh: SessionTokens;
  profileChange: SessionProfile;
  unauthenticated: AuthError;
  sessionChange: AuthSession | null;
};

type AuthState = {
  config: Config;
  listeners: { [K in keyof AuthEventMap]?: Set<(v: AuthEventMap[K]) => void> };
};

function clearAuth(config: Config) {
  const storage = getStorageLike(config.storage);
  clearStorage(storage, config.profileStorageKey);
  clearStorage(storage, config.tokensStorageKey);
}

function getSessionState(session: AuthSession): SessionState {
  return (session as any)[SESSION_STATE] as SessionState;
}

function setSessionState(session: AuthSession, state: SessionState) {
  (session as any)[SESSION_STATE] = state;
}

function getAuthState(am: Am): AuthState {
  return (am as any)[AUTH_STATE];
}

function setAuthState(am: Am, state: AuthState) {
  (am as any)[AUTH_STATE] = state;
}

function getAuthSession(am: Am): AuthSession | null {
  return (am as any)[AUTH_SESSION] || null;
}

function setAuthSession(am: Am, session: AuthSession) {
  (am as any)[AUTH_SESSION] = session;
  const sessionState = getSessionState(session);
  setSessionStateEmitter(sessionState, am);
  emitSessionStateEvent(sessionState, "sessionChange", session);
}

function setSessionStateEmitter(sessionState: SessionState, am: Am) {
  (sessionState as any)[EMITTER] = <K extends keyof AuthEventMap>(
    event: K,
    value: AuthEventMap[K],
  ) => {
    const authState = getAuthState(am);
    const set = authState.listeners[event];
    if (!set) return;
    for (const fn of set) {
      try {
        fn(value);
      } catch {
        console.warn("Unhandled error in AuthEvent listener for event", event);
      }
    }
  };
}

function emitSessionStateEvent<K extends keyof AuthEventMap>(
  sessionState: SessionState,
  event: K,
  value: AuthEventMap[K],
) {
  const emit = (sessionState as any)[EMITTER];
  emit(event, value);
}

function getProblemJson(res: Response, json: any): ProblemDetails {
  if (isProblemJsonResponse(res) && isProblemDetails(json)) {
    return json;
  }
  return toGenericProblemDetails(res, json);
}

/** Refreshes if needed, retries once on 401, and returns Response. */
const fetchSessionResponseEnsureFresh = async (
  state: SessionState,
  url: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> => {
  if (isSessionStateExpired(state)) {
    await refresh(state); // may throw AuthError
  }

  const fetchFn = state.config.fetchFn;
  const res1 = await fetchFn(url, updateBearer(init, state.tokens.accessToken));

  if (res1.status !== 401) return res1;
  if (state.cleared) return res1;

  await refresh(state); // may throw AuthError (emits unauthenticated on 401)
  const res2 = await fetchFn(url, updateBearer(init, state.tokens.accessToken));
  return res2;
};

/** Parses JSON (camelCase) and throws AuthError on non-2xx responses. */
const handleJsonOrThrow = async (res: Response) => {
  if (res.status === 204) return;

  const json = camelCaseObj(await readResJsonAsObject(res));

  if (!res.ok) {
    throw new AuthError(getProblemJson(res, json));
  }

  return json;
};

const getSessionJsonEnsureFresh = async (
  state: SessionState,
  input: RequestInfo | URL,
  init: RequestInit = {},
) => {
  const res = await fetchSessionResponseEnsureFresh(state, input, init);
  return handleJsonOrThrow(res);
};

/** Calls an unauthenticated Accountmaker JSON endpoint and returns parsed data. */
const unauthGet = async (
  { fetchFn, baseUrl }: Config,
  path: string,
  query: Record<string, string> = {},
) => {
  const qs = new URLSearchParams(
    snakeCaseObj(query) as Record<string, string>,
  ).toString();
  const url = qs ? `${baseUrl}${path}?${qs}` : `${baseUrl}${path}`;
  const res = await fetchFn(url, {
    method: "GET",
    headers: fetchGETHeaders,
  });
  return handleJsonOrThrow(res);
};

/** Calls an unauthenticated Accountmaker JSON endpoint and returns parsed data. */
const unauthPost = async (
  { fetchFn, baseUrl }: Config,
  path: string,
  body: Record<string, unknown>,
) => {
  const res = await fetchFn(`${baseUrl}${path}`, {
    method: "POST",
    headers: fetchPOSTHeaders,
    body: JSON.stringify(snakeCaseObj(body)),
  });
  return handleJsonOrThrow(res);
};

const refresh = async (state: SessionState): Promise<void> => {
  if (state.cleared) return;

  if (!state.refreshPromise) {
    state.refreshPromise = doRefresh(state);
  }

  try {
    await state.refreshPromise;
  } finally {
    state.refreshPromise = null;
  }
};

const isUnauthenticatedAuthError = (e: any): e is AuthError => {
  return e instanceof AuthError && e.status === 401;
};

/** Calls an authenticated Accountmaker JSON endpoint, returns parsed data, throws AuthError on non-2xx. */
const authGet = async (
  state: SessionState,
  path: string,
  query: Record<string, string> = {},
) => {
  const qs = new URLSearchParams(
    snakeCaseObj(query) as Record<string, string>,
  ).toString();
  const baseUrl = state.config.baseUrl;
  const url = qs ? `${baseUrl}${path}?${qs}` : `${baseUrl}${path}`;
  return await getSessionJsonEnsureFresh(state, url, {
    method: "GET",
    headers: fetchGETHeaders,
  });
};

/** Calls an authenticated Accountmaker JSON endpoint, returns parsed data, throws AuthError on non-2xx. */
const authPost = async (
  state: SessionState,
  path: string,
  body: Record<string, unknown>,
) => {
  const baseUrl = state.config.baseUrl;
  return await getSessionJsonEnsureFresh(state, `${baseUrl}${path}`, {
    method: "POST",
    headers: fetchPOSTHeaders,
    body: JSON.stringify(snakeCaseObj(body)),
  });
};

function setSessionAuthentication(
  state: SessionState,
  authentication: Authentication,
): void {
  state.tokens = authentication.tokens;
  state.profile = authentication.profile;

  const storage = getStorageLike(state.config.storage);
  writeTokensIfNewer(storage, state.config.tokensStorageKey, state.tokens);
  writeProfileIfNewer(storage, state.config.profileStorageKey, state.profile);

  emitSessionStateEvent(state, "refresh", state.tokens);
  emitSessionStateEvent(state, "profileChange", state.profile);
}

async function doRefresh(state: SessionState): Promise<void> {
  const { fetchFn, baseUrl } = state.config;

  const res = await fetchFn(`${baseUrl}/auth/refresh`, {
    method: "POST",
    headers: fetchPOSTHeaders,
    body: JSON.stringify(
      snakeCaseObj({ refreshToken: state.tokens.refreshToken }),
    ),
  });

  let json;
  try {
    json = await handleJsonOrThrow(res);
  } catch (e) {
    if (!state.cleared && isUnauthenticatedAuthError(e)) {
      emitSessionStateEvent(state, "unauthenticated", e);
    }
    throw e;
  }

  const tokens = toSessionTokens(json);
  state.tokens = tokens;

  const storage = getStorageLike(state.config.storage);
  writeTokensIfNewer(storage, state.config.tokensStorageKey, tokens);

  emitSessionStateEvent(state, "refresh", tokens);
}

async function doRefetchProfile(state: SessionState): Promise<void> {
  const profile = toSessionProfile(await authGet(state, "/auth/me", {}));
  state.profile = profile;

  const storage = getStorageLike(state.config.storage);
  writeProfileIfNewer(storage, state.config.profileStorageKey, profile);

  emitSessionStateEvent(state, "profileChange", profile);
}

const handleAuthenticationResponse = (json: any): Authentication => {
  return {
    tokens: toSessionTokens(json.tokens),
    profile: toSessionProfile(json.profile),
  };
};

async function doSwitchAccounts(
  state: SessionState,
  body: { accountId: AccountId; csrfToken?: string },
): Promise<void> {
  const authentication = handleAuthenticationResponse(
    await authPost(state, "/auth/switch-accounts", body),
  );
  setSessionAuthentication(state, authentication);
}

/**
 * AuthSession represents an authenticated user with automatic token refresh and persisted state.
 *
 * AuthSession owns tokens, profile data, refresh logic, and authenticated requests.
 */
export class AuthSession {
  constructor(initial: Authentication, config: Partial<Config>) {
    const merged = createConfig(config);

    const state: SessionState = {
      ...initial,
      config: merged,
      refreshPromise: null,
      profilePromise: null,
      cleared: false,
    };

    setSessionState(this, state);

    const storage = getStorageLike(merged.storage);
    writeTokensIfNewer(storage, merged.tokensStorageKey, state.tokens);

    if (state.profile) {
      // similar helper for profile
      writeProfileIfNewer(storage, merged.profileStorageKey, state.profile);
    }
  }

  /**
   * Removes all persisted data (tokens, profile) from storage, and prevents future
   * refreshes of token and profile data. Does NOT clear current token or profile data from the
   * session memory, but effectively deactivates the session for future use.
   */
  clear(): void {
    const state = getSessionState(this);
    clearAuth(state.config);
    state.cleared = true;
  }

  get tokens(): SessionTokens {
    return getSessionState(this).tokens;
  }

  get profile(): SessionProfile {
    return getSessionState(this).profile;
  }

  toJSON(): Authentication {
    const state = getSessionState(this);
    return { tokens: state.tokens, profile: state.profile };
  }

  /**
   * Creates an AuthSession from existing authentication data. Useful for restoring
   * a session from custom storage or creating a session from custom server-provided data.
   */
  static fromJSON(
    initial: Authentication,
    config: Partial<Config>,
  ): AuthSession {
    return new AuthSession(initial, config);
  }

  /**
   * Returns true if the access token is expired or will expire soon. The
   * "soon" threshold is configured via Config.earlyRefreshMs (default 1 minute).
   */
  isExpired(): boolean {
    return isSessionStateExpired(getSessionState(this));
  }

  /**
   * Performs standard fetch() with a Bearer token and automatic refresh.
   *
   * Returns Response, does not parse the body, does not throw for HTTP status codes.
   * Throws AuthError when refresh fails, trows runtime errors on network failure.
   *
   * @example
   * ```ts
   * const res = await session.fetch("/api/projects");
   * const projects = await res.json();
   * ```
   *
   * Any service can validate tokens using:
   * https://api.accountmaker.com/.well-known/jwks.json?client_id={clientId}
   */
  async fetch(url: string | URL, init: RequestInit = {}) {
    return fetchSessionResponseEnsureFresh(getSessionState(this), url, init);
  }

  /**
   * Replaces the access token using the refresh token.
   *
   * It is called automatically by all other methods when the access token is expired or near expiry.
   */
  async refresh(): Promise<void> {
    return refresh(getSessionState(this));
  }

  /**
   * refetchProfile() replaces the cached profile with server state.
   *
   * Concurrent calls are deduplicated.
   *
   * @example
   * ```ts
   * await session.refetchProfile();
   * console.log("Updated profile:", session.profile);
   * ```
   *
   * Throws AuthError on network errors, etc.
   * @throws AuthError
   */
  async refetchProfile(): Promise<void> {
    const state = getSessionState(this);
    if (state.cleared) {
      // silently do nothing
      return;
    }

    if (!state.profilePromise) {
      state.profilePromise = doRefetchProfile(state);
    }

    try {
      await state.profilePromise;
    } finally {
      state.profilePromise = null;
    }
  }

  /**
   * Switches the session into another account membership and replaces tokens/profile in place.
   */
  async switchAccounts(body: {
    accountId: AccountId;
    csrfToken?: string;
  }): Promise<void> {
    await doSwitchAccounts(getSessionState(this), body);
  }

  /**
   * Requests a verification email for the current user.
   *
   * Throws AuthError on network errors, etc.
   * @throws AuthError
   */
  async sendVerificationEmail(): Promise<void> {
    await authPost(getSessionState(this), "/auth/send-verification-email", {});
  }
}

/**
 * Am runs authentication flows and produces AuthSession.
 *
 * Use Am before a session exists (sign-in, sign-up, magic link, invites, password reset, CSRF).
 *
 * @example
 * ```ts
 * const am = new Am();
 * const session = await am.signIn({ email: 'user@example.com', password: 'secret' });
 * // Now use `session` for protected API calls
 * ```
 */
export class Am {
  constructor(config?: Partial<Config>) {
    setAuthState(this, {
      config: createConfig(config),
      listeners: {},
    });
  }

  /**
   * session returns the current AuthSession or null.
   *
   * Use restoreSession() to load from storage.
   *
   * @example
   * ```ts
   * const session = am.session;
   * if (!session) throw new Error("Not authenticated");
   * ```
   */
  get session(): AuthSession | null {
    return getAuthSession(this);
  }

  /**
   * Constructs AuthSession from existing tokens and profile.
   *
   * Use this after a server-side auth handshake or custom persistence.
   */
  createSession(initial: Authentication): AuthSession {
    const session = new AuthSession(initial, getAuthState(this).config);
    setAuthSession(this, session);
    return session;
  }

  /**
   * restoreSession loads AuthSession from storage or returns null.
   *
   * Invalid or partial stored data is cleared.
   *
   * @example
   * ```ts
   * const am = new Am({ storage: 'localStorage' });
   * const session = am.restoreSession();
   * if (session) session.fetch("/api/me");
   * ```
   */
  restoreSession(): AuthSession | null {
    const config = getAuthState(this).config;
    const storage = getStorageLike(config.storage);
    if (!storage) return null;

    const tokens = readSessionTokens(storage, config.tokensStorageKey);
    const profile = readSessionProfile(storage, config.profileStorageKey);

    if (!tokens || !profile) {
      clearStorage(storage, config.tokensStorageKey);
      clearStorage(storage, config.profileStorageKey);
      return null;
    }

    const session = new AuthSession({ tokens, profile }, config);
    setAuthSession(this, session);
    return session;
  }

  /**
   * Subscribes to auth events and returns an unsubscribe function.
   */
  on<K extends keyof AuthEventMap>(event: K, fn: (v: AuthEventMap[K]) => void) {
    const listeners = getAuthState(this).listeners;
    const set = ((listeners[event] as unknown) ??= new Set<
      (v: AuthEventMap[K]) => void
    >()) as Set<(v: AuthEventMap[K]) => void>;
    set.add(fn);
    return () => set.delete(fn);
  }

  /**
   * acceptInvite exchanges an invite token for a fresh AuthSession.
   *
   * Throws AuthError on invalid, expired, or already-used tokens.
   */
  async acceptInvite(query: {
    clientId: ClientId;
    token: string;
  }): Promise<AuthSession> {
    const config = getAuthState(this).config;
    const initial = handleAuthenticationResponse(
      await unauthGet(config, "/auth/accept-invite", query),
    );
    const session = new AuthSession(initial, config);
    setAuthSession(this, session);
    return session;
  }

  /**
   * checkEmail returns how an email should authenticate for this client.
   *
   * Use this to choose password vs magic link vs SSO before rendering a login form.
   */
  async checkEmail(body: {
    clientId: ClientId;
    email: string;
    csrfToken?: string;
  }): Promise<{
    status: EmailCheckStatus;
    preferred: LoginMethod[];
    available: LoginMethod[];
  }> {
    return unauthPost(getAuthState(this).config, "/auth/check-email", body);
  }

  /**
   * Sets the httpOnly CSRF cookie.
   *
   * Call csrfToken() next to fetch a signed token for form posts.
   */
  async csrfSession(): Promise<{ csrfToken: string }> {
    return unauthGet(getAuthState(this).config, "/auth/csrf-session");
  }

  /**
   * Returns a signed CSRF token for form posts.
   *
   * Call csrfSession() first to set the CSRF cookie.
   */
  async csrfToken(): Promise<{ csrfToken: string }> {
    return unauthGet(getAuthState(this).config, "/auth/csrf-token");
  }

  /**
   * checkEmail returns how an email should authenticate for this client.
   *
   * Use this to choose password vs magic link vs SSO before rendering a login form.
   */
  async loginMethods(body: { clientId: ClientId }): Promise<{
    oauth_google?: OAuth2LoginMethod;
    oauth_github?: OAuth2LoginMethod;
    oauth_facebook?: OAuth2LoginMethod;
    oauth_apple?: OAuth2LoginMethod;
    oauth_microsoft?: OAuth2LoginMethod;
    password?: OAuth2LoginMethod;
    magic_link?: OAuth2LoginMethod;
  }> {
    return unauthPost(getAuthState(this).config, "/auth/login-methods", body);
  }

  /**
   * Authenticates with email and password and returns a new AuthSession.
   *
   * Tokens and profile are persisted when storage is configured.
   */
  async signIn(body: {
    clientId: ClientId;
    email: string;
    password: string;
    csrfToken?: string;
  }): Promise<AuthSession> {
    const config = getAuthState(this).config;
    const initial = handleAuthenticationResponse(
      await unauthPost(config, "/auth/sign-in", body),
    );

    const session = new AuthSession(initial, config);
    setAuthSession(this, session);
    return session;
  }

  /**
   * Authenticates with a one-time token and returns a new AuthSession.
   *
   * Use this for magic links and similar one-time login flows.
   */
  async signInWithToken(token: string): Promise<AuthSession> {
    const config = getAuthState(this).config;
    const initial = handleAuthenticationResponse(
      await unauthGet(config, "/auth/sign-in-with-token", {
        token,
      }),
    );

    const session = new AuthSession(initial, config);
    setAuthSession(this, session);
    return session;
  }

  /**
   * Creates a new user and returns a new AuthSession.
   *
   * Tokens and profile are persisted when storage is configured.
   */
  async signUp(body: {
    clientId: ClientId;
    email: string;
    password: string;
    csrfToken?: string;
  }): Promise<AuthSession> {
    const config = getAuthState(this).config;
    const initial = handleAuthenticationResponse(
      await unauthPost(config, "/auth/sign-up", body),
    );

    const session = new AuthSession(initial, config);
    setAuthSession(this, session);
    return session;
  }

  /**
   * Sets a new password using a one-time reset token.
   */
  async resetPassword(body: {
    token: string;
    newPassword: string;
  }): Promise<void> {
    return unauthPost(getAuthState(this).config, "/auth/reset-password", body);
  }

  /**
   * Sends a one-time sign-in link to an email address.
   */
  async sendMagicLink(body: {
    clientId: ClientId;
    email: string;
    csrfToken?: string;
  }): Promise<void> {
    return unauthPost(getAuthState(this).config, "/auth/send-magic-link", body);
  }

  /**
   * Sends a password reset link to an email address.
   */
  async sendPasswordReset(body: {
    clientId: ClientId;
    email: string;
    csrfToken?: string;
  }): Promise<void> {
    return unauthPost(
      getAuthState(this).config,
      "/auth/send-password-reset",
      body,
    );
  }
}
