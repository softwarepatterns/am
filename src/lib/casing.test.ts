import { describe, expect, it } from "bun:test";
import {
  camelCaseObj,
  camelCaseStr,
  snakeCaseObj,
  snakeCaseStr,
} from "./casing";

describe("casing", () => {
  it("converts snake_case strings to camelCase", () => {
    expect(camelCaseStr("access_token")).toBe("accessToken");
    expect(camelCaseStr("alreadyCamel")).toBe("alreadyCamel");
  });

  it("converts camelCase strings to snake_case", () => {
    expect(snakeCaseStr("accessToken")).toBe("access_token");
    expect(snakeCaseStr("already_snake")).toBe("already_snake");
  });

  it("converts object keys to camelCase recursively", () => {
    expect(
      camelCaseObj({
        access_token: "token",
        nested_value: {
          refresh_token: "refresh",
        },
        list_values: [{ expires_at: 123 }],
      }),
    ).toEqual({
      accessToken: "token",
      nestedValue: {
        refreshToken: "refresh",
      },
      listValues: [{ expiresAt: 123 }],
    });
  });

  it("converts object keys to snake_case recursively", () => {
    expect(
      snakeCaseObj({
        accessToken: "token",
        nestedValue: {
          refreshToken: "refresh",
        },
        listValues: [{ expiresAt: 123 }],
      }),
    ).toEqual({
      access_token: "token",
      nested_value: {
        refresh_token: "refresh",
      },
      list_values: [{ expires_at: 123 }],
    });
  });

  it("returns non-object values unchanged", () => {
    expect(camelCaseObj(null)).toBeNull();
    expect(camelCaseObj("value")).toBe("value");
    expect(snakeCaseObj(null)).toBeNull();
    expect(snakeCaseObj("value")).toBe("value");
  });
});
