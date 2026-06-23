import { describe, expect, it } from "bun:test";
import { MINUTE_MS } from "./datetime";

describe("MINUTE_MS", () => {
  it("is one minute in milliseconds", () => {
    expect(MINUTE_MS).toBe(60_000);
  });
});
