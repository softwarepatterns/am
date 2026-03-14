import { describe, it, expect, beforeEach, setDefaultTimeout } from "bun:test";
import { Am, AuthSession, AuthError } from "../../src/auth";
import type { StorageLike, ClientId } from "../../src/types";

const BASE_URL = "https://api.accountmaker.com";
const CLIENT_ID = process.env.AM_CLIENT_ID as ClientId;
const TEST_EMAIL = process.env.AM_EMAIL!;
const TEST_PASSWORD = process.env.AM_PASSWORD!;

setDefaultTimeout(10000);

/**
 * Custom fetch that adds Origin header (required by API for CSRF protection).
 */
function fetchWithOrigin(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (!headers.has("Origin")) {
    headers.set("Origin", BASE_URL);
  }
  return fetch(input, { ...init, headers });
}

/**
 * In-memory StorageLike implementation for testing.
 */
function createMockStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem(key: string): string | null {
      return data.get(key) ?? null;
    },
    setItem(key: string, value: string): void {
      data.set(key, value);
    },
    removeItem(key: string): void {
      data.delete(key);
    },
  };
}

describe("SignIn Integration Tests", () => {
  let storage: ReturnType<typeof createMockStorage>;

  beforeEach(() => {
    storage = createMockStorage();
  });

  describe("Successful Authentication", () => {
    it("returns an AuthSession when credentials are valid", async () => {
      const am = new Am({
        baseUrl: BASE_URL,
        storage,
        fetchFn: fetchWithOrigin,
      });

      const session = await am.signIn({
        clientId: CLIENT_ID,
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      });

      expect(session).toBeInstanceOf(AuthSession);
    });

    it("returns tokens with access token, refresh token, and expiration", async () => {
      const am = new Am({
        baseUrl: BASE_URL,
        storage,
        fetchFn: fetchWithOrigin,
      });

      const session = await am.signIn({
        clientId: CLIENT_ID,
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      });

      expect(typeof session.tokens.accessToken).toBe("string");
      expect(session.tokens.accessToken.length).toBeGreaterThan(0);
      expect(typeof session.tokens.refreshToken).toBe("string");
      expect(session.tokens.refreshToken.length).toBeGreaterThan(0);
      expect(session.tokens.tokenType).toBe("Bearer");
      expect(session.tokens.expiresAt).toBeGreaterThan(Date.now());
    });

    it("returns profile with user identity and application context", async () => {
      const am = new Am({
        baseUrl: BASE_URL,
        storage,
        fetchFn: fetchWithOrigin,
      });

      const session = await am.signIn({
        clientId: CLIENT_ID,
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      });

      expect(typeof session.profile.id).toBe("string");
      expect(session.profile.id.length).toBeGreaterThan(0);
      expect(typeof session.profile.applicationId).toBe("string");
      expect(session.profile.applicationId.length).toBeGreaterThan(0);
      expect(typeof session.profile.status).toBe("string");
      expect(session.profile.lastUpdatedAt).toBeGreaterThan(0);
    });

    it("sets the session on the Am instance after successful sign-in", async () => {
      const am = new Am({
        baseUrl: BASE_URL,
        storage,
        fetchFn: fetchWithOrigin,
      });

      expect(am.session).toBeNull();

      const session = await am.signIn({
        clientId: CLIENT_ID,
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      });

      expect(am.session).toBe(session);
    });

    it("session can make authenticated API requests", async () => {
      const am = new Am({
        baseUrl: BASE_URL,
        storage,
        fetchFn: fetchWithOrigin,
      });

      const session = await am.signIn({
        clientId: CLIENT_ID,
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      });

      // Fetch the profile endpoint directly to verify authentication works
      await session.refetchProfile();
      expect(session.profile.id).toBeDefined();
      expect(Array.isArray(session.profile.credentials)).toBe(true);
      expect(Array.isArray(session.profile.memberships)).toBe(true);
      if (session.profile.activeMembership) {
        expect(typeof session.profile.activeMembership.account.id).toBe("string");
        expect(session.profile.activeMembership.account.id.length).toBeGreaterThan(0);
      } else {
        expect(session.profile.activeMembership).toBeNull();
      }
    });
  });

  describe("Authentication Failures", () => {
    it("throws AuthError with 401 when password is incorrect", async () => {
      const am = new Am({
        baseUrl: BASE_URL,
        storage,
        fetchFn: fetchWithOrigin,
      });

      try {
        await am.signIn({
          clientId: CLIENT_ID,
          email: TEST_EMAIL,
          password: "wrong-password-123",
        });
        expect(true).toBe(false); // Should not reach here
      } catch (e) {
        expect(e).toBeInstanceOf(AuthError);
        const error = e as AuthError;
        expect(error.status).toBe(401);
      }
    });

    it("throws AuthError when email does not exist", async () => {
      const am = new Am({
        baseUrl: BASE_URL,
        storage,
        fetchFn: fetchWithOrigin,
      });

      try {
        await am.signIn({
          clientId: CLIENT_ID,
          email: "nonexistent-user-abc123@example.com",
          password: TEST_PASSWORD,
        });
        expect(true).toBe(false); // Should not reach here
      } catch (e) {
        expect(e).toBeInstanceOf(AuthError);
        const error = e as AuthError;
        // Could be 401 (unauthorized) or 404 (not found) depending on API design
        expect([401, 404]).toContain(error.status);
      }
    });

    it("throws AuthError when email is malformed", async () => {
      const am = new Am({
        baseUrl: BASE_URL,
        storage,
        fetchFn: fetchWithOrigin,
      });

      try {
        await am.signIn({
          clientId: CLIENT_ID,
          email: "not-an-email",
          password: TEST_PASSWORD,
        });
        expect(true).toBe(false); // Should not reach here
      } catch (e) {
        expect(e).toBeInstanceOf(AuthError);
        const error = e as AuthError;
        // API returns 401 for malformed email to prevent email enumeration
        expect([400, 401]).toContain(error.status);
      }
    });

    it("throws AuthError when clientId is invalid", async () => {
      const am = new Am({
        baseUrl: BASE_URL,
        storage,
        fetchFn: fetchWithOrigin,
      });

      try {
        await am.signIn({
          clientId: "invalid_client_id" as ClientId,
          email: TEST_EMAIL,
          password: TEST_PASSWORD,
        });
        expect(true).toBe(false); // Should not reach here
      } catch (e) {
        expect(e).toBeInstanceOf(AuthError);
        const error = e as AuthError;
        // Could be 400 (bad request) or 401 (unauthorized)
        expect([400, 401, 404]).toContain(error.status);
      }
    });

    it("does not set session on Am instance when sign-in fails", async () => {
      const am = new Am({
        baseUrl: BASE_URL,
        storage,
        fetchFn: fetchWithOrigin,
      });

      try {
        await am.signIn({
          clientId: CLIENT_ID,
          email: TEST_EMAIL,
          password: "wrong-password",
        });
      } catch {
        // Expected to fail
      }

      expect(am.session).toBeNull();
    });

    it("does not persist anything to storage when sign-in fails", async () => {
      const am = new Am({
        baseUrl: BASE_URL,
        storage,
        fetchFn: fetchWithOrigin,
      });

      try {
        await am.signIn({
          clientId: CLIENT_ID,
          email: TEST_EMAIL,
          password: "wrong-password",
        });
      } catch {
        // Expected to fail
      }

      expect(storage.getItem("am_tokens")).toBeNull();
      expect(storage.getItem("am_profile")).toBeNull();
    });
  });

  describe("Event Notifications", () => {
    it("emits sessionChange event when sign-in succeeds", async () => {
      const am = new Am({
        baseUrl: BASE_URL,
        storage,
        fetchFn: fetchWithOrigin,
      });

      let receivedSession: AuthSession | null = null;
      am.on("sessionChange", (session) => {
        receivedSession = session;
      });

      const session = await am.signIn({
        clientId: CLIENT_ID,
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      });

      expect(receivedSession).toBe(session);
    });

    it("does not emit sessionChange event when sign-in fails", async () => {
      const am = new Am({
        baseUrl: BASE_URL,
        storage,
        fetchFn: fetchWithOrigin,
      });

      let eventFired = false;
      am.on("sessionChange", () => {
        eventFired = true;
      });

      try {
        await am.signIn({
          clientId: CLIENT_ID,
          email: TEST_EMAIL,
          password: "wrong-password",
        });
      } catch {
        // Expected to fail
      }

      expect(eventFired).toBe(false);
    });
  });

  describe("Multiple Sign-Ins", () => {
    it("subsequent sign-in replaces the current session", async () => {
      const am = new Am({
        baseUrl: BASE_URL,
        storage,
        fetchFn: fetchWithOrigin,
      });

      const session1 = await am.signIn({
        clientId: CLIENT_ID,
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      });

      const session2 = await am.signIn({
        clientId: CLIENT_ID,
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      });

      expect(am.session).toBe(session2);
      expect(am.session).not.toBe(session1);
    });

    it("each sign-in returns a new AuthSession instance", async () => {
      const am = new Am({
        baseUrl: BASE_URL,
        storage,
        fetchFn: fetchWithOrigin,
      });

      const session1 = await am.signIn({
        clientId: CLIENT_ID,
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      });

      const session2 = await am.signIn({
        clientId: CLIENT_ID,
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      });

      expect(session1).not.toBe(session2);
      expect(session1.tokens.accessToken).not.toBe(session2.tokens.accessToken);
    });

    it("clearing one session does not affect a subsequently created session", async () => {
      const am = new Am({
        baseUrl: BASE_URL,
        storage,
        fetchFn: fetchWithOrigin,
      });

      const session1 = await am.signIn({
        clientId: CLIENT_ID,
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      });

      session1.clear();

      const session2 = await am.signIn({
        clientId: CLIENT_ID,
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      });

      // session2 should still have valid tokens in storage
      expect(storage.getItem("am_tokens")).not.toBeNull();
      expect(session2.tokens.accessToken).toBeDefined();
    });
  });

  describe("Concurrent Sign-Ins", () => {
    it("parallel sign-in requests both succeed independently", async () => {
      const am1 = new Am({
        baseUrl: BASE_URL,
        storage: createMockStorage(),
        fetchFn: fetchWithOrigin,
      });

      const am2 = new Am({
        baseUrl: BASE_URL,
        storage: createMockStorage(),
        fetchFn: fetchWithOrigin,
      });

      const [session1, session2] = await Promise.all([
        am1.signIn({
          clientId: CLIENT_ID,
          email: TEST_EMAIL,
          password: TEST_PASSWORD,
        }),
        am2.signIn({
          clientId: CLIENT_ID,
          email: TEST_EMAIL,
          password: TEST_PASSWORD,
        }),
      ]);

      expect(session1).toBeInstanceOf(AuthSession);
      expect(session2).toBeInstanceOf(AuthSession);
      expect(session1.tokens.accessToken).not.toBe(session2.tokens.accessToken);
    });
  });

  describe("AuthError Structure", () => {
    it("AuthError contains RFC 7807 problem details on failure", async () => {
      const am = new Am({
        baseUrl: BASE_URL,
        storage,
        fetchFn: fetchWithOrigin,
      });

      try {
        await am.signIn({
          clientId: CLIENT_ID,
          email: TEST_EMAIL,
          password: "wrong-password",
        });
        expect(true).toBe(false); // Should not reach here
      } catch (e) {
        expect(e).toBeInstanceOf(AuthError);
        const error = e as AuthError;

        // RFC 7807 required fields
        expect(typeof error.type).toBe("string");
        expect(typeof error.title).toBe("string");
        expect(typeof error.status).toBe("number");

        // Error message should be the title
        expect(error.message).toBe(error.title);

        // problem object should be frozen
        expect(Object.isFrozen(error.problem)).toBe(true);
      }
    });
  });

  describe("Session Serialization", () => {
    it("session can be serialized to JSON for custom persistence", async () => {
      const am = new Am({
        baseUrl: BASE_URL,
        storage,
        fetchFn: fetchWithOrigin,
      });

      const session = await am.signIn({
        clientId: CLIENT_ID,
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      });

      const json = session.toJSON();

      expect(json.tokens).toBeDefined();
      expect(json.tokens.accessToken).toBe(session.tokens.accessToken);
      expect(json.profile).toBeDefined();
      expect(json.profile.id).toBe(session.profile.id);
    });
  });
});
