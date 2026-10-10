import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";

import type { Credentials } from "../src/credentials-form";
import { CredentialsForm } from "../src/credentials-form";

it("submits trimmed sign-up credentials and shows the returned error", async () => {
  const user = userEvent.setup();
  const submitted: Credentials[] = [];
  render(
    <CredentialsForm
      mode="sign-up"
      minPasswordLength={8}
      submit={(credentials) => {
        submitted.push(credentials);
        return Promise.resolve("User already exists");
      }}
    />,
  );
  await user.type(screen.getByLabelText("Name"), " Ada ");
  await user.type(screen.getByLabelText("Email"), "ada@example.test ");
  await user.type(screen.getByLabelText("Password"), "correct horse");
  await user.click(screen.getByRole("button", { name: "Create account" }));
  expect(submitted).toEqual([
    { name: "Ada", email: "ada@example.test", password: "correct horse" },
  ]);
  expect((await screen.findByRole("alert")).textContent).toBe(
    "User already exists",
  );
});

it("omits the name field when signing in", () => {
  render(
    <CredentialsForm
      mode="sign-in"
      minPasswordLength={8}
      submit={() => Promise.resolve(null)}
    />,
  );
  expect(screen.queryByLabelText("Name")).toBeNull();
  expect(screen.getByRole("button", { name: "Sign in" })).toBeTruthy();
});
