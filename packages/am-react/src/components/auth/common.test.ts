import { AuthError } from "@softwarepatterns/am";
import { describe, expect, it } from "vitest";

import {
  canSubmitEmailPassword,
  canSubmitMagicLink,
  toFieldErrors,
} from "./common.js";
import type { AuthErrorLabels } from "./labels.js";

const labels: AuthErrorLabels = {
  networkError: "Network error",
  requestFailed: "Request failed",
  invalidEmail: "Invalid email",
  invalidPassword: "Invalid password",
  badRequest: "Bad request",
  unauthorized: "Unauthorized",
  forbidden: "Forbidden",
  conflict: "Conflict",
  tooManyRequests: "Too many requests",
  serverError: "Server error",
};

describe("auth form helpers", () => {
  it("maps non-auth errors to the network error contract", () => {
    expect(toFieldErrors(new Error("offline"), labels)).toEqual({
      form: "Network error",
    });
  });

  it("maps auth status and invalid params to field errors", () => {
    const error = new AuthError({
      type: "https://example.com/problem",
      title: "Unauthorized",
      status: 401,
      detail: "Bad credentials",
      invalidParams: [
        { path: "email", reason: "invalid" },
        { path: "password", reason: "invalid" },
      ],
    });

    expect(toFieldErrors(error, labels)).toEqual({
      email: "Invalid email",
      form: "Unauthorized",
      password: "Invalid password",
    });
  });

  it("allows email-password submission only when the email and password contract is satisfied", () => {
    const base = {
      normalizedEmail: "person@example.com",
      password: "secret",
      isChecking: false,
      isSubmitting: false,
      emailState: {
        status: "active",
        preferred: "email_password",
        available: ["email_password"],
      } as const,
      canUsePassword: true,
    };

    expect(canSubmitEmailPassword(base)).toBe(true);
    expect(
      canSubmitEmailPassword({ ...base, normalizedEmail: "not-email" }),
    ).toBe(false);
    expect(canSubmitEmailPassword({ ...base, password: "" })).toBe(false);
  });

  it("allows magic-link submission only for active email states with magic link support", () => {
    const base = {
      normalizedEmail: "person@example.com",
      isChecking: false,
      isSubmitting: false,
      emailState: {
        status: "active",
        preferred: "magic_link",
        available: ["magic_link"],
      } as const,
      canUseMagic: true,
    };

    expect(canSubmitMagicLink(base)).toBe(true);
    expect(
      canSubmitMagicLink({
        ...base,
        emailState: { status: "inactive" },
      }),
    ).toBe(false);
    expect(canSubmitMagicLink({ ...base, canUseMagic: false })).toBe(false);
  });
});
