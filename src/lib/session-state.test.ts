import { describe, expect, it } from "bun:test";
import type { SessionState } from "./session-state";
import { isSessionStateExpired } from "./session-state";

function createState(expiresAt: number, earlyRefreshMs: number): SessionState {
  return {
    cleared: false,
    config: {
      baseUrl: "https://example.com",
      earlyRefreshMs,
      fetchFn: async () => new Response(null),
      profileStorageKey: "profile",
      storage: null,
      tokensStorageKey: "tokens",
    },
    profile: {
      id: "uid_1",
      applicationId: "app_1",
      status: "active",
      identity: null,
      credentials: [],
      memberships: [],
      activeMembership: null,
      lastUpdatedAt: 1,
    },
    profilePromise: null,
    refreshPromise: null,
    tokens: {
      accessToken: "access",
      refreshToken: "refresh",
      tokenType: "Bearer",
      expiresIn: 3600,
      expiresAt,
    },
  };
}

describe("isSessionStateExpired", () => {
  it("returns false before the early refresh window", () => {
    const now = Date.now;
    Date.now = () => 1000;

    try {
      expect(isSessionStateExpired(createState(3000, 500))).toBe(false);
    } finally {
      Date.now = now;
    }
  });

  it("returns true inside the early refresh window", () => {
    const now = Date.now;
    Date.now = () => 1000;

    try {
      expect(isSessionStateExpired(createState(1200, 500))).toBe(true);
    } finally {
      Date.now = now;
    }
  });

  it("clamps early refresh between zero and five minutes", () => {
    const now = Date.now;
    Date.now = () => 1000;

    try {
      expect(isSessionStateExpired(createState(999, -1))).toBe(true);
      expect(isSessionStateExpired(createState(301001, 999999999))).toBe(false);
      expect(isSessionStateExpired(createState(300999, 999999999))).toBe(true);
    } finally {
      Date.now = now;
    }
  });
});
