import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PasswordInput } from "./PasswordInput.js";

const labels = {
  password: "Password",
  hidePassword: "Hide password",
  showPassword: "Show password",
};

describe("PasswordInput", () => {
  it("renders a password field and reports value changes", async () => {
    const onValueChange = vi.fn();

    render(
      <PasswordInput
        password=""
        isSubmitting={false}
        labels={labels}
        onValueChange={onValueChange}
      />,
    );

    await userEvent.type(screen.getByLabelText("Password"), "s");

    expect(onValueChange).toHaveBeenCalledWith("s");
  });

  it("toggles password visibility using the accessible button label", async () => {
    render(
      <PasswordInput
        password="secret"
        isSubmitting={false}
        labels={labels}
        onValueChange={() => {}}
      />,
    );

    const input = screen.getByLabelText("Password");
    expect(input).toHaveAttribute("type", "password");

    await userEvent.click(screen.getByRole("button", { name: "Show password" }));

    expect(input).toHaveAttribute("type", "text");
    expect(
      screen.getByRole("button", { name: "Hide password" }),
    ).toBeInTheDocument();
  });
});
