import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { EmailInput } from "./EmailInput.js";

const labels = {
  email: "Email",
  checkingAvailability: "Checking availability",
};

describe("EmailInput", () => {
  it("renders the labeled email field and reports value changes", async () => {
    const onValueChange = vi.fn();

    render(
      <EmailInput
        email=""
        isChecking={false}
        isSubmitting={false}
        labels={labels}
        onValueChange={onValueChange}
      />,
    );

    await userEvent.type(screen.getByLabelText("Email"), "a");

    expect(onValueChange).toHaveBeenCalledWith("a");
  });

  it("marks the field invalid when an error is present", () => {
    render(
      <EmailInput
        email="bad"
        error="Invalid email"
        isChecking={false}
        isSubmitting={false}
        labels={labels}
        onValueChange={() => {}}
      />,
    );

    expect(screen.getByLabelText("Email")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByText("Invalid email")).toBeInTheDocument();
  });
});
