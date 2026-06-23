/**
 * Interface pinning tests for all public functions.
 * These tests verify that the public API shape remains stable.
 * They mock fetchFn to avoid network calls.
 */
import { describe, it, expect } from "bun:test";
import { Am, AuthSession } from "../../src/auth";
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

    it("returns AuthSession after createSession", () => {
      const am = new Am();
      const session = am.createSession(createValidAuthentication());
      expect(am.session).toBe(session);
    });
  });

  describe("createSession", () => {
    it("accepts Authentication and returns AuthSession", () => {
      const am = new Am();
      const session = am.createSession(createValidAuthentication());
      expect(session).toBeInstanceOf(AuthSession);
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

    it("returns AuthSession when valid data exists in storage", () => {
      const storage = createMockStorage();
      storage.setItem("am_tokens", JSON.stringify(createValidTokens()));
      storage.setItem("am_profile", JSON.stringify(createValidProfile()));

      const am = new Am({ storage });
      const session = am.restoreSession();
      expect(session).toBeInstanceOf(AuthSession);
    });
  });

  describe("on", () => {
    it("returns unsubscribe function", () => {
      const am = new Am();
      const unsubscribe = am.on("sessionChange", () => {});
      expect(typeof unsubscribe).toBe("function");
    });

    it("accepts sessionChange event", () => {
      const am = new Am();
      const unsub = am.on("sessionChange", (_session) => {});
      unsub();
    });

    it("accepts refresh event", () => {
      const am = new Am();
      const unsub = am.on("refresh", (_tokens) => {});
      unsub();
    });

    it("accepts profileChange event", () => {
      const am = new Am();
      const unsub = am.on("profileChange", (_profile) => {});
      unsub();
    });

    it("accepts unauthenticated event", () => {
      const am = new Am();
      const unsub = am.on("unauthenticated", (_error) => {});
      unsub();
    });
  });

  describe("signIn", () => {
    it("accepts clientId, email, password and returns Promise<AuthSession>", async () => {
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

      expect(session).toBeInstanceOf(AuthSession);
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

      expect(session).toBeInstanceOf(AuthSession);
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
    it("accepts clientId, email, password and returns Promise<AuthSession>", async () => {
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

      expect(session).toBeInstanceOf(AuthSession);
    });
  });

  describe("signInWithToken", () => {
    it("accepts token string and returns Promise<AuthSession>", async () => {
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
      expect(session).toBeInstanceOf(AuthSession);
    });
  });

  describe("acceptInvite", () => {
    it("accepts clientId and token, returns Promise<AuthSession>", async () => {
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

      expect(session).toBeInstanceOf(AuthSession);
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
// AuthSession
// ============================================================================

describe("AuthSession", () => {
  describe("constructor", () => {
    it("accepts Authentication and config", () => {
      const session = new AuthSession(createValidAuthentication(), {});
      expect(session).toBeInstanceOf(AuthSession);
    });
  });

  describe("tokens getter", () => {
    it("returns SessionTokens", () => {
      const auth = createValidAuthentication();
      const session = new AuthSession(auth, {});
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
      const session = new AuthSession(auth, {});
      expect(session.profile.id).toBe(auth.profile.id);
      expect(session.profile.applicationId).toBe(auth.profile.applicationId);
      expect(session.profile.status).toBe(auth.profile.status);
    });
  });

  describe("toJSON", () => {
    it("returns Authentication object", () => {
      const auth = createValidAuthentication();
      const session = new AuthSession(auth, {});
      const json = session.toJSON();
      expect(json.tokens).toBeDefined();
      expect(json.profile).toBeDefined();
      expect(json.tokens.accessToken).toBe(auth.tokens.accessToken);
      expect(json.profile.id).toBe(auth.profile.id);
    });
  });

  describe("fromJSON static", () => {
    it("creates AuthSession from Authentication", () => {
      const auth = createValidAuthentication();
      const session = AuthSession.fromJSON(auth, {});
      expect(session).toBeInstanceOf(AuthSession);
      expect(session.tokens.accessToken).toBe(auth.tokens.accessToken);
    });
  });

  describe("isExpired", () => {
    it("returns false for valid tokens", () => {
      const session = new AuthSession(createValidAuthentication(), {});
      expect(session.isExpired()).toBe(false);
    });

    it("returns true for expired tokens", () => {
      const auth = createValidAuthentication();
      auth.tokens.expiresAt = Date.now() - 10000;
      const session = new AuthSession(auth, {});
      expect(session.isExpired()).toBe(true);
    });
  });

  describe("clear", () => {
    it("is a function that returns void", () => {
      const session = new AuthSession(createValidAuthentication(), {});
      const result = session.clear();
      expect(result).toBeUndefined();
    });
  });

  describe("fetch", () => {
    it("accepts url and returns Promise<Response>", async () => {
      const session = new AuthSession(createValidAuthentication(), {
        fetchFn: createMockFetch({ status: 200, body: { data: "test" } }),
      });

      const response = await session.fetch("https://api.example.com/resource");
      expect(response).toBeInstanceOf(Response);
      expect(response.status).toBe(200);
    });

    it("accepts optional RequestInit", async () => {
      const session = new AuthSession(createValidAuthentication(), {
        fetchFn: createMockFetch({ status: 200 }),
      });

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

    it("updates storage and emits refresh/profileChange", async () => {
      const storage = createMockStorage();
      let refreshCount = 0;
      let profileChangeCount = 0;
      let latestAccessToken = "";
      let latestAccountId = "";

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
      const session = am.createSession(initial);

      am.on("refresh", (tokens) => {
        refreshCount += 1;
        latestAccessToken = tokens.accessToken;
      });
      am.on("profileChange", (profile) => {
        profileChangeCount += 1;
        latestAccountId = profile.activeMembership?.account.id ?? "";
      });

      await session.switchAccounts({ accountId: "acc_2" });

      expect(refreshCount).toBe(1);
      expect(profileChangeCount).toBe(1);
      expect(latestAccessToken).toBe("switched_access_token");
      expect(latestAccountId).toBe("acc_2");

      const storedTokens = JSON.parse(storage.getItem("am_tokens")!);
      const storedProfile = JSON.parse(storage.getItem("am_profile")!);

      expect(storedTokens.accessToken).toBe("switched_access_token");
      expect(storedProfile.activeMembership.account.id).toBe("acc_2");
    });
  });

  describe("sendVerificationEmail", () => {
    it("returns Promise<void>", async () => {
      const session = new AuthSession(createValidAuthentication(), {
        fetchFn: createMockFetch({ status: 204 }),
      });

      const result = await session.sendVerificationEmail();
      expect(result).toBeUndefined();
    });
  });
});
