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

  clear(): void {
    const state = getState(this);
    clearAuth(state.config);
    state.cleared = true;
  }

  get accessToken(): string {
    return getState(this).tokens.accessToken;
  }
  get refreshToken(): string {
    return getState(this).tokens.refreshToken;
  }
  get idToken(): string | undefined {
    return getState(this).tokens.idToken;
  }
  get tokenType(): "Bearer" {
    return getState(this).tokens.tokenType;
  }
  get expiresIn(): number {
    return getState(this).tokens.expiresIn;
  }
  get expiresAt(): Date {
    return new Date(getState(this).tokens.expiresAt);
  }
  get profile(): SessionProfile | null {
    return getState(this).profile;
  }

  toJSON(): Authentication {
    const state = getState(this);
    return { tokens: state.tokens, profile: state.profile };
  }

  static fromJSON(
    initial: Authentication,
    config: Partial<Config>,
  ): AuthSession {
    return new AuthSession(initial, config);
  }

  isExpired(): boolean {
    const early = Math.min(
      Math.max(getState(this).config.earlyRefreshMs, 0),
      5 * MINUTE_MS,
    );
    return Date.now() >= this.expiresAt.getTime() - early;
  }

  /**
   * Fetch with automatic token refresh.
   *
   * If the access token is expired, it will be refreshed before making the request. The
   * Authorization header will be set with the current access token.
   */
  async fetch(url: string | URL, init: RequestInit = {}) {
    return authFetchWithRefresh(getState(this), url, init);
  }

  async refresh(): Promise<void> {
    return refresh(getState(this));
  }

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

  async sendVerificationEmail(): Promise<void> {
    await authPost(getState(this), "/auth/send-verification-email", {});
  }

  async user(id: UserId): Promise<UserResource> {
    return authGet(getState(this), `/auth/user/${id}`, {});
  }
}

export class Am {
  private options: Config;

  constructor(config?: Partial<Config>) {
    this.options = { ...defaultConfig, ...config } as Config;
  }

  static createAuthSession(
    initial: Authentication,
    config?: Partial<Config>,
  ): AuthSession {
    return new Am(config).createAuthSession(initial);
  }

  createAuthSession(initial: Authentication): AuthSession {
    return new AuthSession(initial, this.options);
  }

  static async acceptInvite(
    query: {
      clientId: ClientId;
      token: string;
    },
    config?: Partial<Config>,
  ): Promise<AuthSession> {
    return new Am(config).acceptInvite(query);
  }

  async acceptInvite(query: {
    clientId: ClientId;
    token: string;
  }): Promise<AuthSession> {
    const initial = handleAuthenticationResponse(
      await unauthGet(this.options, "/auth/accept-invite", query),
    );
    return new AuthSession(initial, this.options);
  }

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

  static async csrfSession(
    config?: Partial<Config>,
  ): Promise<{ csrfToken: string }> {
    return new Am(config).csrfSession();
  }

  async csrfSession(): Promise<{ csrfToken: string }> {
    return unauthGet(this.options, "/auth/csrf-session");
  }

  static async csrfToken(
    config?: Partial<Config>,
  ): Promise<{ csrfToken: string }> {
    return new Am(config).csrfToken();
  }

  async csrfToken(): Promise<{ csrfToken: string }> {
    return unauthGet(this.options, "/auth/csrf-token");
  }

  static async signIn(
    body: {
      email: string;
      password: string;
      csrfToken?: string;
    },
    config?: Partial<Config>,
  ): Promise<AuthSession> {
    return new Am(config).signIn(body);
  }

  async signIn(body: {
    email: string;
    password: string;
    csrfToken?: string;
  }): Promise<AuthSession> {
    const initial = handleAuthenticationResponse(
      await unauthPost(this.options, "/auth/login", body),
    );

    return new AuthSession(initial, this.options);
  }

  static async signInWithToken(
    token: string,
    config?: Partial<Config>,
  ): Promise<AuthSession> {
    return new Am(config).tokenLogin(token);
  }

  async tokenLogin(token: string): Promise<AuthSession> {
    const options = this.options;
    const initial = handleAuthenticationResponse(
      await unauthGet(options, "/auth/token-login", {
        token,
      }),
    );

    return new AuthSession(initial, options);
  }

  static async refresh(
    refreshToken: string,
    config?: Partial<Config>,
  ): Promise<SessionTokens> {
    return new Am(config).refresh(refreshToken);
  }

  async refresh(refreshToken: string): Promise<SessionTokens> {
    return toSessionTokens(
      await unauthPost(this.options, "/auth/refresh", {
        refreshToken,
      }),
    );
  }

  static async register(
    body: {
      email: string;
      password: string;
      csrfToken?: string;
    },
    config?: Partial<Config>,
  ): Promise<AuthSession> {
    return new Am(config).register(body);
  }

  async register(body: {
    email: string;
    password: string;
    csrfToken?: string;
  }): Promise<AuthSession> {
    const initial = handleAuthenticationResponse(
      await unauthPost(this.options, "/auth/register", body),
    );

    return new AuthSession(initial, this.options);
  }

  static async resetPassword(
    body: {
      token: string;
      newPassword: string;
    },
    config?: Partial<Config>,
  ): Promise<void> {
    return new Am(config).resetPassword(body);
  }

  async resetPassword(body: {
    token: string;
    newPassword: string;
  }): Promise<void> {
    return unauthPost(this.options, "/auth/reset-password", body);
  }

  static async sendMagicLink(
    body: {
      email: string;
      csrfToken?: string;
    },
    config?: Partial<Config>,
  ): Promise<void> {
    return new Am(config).sendMagicLink(body);
  }

  async sendMagicLink(body: {
    email: string;
    csrfToken?: string;
  }): Promise<void> {
    return unauthPost(this.options, "/auth/send-magic-link", body);
  }

  static async sendPasswordReset(
    body: {
      email: string;
      csrfToken?: string;
    },
    config?: Partial<Config>,
  ): Promise<void> {
    return new Am(config).sendPasswordReset(body);
  }

  async sendPasswordReset(body: {
    email: string;
    csrfToken?: string;
  }): Promise<void> {
    return unauthPost(this.options, "/auth/send-password-reset", body);
  }
}
