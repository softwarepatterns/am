import { describe, expect, it } from "bun:test";
import type { SessionProfile, StorageLike } from "../types";
import {
  isSessionProfile,
  readSessionProfile,
  toSessionProfile,
  writeProfileIfNewer,
} from "./session-profile";

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

function createProfile(lastUpdatedAt: number): SessionProfile {
  return {
    id: "uid_1",
    applicationId: "app_1",
    status: "active",
    identity: null,
    credentials: [],
    memberships: [],
    activeMembership: null,
    lastUpdatedAt,
  };
}

describe("session profile helpers", () => {
  it("normalizes profile shape and timestamps it", () => {
    const now = Date.now;
    Date.now = () => 1234;

    try {
      expect(
        toSessionProfile({
          id: "uid_1",
          applicationId: "app_1",
          status: "active",
          identity: null,
          emailCredentials: [{ id: "email_1" }],
        }),
      ).toMatchObject({
        credentials: [{ id: "email_1" }],
        activeMembership: null,
        lastUpdatedAt: 1234,
      });
    } finally {
      Date.now = now;
    }
  });

  it("recognizes valid session profiles", () => {
    expect(isSessionProfile(createProfile(1))).toBe(true);
    expect(isSessionProfile({ ...createProfile(1), applicationId: 1 })).toBe(
      false,
    );
    expect(isSessionProfile(null)).toBe(false);
  });

  it("reads valid profiles from storage", () => {
    const storage = createStorage();
    const profile = createProfile(1);
    storage.setItem("profile", JSON.stringify(profile));

    expect(readSessionProfile(storage, "profile")).toEqual(profile);
  });

  it("returns null for invalid or unavailable profile storage", () => {
    const storage = createStorage();
    storage.setItem("profile", JSON.stringify({ id: "uid_1" }));

    expect(readSessionProfile(storage, "profile")).toBeNull();
    expect(readSessionProfile(null, "profile")).toBeNull();
  });

  it("writes profiles when newer and preserves newer stored profiles", () => {
    const storage = createStorage();
    const newer = createProfile(20);
    storage.setItem("profile", JSON.stringify(newer));

    writeProfileIfNewer(storage, "profile", createProfile(10));
    expect(readSessionProfile(storage, "profile")).toEqual(newer);

    const newest = createProfile(30);
    writeProfileIfNewer(storage, "profile", newest);
    expect(readSessionProfile(storage, "profile")).toEqual(newest);
  });

  it("clears invalid stored profiles before writing", () => {
    const storage = createStorage();
    const profile = createProfile(10);
    storage.setItem("profile", JSON.stringify({ id: "uid_1" }));

    writeProfileIfNewer(storage, "profile", profile);

    expect(readSessionProfile(storage, "profile")).toEqual(profile);
  });

  it("does nothing without storage", () => {
    expect(() =>
      writeProfileIfNewer(null, "profile", createProfile(10)),
    ).not.toThrow();
  });
});
