import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";

import { ThemeProvider } from "../src/theme";
import { WorkspaceShell } from "../src/workspace-shell";

it("exposes active navigation and an accessible mobile drawer", async () => {
  const user = userEvent.setup();
  render(
    <ThemeProvider>
      <WorkspaceShell
        studio
        links={[
          {
            href: "/playground",
            label: "Playground",
            icon: "chat",
            active: true,
          },
        ]}
      >
        <p>Workspace content</p>
      </WorkspaceShell>
    </ThemeProvider>,
  );
  expect(
    screen
      .getByRole("link", { name: "Playground" })
      .getAttribute("aria-current"),
  ).toBe("page");
  await user.click(screen.getByRole("button", { name: "Open navigation" }));
  expect(
    screen.getByRole("dialog", { name: "Workspace navigation" }),
  ).toBeTruthy();
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("dialog")).toBeNull();
});
