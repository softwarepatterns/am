import { describe, expect, it } from "bun:test";
import type { SessionTokens, StorageLike } from "../types";
import {
  isSessionTokens,
  readSessionTokens,
  toSessionTokens,
  writeTokensIfNewer,
} from "./session-tokens";

function createStorage(): StorageLike {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
}

function createTokens(expiresAt: number): SessionTokens {
  return {
    accessToken: "access",
    refreshToken: "refresh",
    tokenType: "Bearer",
    expiresIn: 3600,
    expiresAt,
  };
}

describe("session token helpers", () => {
  it("normalizes token expiration", () => {
    const now = Date.now;
    Date.now = () => 1000;

    try {
      expect(
        toSessionTokens({
          accessToken: "access",
          refreshToken: "refresh",
          tokenType: "Bearer",
          expiresIn: 2,
        }),
      ).toEqual({
        accessToken: "access",
        refreshToken: "refresh",
        tokenType: "Bearer",
        expiresIn: 2,
        expiresAt: 3000,
      });
    } finally {
      Date.now = now;
    }
  });

  it("recognizes valid session tokens", () => {
    expect(isSessionTokens(createTokens(1))).toBe(true);
    expect(isSessionTokens({ ...createTokens(1), tokenType: "Basic" })).toBe(
      false,
    );
    expect(isSessionTokens(null)).toBe(false);
  });

  it("reads valid tokens from storage", () => {
    const storage = createStorage();
    const tokens = createTokens(1);
    storage.setItem("tokens", JSON.stringify(tokens));

    expect(readSessionTokens(storage, "tokens")).toEqual(tokens);
  });

  it("returns null for invalid or unavailable token storage", () => {
    const storage = createStorage();
    storage.setItem("tokens", JSON.stringify({ accessToken: "access" }));

    expect(readSessionTokens(storage, "tokens")).toBeNull();
    expect(readSessionTokens(null, "tokens")).toBeNull();
  });

  it("writes tokens when newer and preserves newer stored tokens", () => {
    const storage = createStorage();
    const newer = createTokens(20);
    storage.setItem("tokens", JSON.stringify(newer));

    writeTokensIfNewer(storage, "tokens", createTokens(10));
    expect(readSessionTokens(storage, "tokens")).toEqual(newer);

    const newest = createTokens(30);
    writeTokensIfNewer(storage, "tokens", newest);
    expect(readSessionTokens(storage, "tokens")).toEqual(newest);
  });

  it("clears invalid stored tokens before writing", () => {
    const storage = createStorage();
    const tokens = createTokens(10);
    storage.setItem("tokens", JSON.stringify({ accessToken: "access" }));

    writeTokensIfNewer(storage, "tokens", tokens);

    expect(readSessionTokens(storage, "tokens")).toEqual(tokens);
  });

  it("does nothing without storage", () => {
    expect(() => writeTokensIfNewer(null, "tokens", createTokens(10))).not.toThrow();
  });
});
