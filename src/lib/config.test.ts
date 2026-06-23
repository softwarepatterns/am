import { describe, expect, it } from "bun:test";
import { createConfig } from "./config";
import { MINUTE_MS } from "./datetime";

describe("createConfig", () => {
  it("returns the default config", () => {
    const config = createConfig();

    expect(config.baseUrl).toBe("https://api.accountmaker.com");
    expect(config.earlyRefreshMs).toBe(MINUTE_MS);
    expect(config.storage).toBeNull();
    expect(config.tokensStorageKey).toBe("am_tokens");
    expect(config.profileStorageKey).toBe("am_profile");
    expect(typeof config.fetchFn).toBe("function");
  });

  it("overrides default config values", async () => {
    const response = new Response(null, { status: 204 });
    const fetchFn = async () => response;
    const storage = {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    };

    const config = createConfig({
      baseUrl: "https://example.com",
      earlyRefreshMs: 5000,
      fetchFn,
      profileStorageKey: "profile",
      storage,
      tokensStorageKey: "tokens",
    });

    expect(config.baseUrl).toBe("https://example.com");
    expect(config.earlyRefreshMs).toBe(5000);
    expect(await config.fetchFn("https://example.com")).toBe(response);
    expect(config.profileStorageKey).toBe("profile");
    expect(config.storage).toBe(storage);
    expect(config.tokensStorageKey).toBe("tokens");
  });
});
