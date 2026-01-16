import { describe, it, expect, beforeEach } from "bun:test";
import { Am, AuthSession } from "../../src/auth";
import type { StorageLike, ClientId } from "../../src/types";

const BASE_URL = "https://api.accountmaker.com";
const CLIENT_ID = process.env.AM_CLIENT_ID as ClientId;
const TEST_EMAIL = process.env.AM_EMAIL!;
const TEST_PASSWORD = process.env.AM_PASSWORD!;

/**
 * Custom fetch that adds Origin header (required by API for CSRF protection).
 * In browsers, this is automatic. In Node/Bun, we need to add it manually.
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

describe("Storage Integration Tests", () => {
  let storage: ReturnType<typeof createMockStorage>;

  beforeEach(() => {
    storage = createMockStorage();
  });

  describe("Session Persistence", () => {
    it("persists tokens to storage after successful sign-in", async () => {
      const am = new Am({
        baseUrl: BASE_URL,
        storage,
        fetchFn: fetchWithOrigin,
      });

      await am.signIn({
        clientId: CLIENT_ID,
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      });

      const storedTokens = JSON.parse(storage.getItem("am_tokens")!);
      expect(storedTokens.accessToken).toBeDefined();
      expect(storedTokens.refreshToken).toBeDefined();
      expect(storedTokens.expiresAt).toBeGreaterThan(Date.now());
    });

    it("persists profile to storage after successful sign-in", async () => {
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

      const storedProfile = JSON.parse(storage.getItem("am_profile")!);
      expect(storedProfile.id).toBe(session.profile.id);
      expect(storedProfile.applicationId).toBeDefined();
      expect(storedProfile.lastUpdatedAt).toBeGreaterThan(0);
    });

    it("does not persist anything when storage is null", async () => {
      const am = new Am({
        baseUrl: BASE_URL,
        storage: null,
        fetchFn: fetchWithOrigin,
      });

      await am.signIn({
        clientId: CLIENT_ID,
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      });

      expect(storage.getItem("am_tokens")).toBeNull();
      expect(storage.getItem("am_profile")).toBeNull();
    });
  });

  describe("Session Restoration", () => {
    it("restores a complete session from storage across Am instances", async () => {
      const am1 = new Am({
        baseUrl: BASE_URL,
        storage,
        fetchFn: fetchWithOrigin,
      });

      const originalSession = await am1.signIn({
        clientId: CLIENT_ID,
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      });

      const am2 = new Am({
        baseUrl: BASE_URL,
        storage,
        fetchFn: fetchWithOrigin,
      });

      const restoredSession = am2.restoreSession();

      expect(restoredSession).not.toBeNull();
      expect(restoredSession!.tokens.accessToken).toBe(
        originalSession.tokens.accessToken
      );
      expect(restoredSession!.profile.id).toBe(originalSession.profile.id);
    });

    it("returns null when storage is not configured", () => {
      const am = new Am({
        baseUrl: BASE_URL,
        storage: null,
        fetchFn: fetchWithOrigin,
      });

      expect(am.restoreSession()).toBeNull();
    });

    it("returns null when storage is empty", () => {
      const am = new Am({
        baseUrl: BASE_URL,
        storage,
        fetchFn: fetchWithOrigin,
      });

      expect(am.restoreSession()).toBeNull();
    });

    it("restored session can make authenticated API calls", async () => {
      const am1 = new Am({
        baseUrl: BASE_URL,
        storage,
        fetchFn: fetchWithOrigin,
      });

      await am1.signIn({
        clientId: CLIENT_ID,
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      });

      const am2 = new Am({
        baseUrl: BASE_URL,
        storage,
        fetchFn: fetchWithOrigin,
      });

      const restoredSession = am2.restoreSession();
      expect(restoredSession).not.toBeNull();

      // Verify the restored session can fetch profile from API
      await restoredSession!.refetchProfile();
      expect(restoredSession!.profile.id).toBeDefined();
    });
  });

  describe("Storage Validation", () => {
    it("rejects and clears storage when tokens are missing", () => {
      storage.setItem(
        "am_profile",
        JSON.stringify({
          id: "uid_test",
          applicationId: "app_test",
          status: "active",
          lastUpdatedAt: Date.now(),
          identity: null,
        })
      );

      const am = new Am({
        baseUrl: BASE_URL,
        storage,
        fetchFn: fetchWithOrigin,
      });

      expect(am.restoreSession()).toBeNull();
      expect(storage.getItem("am_tokens")).toBeNull();
      expect(storage.getItem("am_profile")).toBeNull();
    });

    it("rejects and clears storage when profile is missing", () => {
      storage.setItem(
        "am_tokens",
        JSON.stringify({
          accessToken: "test_access",
          refreshToken: "test_refresh",
          tokenType: "Bearer",
          expiresIn: 3600,
          expiresAt: Date.now() + 3600000,
        })
      );

      const am = new Am({
        baseUrl: BASE_URL,
        storage,
        fetchFn: fetchWithOrigin,
      });

      expect(am.restoreSession()).toBeNull();
      expect(storage.getItem("am_tokens")).toBeNull();
      expect(storage.getItem("am_profile")).toBeNull();
    });

    it("rejects and clears storage when tokens are malformed", () => {
      storage.setItem(
        "am_tokens",
        JSON.stringify({
          accessToken: "test_access",
          // missing: refreshToken, tokenType, expiresIn, expiresAt
        })
      );
      storage.setItem(
        "am_profile",
        JSON.stringify({
          id: "uid_test",
          applicationId: "app_test",
          status: "active",
          lastUpdatedAt: Date.now(),
          identity: null,
        })
      );

      const am = new Am({
        baseUrl: BASE_URL,
        storage,
        fetchFn: fetchWithOrigin,
      });

      expect(am.restoreSession()).toBeNull();
      expect(storage.getItem("am_tokens")).toBeNull();
      expect(storage.getItem("am_profile")).toBeNull();
    });

    it("rejects and clears storage when profile is malformed", () => {
      storage.setItem(
        "am_tokens",
        JSON.stringify({
          accessToken: "test_access",
          refreshToken: "test_refresh",
          tokenType: "Bearer",
          expiresIn: 3600,
          expiresAt: Date.now() + 3600000,
        })
      );
      storage.setItem(
        "am_profile",
        JSON.stringify({
          id: "uid_test",
          // missing: applicationId, status, lastUpdatedAt, identity
        })
      );

      const am = new Am({
        baseUrl: BASE_URL,
        storage,
        fetchFn: fetchWithOrigin,
      });

      expect(am.restoreSession()).toBeNull();
      expect(storage.getItem("am_tokens")).toBeNull();
      expect(storage.getItem("am_profile")).toBeNull();
    });

    it("rejects and clears storage when JSON is corrupted", () => {
      storage.setItem("am_tokens", "not valid json {{{");
      storage.setItem("am_profile", "also not valid json");

      const am = new Am({
        baseUrl: BASE_URL,
        storage,
        fetchFn: fetchWithOrigin,
      });

      expect(am.restoreSession()).toBeNull();
      expect(storage.getItem("am_tokens")).toBeNull();
      expect(storage.getItem("am_profile")).toBeNull();
    });

    it("rejects tokens with wrong tokenType", () => {
      storage.setItem(
        "am_tokens",
        JSON.stringify({
          accessToken: "test_access",
          refreshToken: "test_refresh",
          tokenType: "Basic", // wrong type
          expiresIn: 3600,
          expiresAt: Date.now() + 3600000,
        })
      );
      storage.setItem(
        "am_profile",
        JSON.stringify({
          id: "uid_test",
          applicationId: "app_test",
          status: "active",
          lastUpdatedAt: Date.now(),
          identity: null,
        })
      );

      const am = new Am({
        baseUrl: BASE_URL,
        storage,
        fetchFn: fetchWithOrigin,
      });

      expect(am.restoreSession()).toBeNull();
    });
  });

  describe("Session Clearing", () => {
    it("removes all persisted data when session is cleared", async () => {
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

      expect(storage.getItem("am_tokens")).not.toBeNull();
      expect(storage.getItem("am_profile")).not.toBeNull();

      session.clear();

      expect(storage.getItem("am_tokens")).toBeNull();
      expect(storage.getItem("am_profile")).toBeNull();
    });

    it("prevents token refresh after session is cleared", async () => {
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

      session.clear();

      // Should not throw, should silently do nothing
      await session.refresh();

      expect(storage.getItem("am_tokens")).toBeNull();
    });

    it("prevents profile refresh after session is cleared", async () => {
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

      session.clear();

      // Should not throw, should silently do nothing
      await session.refetchProfile();

      expect(storage.getItem("am_profile")).toBeNull();
    });
  });

  describe("Storage Key Configuration", () => {
    it("uses custom storage keys when configured", async () => {
      const customTokensKey = "my_app_tokens";
      const customProfileKey = "my_app_profile";

      const am = new Am({
        baseUrl: BASE_URL,
        storage,
        tokensStorageKey: customTokensKey,
        profileStorageKey: customProfileKey,
        fetchFn: fetchWithOrigin,
      });

      await am.signIn({
        clientId: CLIENT_ID,
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      });

      expect(storage.getItem("am_tokens")).toBeNull();
      expect(storage.getItem("am_profile")).toBeNull();
      expect(storage.getItem(customTokensKey)).not.toBeNull();
      expect(storage.getItem(customProfileKey)).not.toBeNull();
    });

    it("restores session from custom storage keys", async () => {
      const customTokensKey = "my_app_tokens";
      const customProfileKey = "my_app_profile";

      const am1 = new Am({
        baseUrl: BASE_URL,
        storage,
        tokensStorageKey: customTokensKey,
        profileStorageKey: customProfileKey,
        fetchFn: fetchWithOrigin,
      });

      const originalSession = await am1.signIn({
        clientId: CLIENT_ID,
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      });

      const am2 = new Am({
        baseUrl: BASE_URL,
        storage,
        tokensStorageKey: customTokensKey,
        profileStorageKey: customProfileKey,
        fetchFn: fetchWithOrigin,
      });

      const restoredSession = am2.restoreSession();

      expect(restoredSession).not.toBeNull();
      expect(restoredSession!.tokens.accessToken).toBe(
        originalSession.tokens.accessToken
      );
    });

    it("allows multiple apps to coexist in same storage", async () => {
      const am1 = new Am({
        baseUrl: BASE_URL,
        storage,
        tokensStorageKey: "app1_tokens",
        profileStorageKey: "app1_profile",
        fetchFn: fetchWithOrigin,
      });

      const am2 = new Am({
        baseUrl: BASE_URL,
        storage,
        tokensStorageKey: "app2_tokens",
        profileStorageKey: "app2_profile",
        fetchFn: fetchWithOrigin,
      });

      const session1 = await am1.signIn({
        clientId: CLIENT_ID,
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      });

      await am2.signIn({
        clientId: CLIENT_ID,
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      });

      // Both sessions should be independently stored
      expect(storage.getItem("app1_tokens")).not.toBeNull();
      expect(storage.getItem("app2_tokens")).not.toBeNull();

      // Clearing one doesn't affect the other
      session1.clear();
      expect(storage.getItem("app1_tokens")).toBeNull();
      expect(storage.getItem("app2_tokens")).not.toBeNull();
    });
  });

  describe("Concurrent Write Protection", () => {
    it("does not overwrite tokens with older expiresAt", async () => {
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

      const originalTokens = JSON.parse(storage.getItem("am_tokens")!);

      // Simulate older tokens being written (e.g., from another tab)
      const olderTokens = {
        ...originalTokens,
        accessToken: "stale_access_token",
        expiresAt: originalTokens.expiresAt - 10000,
      };
      storage.setItem("am_tokens", JSON.stringify(olderTokens));

      // Creating a new session with newer tokens should overwrite
      const am2 = new Am({
        baseUrl: BASE_URL,
        storage,
        fetchFn: fetchWithOrigin,
      });

      am2.createSession({
        tokens: session.tokens,
        profile: session.profile,
      });

      const finalTokens = JSON.parse(storage.getItem("am_tokens")!);
      expect(finalTokens.accessToken).toBe(session.tokens.accessToken);
    });

    it("does not overwrite profile with older lastUpdatedAt", async () => {
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

      const originalProfile = JSON.parse(storage.getItem("am_profile")!);

      // Simulate older profile being written
      const olderProfile = {
        ...originalProfile,
        lastUpdatedAt: originalProfile.lastUpdatedAt - 10000,
      };
      storage.setItem("am_profile", JSON.stringify(olderProfile));

      // Creating a new session with newer profile should overwrite
      const am2 = new Am({
        baseUrl: BASE_URL,
        storage,
        fetchFn: fetchWithOrigin,
      });

      am2.createSession({
        tokens: session.tokens,
        profile: session.profile,
      });

      const finalProfile = JSON.parse(storage.getItem("am_profile")!);
      expect(finalProfile.lastUpdatedAt).toBe(session.profile.lastUpdatedAt);
    });

    it("preserves newer tokens when attempting to write older ones", async () => {
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

      const newerTokens = JSON.parse(storage.getItem("am_tokens")!);

      // Create session with older tokens - should not overwrite
      const am2 = new Am({
        baseUrl: BASE_URL,
        storage,
        fetchFn: fetchWithOrigin,
      });

      const olderTokens = {
        ...session.tokens,
        expiresAt: session.tokens.expiresAt - 10000,
        accessToken: "older_access_token",
      };

      am2.createSession({
        tokens: olderTokens,
        profile: session.profile,
      });

      const finalTokens = JSON.parse(storage.getItem("am_tokens")!);
      expect(finalTokens.accessToken).toBe(newerTokens.accessToken);
    });
  });

  describe("Storage Error Handling", () => {
    it("continues without throwing when storage.setItem throws", async () => {
      const failingStorage: StorageLike = {
        getItem: () => null,
        setItem: () => {
          throw new Error("QuotaExceededError");
        },
        removeItem: () => {},
      };

      const am = new Am({
        baseUrl: BASE_URL,
        storage: failingStorage,
        fetchFn: fetchWithOrigin,
      });

      const session = await am.signIn({
        clientId: CLIENT_ID,
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      });

      expect(session).toBeInstanceOf(AuthSession);
      expect(session.tokens.accessToken).toBeDefined();
    });

    it("continues without throwing when storage.removeItem throws", async () => {
      const failingStorage: StorageLike = {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {
          throw new Error("Storage error");
        },
      };

      const am = new Am({
        baseUrl: BASE_URL,
        storage: failingStorage,
        fetchFn: fetchWithOrigin,
      });

      const session = await am.signIn({
        clientId: CLIENT_ID,
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      });

      // Should not throw
      session.clear();
    });

    // NOTE: storage.getItem throwing is not currently handled by the library.
    // readJson() does not wrap getItem in try-catch, unlike writeJson/removeKey.
    // This is a potential improvement for future defensive programming.
  });

  describe("Token Refresh Updates Storage", () => {
    it("updates stored tokens after successful refresh", async () => {
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

      const originalTokens = JSON.parse(storage.getItem("am_tokens")!);

      await session.refresh();

      const updatedTokens = JSON.parse(storage.getItem("am_tokens")!);
      expect(updatedTokens.accessToken).not.toBe(originalTokens.accessToken);
      expect(updatedTokens.expiresAt).toBeGreaterThanOrEqual(
        originalTokens.expiresAt
      );
    });
  });

  describe("Profile Refresh Updates Storage", () => {
    it("updates stored profile after successful refetch", async () => {
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

      const originalProfile = JSON.parse(storage.getItem("am_profile")!);

      // Wait a bit to ensure lastUpdatedAt changes
      await new Promise((resolve) => setTimeout(resolve, 10));

      await session.refetchProfile();

      const updatedProfile = JSON.parse(storage.getItem("am_profile")!);
      expect(updatedProfile.lastUpdatedAt).toBeGreaterThan(
        originalProfile.lastUpdatedAt
      );
    });
  });
});
