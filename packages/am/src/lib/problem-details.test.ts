import { describe, expect, it } from "bun:test";
import { isProblemDetails, toGenericProblemDetails } from "./problem-details";

describe("problem details", () => {
  it("creates generic problem details from a response", () => {
    const response = new Response(null, {
      status: 418,
      statusText: "I'm a Teapot",
    });

    expect(toGenericProblemDetails(response, "short and stout")).toEqual({
      type: "about:blank",
      title: "I'm a Teapot",
      status: 418,
      detail: "short and stout",
    });
  });

  it("omits non-string detail values", () => {
    const response = new Response(null, { status: 500 });

    expect(toGenericProblemDetails(response, { error: true })).toEqual({
      type: "about:blank",
      title: "Request failed",
      status: 500,
      detail: undefined,
    });
  });

  it("recognizes valid problem details", () => {
    expect(
      isProblemDetails({
        type: "about:blank",
        title: "Unauthorized",
        status: 401,
      }),
    ).toBe(true);
  });

  it("rejects invalid problem details", () => {
    expect(isProblemDetails(null)).toBe(false);
    expect(isProblemDetails({ type: "about:blank", status: 401 })).toBe(false);
    expect(
      isProblemDetails({
        type: "about:blank",
        title: "Unauthorized",
        status: "401",
      }),
    ).toBe(false);
  });
});
