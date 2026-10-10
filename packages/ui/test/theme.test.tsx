import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";

import { ThemeProvider, ThemeToggle } from "../src/theme";

it("defaults to dark and persists the user's explicit light choice", async () => {
  const user = userEvent.setup();
  render(
    <ThemeProvider>
      <ThemeToggle />
    </ThemeProvider>,
  );
  await waitFor(() =>
    expect(document.documentElement.classList.contains("dark")).toBe(true),
  );
  await user.click(screen.getByRole("button", { name: "Change color theme" }));
  await user.click(screen.getByRole("menuitem", { name: "Light" }));
  await waitFor(() =>
    expect(document.documentElement.classList.contains("light")).toBe(true),
  );
  expect(localStorage.getItem("multitudes-theme")).toBe("light");
});
