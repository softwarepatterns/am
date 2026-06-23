import { describe, expect, it } from "vitest";

import { isLikelyEmail, normalizeEmail } from "./emails.js";

describe("email helpers", () => {
  it("normalizes email casing and surrounding whitespace", () => {
    expect(normalizeEmail(" Person@Example.COM ")).toBe("person@example.com");
  });

  it("accepts simple email shapes and rejects incomplete values", () => {
    expect(isLikelyEmail("person@example.com")).toBe(true);
    expect(isLikelyEmail("person")).toBe(false);
    expect(isLikelyEmail("person@example")).toBe(false);
  });
});
