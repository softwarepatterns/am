import { describe, it, expect } from "bun:test";
import { Am } from "../../src/auth";
import { AuthError } from "../../src/lib/auth-error";
import type { SessionTokens, SessionProfile } from "../../src/types";

/**
 * Creates a mock fetch function that returns predefined responses.
 */
function createMockFetch(responses: Array<{ status: number; body?: any }>) {
  let callIndex = 0;
  return async (_input: RequestInfo | URL, _init?: RequestInit) => {
    const response = responses[callIndex++];
    if (!response) {
      throw new Error(`Unexpected fetch call #${callIndex}`);
    }

    const headers = new Headers();
    if (response.body) {
      headers.set("Content-Type", "application/json");
    }
    if (response.status >= 400 && response.body) {
      headers.set("Content-Type", "application/problem+json");
    }

    return new Response(response.body ? JSON.stringify(response.body) : null, {
      status: response.status,
      statusText: response.status === 401 ? "Unauthorized" : "OK",
      headers,
    });
  };
}

function createValidTokens(expiresInMs = 3600000): SessionTokens {
  return {
    accessToken: "valid_access_token",
    refreshToken: "valid_refresh_token",
    tokenType: "Bearer",
    expiresIn: expiresInMs / 1000,
    expiresAt: Date.now() + expiresInMs,
  };
}

function createExpiredTokens(): SessionTokens {
  return {
    accessToken: "expired_access_token",
    refreshToken: "expired_refresh_token",
    tokenType: "Bearer",
    expiresIn: 3600,
    expiresAt: Date.now() - 10000, // Expired 10 seconds ago
  };
}

function createValidProfile(): SessionProfile {
  return {
    id: "uid_test",
    applicationId: "app_test",
    status: "active",
    lastUpdatedAt: Date.now(),
    identity: null,
    activeMembership: null,
  };
}

