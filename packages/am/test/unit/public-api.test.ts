/**
 * Interface pinning tests for all public functions.
 * These tests verify that the public API shape remains stable.
 * They mock fetchFn to avoid network calls.
 */
import { describe, it, expect } from "bun:test";
import { Am } from "../../src/auth";
import { AuthError } from "../../src/lib/auth-error";
import type {
  SessionTokens,
  SessionProfile,
  StorageLike,
  ClientId,
  Authentication,
} from "../../src/types";

// ============================================================================
// Test Fixtures
// ============================================================================

function createMockFetch(response: { status: number; body?: unknown }) {
  return async (_input: RequestInfo | URL, _init?: RequestInit) => {
    const headers = new Headers();
    if (response.body) {
      headers.set(
        "Content-Type",
        response.status >= 400 ? "application/problem+json" : "application/json"
      );
    }
    return new Response(
      response.body ? JSON.stringify(response.body) : null,
      { status: response.status, headers }
    );
  };
}

function createValidTokens(): SessionTokens {
  return {
    accessToken: "access_token",
    refreshToken: "refresh_token",
    tokenType: "Bearer",
    expiresIn: 3600,
    expiresAt: Date.now() + 3600000,
  };
}

function createValidProfile(): SessionProfile {
  return {
    id: "uid_test",
    applicationId: "app_test",
    status: "active",
    identity: null,
    credentials: [],
    memberships: [],
    activeMembership: null,
    lastUpdatedAt: Date.now(),
  };
}

function createValidAuthentication(): Authentication {
  return {
    tokens: createValidTokens(),
    profile: createValidProfile(),
  };
}

function createMockStorage(): StorageLike {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
  };
}

function createEventLog(am: Am) {
  const tokensUpdated: SessionTokens[] = [];
  const profileUpdated: SessionProfile[] = [];
  const authLost: AuthError[] = [];
  let reloadRequiredCount = 0;

  am.on("tokensUpdated", (tokens) => {
    tokensUpdated.push(tokens);
  });
  am.on("profileUpdated", (profile) => {
    profileUpdated.push(profile);
  });
  am.on("authLost", (error) => {
    authLost.push(error);
  });
  am.on("reloadRequired", () => {
    reloadRequiredCount += 1;
  });

  return {
    tokensUpdated,
    profileUpdated,
    authLost,
    get reloadRequiredCount() {
      return reloadRequiredCount;
    },
  };
}

type Session = ReturnType<Am["createSession"]>;

// ============================================================================
// AuthError
// ============================================================================

describe("AuthError", () => {
  it("constructs with ProblemDetails", () => {
    const error = new AuthError({
      type: "https://example.com/errors/test",
      title: "Test Error",
      status: 400,
    });
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AuthError);
  });

  it("exposes type getter", () => {
    const error = new AuthError({ type: "test-type", title: "Title", status: 400 });
    expect(error.type).toBe("test-type");
  });

  it("exposes title getter", () => {
    const error = new AuthError({ type: "t", title: "Test Title", status: 400 });
    expect(error.title).toBe("Test Title");
  });

  it("exposes status getter", () => {
    const error = new AuthError({ type: "t", title: "T", status: 401 });
    expect(error.status).toBe(401);
  });

  it("exposes code getter", () => {
    const error = new AuthError({ type: "t", title: "T", status: 400, code: "ERR_CODE" });
    expect(error.code).toBe("ERR_CODE");
  });

  it("exposes detail getter", () => {
    const error = new AuthError({ type: "t", title: "T", status: 400, detail: "Details here" });
    expect(error.detail).toBe("Details here");
  });

  it("exposes invalidParams getter", () => {
    const params = [{ in: "body" as const, path: "email", type: "required", received: null }];
    const error = new AuthError({ type: "t", title: "T", status: 400, invalidParams: params });
    expect(error.invalidParams).toEqual(params);
  });

  it("exposes frozen problem object", () => {
    const error = new AuthError({ type: "t", title: "T", status: 400 });
    expect(error.problem).toBeDefined();
    expect(Object.isFrozen(error.problem)).toBe(true);
  });

  it("uses title as error message", () => {
    const error = new AuthError({ type: "t", title: "Error Message", status: 400 });
    expect(error.message).toBe("Error Message");
  });
});

// ============================================================================
// Am
// ============================================================================

