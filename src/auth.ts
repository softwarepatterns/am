import type {
  AuthenticationResponse,
  AuthenticationResult,
  ClientId,
  EmailCheckStatus,
  LoginMethod,
  ProblemDetails,
  SessionProfile,
  SessionTokens,
  ResponseTokens,
  UserId,
  UserResource,
  StorageLike,
} from "./types";

const MINUTE_MS = 60 * 1000;
const STATE = Symbol("state");

type FetchFn = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

type Config = {
  fetchFn: FetchFn;
  baseUrl: string;
  earlyRefreshMs: number;
  onRefresh?: (tokens: SessionTokens) => void | Promise<void>;
  onUnauthenticated?: () => void | Promise<void>;
  storage?: StorageLike | "localStorage" | null;
  storageKey?: string;
};

type State = {
  tokens: SessionTokens;
  config: Config;
  refreshPromise: Promise<void> | null;
  cleared: boolean;
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

function readTokens(state: State): SessionTokens | null {
  const storage =
    state.config.storage === "localStorage"
      ? getBrowserLocalStorage()
      : (state.config.storage ?? null);

  if (!storage) return null;

  try {
    const key = state.config.storageKey || "am_tokens";
    const raw = storage.getItem(key);
    return raw ? (JSON.parse(raw) as SessionTokens) : null;
  } catch {
    return null;
  }
}

function persistTokens(state: State) {
  const storageOpt = state.config.storage;
  if (!storageOpt) return;

  const storage =
    storageOpt === "localStorage" ? getBrowserLocalStorage() : storageOpt;

  if (!storage) return;

  try {
    const key = state.config.storageKey || "am_tokens";
    storage.setItem(key, JSON.stringify(state.tokens));
  } catch {
    // ignore
  }
}

function persistTokensIfNewer(state: State) {
  if (!state.config.storage) return;

  const existing = readTokens(state);
  if (existing && existing.expiresAt >= state.tokens.expiresAt) return;

  try {
    persistTokens(state);
  } catch {
    // swallow storage failures
  }
}

function clearPersistedTokens(state: State) {
  const storageOpt = state.config.storage;
  if (!storageOpt) return;

  const storage =
    storageOpt === "localStorage" ? getBrowserLocalStorage() : storageOpt;

  if (!storage) return;

  try {
    storage.removeItem(state.config.storageKey || "am_tokens");
  } catch {}
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

function toGenericProblem(res: Response, detail?: string): ProblemDetails {
  return {
    type: "about:blank",
    title: res.statusText || "Request failed",
    status: res.status,
    detail,
  };
}

const handleResponse = async (res: Response) => {
  if (res.status === 204) {
    return;
  }

  const raw = await readJsonSafe(res);
  const json = camelCaseObj(raw);

  if (!res.ok) {
    if (isProblemJson(res) && json && typeof json === "object") {
      throw new AuthError(json as ProblemDetails);
    }
    throw new AuthError(
      toGenericProblem(res, typeof raw === "string" ? raw : undefined),
    );
  }

  return json;
};

/**
 * Unauthenticated GET request.
 */
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

/**
 * Unauthenticated POST request
 */
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
  const res = await authFetch(state, url, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });
  return handleResponse(res);
};

/**
 * Authenticated POST request
 *
 * The access token is included in the Authorization header. The clientId is not
 * included in the body since the access token already identifies the client.
 */
