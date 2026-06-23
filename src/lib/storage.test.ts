import { describe, expect, it } from "bun:test";
import type { StorageLike } from "../types";
import { clearStorage, getStorageLike, readStorage, writeStorage } from "./storage";

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

describe("storage helpers", () => {
  it("resolves nullish storage configs to null", () => {
    expect(getStorageLike(null)).toBeNull();
    expect(getStorageLike(undefined)).toBeNull();
  });

  it("resolves custom storage objects", () => {
    const storage = createStorage();

    expect(getStorageLike(storage)).toBe(storage);
  });

  it("resolves browser localStorage when requested", () => {
    const originalWindow = (globalThis as any).window;
    const localStorage = createStorage();

    try {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: { localStorage },
      });

      expect(getStorageLike("localStorage")).toBe(localStorage);
    } finally {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: originalWindow,
      });
    }
  });

  it("returns null when browser localStorage is unavailable", () => {
    const originalWindow = (globalThis as any).window;

    try {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: undefined,
      });

      expect(getStorageLike("localStorage")).toBeNull();
    } finally {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: originalWindow,
      });
    }
  });

  it("reads and writes JSON values", () => {
    const storage = createStorage();

    writeStorage(storage, "key", { value: 1 });

    expect(readStorage(storage, "key")).toEqual({ value: 1 });
  });

  it("returns null when reading invalid or unavailable storage", () => {
    const storage = createStorage();
    storage.setItem("key", "not-json");

    expect(readStorage(storage, "key")).toBeNull();
    expect(readStorage(null, "key")).toBeNull();
  });

  it("clears stored values", () => {
    const storage = createStorage();
    writeStorage(storage, "key", { value: 1 });

    clearStorage(storage, "key");

    expect(readStorage(storage, "key")).toBeNull();
  });

  it("ignores write and clear errors", () => {
    const storage: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new Error("write failed");
      },
      removeItem: () => {
        throw new Error("remove failed");
      },
    };

    expect(() => writeStorage(storage, "key", { value: 1 })).not.toThrow();
    expect(() => clearStorage(storage, "key")).not.toThrow();
  });
});
