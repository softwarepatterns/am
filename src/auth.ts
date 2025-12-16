import type {
  Authentication,
  ClientId,
  EmailCheckStatus,
  LoginMethod,
  ProblemDetails,
  SessionProfile,
  SessionTokens,
  UserId,
  UserResource,
  StorageLike,
} from "./types";

const MINUTE_MS = 60 * 1000;
const STATE = Symbol("state");

type StorageConfig = StorageLike | "localStorage" | null | undefined;

type FetchFn = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

type Config = {
  baseUrl: string;
  earlyRefreshMs: number;
  fetchFn: FetchFn;
  onRefresh?: (tokens: SessionTokens) => void | Promise<void>;
  onProfileRefetch?: (profile: SessionProfile) => void | Promise<void>;
  onUnauthenticated?: (e: AuthError) => void | Promise<void>;
  profileStorageKey: string;
  storage: StorageConfig;
  tokensStorageKey: string;
};

type State = {
  cleared: boolean;
  config: Config;
  refreshPromise: Promise<void> | null;
  profilePromise: Promise<void> | null;
  profile: SessionProfile | null;
  tokens: SessionTokens;
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
    typeof x.accountId === "string" &&
    typeof x.status === "string" &&
    typeof x.lastUpdatedAt === "number" &&
    (typeof x.identity === "object" || x.identity === null)
  );
}

function getState(session: AuthSession): State {
  return (session as any)[STATE] as State;
}

function setState(session: AuthSession, state: State) {
  (session as any)[STATE] = state;
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
 * Error type for authentication-related failures.
 *
 * Always thrown on non-2xx responses from auth endpoints. Contains structured ProblemDetails
 * from the server when available.
 *
 * Most 400 errors will also contain `invalidParams` for parameters that caused
 * the error, which can be used to display field-level validation messages.
 *
 * Note that network errors, timeouts, etc. will throw other Error types (e.g. TypeError) unrelated
 * to AuthError.
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
  if (typeof f === "function") return f;

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

const handleResponse = async (res: Response) => {
  if (res.status === 204) {
    return;
  }

  const json = camelCaseObj(await readJsonSafe(res));

  if (!res.ok) {
    throw new AuthError(getProblemJson(res, json));
  }

  return json;
};

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
  return handleResponse(res);
};

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
  return handleResponse(res);
};

/**
 * Fetch with Authorization header.
 *
 * Returns the response as JSON. Throws AuthError on non-2xx responses.
 * @throws AuthError
 */
const authFetch = async (
  state: State,
  url: string | URL,
  init: RequestInit = {},
) => {
  const res = await state.config.fetchFn(url, {
    ...init,
    headers: {
      ...(init.headers || {}),
      Authorization: `Bearer ${state.tokens.accessToken}`,
    },
  });

  return handleResponse(res);
};

const isExpired = (state: State): boolean => {
  const early = Math.min(
    Math.max(state.config.earlyRefreshMs, 0),
    5 * MINUTE_MS,
  );
  return Date.now() >= state.tokens.expiresAt - early;
};

const refresh = async (state: State): Promise<void> => {
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

/**
 * Fetch with automatic token refresh.
 *
 * If the access token is expired, it will be refreshed before making the request. The
 * Authorization header will be set with the current access token.
 *
 * Returns the response as JSON. Throws AuthError on non-2xx responses.
 *
 * @throws AuthError
 */
const authFetchWithRefresh = async (
  state: State,
  url: string | URL,
  init: RequestInit = {},
) => {
  if (isExpired(state)) {
    await refresh(state);
  }

  try {
    return await authFetch(state, url, init);
  } catch (e) {
    // Only retry on "401 Unauthenticated" errors.
    if (!isUnauthenticatedAuthError(e)) {
      throw e;
    }
    // Do not retry if the session was cleared.
    if (state.cleared) {
      throw e;
    }

    try {
      // Attempt to refresh the token. Will throw if refresh fails.
      // Exception case 1) Another 401 due to expired token, allow error to propagate.
      // Exception case 2) Internet connection is down, allow error to propagate.
      // Success case 3) Refresh actually gets a new access token, try request again.
      await refresh(state);

      // Retry again since the refresh  succeeded.
      return await authFetch(state, url, init);
    } catch (e2) {
      // Notify unauthenticated handler if provided.
      if (
        state.config.onUnauthenticated &&
        !state.cleared &&
        isUnauthenticatedAuthError(e2)
      ) {
        try {
          await state.config.onUnauthenticated(e2);
        } catch {}
      }
      throw e2;
    }
  }
};

/** * Authenticated GET request
 *
 * Returns the body parsed as JSON. Throws AuthError on non-2xx responses.
 * @throws AuthError
 */
const authGet = async (
  state: State,
  path: string,
  query: Record<string, string> = {},
) => {
  const qs = new URLSearchParams(
    snakeCaseObj(query) as Record<string, string>,
  ).toString();
  const baseUrl = state.config.baseUrl;
  const url = qs ? `${baseUrl}${path}?${qs}` : `${baseUrl}${path}`;
  return await authFetchWithRefresh(state, url, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });
};

