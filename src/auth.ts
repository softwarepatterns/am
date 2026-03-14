import type {
  AccountId,
  Authentication,
  ClientId,
  EmailCheckStatus,
  LoginMethod,
  OAuth2LoginMethod,
  ProblemDetails,
  SessionProfile,
  SessionTokens,
  StorageLike,
} from "./types";

const MINUTE_MS = 60 * 1000;
const SESSION_STATE = Symbol("session_state");
const AUTH_SESSION = Symbol("auth_session");
const AUTH_STATE = Symbol("auth_state");
const EMITTER = Symbol("emitter");

type StorageConfig = StorageLike | "localStorage" | null | undefined;

type FetchFn = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

type Config = {
  baseUrl: string;
  earlyRefreshMs: number;
  fetchFn: FetchFn;
  profileStorageKey: string;
  storage: StorageConfig;
  tokensStorageKey: string;
};

type AuthEventMap = {
  refresh: SessionTokens;
  profileChange: SessionProfile;
  unauthenticated: AuthError;
  sessionChange: AuthSession | null;
};

type SessionState = {
  cleared: boolean;
  config: Config;
  refreshPromise: Promise<void> | null;
  profilePromise: Promise<void> | null;
  profile: SessionProfile;
  tokens: SessionTokens;
};

type AuthState = {
  config: Config;
  listeners: { [K in keyof AuthEventMap]?: Set<(v: AuthEventMap[K]) => void> };
};

