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

describe("Unauthenticated Event", () => {
  describe("when request returns 401 and refresh returns 401", () => {
    it("emits unauthenticated event", async () => {
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

      let unauthenticatedError: AuthError | null = null;
      am.on("unauthenticated", (error) => {
        unauthenticatedError = error;
      });

      try {
        await session.fetch("/api/protected");
      } catch {
        // Expected to throw
      }

      expect(unauthenticatedError).not.toBeNull();
      expect(unauthenticatedError).toBeInstanceOf(AuthError);
      expect(unauthenticatedError!.status).toBe(401);
    });
  });

  describe("when request returns 401 but refresh succeeds", () => {
    it("does not emit unauthenticated event", async () => {
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

      let unauthenticatedFired = false;
      am.on("unauthenticated", () => {
        unauthenticatedFired = true;
      });

      await session.fetch("/api/protected");

      expect(unauthenticatedFired).toBe(false);
    });
  });

  describe("when request returns 401 and refresh returns 500", () => {
    it("does not emit unauthenticated event (server error is not auth failure)", async () => {
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

      let unauthenticatedFired = false;
      am.on("unauthenticated", () => {
        unauthenticatedFired = true;
      });

      try {
        await session.fetch("/api/protected");
      } catch {
        // Expected to throw
      }

      expect(unauthenticatedFired).toBe(false);
    });
  });

  describe("when request returns 401 and refresh times out", () => {
    it("does not emit unauthenticated event (network error is not auth failure)", async () => {
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

      let unauthenticatedFired = false;
      am.on("unauthenticated", () => {
        unauthenticatedFired = true;
      });

      try {
        await session.fetch("/api/protected");
      } catch {
        // Expected to throw network error
      }

      expect(unauthenticatedFired).toBe(false);
    });
  });

  describe("when tokens are expired and refresh returns 401", () => {
    it("emits unauthenticated event", async () => {
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

      let unauthenticatedError: AuthError | null = null;
      am.on("unauthenticated", (error) => {
        unauthenticatedError = error;
      });

      try {
        await session.fetch("/api/protected");
      } catch {
        // Expected to throw
      }

      expect(unauthenticatedError).not.toBeNull();
      expect(unauthenticatedError).toBeInstanceOf(AuthError);
      expect(unauthenticatedError!.status).toBe(401);
    });
  });

  describe("when session is cleared", () => {
    it("does not emit unauthenticated event even if refresh would fail", async () => {
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

      let unauthenticatedFired = false;
      am.on("unauthenticated", () => {
        unauthenticatedFired = true;
      });

      session.clear();

      const response = await session.fetch("/api/protected");
      // Should return the 401 response without attempting refresh
      expect(response.status).toBe(401);
      expect(unauthenticatedFired).toBe(false);
    });
  });

  describe("when calling refresh() directly and it returns 401", () => {
    it("emits unauthenticated event", async () => {
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

      let unauthenticatedError: AuthError | null = null;
      am.on("unauthenticated", (error) => {
        unauthenticatedError = error;
      });

      try {
        await session.refresh();
      } catch {
        // Expected to throw
      }

      expect(unauthenticatedError).not.toBeNull();
      expect(unauthenticatedError!.status).toBe(401);
    });
  });
});
