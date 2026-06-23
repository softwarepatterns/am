import { describe, expect, it } from "bun:test";
import { isProblemJsonResponse, readResJsonAsObject } from "./http-response";

describe("http response helpers", () => {
  it("reads object JSON responses", async () => {
    const response = Response.json({ ok: true });

    await expect(readResJsonAsObject(response)).resolves.toEqual({ ok: true });
  });

  it("returns null for non-object JSON responses", async () => {
    await expect(readResJsonAsObject(Response.json(["value"]))).resolves.toBeNull();
    await expect(readResJsonAsObject(Response.json("value"))).resolves.toBeNull();
  });

  it("returns null when JSON parsing fails", async () => {
    const response = new Response("not-json", {
      headers: { "Content-Type": "application/json" },
    });

    await expect(readResJsonAsObject(response)).resolves.toBeNull();
  });

  it("detects problem JSON responses", () => {
    expect(
      isProblemJsonResponse(
        new Response(null, {
          headers: { "Content-Type": "application/problem+json" },
        }),
      ),
    ).toBe(true);
    expect(
      isProblemJsonResponse(
        new Response(null, {
          headers: { "Content-Type": "application/json" },
        }),
      ),
    ).toBe(false);
  });
});