function getBrowserLocalStorage(): StorageLike | null {
  try {
    if (typeof window === "undefined") return null;
    if (!window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

function resolveStorage(storageConfig: StorageConfig): StorageLike | null {
  if (!storageConfig) return null;
  if (storageConfig === "localStorage") return getBrowserLocalStorage();
  return storageConfig;
}

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function readJson<T>(storage: StorageLike | null, key: string): T | null {
  if (!storage) return null;
  return safeParse<T>(storage.getItem(key));
}

function writeJson<T>(
  storage: StorageLike | null,
  key: string,
  value: T,
): void {
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {}
}

function removeKey(storage: StorageLike | null, key: string): void {
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {}
}

function clearAuth(config: Config) {
  const storage = resolveStorage(config.storage);
  removeKey(storage, config.profileStorageKey);
  removeKey(storage, config.tokensStorageKey);
}

function writeTokensIfNewer(
  storage: StorageLike | null,
  key: string,
  next: SessionTokens,
) {
  if (!storage) return;

  const curRaw = readJson<unknown>(storage, key);
  const cur = isSessionTokens(curRaw) ? curRaw : null;

  if (curRaw !== null && !cur) removeKey(storage, key);
  if (cur && cur.expiresAt >= next.expiresAt) return;

  writeJson(storage, key, next);
}

function writeProfileIfNewer(
  storage: StorageLike | null,
  key: string,
  next: SessionProfile,
) {
  if (!storage) return;

  const curRaw = readJson<unknown>(storage, key);
  const cur = isSessionProfile(curRaw) ? curRaw : null;

  if (curRaw !== null && !cur) removeKey(storage, key);
  if (cur && cur.lastUpdatedAt >= next.lastUpdatedAt) return;

  writeJson(storage, key, next);
}

function isSessionTokens(x: any): x is SessionTokens {
  return (
    !!x &&
    typeof x.accessToken === "string" &&
    typeof x.refreshToken === "string" &&
    typeof x.expiresAt === "number" &&
    typeof x.expiresIn === "number" &&
    x.tokenType === "Bearer"
  );
}

function isSessionProfile(x: any): x is SessionProfile {
  return (
    !!x &&
    typeof x.id === "string" &&
    typeof x.applicationId === "string" &&
    typeof x.status === "string" &&
    typeof x.lastUpdatedAt === "number" &&
    (typeof x.identity === "object" || x.identity === null)
  );
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

function camelCaseStr(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

function camelCaseObj(input: unknown): any {
  if (input === null || typeof input !== "object") {
    return input;
  }

  if (Array.isArray(input)) {
    return input.map((item) => camelCaseObj(item));
  }

  const obj = input as Record<string, unknown>;
  const result: Record<string, unknown> = {};

  for (const key of Object.keys(obj)) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      result[camelCaseStr(key)] = camelCaseObj(obj[key]);
    }
  }

  return result;
}

function snakeCaseStr(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function snakeCaseObj(input: unknown): any {
  if (input === null || typeof input !== "object") {
    return input;
  }

  if (Array.isArray(input)) {
    return input.map((item) => snakeCaseObj(item));
  }

  const obj = input as Record<string, unknown>;
  const result: Record<string, unknown> = {};

  for (const key of Object.keys(obj)) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      result[snakeCaseStr(key)] = snakeCaseObj(obj[key]);
    }
  }

  return result;
}

/**
 * AuthError represents structured authentication failures from Accountmaker endpoints.
 *
 * AuthError wraps RFC 7807 Problem Details. invalidParams may be present for field-level validation.
 * Network failures throw other error types.
 *
 * Also note that the `type` field often contains a URI that points to documentation about the
 * specific error type, including how to resolve it, code samples, and links to the RFCs or other
 * standards that define the error.
 *
 * @example
 * ```ts
 * try {
 *  const session = await am.signIn({ email: 'test@example.com', password: 'password123' });
 * } catch (e) {
 *  if (e instanceof AuthError) {
 *   console.error("Authentication failed:", e.title);
 *   if (e.invalidParams) {
 *    for (const param of e.invalidParams) {
 *      console.error(` - Invalid parameter: ${param.path} (${param.type})`);
 *     }
 *    }
 *   } else {
 *    console.error("Unexpected error:", e);
 *   }
 * }
 * ```
 *
 * Note that HTTP error codes are distinctly:
 * - 400: Client error (bad request, invalid input, etc.)
 * - 401: Unauthenticated (we don't know who you are)
 * - 402: Payment required (e.g. billing issue)
 * - 403: Unauthorized (we know who you are, but you don't have permission)
 * - 404: Not found
 * - 409: Conflict (email already registered, user already invited, etc.)
 * - 429: Too many requests (rate limiting)
 * - 500: Internal server error (server's fault)
 */
export class AuthError extends Error {
  public readonly problem: ProblemDetails;

  constructor(problem: ProblemDetails) {
    super(problem.title);
    this.name = "AuthError";
    this.problem = Object.freeze(problem);
  }
  get type(): string {
    return this.problem.type;
  }
  get title(): string {
    return this.problem.title;
  }
  get status(): number {
    return this.problem.status;
  }
  get code(): string | undefined {
    return this.problem.code;
  }
  get detail(): string | undefined {
    return this.problem.detail;
  }
  get invalidParams(): ProblemDetails["invalidParams"] | undefined {
    return this.problem.invalidParams;
  }
}

function defaultFetchFn(): FetchFn {
  const f = (globalThis as any).fetch as FetchFn | undefined;
  if (typeof f === "function") {
    return f.bind(globalThis);
  }

  return async () => {
    throw new Error(
      "Missing fetch implementation. Provide config.fetchFn or use a runtime with global fetch.",
    );
  };
}

const defaultConfig: Config = {
  fetchFn: defaultFetchFn(),
  baseUrl: "https://api.accountmaker.com",
  earlyRefreshMs: MINUTE_MS,
  storage: null,
  tokensStorageKey: "am_tokens",
  profileStorageKey: "am_profile",
};

function isProblemJson(res: Response): boolean {
  const contentType = res.headers.get("Content-Type") || "";
  return contentType.includes("application/problem+json");
}

async function readJsonSafe(res: Response): Promise<unknown> {
  const contentType = res.headers.get("Content-Type") || "";
  if (
    !contentType.includes("application/json") &&
    !contentType.includes("+json")
  )
    return null;
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function toGenericProblem(res: Response, detail?: unknown): ProblemDetails {
  return {
    type: "about:blank",
    title: res.statusText || "Request failed",
    status: res.status,
    detail: typeof detail === "string" ? detail : undefined,
  };
}

function getProblemJson(res: Response, json: any): ProblemDetails {
  if (
    isProblemJson(res) &&
    json &&
    typeof json === "object" &&
    typeof json.type === "string" &&
    typeof json.title === "string" &&
    typeof json.status === "number"
  ) {
    return json as ProblemDetails;
  }
  return toGenericProblem(res, json);
}

/** Adds an Authorization header to RequestInit. Supports Headers, arrays, and plain objects. */
function withBearer(init: RequestInit, token: string): RequestInit {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  return { ...init, headers };
}

/** Performs a single authenticated fetch and returns Response. */
const fetchSessionResponse = async (
  state: SessionState,
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> => {
  return state.config.fetchFn(
    input,
    withBearer(init, state.tokens.accessToken),
  );
};

/** Refreshes if needed, retries once on 401, and returns Response. */
const fetchSessionResponseEnsureFresh = async (
  state: SessionState,
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> => {
  if (isExpired(state)) {
    await refresh(state); // may throw AuthError
  }

  let res = await fetchSessionResponse(state, input, init);

  if (res.status !== 401) return res;
  if (state.cleared) return res;

  await refresh(state); // may throw AuthError (emits unauthenticated on 401)
  res = await fetchSessionResponse(state, input, init);
  return res;
};

/** Parses JSON (camelCase) and throws AuthError on non-2xx responses. */
const handleJsonOrThrow = async (res: Response) => {
  if (res.status === 204) return;

  const json = camelCaseObj(await readJsonSafe(res));

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
    headers: {
      Accept: "application/json",
    },
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
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(snakeCaseObj(body)),
  });
  return handleJsonOrThrow(res);
};

const isExpired = (state: SessionState): boolean => {
  const early = Math.min(
    Math.max(state.config.earlyRefreshMs, 0),
    5 * MINUTE_MS,
  );
  return Date.now() >= state.tokens.expiresAt - early;
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
    headers: {
      Accept: "application/json",
    },
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
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(snakeCaseObj(body)),
  });
};

const toSessionTokens = (tokens: any): SessionTokens => {
  const expiresIn = typeof tokens.expiresIn === "number" ? tokens.expiresIn : 0;
  return {
    ...tokens,
    expiresAt: Date.now() + expiresIn * 1000,
  };
};

const toSessionProfile = (profile: any): SessionProfile => {
  const credentials = profile.credentials ?? profile.emailCredentials;
  const activeMembership = profile.activeMembership ?? null;

  return {
    ...profile,
    credentials,
    activeMembership,
    lastUpdatedAt: Date.now(),
  };
};

function setSessionAuthentication(
  state: SessionState,
  authentication: Authentication,
): void {
  state.tokens = authentication.tokens;
  state.profile = authentication.profile;

  const storage = resolveStorage(state.config.storage);
  writeTokensIfNewer(storage, state.config.tokensStorageKey, state.tokens);
  writeProfileIfNewer(storage, state.config.profileStorageKey, state.profile);

  emitSessionStateEvent(state, "refresh", state.tokens);
  emitSessionStateEvent(state, "profileChange", state.profile);
}

async function doRefresh(state: SessionState): Promise<void> {
  const { fetchFn, baseUrl } = state.config;

  const res = await fetchFn(`${baseUrl}/auth/refresh`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
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

  const storage = resolveStorage(state.config.storage);
  writeTokensIfNewer(storage, state.config.tokensStorageKey, tokens);

  emitSessionStateEvent(state, "refresh", tokens);
}

async function doRefetchProfile(state: SessionState): Promise<void> {
  const profile = toSessionProfile(await authGet(state, "/auth/me", {}));
  state.profile = profile;

  const storage = resolveStorage(state.config.storage);
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
    const merged = { ...defaultConfig, ...config } as Config;

    const state: SessionState = {
      ...initial,
      config: merged,
      refreshPromise: null,
      profilePromise: null,
      cleared: false,
    };

    setSessionState(this, state);

    const storage = resolveStorage(merged.storage);
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
    return isExpired(getSessionState(this));
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
      config: { ...defaultConfig, ...config },
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
    const storage = resolveStorage(config.storage);
    if (!storage) return null;

    const tokensRaw = readJson<unknown>(storage, config.tokensStorageKey);
    const tokens = isSessionTokens(tokensRaw) ? tokensRaw : null;

    const profileRaw = readJson<unknown>(storage, config.profileStorageKey);
    const profile = isSessionProfile(profileRaw) ? profileRaw : null;

    if (!tokens || !profile) {
      removeKey(storage, config.tokensStorageKey);
      removeKey(storage, config.profileStorageKey);
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
