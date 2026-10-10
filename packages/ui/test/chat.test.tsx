import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AgentChat } from "../src/agent-chat";

const done = {
  id: "run-1",
  input: "A useful task",
  status: "completed" as const,
  output: "A useful result",
  error: null,
};

describe("durable chat", () => {
  it("submits once, displays the real result, and starts a fresh task", async () => {
    const submit = vi.fn().mockResolvedValue({ id: done.id });
    const poll = vi.fn().mockResolvedValue(done);
    render(<AgentChat submit={submit} poll={poll} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Task" }), {
      target: { value: done.input },
    });
    const send = screen.getByRole("button", { name: "Send task" });
    fireEvent.click(send);
    fireEvent.click(send);
    await screen.findByText(done.output);
    expect(submit).toHaveBeenCalledExactlyOnceWith(
      done.input,
      expect.any(String),
    );
    expect(window.location.search).toBe("?run=run-1");
    fireEvent.click(screen.getByRole("button", { name: "New task" }));
    expect(window.location.search).toBe("");
    expect(screen.getByRole("textbox").getAttribute("disabled")).toBeNull();
  });

  it("restores a run and reconnects after a network failure without resubmitting", async () => {
    window.history.replaceState(null, "", "/?run=run-1");
    const submit = vi.fn();
    const poll = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue(done);
    render(<AgentChat submit={submit} poll={poll} />);
    fireEvent.click(await screen.findByRole("button", { name: "Reconnect" }));
    await screen.findByText(done.output);
    expect(submit).not.toHaveBeenCalled();
    expect(poll).toHaveBeenCalledTimes(2);
  });

  it("preserves a draft on failed submission and prevents empty sends", async () => {
    const submit = vi.fn().mockRejectedValue(new Error("failed"));
    render(<AgentChat submit={submit} poll={vi.fn()} />);
    expect(
      screen
        .getByRole("button", { name: "Send task" })
        .hasAttribute("disabled"),
    ).toBe(true);
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "keep this draft" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send task" }));
    await screen.findByRole("alert");
    expect(screen.getByRole<HTMLTextAreaElement>("textbox").value).toBe(
      "keep this draft",
    );
  });

  it("reuses a durable key after a lost response and reload", async () => {
    const submit = vi
      .fn()
      .mockRejectedValueOnce(new Error("response lost"))
      .mockResolvedValue({ id: done.id });
    const poll = vi.fn().mockResolvedValue(done);
    const first = render(<AgentChat submit={submit} poll={poll} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Task" }), {
      target: { value: done.input },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send task" }));
    await screen.findByRole("alert");
    first.unmount();
    render(<AgentChat submit={submit} poll={poll} />);
    expect(
      screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Task" }).value,
    ).toBe(done.input);
    fireEvent.click(screen.getByRole("button", { name: "Send task" }));
    await screen.findByText(done.output);
    expect(submit.mock.calls[1]?.[1]).toBe(submit.mock.calls[0]?.[1]);
  });

  it("does not submit during IME composition", () => {
    const submit = vi.fn();
    render(<AgentChat submit={submit} poll={vi.fn()} />);
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "hello" },
    });
    fireEvent.keyDown(screen.getByRole("textbox"), {
      key: "Enter",
      isComposing: true,
    });
    expect(submit).not.toHaveBeenCalled();
  });

  it("shows failures and allows a new task", async () => {
    window.history.replaceState(null, "", "/?run=run-1");
    render(
      <AgentChat
        submit={vi.fn()}
        poll={vi.fn().mockResolvedValue({
          ...done,
          status: "failed",
          output: null,
          error: "Worker failed",
        })}
      />,
    );
    await screen.findByText("Worker failed");
    expect(screen.getByRole("button", { name: "New task" })).toBeTruthy();
  });
});