describe("authLost", () => {
  describe("when refresh fails with a 401 auth error", () => {
    it("emits authLost and does not emit reloadRequired", async () => {
      const mockFetch = createMockFetch([
        // First request returns 401
        { status: 401, body: { type: "about:blank", title: "Unauthorized", status: 401 } },
        // Refresh attempt returns 401
        { status: 401, body: { type: "about:blank", title: "Invalid refresh token", status: 401 } },
      ]);

      const am = new Am({
        baseUrl: "https://api.example.com",
        storage: null,
        fetchFn: mockFetch,
      });

      const session = am.createSession({
        tokens: createValidTokens(),
        profile: createValidProfile(),
      });

      let authLostError: AuthError | null = null;
      let reloadRequiredCount = 0;
      am.on("authLost", (error) => {
        authLostError = error;
      });
      am.on("reloadRequired", () => {
        reloadRequiredCount += 1;
      });

      try {
        await session.fetch("/api/protected");
      } catch {
        // Expected to throw
      }

      expect(authLostError).not.toBeNull();
      expect(authLostError).toBeInstanceOf(AuthError);
      expect(authLostError!.status).toBe(401);
      expect(reloadRequiredCount).toBe(0);
    });
  });

  describe("when refresh succeeds", () => {
    it("does not emit authLost", async () => {
      const mockFetch = createMockFetch([
        // First request returns 401
        { status: 401, body: { type: "about:blank", title: "Unauthorized", status: 401 } },
        // Refresh succeeds
        {
          status: 200,
          body: {
            access_token: "new_access_token",
            refresh_token: "new_refresh_token",
            token_type: "Bearer",
            expires_in: 3600,
          },
        },
        // Retry request succeeds
        { status: 200, body: { data: "success" } },
      ]);

      const am = new Am({
        baseUrl: "https://api.example.com",
        storage: null,
        fetchFn: mockFetch,
      });

      const session = am.createSession({
        tokens: createValidTokens(),
        profile: createValidProfile(),
      });

      let authLostFired = false;
      am.on("authLost", () => {
        authLostFired = true;
      });

      await session.fetch("/api/protected");

      expect(authLostFired).toBe(false);
    });
  });

  describe("when refresh fails for a non-auth reason", () => {
    it("does not emit authLost for a server error", async () => {
      const mockFetch = createMockFetch([
        // First request returns 401
        { status: 401, body: { type: "about:blank", title: "Unauthorized", status: 401 } },
        // Refresh returns 500 server error
        { status: 500, body: { type: "about:blank", title: "Internal Server Error", status: 500 } },
      ]);

      const am = new Am({
        baseUrl: "https://api.example.com",
        storage: null,
        fetchFn: mockFetch,
      });

      const session = am.createSession({
        tokens: createValidTokens(),
        profile: createValidProfile(),
      });

      let authLostFired = false;
      am.on("authLost", () => {
        authLostFired = true;
      });

      try {
        await session.fetch("/api/protected");
      } catch {
        // Expected to throw
      }

      expect(authLostFired).toBe(false);
    });

    it("does not emit authLost for a network error", async () => {
      let callCount = 0;
      const mockFetch = async (_input: RequestInfo | URL, _init?: RequestInit) => {
        callCount++;
        if (callCount === 1) {
          // First request returns 401
          return new Response(
            JSON.stringify({ type: "about:blank", title: "Unauthorized", status: 401 }),
            {
              status: 401,
              headers: { "Content-Type": "application/problem+json" },
            }
          );
        }
        // Refresh times out
        throw new Error("Network timeout");
      };

      const am = new Am({
        baseUrl: "https://api.example.com",
        storage: null,
        fetchFn: mockFetch,
      });

      const session = am.createSession({
        tokens: createValidTokens(),
        profile: createValidProfile(),
      });

      let authLostFired = false;
      am.on("authLost", () => {
        authLostFired = true;
      });

      try {
        await session.fetch("/api/protected");
      } catch {
        // Expected to throw network error
      }

      expect(authLostFired).toBe(false);
    });
  });

  describe("recoverability", () => {
    it("emits authLost when expired tokens cannot be refreshed", async () => {
      const mockFetch = createMockFetch([
        // Refresh attempt (triggered by expired tokens) returns 401
        { status: 401, body: { type: "about:blank", title: "Invalid refresh token", status: 401 } },
      ]);

      const am = new Am({
        baseUrl: "https://api.example.com",
        storage: null,
        fetchFn: mockFetch,
      });

      const session = am.createSession({
        tokens: createExpiredTokens(),
        profile: createValidProfile(),
      });

      let authLostError: AuthError | null = null;
      let reloadRequiredCount = 0;
      am.on("authLost", (error) => {
        authLostError = error;
      });
      am.on("reloadRequired", () => {
        reloadRequiredCount += 1;
      });

      try {
        await session.fetch("/api/protected");
      } catch {
        // Expected to throw
      }

      expect(authLostError).not.toBeNull();
      expect(authLostError).toBeInstanceOf(AuthError);
      expect(authLostError!.status).toBe(401);
      expect(reloadRequiredCount).toBe(0);
    });

    it("remains recoverable after authLost", async () => {
      const mockFetch = createMockFetch([
        { status: 401, body: { type: "about:blank", title: "Unauthorized", status: 401 } },
        { status: 401, body: { type: "about:blank", title: "Invalid refresh token", status: 401 } },
        {
          status: 200,
          body: {
            access_token: "recovered_access_token",
            refresh_token: "recovered_refresh_token",
            token_type: "Bearer",
            expires_in: 3600,
          },
        },
      ]);

      const am = new Am({
        baseUrl: "https://api.example.com",
        storage: null,
        fetchFn: mockFetch,
      });

      const session = am.createSession({
        tokens: createValidTokens(),
        profile: createValidProfile(),
      });

      let authLostCount = 0;
      am.on("authLost", () => {
        authLostCount += 1;
      });

      await expect(session.fetch("/api/protected")).rejects.toBeInstanceOf(AuthError);
      await session.refresh();

      expect(authLostCount).toBe(1);
      expect(session.tokens.accessToken).toBe("recovered_access_token");
    });
  });

  describe("when the session is reloadRequired", () => {
    it("does not emit authLost even if refresh would otherwise fail", async () => {
      const mockFetch = createMockFetch([
        // First request returns 401
        { status: 401, body: { type: "about:blank", title: "Unauthorized", status: 401 } },
      ]);

      const am = new Am({
        baseUrl: "https://api.example.com",
        storage: null,
        fetchFn: mockFetch,
      });

      const session = am.createSession({
        tokens: createValidTokens(),
        profile: createValidProfile(),
      });

      let authLostFired = false;
      am.on("authLost", () => {
        authLostFired = true;
      });

      session.clear();

      const response = await session.fetch("/api/protected");
      // Should return the 401 response without attempting refresh
      expect(response.status).toBe(401);
      expect(authLostFired).toBe(false);
    });
  });

  describe("when refresh() itself returns 401", () => {
    it("emits authLost", async () => {
      const mockFetch = createMockFetch([
        // Refresh returns 401
        { status: 401, body: { type: "about:blank", title: "Invalid refresh token", status: 401 } },
      ]);

      const am = new Am({
        baseUrl: "https://api.example.com",
        storage: null,
        fetchFn: mockFetch,
      });

      const session = am.createSession({
        tokens: createValidTokens(),
        profile: createValidProfile(),
      });

      let authLostError: AuthError | null = null;
      am.on("authLost", (error) => {
        authLostError = error;
      });

      try {
        await session.refresh();
      } catch {
        // Expected to throw
      }

      expect(authLostError).not.toBeNull();
      expect(authLostError!.status).toBe(401);
    });
  });
});
