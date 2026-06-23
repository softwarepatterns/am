import { describe, expect, it } from "vitest";

import { hasMethod, pickInitialMode, toEmailState } from "./useEmailCheck.js";

describe("useEmailCheck helpers", () => {
  it("normalizes active email check responses", () => {
    expect(
      toEmailState({
        status: "active",
        preferred: ["magic_link"],
        available: ["email_password", "magic_link"],
      }),
    ).toEqual({
      status: "active",
      preferred: "magic_link",
      available: ["email_password", "magic_link"],
    });
  });

  it("reports method availability from preferred or available methods", () => {
    const state = {
      status: "active",
      preferred: "magic_link",
      available: [],
    } as const;

    expect(hasMethod(state, "magic_link")).toBe(true);
    expect(hasMethod(state, "email_password")).toBe(false);
  });

  it("picks the least surprising initial login mode", () => {
    expect(pickInitialMode(null)).toBe("email_password");
    expect(
      pickInitialMode({
        status: "active",
        preferred: "magic_link",
        available: ["email_password"],
      }),
    ).toBe("magic_link");
  });
});
