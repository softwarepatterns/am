import type {
  AuthenticationResult,
  ClientId,
  EmailCheckStatus,
  LoginMethod,
  ProblemDetails,
  SessionProfile,
  SessionTokens,
  UserId,
  UserResource,
} from "./types";

const MINUTE_MS = 60 * 1000;

type FetchFn = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

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

type Config = {
  fetchFn: FetchFn;
  baseUrl: string;
};

function defaultFetchFn(): FetchFn {
  const f = (globalThis as any).fetch as FetchFn | undefined;
  if (typeof f === "function") return f;

  return async () => {
    throw new Error(
      "Missing fetch implementation. Provide config.fetchFn or use a runtime with global fetch.",
    );
  };
}

const defaultConfig = {
  fetchFn: defaultFetchFn(),
  baseUrl: "https://api.accountmaker.com",
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
      "Content-Type": "application/json",
    },
    body: JSON.stringify(snakeCaseObj(body)),
  });
  return handleResponse(res);
};

const authGet = async (
  { accessToken }: AuthSession,
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
      Authorization: `Bearer ${accessToken}`,
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
  { accessToken }: AuthSession,
  { fetchFn, baseUrl }: Config,
  path: string,
  body: Record<string, unknown>,
) => {
  const res = await fetchFn(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(snakeCaseObj(body)),
  });

  return handleResponse(res);
};

export class AuthSession {
  private tokens: SessionTokens;
  private config: Config;
  private lastUpdated: Date;

  constructor(tokens: SessionTokens, config: Partial<Config>) {
    this.tokens = tokens;
    this.config = {
      ...defaultConfig,
      ...config,
    } as Config;
    this.lastUpdated = new Date();
  }

  get accessToken(): string {
    return this.tokens.accessToken;
  }
  get refreshToken(): string {
    return this.tokens.refreshToken;
  }
  get idToken(): string | undefined {
    return this.tokens.idToken;
  }
  get tokenType(): "Bearer" {
    return this.tokens.tokenType;
  }
  get expiresIn(): number {
    return this.tokens.expiresIn;
  }
  get lastUpdatedAt(): Date {
    return this.lastUpdated;
  }
  get expiresAt(): Date {
    return new Date(this.lastUpdated.getTime() + this.expiresIn * 1000);
  }

  isExpired(): boolean {
    return Date.now() >= this.expiresAt.getTime() - MINUTE_MS; // 1 minute early
  }

  /**
   * Fetch with automatic token refresh.
   *
   * If the access token is expired, it will be refreshed before making the request. The
   * Authorization header will be set with the current access token.
   */
  async fetch(url: string | URL | Request, init: RequestInit = {}) {
    const { fetchFn } = this.config;

    // if expired, refresh
    if (this.isExpired()) {
      await this.refresh();
    }

    return await fetchFn(url, {
      ...init,
      headers: {
        ...(init.headers || {}),
        Authorization: `Bearer ${this.tokens.accessToken}`,
      },
    });
  }

  async refresh(): Promise<void> {
    const { fetchFn, baseUrl } = this.config;
    const res = await fetchFn(`${baseUrl}/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        snakeCaseObj({ refreshToken: this.tokens.refreshToken }),
      ),
    });
    const json = await handleResponse(res);
    this.tokens = json as SessionTokens;
    this.lastUpdated = new Date();
  }

  async sendVerificationEmail(): Promise<void> {
    await authPost(this, this.config, "/auth/send-verification-email", {});
  }

  async me(): Promise<SessionProfile> {
    return await authGet(this, this.config, "/auth/me", {});
  }

  async user(id: UserId): Promise<UserResource> {
    return await authGet(this, this.config, `/auth/user/${id}`, {});
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
    return await unauthPost(this.options, "/auth/login", body);
  }

  static async tokenLogin(
    token: string,
    config?: Partial<Config>,
  ): Promise<AuthenticationResult> {
    return new Am(config).tokenLogin(token);
  }

  async tokenLogin(token: string): Promise<AuthenticationResult> {
    const options = this.options;
    return await unauthGet(options, "/auth/token-login", {
      token,
    });
  }

  static async refresh(
    refreshToken: string,
    config?: Partial<Config>,
  ): Promise<SessionTokens> {
    return new Am(config).refresh(refreshToken);
  }

  async refresh(refreshToken: string): Promise<SessionTokens> {
    return await unauthPost(this.options, "/auth/refresh", {
      refreshToken,
    });
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
    return await unauthPost(this.options, "/auth/register", body);
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
