import { describe, it, expect } from "bun:test";
import { AuthError } from "./auth";

describe("AuthError", () => {
  it("exposes problem details properties", () => {
    const error = new AuthError({
      type: "https://example.com/errors/invalid-credentials",
      title: "Invalid credentials",
      status: 401,
      detail: "The email or password is incorrect.",
    });

    expect(error.type).toBe("https://example.com/errors/invalid-credentials");
    expect(error.title).toBe("Invalid credentials");
    expect(error.status).toBe(401);
    expect(error.detail).toBe("The email or password is incorrect.");
    expect(error.message).toBe("Invalid credentials");
    expect(error.name).toBe("AuthError");
  });

  it("freezes the problem object", () => {
    const error = new AuthError({
      type: "about:blank",
      title: "Error",
      status: 400,
    });

    expect(Object.isFrozen(error.problem)).toBe(true);
  });
});
