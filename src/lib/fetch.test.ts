import { describe, expect, it } from "bun:test";
import {
  defaultFetchFn,
  fetchGETHeaders,
  fetchPOSTHeaders,
  updateBearer,
} from "./fetch";

describe("fetch helpers", () => {
  it("returns a bound global fetch implementation", async () => {
    const originalFetch = globalThis.fetch;
    const response = new Response(null, { status: 204 });
    const thisValues: unknown[] = [];

    globalThis.fetch = function fakeFetch(this: unknown) {
      thisValues.push(this);
      return Promise.resolve(response);
    } as typeof fetch;

    try {
      const fetchFn = defaultFetchFn();

      expect(await fetchFn("https://example.com")).toBe(response);
      expect(thisValues).toEqual([globalThis]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("returns a fetch function that fails when global fetch is missing", async () => {
    const originalFetch = globalThis.fetch;

    try {
      Object.defineProperty(globalThis, "fetch", {
        configurable: true,
        value: undefined,
      });

      const fetchFn = defaultFetchFn();

      await expect(fetchFn("https://example.com")).rejects.toThrow(
        "Missing fetch implementation",
      );
    } finally {
      Object.defineProperty(globalThis, "fetch", {
        configurable: true,
        value: originalFetch,
      });
    }
  });

  it("exports JSON request headers", () => {
    expect(fetchGETHeaders).toEqual({
      Accept: "application/json",
    });
    expect(fetchPOSTHeaders).toEqual({
      Accept: "application/json",
      "Content-Type": "application/json",
    });
  });

  it("adds an Authorization bearer header without dropping existing init", () => {
    const init = {
      method: "POST",
      headers: {
        "X-Test": "yes",
      },
    };

    const updated = updateBearer(init, "abc123");
    const headers = new Headers(updated.headers);

    expect(updated.method).toBe("POST");
    expect(headers.get("Authorization")).toBe("Bearer abc123");
    expect(headers.get("X-Test")).toBe("yes");
  });
});
