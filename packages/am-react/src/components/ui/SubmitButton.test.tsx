import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SubmitButton } from "./SubmitButton.js";

describe("SubmitButton", () => {
  it("renders idle children and allows clicks", async () => {
    const onClick = vi.fn();

    render(
      <SubmitButton state="idle" onClick={onClick}>
        Save
      </SubmitButton>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("disables the button while busy", () => {
    render(<SubmitButton state="busy">Save</SubmitButton>);

    expect(screen.getByRole("button")).toBeDisabled();
    expect(screen.getByRole("button")).toHaveAttribute("aria-busy", "true");
  });
});