describe("Am", () => {
  describe("constructor", () => {
    it("accepts empty config", () => {
      const am = new Am();
      expect(am).toBeInstanceOf(Am);
    });

    it("accepts partial config", () => {
      const am = new Am({
        baseUrl: "https://custom.example.com",
        storage: null,
      });
      expect(am).toBeInstanceOf(Am);
    });

    it("accepts fetchFn in config", () => {
      const am = new Am({ fetchFn: createMockFetch({ status: 200 }) });
      expect(am).toBeInstanceOf(Am);
    });
  });

  describe("session getter", () => {
    it("returns null when no session exists", () => {
      const am = new Am();
      expect(am.session).toBeNull();
    });

    it("returns a session after createSession", () => {
      const am = new Am();
      const session = am.createSession(createValidAuthentication());
      expect(am.session).toBe(session);
    });
  });

  describe("createSession", () => {
    it("accepts Authentication and returns an operable session", () => {
      const am = new Am();
      const session = am.createSession(createValidAuthentication());
      expect(typeof session.fetch).toBe("function");
      expect(typeof session.refresh).toBe("function");
    });

    it("returned session has tokens", () => {
      const am = new Am();
      const auth = createValidAuthentication();
      const session = am.createSession(auth);
      expect(session.tokens.accessToken).toBe(auth.tokens.accessToken);
    });

    it("returned session has profile", () => {
      const am = new Am();
      const auth = createValidAuthentication();
      const session = am.createSession(auth);
      expect(session.profile.id).toBe(auth.profile.id);
    });
  });

  describe("restoreSession", () => {
    it("returns null when storage is not configured", () => {
      const am = new Am({ storage: null });
      expect(am.restoreSession()).toBeNull();
    });

    it("returns null when storage is empty", () => {
      const am = new Am({ storage: createMockStorage() });
      expect(am.restoreSession()).toBeNull();
    });

    it("returns a session when valid data exists in storage", () => {
      const storage = createMockStorage();
      storage.setItem("am_tokens", JSON.stringify(createValidTokens()));
      storage.setItem("am_profile", JSON.stringify(createValidProfile()));

      const am = new Am({ storage });
      const session = am.restoreSession();
      expect(session).not.toBeNull();
      expect(typeof session?.fetch).toBe("function");
    });
  });

  describe("on", () => {
    it("returns unsubscribe function", () => {
      const am = new Am();
      const unsubscribe = am.on("signedIn", () => {});
      expect(typeof unsubscribe).toBe("function");
    });

    it("accepts signedIn event", () => {
      const am = new Am();
      const unsub = am.on("signedIn", (_session) => {});
      unsub();
    });

    it("accepts tokensUpdated event", () => {
      const am = new Am();
      const unsub = am.on("tokensUpdated", (_tokens) => {});
      unsub();
    });

    it("accepts profileUpdated event", () => {
      const am = new Am();
      const unsub = am.on("profileUpdated", (_profile) => {});
      unsub();
    });

    it("accepts authLost event", () => {
      const am = new Am();
      const unsub = am.on("authLost", (_error) => {});
      unsub();
    });

    it("accepts reloadRequired event", () => {
      const am = new Am();
      const unsub = am.on("reloadRequired", () => {});
      unsub();
    });
  });

  describe("signIn", () => {
    it("accepts clientId, email, password and returns a session promise", async () => {
      const am = new Am({
        fetchFn: createMockFetch({
          status: 200,
          body: {
            tokens: {
              access_token: "at",
              refresh_token: "rt",
              token_type: "Bearer",
              expires_in: 3600,
            },
            profile: {
              id: "uid_1",
              application_id: "app_1",
              status: "active",
              identity: null,
              credentials: [],
              memberships: [],
              active_membership: null,
            },
          },
        }),
      });

      const session = await am.signIn({
        clientId: "cid_test" as ClientId,
        email: "test@example.com",
        password: "password123",
      });

      expect(typeof session.fetch).toBe("function");
    });

    it("accepts optional csrfToken", async () => {
      const am = new Am({
        fetchFn: createMockFetch({
          status: 200,
          body: {
            tokens: { access_token: "at", refresh_token: "rt", token_type: "Bearer", expires_in: 3600 },
            profile: { id: "uid_1", application_id: "app_1", status: "active", identity: null, credentials: [], memberships: [], active_membership: null },
          },
        }),
      });

      const session = await am.signIn({
        clientId: "cid_test" as ClientId,
        email: "test@example.com",
        password: "password123",
        csrfToken: "csrf_token",
      });

      expect(typeof session.refresh).toBe("function");
    });

    it("throws AuthError on failure", async () => {
      const am = new Am({
        fetchFn: createMockFetch({
          status: 401,
          body: { type: "about:blank", title: "Unauthorized", status: 401 },
        }),
      });

      await expect(
        am.signIn({ clientId: "cid_test" as ClientId, email: "a@b.com", password: "wrong" })
      ).rejects.toBeInstanceOf(AuthError);
    });
  });

  describe("signUp", () => {
    it("accepts clientId, email, password and returns a session promise", async () => {
      const am = new Am({
        fetchFn: createMockFetch({
          status: 200,
          body: {
            tokens: { access_token: "at", refresh_token: "rt", token_type: "Bearer", expires_in: 3600 },
            profile: { id: "uid_1", application_id: "app_1", status: "active", identity: null, credentials: [], memberships: [], active_membership: null },
          },
        }),
      });

      const session = await am.signUp({
        clientId: "cid_test" as ClientId,
        email: "new@example.com",
        password: "password123",
      });

      expect(typeof session.fetch).toBe("function");
    });
  });

  describe("signInWithToken", () => {
    it("accepts token string and returns a session promise", async () => {
      const am = new Am({
        fetchFn: createMockFetch({
          status: 200,
          body: {
            tokens: { access_token: "at", refresh_token: "rt", token_type: "Bearer", expires_in: 3600 },
            profile: { id: "uid_1", application_id: "app_1", status: "active", identity: null, credentials: [], memberships: [], active_membership: null },
          },
        }),
      });

      const session = await am.signInWithToken("magic_link_token");
      expect(typeof session.fetch).toBe("function");
    });
  });

  describe("acceptInvite", () => {
    it("accepts clientId and token, returns a session promise", async () => {
      const am = new Am({
        fetchFn: createMockFetch({
          status: 200,
          body: {
            tokens: { access_token: "at", refresh_token: "rt", token_type: "Bearer", expires_in: 3600 },
            profile: { id: "uid_1", application_id: "app_1", status: "active", identity: null, credentials: [], memberships: [], active_membership: null },
          },
        }),
      });

      const session = await am.acceptInvite({
        clientId: "cid_test" as ClientId,
        token: "invite_token",
      });

      expect(typeof session.fetch).toBe("function");
    });
  });

  describe("checkEmail", () => {
    it("accepts clientId and email, returns status and methods", async () => {
      const am = new Am({
        fetchFn: createMockFetch({
          status: 200,
          body: {
            status: "active",
            preferred: ["email_password"],
            available: ["email_password", "magic_link"],
          },
        }),
      });

      const result = await am.checkEmail({
        clientId: "cid_test" as ClientId,
        email: "test@example.com",
      });

      expect(result.status).toBe("active");
      expect(Array.isArray(result.preferred)).toBe(true);
      expect(Array.isArray(result.available)).toBe(true);
    });
  });

  describe("csrfSession", () => {
    it("returns Promise with csrfToken", async () => {
      const am = new Am({
        fetchFn: createMockFetch({
          status: 200,
          body: { csrf_token: "session_csrf_token" },
        }),
      });

      const result = await am.csrfSession();
      expect(result.csrfToken).toBe("session_csrf_token");
    });
  });

  describe("csrfToken", () => {
    it("returns Promise with csrfToken", async () => {
      const am = new Am({
        fetchFn: createMockFetch({
          status: 200,
          body: { csrf_token: "signed_csrf_token" },
        }),
      });

      const result = await am.csrfToken();
      expect(result.csrfToken).toBe("signed_csrf_token");
    });
  });

  describe("resetPassword", () => {
    it("accepts token and newPassword, returns Promise<void>", async () => {
      const am = new Am({
        fetchFn: createMockFetch({ status: 204 }),
      });

      const result = await am.resetPassword({
        token: "reset_token",
        newPassword: "new_password",
      });

      expect(result).toBeUndefined();
    });
  });

  describe("sendMagicLink", () => {
    it("accepts clientId and email, returns Promise<void>", async () => {
      const am = new Am({
        fetchFn: createMockFetch({ status: 204 }),
      });

      const result = await am.sendMagicLink({
        clientId: "cid_test" as ClientId,
        email: "test@example.com",
      });

      expect(result).toBeUndefined();
    });
  });

  describe("sendPasswordReset", () => {
    it("accepts clientId and email, returns Promise<void>", async () => {
      const am = new Am({
        fetchFn: createMockFetch({ status: 204 }),
      });

      const result = await am.sendPasswordReset({
        clientId: "cid_test" as ClientId,
        email: "test@example.com",
      });

      expect(result).toBeUndefined();
    });
  });
});

