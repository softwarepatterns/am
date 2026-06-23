import { describe, expect, it } from "bun:test";
import { AuthError } from "./auth-error";
import type { ProblemDetails } from "./problem-details";

describe("AuthError", () => {
  it("wraps problem details as an Error", () => {
    const problem: ProblemDetails = {
      type: "https://example.com/problems/invalid",
      title: "Invalid request",
      status: 400,
      code: "invalid_request",
      detail: "Email is required",
      invalidParams: [
        {
          in: "body",
          path: "email",
          type: "required",
          received: undefined,
        },
      ],
    };

    const error = new AuthError(problem);

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("AuthError");
    expect(error.message).toBe(problem.title);
    expect(error.problem).toEqual(problem);
    expect(error.type).toBe(problem.type);
    expect(error.title).toBe(problem.title);
    expect(error.status).toBe(problem.status);
    expect(error.code).toBe(problem.code);
    expect(error.detail).toBe(problem.detail);
    expect(error.invalidParams).toEqual(problem.invalidParams);
  });

  it("freezes the wrapped problem", () => {
    const error = new AuthError({
      type: "about:blank",
      title: "Unauthorized",
      status: 401,
    });

    expect(Object.isFrozen(error.problem)).toBe(true);
  });
});