/**
 * Authenticated POST request
 *
 * Returns the body parsed as JSON. Throws AuthError on non-2xx responses.
 * @throws AuthError
 */
const authPost = async (
  state: State,
  path: string,
  body: Record<string, unknown>,
) => {
  const baseUrl = state.config.baseUrl;
  return await authFetchWithRefresh(state, `${baseUrl}${path}`, {
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
  return {
    ...profile,
    lastUpdatedAt: Date.now(),
  };
};

async function doRefresh(state: State): Promise<void> {
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

  const tokens = toSessionTokens(await handleResponse(res));
  state.tokens = tokens;

  const storage = resolveStorage(state.config.storage);
  writeTokensIfNewer(storage, state.config.tokensStorageKey, tokens);

  await state.config.onRefresh?.(tokens);
}

async function doRefetchProfile(state: State): Promise<void> {
  const profile = toSessionProfile(await authGet(state, "/auth/me", {}));
  state.profile = profile;

  const storage = resolveStorage(state.config.storage);
  writeProfileIfNewer(storage, state.config.profileStorageKey, profile);

  await state.config.onProfileRefetch?.(profile);
}

const handleAuthenticationResponse = (json: any): Authentication => {
  return {
    tokens: toSessionTokens(json.tokens),
    profile: toSessionProfile(json.profile),
  };
};

/**
 * You receive an AuthSession after successful sign-in/register/etc.
 *
 * It contains the current access token, user profile, and methods to perform authorized
 * requests.
 *
 * Features:
 * - session.fetch() will always use a valid access token (refreshing automatically)
 * - All non-2xx responses throw AuthError
 * - Tokens and profile are automatically persisted to storage (if configured)
 */
export class AuthSession {
  constructor(initial: Authentication, config: Partial<Config>) {
    const merged = { ...defaultConfig, ...config } as Config;

    const state: State = {
      ...initial,
      config: merged,
      refreshPromise: null,
      profilePromise: null,
      cleared: false,
    };

    setState(this, state);

    const storage = resolveStorage(merged.storage);
    writeTokensIfNewer(storage, merged.tokensStorageKey, state.tokens);

    if (state.profile) {
      // similar helper for profile
      writeProfileIfNewer(storage, merged.profileStorageKey, state.profile);
    }
  }

  /**
   * Restores an AuthSession from persisted storage. Returns null if no valid session
   * is found.
   *
   * @example
   * ```ts
   * const session = AuthSession.restoreSession();
   * if (session) {
   *   console.log("Restored session for user:", session.profile);
   * } else {
   *   console.log("No valid session found.");
   * }
   * ```
   */
  static restoreSession(config: Partial<Config> = {}): AuthSession | null {
    const merged = { ...defaultConfig, ...config } as Config;
    const storage = resolveStorage(merged.storage);
    if (!storage) return null;

    const tokensRaw = readJson<unknown>(storage, merged.tokensStorageKey);
    const tokens = isSessionTokens(tokensRaw) ? tokensRaw : null;

    if (!tokens) {
      if (tokensRaw !== null) removeKey(storage, merged.tokensStorageKey);
      // avoid ghost profile
      removeKey(storage, merged.profileStorageKey);
      return null;
    }

    const profileRaw = readJson<unknown>(storage, merged.profileStorageKey);
    const profile = isSessionProfile(profileRaw) ? profileRaw : null;

    if (profileRaw !== null && !profile) {
      // schema drift or corrupted profile data
      removeKey(storage, merged.profileStorageKey);
    }

    return new AuthSession({ tokens, profile }, merged);
  }

  /**
   * Removes all persisted data (tokens, profile) from storage, and prevents future
   * refreshs of token and profile data. Does NOT clear current token or profile data from the
   * session memory, but effectively deactivates the session for future use.
   */
  clear(): void {
    const state = getState(this);
    clearAuth(state.config);
    state.cleared = true;
  }

  accessToken(): string {
    return getState(this).tokens.accessToken;
  }
  refreshToken(): string {
    return getState(this).tokens.refreshToken;
  }
  idToken(): string | undefined {
    return getState(this).tokens.idToken;
  }
  expiresIn(): number {
    return getState(this).tokens.expiresIn;
  }
  expiresAt(): Date {
    return new Date(getState(this).tokens.expiresAt);
  }
  profile(): SessionProfile | null {
    return getState(this).profile;
  }

  toJSON(): Authentication {
    const state = getState(this);
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
    return isExpired(getState(this));
  }

  /**
   * Perform an authenticated fetch. Used to call your own APIs with the current
   * session's access token. Any service can validate the token against Am's public
   * keys at https://api.accountmaker.com/.well-known/jwks.json?client_id={clientId}
   *
   * Automatically:
   *   - Adds Authorization header
   *   - Refreshes token if expired
   *   - Retries once on 401 if refresh succeeds
   *
   * Assumes the response is JSON and parses it. Throws AuthError on non-2xx responses.
   *
   * If the error is a RFC 7807 Problem Details response, the AuthError.problem
   * will contain the full details.
   *
   * @example
   * ```ts
   * const res = await session.fetch('/api/projects');
   * const projects = await res.json();
   * ```
   *
   * Throws AuthError on network errors, etc.
   * @throws AuthError
   */
  async fetch(url: string | URL, init: RequestInit = {}) {
    return authFetchWithRefresh(getState(this), url, init);
  }

  /**
   * Refreshes the access token using the refresh token. Updates the stored tokens on
   * success. This is called automatically by fetch() if the token is expired or close to
   * expiring.
   */
  async refresh(): Promise<void> {
    return refresh(getState(this));
  }

  /**
   * Refetches the user's profile from the server and updates the stored profile.
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
    const state = getState(this);
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
   * Sends a verification email to the user's primary email address. This only succeeds if
   * called by the currently authenticated user or an account admin.
   *
   * Throws AuthError on network errors, etc.
   * @throws AuthError
   */
  async sendVerificationEmail(): Promise<void> {
    await authPost(getState(this), "/auth/send-verification-email", {});
  }

  /**
   * Fetches a user by ID.
   *
   * Throws AuthError on invalid user ID, network errors, etc.
   * @throws AuthError
   */
  async user(id: UserId): Promise<UserResource> {
    return authGet(getState(this), `/auth/user/${id}`, {});
  }
}

/**
 * Use `Am` to perform initial sign-in, registration, password reset flows, magic links,
 * invite acceptance, and other unauthenticated actions.
 *
 * Once authentication succeeds, these methods return an `AuthSession` that you use
 * for all subsequent authenticated requests.
 *
 * Example:
 * ```ts
 * const am = new Am();
 * const session = await am.signIn({ email: 'user@example.com', password: 'secret' });
 * // Now use `session` for protected API calls
 * ```
 */
export class Am {
  private options: Config;

  constructor(config?: Partial<Config>) {
    this.options = { ...defaultConfig, ...config } as Config;
  }

  /**
   * Creates an AuthSession from existing authentication data. Useful for restoring
   * a session from custom storage or creating a session from custom server-provided data.
   */
  static createAuthSession(
    initial: Authentication,
    config?: Partial<Config>,
  ): AuthSession {
    return new Am(config).createAuthSession(initial);
  }

  /**
   * Creates an AuthSession from existing authentication data. Useful for restoring
   * a session from custom storage or creating a session from custom server-provided data.
   */
  createAuthSession(initial: Authentication): AuthSession {
    return new AuthSession(initial, this.options);
  }

  /**
   * Accepts an invitation to join an account. On success, returns an AuthSession
   * containing fresh tokens and profile. Tokens are automatically persisted (if
   * storage is enabled).
   *
   * Throws AuthError on invalid or expired token, etc.
   * @throws AuthError
   */
  static async acceptInvite(
    query: {
      clientId: ClientId;
      token: string;
    },
    config?: Partial<Config>,
  ): Promise<AuthSession> {
    return new Am(config).acceptInvite(query);
  }

  /**
   * Accepts an invitation to join an account. On success, returns an AuthSession
   * containing fresh tokens and profile. Tokens are automatically persisted (if
   * storage is enabled).
   *
   * Throws AuthError on invalid or expired token, etc.
   * @throws AuthError
   */
  async acceptInvite(query: {
    clientId: ClientId;
    token: string;
  }): Promise<AuthSession> {
    const initial = handleAuthenticationResponse(
      await unauthGet(this.options, "/auth/accept-invite", query),
    );
    return new AuthSession(initial, this.options);
  }

  /**
   * Checks the status of an email address for authentication purposes. Indicates whether the
   * email is associated with an active account, and what login methods are preferred and
   * available for that user. This can be used to enforce login expierences for enterprise SSO or
   * to prefer passwordless login methods.
   *
   * Throws AuthError on invalid client ID, network errors, etc.
   * @throws AuthError
   */
  static async checkEmail(
    body: { clientId: ClientId; email: string; csrfToken?: string },
    config?: Partial<Config>,
  ): Promise<{
    status: EmailCheckStatus;
    preferred: LoginMethod[];
    available: LoginMethod[];
  }> {
    return new Am(config).checkEmail(body);
  }

  /**
   * Checks the status of an email address for authentication purposes. Indicates whether the
   * email is associated with an active account, and what login methods are preferred and
   * available for that user. This can be used to enforce login expierences for enterprise SSO or
   * to prefer passwordless login methods.
   *
   * Throws AuthError on invalid client ID, network errors, etc.
   * @throws AuthError
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
    return unauthPost(this.options, "/auth/check-email", body);
  }

  /**
   * When called, sets a httpOnly CSRF session cookie. Then when rendering a form, call csrfToken()
   * to get the signed token to include in the form. When the form is submitted, the server
   * will verify the signed token against the session cookie. This prevents a certain class
   * of CSRF attacks that rely on being able to read values from the target site.
   */
  static async csrfSession(
    config?: Partial<Config>,
  ): Promise<{ csrfToken: string }> {
    return new Am(config).csrfSession();
  }

  /**
   * When called, sets a httpOnly CSRF session cookie. Then when rendering a form, call csrfToken()
   * to get the signed token to include in the form. When the form is submitted, the server
   * will verify the signed token against the session cookie. This prevents a certain class
   * of CSRF attacks that rely on being able to read values from the target site.
   */
  async csrfSession(): Promise<{ csrfToken: string }> {
    return unauthGet(this.options, "/auth/csrf-session");
  }

  /**
   * Fetches a signed CSRF token for use in forms. Call csrfSession() first to set a httpOnly CSRF
   * session cookie, then call this method to get the signed token, then include the token in your
   * form submissions. When the form is submitted, the server will verify the signed token against
   * the httpOnly session cookie. This prevents a certain class of CSRF attacks that rely on being
   * able to read values from the target site.
   *
   * @throws AuthError
   */
  static async csrfToken(
    config?: Partial<Config>,
  ): Promise<{ csrfToken: string }> {
    return new Am(config).csrfToken();
  }

  /**
   * Fetches a signed CSRF token for use in forms. Call csrfSession() first to set a httpOnly CSRF
   * session cookie, then call this method to get the signed token, then include the token in your
   * form submissions. When the form is submitted, the server will verify the signed token against
   * the httpOnly session cookie. This prevents a certain class of CSRF attacks that rely on being
   * able to read values from the target site.
   *
   * @throws AuthError
   */
  async csrfToken(): Promise<{ csrfToken: string }> {
    return unauthGet(this.options, "/auth/csrf-token");
  }

  /**
   * On success, returns an AuthSession containing fresh tokens and profile.
   * Tokens are automatically persisted (if storage is enabled).
   *
   * Throws AuthError on invalid credentials, unverified email, etc.
   * @throws AuthError
   */
  static async signIn(
    body: {
      clientId: ClientId;
      email: string;
      password: string;
      csrfToken?: string;
    },
    config?: Partial<Config>,
  ): Promise<AuthSession> {
    return new Am(config).signIn(body);
  }

  /**
   * On success, returns an AuthSession containing fresh tokens and profile.
   * Tokens are automatically persisted (if storage is enabled).
   *
   * Throws AuthError on invalid credentials, unverified email, etc.
   * @throws AuthError
   */
  async signIn(body: {
    clientId: ClientId;
    email: string;
    password: string;
    csrfToken?: string;
  }): Promise<AuthSession> {
    const initial = handleAuthenticationResponse(
      await unauthPost(this.options, "/auth/sign-in", body),
    );

    return new AuthSession(initial, this.options);
  }

  /**
   * Authenticates using a one-time token (e.g., magic link or invite token).
   *
   * On success, returns an AuthSession containing fresh tokens and profile.
   * Tokens are automatically persisted (if storage is enabled).
   *
   * Throws AuthError on invalid or expired token, etc.
   * @throws AuthError
   */
  static async signInWithToken(
    token: string,
    config?: Partial<Config>,
  ): Promise<AuthSession> {
    return new Am(config).signInWithToken(token);
  }

  /**
   * Authenticates using a one-time token (e.g., magic link or invite token).
   *
   * On success, returns an AuthSession containing fresh tokens and profile.
   * Tokens are automatically persisted (if storage is enabled).
   *
   * Throws AuthError on invalid or expired token, etc.
   * @throws AuthError
   */
  async signInWithToken(token: string): Promise<AuthSession> {
    const options = this.options;
    const initial = handleAuthenticationResponse(
      await unauthGet(options, "/auth/sign-in-with-token", {
        token,
      }),
    );

    return new AuthSession(initial, options);
  }

  /**
   * Manually refreshes session tokens using the provided refresh token. Does NOT
   * persist tokens. Use AuthSession.refresh() to refresh and persist tokens in an
   * existing session.
   *
   * Throws AuthError on invalid or expired refresh token, etc.
   * @throws AuthError
   */
  static async refresh(
    refreshToken: string,
    config?: Partial<Config>,
  ): Promise<SessionTokens> {
    return new Am(config).refresh(refreshToken);
  }

  /**
   * Manually refreshes session tokens using the provided refresh token. Does NOT
   * persist tokens. Use AuthSession.refresh() to refresh and persist tokens in an
   * existing session.
   *
   * Throws AuthError on invalid or expired refresh token, etc.
   * @throws AuthError
   */
  async refresh(refreshToken: string): Promise<SessionTokens> {
    return toSessionTokens(
      await unauthPost(this.options, "/auth/refresh", {
        refreshToken,
      }),
    );
  }

  /**
   * Successful registration immediately authenticates the user and returns an
   * AuthSession. Tokens are automatically persisted (if storage is enabled).
   *
   * Throws AuthError on invalid data, existing email, etc.
   * @throws AuthError
   */
  static async signUp(
    body: {
      clientId: ClientId;
      email: string;
      password: string;
      csrfToken?: string;
    },
    config?: Partial<Config>,
  ): Promise<AuthSession> {
    return new Am(config).signUp(body);
  }

  /**
   * Successful registration immediately authenticates the user and returns an
   * AuthSession. Tokens are automatically persisted (if storage is enabled).
   *
   * Throws AuthError on invalid data, existing email, etc.
   * @throws AuthError
   */
  async signUp(body: {
    clientId: ClientId;
    email: string;
    password: string;
    csrfToken?: string;
  }): Promise<AuthSession> {
    const initial = handleAuthenticationResponse(
      await unauthPost(this.options, "/auth/sign-up", body),
    );

    return new AuthSession(initial, this.options);
  }

  /**
   * Completes a password reset using the token received via email. On success,
   * the user's password is updated.
   *
   * Throws AuthError on invalid or expired token, weak password, etc.
   * @throws AuthError
   */
  static async resetPassword(
    body: {
      token: string;
      newPassword: string;
    },
    config?: Partial<Config>,
  ): Promise<void> {
    return new Am(config).resetPassword(body);
  }

  /**
   * Completes a password reset using the token received via email. On success,
   * the user's password is updated.
   *
   * Throws AuthError on invalid or expired token, weak password, etc.
   * @throws AuthError
   */
  async resetPassword(body: {
    token: string;
    newPassword: string;
  }): Promise<void> {
    return unauthPost(this.options, "/auth/reset-password", body);
  }

  /**
   * Sends a magic link email to the specified address. A magic link allows
   * passwordless authentication.
   *
   * Throws AuthError on invalid email format, etc.
   * @throws AuthError
   */
  static async sendMagicLink(
    body: {
      clientId: ClientId;
      email: string;
      csrfToken?: string;
    },
    config?: Partial<Config>,
  ): Promise<void> {
    return new Am(config).sendMagicLink(body);
  }

  /**
   * Sends a magic link email to the specified address. A magic link allows
   * passwordless authentication.
   *
   * Throws AuthError on invalid email format, etc.
   * @throws AuthError
   */
  async sendMagicLink(body: {
    clientId: ClientId;
    email: string;
    csrfToken?: string;
  }): Promise<void> {
    return unauthPost(this.options, "/auth/send-magic-link", body);
  }

  /**
   * Sends a password reset email to the specified address.
   *
   * Throws AuthError on invalid email format, etc.
   * @throws AuthError
   */
  static async sendPasswordReset(
    body: {
      clientId: ClientId;
      email: string;
      csrfToken?: string;
    },
    config?: Partial<Config>,
  ): Promise<void> {
    return new Am(config).sendPasswordReset(body);
  }

  /**
   * Sends a password reset email to the specified address.
   *
   * Throws AuthError on invalid email format, etc.
   * @throws AuthError
   */
  async sendPasswordReset(body: {
    clientId: ClientId;
    email: string;
    csrfToken?: string;
  }): Promise<void> {
    return unauthPost(this.options, "/auth/send-password-reset", body);
  }
}