// ============================================================================
// Session values returned by Am
// ============================================================================

describe("session values returned by Am", () => {
  function createSession(config: ConstructorParameters<typeof Am>[0] = {}): Session {
    const am = new Am(config);
    return am.createSession(createValidAuthentication());
  }

  describe("tokens getter", () => {
    it("returns SessionTokens", () => {
      const auth = createValidAuthentication();
      const am = new Am();
      const session = am.createSession(auth);
      expect(session.tokens.accessToken).toBe(auth.tokens.accessToken);
      expect(session.tokens.refreshToken).toBe(auth.tokens.refreshToken);
      expect(session.tokens.tokenType).toBe("Bearer");
      expect(typeof session.tokens.expiresIn).toBe("number");
      expect(typeof session.tokens.expiresAt).toBe("number");
    });
  });

  describe("profile getter", () => {
    it("returns SessionProfile", () => {
      const auth = createValidAuthentication();
      const am = new Am();
      const session = am.createSession(auth);
      expect(session.profile.id).toBe(auth.profile.id);
      expect(session.profile.applicationId).toBe(auth.profile.applicationId);
      expect(session.profile.status).toBe(auth.profile.status);
    });
  });

  describe("toJSON", () => {
    it("returns Authentication object", () => {
      const auth = createValidAuthentication();
      const am = new Am();
      const session = am.createSession(auth);
      const json = session.toJSON();
      expect(json.tokens).toBeDefined();
      expect(json.profile).toBeDefined();
      expect(json.tokens.accessToken).toBe(auth.tokens.accessToken);
      expect(json.profile.id).toBe(auth.profile.id);
    });
  });

  describe("isExpired", () => {
    it("returns false for valid tokens", () => {
      const session = createSession();
      expect(session.isExpired()).toBe(false);
    });

    it("returns true for expired tokens", () => {
      const auth = createValidAuthentication();
      auth.tokens.expiresAt = Date.now() - 10000;
      const am = new Am();
      const session = am.createSession(auth);
      expect(session.isExpired()).toBe(true);
    });
  });

  describe("clear", () => {
    it("is a function that returns void", () => {
      const am = new Am();
      const session = am.createSession(createValidAuthentication());
      const result = session.clear();
      expect(result).toBeUndefined();
    });
  });

  describe("fetch", () => {
    it("accepts url and returns Promise<Response>", async () => {
      const am = new Am({
        fetchFn: createMockFetch({ status: 200, body: { data: "test" } }),
      });
      const session = am.createSession(createValidAuthentication());

      const response = await session.fetch("https://api.example.com/resource");
      expect(response).toBeInstanceOf(Response);
      expect(response.status).toBe(200);
    });

    it("accepts optional RequestInit", async () => {
      const am = new Am({
        fetchFn: createMockFetch({ status: 200 }),
      });
      const session = am.createSession(createValidAuthentication());

      const response = await session.fetch("https://api.example.com/resource", {
        method: "POST",
        headers: { "X-Custom": "header" },
      });

      expect(response.status).toBe(200);
    });
  });

  describe("refresh", () => {
    it("returns Promise<void>", async () => {
      const am = new Am({
        fetchFn: createMockFetch({
          status: 200,
          body: {
            access_token: "new_at",
            refresh_token: "new_rt",
            token_type: "Bearer",
            expires_in: 3600,
          },
        }),
      });
      const session = am.createSession(createValidAuthentication());

      const result = await session.refresh();
      expect(result).toBeUndefined();
    });

    it("updates tokens after successful refresh", async () => {
      const am = new Am({
        fetchFn: createMockFetch({
          status: 200,
          body: {
            access_token: "new_access_token",
            refresh_token: "new_refresh_token",
            token_type: "Bearer",
            expires_in: 3600,
          },
        }),
      });
      const session = am.createSession(createValidAuthentication());

      await session.refresh();
      expect(session.tokens.accessToken).toBe("new_access_token");
    });
  });

  describe("refetchProfile", () => {
    it("returns Promise<void>", async () => {
      const am = new Am({
        fetchFn: createMockFetch({
          status: 200,
          body: {
            id: "uid_updated",
            application_id: "app_1",
            status: "active",
            identity: null,
            credentials: [],
            memberships: [],
            active_membership: null,
          },
        }),
      });
      const session = am.createSession(createValidAuthentication());

      const result = await session.refetchProfile();
      expect(result).toBeUndefined();
    });

    it("updates profile after successful fetch", async () => {
      const am = new Am({
        fetchFn: createMockFetch({
          status: 200,
          body: {
            id: "uid_updated",
            application_id: "app_1",
            status: "active",
            identity: { id: "uid_updated", display_name: "New Name", avatar_url: null, external_id: null, given_name: null, family_name: null, preferred_language: null, locale: null, timezone: null },
            credentials: [],
            memberships: [],
            active_membership: null,
          },
        }),
      });
      const session = am.createSession(createValidAuthentication());

      await session.refetchProfile();
      expect(session.profile.identity?.displayName).toBe("New Name");
      expect(session.profile.credentials).toEqual([]);
    });

    it("preserves active membership account context", async () => {
      const am = new Am({
        fetchFn: createMockFetch({
          status: 200,
          body: {
            id: "uid_updated",
            application_id: "app_1",
            status: "active",
            identity: null,
            credentials: [],
            memberships: [],
            active_membership: {
              id: "mbr_2",
              user_id: "uid_updated",
              account_id: "acc_2",
              role: "owner",
              account: {
                id: "acc_2",
                parent_id: "app_1",
                name: "Second Account",
                avatar_url: null,
                status: "active",
                paid_until: null,
              },
            },
          },
        }),
      });
      const session = am.createSession(createValidAuthentication());

      await session.refetchProfile();

      expect(session.profile.activeMembership?.account.id).toBe("acc_2");
      expect(session.profile.activeMembership?.account.name).toBe(
        "Second Account",
      );
    });
  });

  describe("switchAccounts", () => {
    it("replaces tokens and profile in place", async () => {
      let requestUrl = "";
      let requestMethod = "";
      let requestBody = "";
      let authorization = "";
      const am = new Am({
        fetchFn: async (input, init) => {
          requestUrl = String(input);
          requestMethod = init?.method ?? "";
          requestBody = String(init?.body ?? "");
          authorization = new Headers(init?.headers).get("Authorization") ?? "";
          return new Response(
            JSON.stringify({
              tokens: {
                access_token: "switched_access_token",
                refresh_token: "switched_refresh_token",
                token_type: "Bearer",
                expires_in: 7200,
              },
              profile: {
                id: "uid_1",
                application_id: "app_1",
                status: "active",
                credentials: [],
                identity: null,
                memberships: [
                  {
                    id: "mbr_2",
                    user_id: "uid_1",
                    account_id: "acc_2",
                    role: "owner",
                    account: {
                      id: "acc_2",
                      parent_id: "app_1",
                      name: "Second Account",
                      avatar_url: null,
                      status: "active",
                      paid_until: null,
                    },
                  },
                ],
                active_membership: {
                  id: "mbr_2",
                  user_id: "uid_1",
                  account_id: "acc_2",
                  role: "owner",
                  account: {
                    id: "acc_2",
                    parent_id: "app_1",
                    name: "Second Account",
                    avatar_url: null,
                    status: "active",
                    paid_until: null,
                  },
                },
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        },
      });
      const session = am.createSession(createValidAuthentication());

      const result = await session.switchAccounts({ accountId: "acc_2" });

      expect(result).toBeUndefined();
      expect(requestUrl).toBe(
        "https://api.accountmaker.com/auth/switch-accounts",
      );
      expect(requestMethod).toBe("POST");
      expect(authorization).toBe("Bearer access_token");
      expect(requestBody).toBe(JSON.stringify({ account_id: "acc_2" }));
      expect(session.tokens.accessToken).toBe("switched_access_token");
      expect(session.profile.activeMembership?.account.id).toBe("acc_2");
      expect(session.profile.activeMembership?.account.name).toBe("Second Account");
    });

    it("updates storage, emits tokensUpdated/profileUpdated, and then emits reloadRequired", async () => {
      const storage = createMockStorage();
      const am = new Am({
        earlyRefreshMs: 0,
        storage,
        fetchFn: async () =>
          new Response(
            JSON.stringify({
              tokens: {
                access_token: "switched_access_token",
                refresh_token: "switched_refresh_token",
                token_type: "Bearer",
                expires_in: 3600,
              },
              profile: {
                id: "uid_1",
                application_id: "app_1",
                status: "active",
                identity: null,
                credentials: [],
                memberships: [
                  {
                    id: "mbr_2",
                    user_id: "uid_1",
                    account_id: "acc_2",
                    role: "owner",
                    account: {
                      id: "acc_2",
                      parent_id: "app_1",
                      name: "Second Account",
                      avatar_url: null,
                      status: "active",
                      paid_until: null,
                    },
                  },
                ],
                active_membership: {
                  id: "mbr_2",
                  user_id: "uid_1",
                  account_id: "acc_2",
                  role: "owner",
                  account: {
                    id: "acc_2",
                    parent_id: "app_1",
                    name: "Second Account",
                    avatar_url: null,
                    status: "active",
                    paid_until: null,
                  },
                },
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
      });
      const initial = createValidAuthentication();
      initial.tokens.expiresIn = 1;
      initial.tokens.expiresAt = Date.now() + 1000;
      initial.profile.lastUpdatedAt = 0;
      const events = createEventLog(am);
      const session = am.createSession(initial);

      await session.switchAccounts({ accountId: "acc_2" });

      expect(events.tokensUpdated).toHaveLength(1);
      expect(events.profileUpdated).toHaveLength(1);
      expect(events.reloadRequiredCount).toBe(1);
      expect(events.tokensUpdated[0]?.accessToken).toBe("switched_access_token");
      expect(events.profileUpdated[0]?.activeMembership?.account.id).toBe("acc_2");

      const storedTokens = JSON.parse(storage.getItem("am_tokens")!);
      const storedProfile = JSON.parse(storage.getItem("am_profile")!);

      expect(storedTokens.accessToken).toBe("switched_access_token");
      expect(storedProfile.activeMembership.account.id).toBe("acc_2");
    });
  });

  describe("reloadRequired session behavior", () => {
    it("clear emits reloadRequired once and suppresses session maintenance", async () => {
      let fetchCallCount = 0;
      const am = new Am({
        fetchFn: async () => {
          fetchCallCount += 1;
          return new Response(
            JSON.stringify({
              id: "uid_updated",
              application_id: "app_1",
              status: "active",
              identity: null,
              credentials: [],
              memberships: [],
              active_membership: null,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        },
      });
      const events = createEventLog(am);
      const session = am.createSession(createValidAuthentication());

      session.clear();
      session.clear();

      await session.refresh();
      await session.refetchProfile();

      expect(events.reloadRequiredCount).toBe(1);
      expect(fetchCallCount).toBe(0);
    });

    it("does not attempt refresh after a 401 once clear marks reloadRequired", async () => {
      let fetchCallCount = 0;
      const am = new Am({
        fetchFn: async () => {
          fetchCallCount += 1;
          return new Response(
            JSON.stringify({ type: "about:blank", title: "Unauthorized", status: 401 }),
            { status: 401, headers: { "Content-Type": "application/problem+json" } },
          );
        },
      });
      const events = createEventLog(am);
      const session = am.createSession(createValidAuthentication());

      session.clear();
      const response = await session.fetch("https://api.example.com/protected");

      expect(response.status).toBe(401);
      expect(fetchCallCount).toBe(1);
      expect(events.authLost).toHaveLength(0);
      expect(events.reloadRequiredCount).toBe(1);
    });

    it("switchAccounts suppresses refresh and profile refetch after reloadRequired is set", async () => {
      let fetchCallCount = 0;
      const am = new Am({
        fetchFn: async (input) => {
          fetchCallCount += 1;

          if (String(input).endsWith("/auth/switch-accounts")) {
            return new Response(
              JSON.stringify({
                tokens: {
                  access_token: "switched_access_token",
                  refresh_token: "switched_refresh_token",
                  token_type: "Bearer",
                  expires_in: 3600,
                },
                profile: {
                  id: "uid_1",
                  application_id: "app_1",
                  status: "active",
                  identity: null,
                  credentials: [],
                  memberships: [],
                  active_membership: null,
                },
              }),
              { status: 200, headers: { "Content-Type": "application/json" } },
            );
          }

          throw new Error("Unexpected fetch after reloadRequired");
        },
      });
      const events = createEventLog(am);
      const session = am.createSession(createValidAuthentication());

      await session.switchAccounts({ accountId: "acc_2" });
      await session.refresh();
      await session.refetchProfile();

      expect(fetchCallCount).toBe(1);
      expect(events.reloadRequiredCount).toBe(1);
    });
  });

  describe("sendVerificationEmail", () => {
    it("returns Promise<void>", async () => {
      const am = new Am({
        fetchFn: createMockFetch({ status: 204 }),
      });
      const session = am.createSession(createValidAuthentication());

      const result = await session.sendVerificationEmail();
      expect(result).toBeUndefined();
    });
  });
});
