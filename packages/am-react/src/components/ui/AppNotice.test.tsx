import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppNotice } from "./AppNotice.js";

describe("AppNotice", () => {
  it("uses alert semantics for warning and error notices", () => {
    render(<AppNotice tone="error">Unable to sign in</AppNotice>);

    expect(screen.getByRole("alert")).toHaveTextContent("Unable to sign in");
  });

  it("uses status semantics for non-disruptive notices", () => {
    render(<AppNotice tone="success">Magic link sent</AppNotice>);

    expect(screen.getByRole("status")).toHaveTextContent("Magic link sent");
  });
});