const authPost = async (
  state: State,
  path: string,
  body: Record<string, unknown>,
) => {
  const baseUrl = state.config.baseUrl;
  const res = await authFetch(state, `${baseUrl}${path}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(snakeCaseObj(body)),
  });

  return handleResponse(res);
};

const authFetch = (
  state: State,
  url: string | URL,
  init: RequestInit = {},
): Promise<Response> => {
  return state.config.fetchFn(url, {
    ...init,
    headers: {
      ...(init.headers || {}),
      Authorization: `Bearer ${state.tokens.accessToken}`,
    },
  });
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

  const json = await handleResponse(res);
  state.tokens = toSessionTokens(json);
  persistTokens(state);
  await state.config.onRefresh?.(state.tokens);
}

const toSessionTokens = (tokens: ResponseTokens): SessionTokens => {
  return {
    ...tokens,
    expiresAt: Date.now() + tokens.expiresIn * 1000,
  };
};

const handleAuthenticationResponse = (
  json: AuthenticationResponse,
): AuthenticationResult => {
  return {
    tokens: toSessionTokens(json.tokens),
    profile: json.profile,
  };
};

export class AuthSession {
  // private tokens: SessionTokens;
  // private config: Config;
  // private lastUpdated: Date;
  // private refreshPromise: Promise<void> | null = null;

  constructor(tokens: SessionTokens, config: Partial<Config>) {
    setState(this, {
      tokens,
      config: {
        ...defaultConfig,
        ...config,
      } as Config,
      refreshPromise: null,
      cleared: false,
    });

    persistTokensIfNewer(getState(this));
  }

  static restoreSession(config: Partial<Config> = {}): AuthSession | null {
    const merged = { ...defaultConfig, ...config } as Config;

    const storage =
      merged.storage === "localStorage"
        ? getBrowserLocalStorage()
        : (merged.storage ?? null);

    if (!storage) return null;

    try {
      const key = merged.storageKey || "am_tokens";
      const raw = storage.getItem(key);
      if (!raw) return null;
      const tokens = JSON.parse(raw) as SessionTokens;
      if (!tokens?.accessToken || !tokens?.refreshToken || !tokens?.expiresAt)
        return null;
      return new AuthSession(tokens, merged);
    } catch {
      return null;
    }
  }

  clear(): void {
    const state = getState(this);
    clearPersistedTokens(state);
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

  toJSON(): SessionTokens {
    return { ...getState(this).tokens };
  }

  static fromJSON(tokens: SessionTokens, config: Partial<Config>): AuthSession {
    return new AuthSession(tokens, config);
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
    if (this.isExpired()) {
      await this.refresh();
    }

    const state = getState(this);

    let res = await authFetch(state, url, init);
    if (res.status !== 401) return res;

    await this.refresh();

    res = await authFetch(state, url, init);
    if (res.status !== 401) return res;

    await state.config.onUnauthenticated?.();
    return res;
  }

  async refresh(): Promise<void> {
    const state = getState(this);
    if (state.cleared) {
      // silently do nothing
      return;
    }

    if (!state.refreshPromise) {
      state.refreshPromise = doRefresh(state);
    }

    try {
      await state.refreshPromise;
    } finally {
      state.refreshPromise = null;
    }
  }

  async sendVerificationEmail(): Promise<void> {
    await authPost(getState(this), "/auth/send-verification-email", {});
  }

  async me(): Promise<SessionProfile> {
    return await authGet(getState(this), "/auth/me", {});
  }

  async user(id: UserId): Promise<UserResource> {
    return await authGet(getState(this), `/auth/user/${id}`, {});
  }
}

export class Am {
  private options: Config;

  constructor(config?: Partial<Config>) {
    this.options = { ...defaultConfig, ...config } as Config;
  }

  static createAuthSession(
    tokens: SessionTokens,
    config?: Partial<Config>,
  ): AuthSession {
    return new Am(config).createAuthSession(tokens);
  }

  createAuthSession(tokens: SessionTokens): AuthSession {
    return new AuthSession(tokens, this.options);
  }

  static async acceptInvite(
    query: {
      clientId: ClientId;
      token: string;
    },
    config?: Partial<Config>,
  ) {
    return new Am(config).acceptInvite(query);
  }

  async acceptInvite(query: {
    clientId: ClientId;
    token: string;
  }): Promise<AuthenticationResult> {
    return await unauthGet(this.options, "/auth/accept-invite", query);
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

  static async login(
    body: {
      email: string;
      password: string;
      csrfToken?: string;
    },
    config?: Partial<Config>,
  ): Promise<AuthenticationResult> {
    return new Am(config).login(body);
  }

  async login(body: {
    email: string;
    password: string;
    csrfToken?: string;
  }): Promise<AuthenticationResult> {
    return handleAuthenticationResponse(
      await unauthPost(this.options, "/auth/login", body),
    );
  }

  static async tokenLogin(
    token: string,
    config?: Partial<Config>,
  ): Promise<AuthenticationResult> {
    return new Am(config).tokenLogin(token);
  }

  async tokenLogin(token: string): Promise<AuthenticationResult> {
    const options = this.options;
    return handleAuthenticationResponse(
      await unauthGet(options, "/auth/token-login", {
        token,
      }),
    );
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
  ): Promise<AuthenticationResult> {
    return new Am(config).register(body);
  }

  async register(body: {
    email: string;
    password: string;
    csrfToken?: string;
  }): Promise<AuthenticationResult> {
    return handleAuthenticationResponse(
      await unauthPost(this.options, "/auth/register", body),
    );
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
