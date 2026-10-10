"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowUpIcon,
  CheckIcon,
  CopyIcon,
  LoaderCircleIcon,
  SparklesIcon,
} from "lucide-react";

import { reportClientError } from "@multitudes/observability/browser";

import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "./ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "./ai-elements/message";
import { Suggestion, Suggestions } from "./ai-elements/suggestion";
import { Alert, AlertDescription, AlertTitle } from "./alert";
import { Badge } from "./badge";
import { Button } from "./button";
import { Textarea } from "./textarea";

export interface ChatSnapshot {
  id: string;
  input: string;
  status: "queued" | "running" | "completed" | "failed";
  output: string | null;
  error: string | null;
}

/** Recover only our own well-formed pending request; malformed browser state is discarded. */
function pendingSubmission(storageKey: string) {
  try {
    const value: unknown = JSON.parse(
      sessionStorage.getItem(storageKey) ?? "null",
    );
    if (
      value &&
      typeof value === "object" &&
      "input" in value &&
      typeof value.input === "string" &&
      "scope" in value &&
      typeof value.scope === "string" &&
      "key" in value &&
      typeof value.key === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value.key,
      )
    )
      return { input: value.input, scope: value.scope, key: value.key };
  } catch {
    /* A malformed entry is not an admission receipt. */
  }
  return null;
}

/** Read-only transcript, reused for the product workspace and persisted studio runs. */
export function RunConversation({ run }: { run: ChatSnapshot }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-8">
      <Message from="user">
        <MessageContent>{run.input}</MessageContent>
      </Message>
      <Message from="assistant">
        <div className="text-primary bg-primary/10 flex size-8 shrink-0 items-center justify-center rounded-lg">
          <SparklesIcon className="size-4" />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex items-center gap-3 text-sm font-medium">
            Multitudes{" "}
            <Badge
              variant="outline"
              className="text-muted-foreground text-[10px]"
            >
              {run.status}
            </Badge>
          </div>
          {run.output !== null ? (
            <>
              <MessageContent>
                <MessageResponse>{run.output}</MessageResponse>
              </MessageContent>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  void navigator.clipboard
                    .writeText(run.output ?? "")
                    .then(() => setCopied(true))
                    .catch((error: unknown) =>
                      reportClientError("copy-response", error),
                    );
                }}
              >
                {copied ? (
                  <CheckIcon className="size-3" />
                ) : (
                  <CopyIcon className="size-3" />
                )}
                {copied ? "Copied" : "Copy response"}
              </Button>
            </>
          ) : run.status === "failed" ? (
            <Alert variant="destructive">
              <AlertTitle>Task failed</AlertTitle>
              <AlertDescription>
                {run.error ?? "The task could not finish."}
              </AlertDescription>
            </Alert>
          ) : (
            <p
              role="status"
              className="text-muted-foreground flex items-center gap-2 text-sm"
            >
              <LoaderCircleIcon className="size-3 animate-spin" />
              {run.status === "queued"
                ? "Queued · waiting for a worker"
                : "Working on your task…"}
            </p>
          )}
        </div>
      </Message>
    </div>
  );
}

/** Durable task UI: only the run ID goes in the URL; reconnecting never resubmits a task. */
export function AgentChat({
  submit,
  submissionScope = "default",
  poll,
  disabled = false,
  modelLabel = "Agent",
  runHref,
}: {
  submit: (input: string, requestKey: string) => Promise<{ id: string }>;
  submissionScope?: string;
  poll: (id: string) => Promise<ChatSnapshot>;
  disabled?: boolean;
  modelLabel?: string;
  runHref?: (id: string) => string;
}) {
  const [draft, setDraft] = useState("");
  const [runId, setRunId] = useState<string | null>(null);
  const [run, setRun] = useState<ChatSnapshot | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connection, setConnection] = useState(0);
  const submittingRef = useRef(false);
  const finished = run?.status === "completed" || run?.status === "failed";

  useEffect(() => {
    const id = new URL(window.location.href).searchParams.get("run");
    // The URL is an external browser store, read after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (id) setRunId(id);
    else {
      const pending = pendingSubmission(
        `multitudes:pending:${window.location.pathname}`,
      );

      if (pending) setDraft(pending.input);
    }
  }, []);

  useEffect(() => {
    if (!runId || finished) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = async () => {
      try {
        const snapshot = await poll(runId);
        if (cancelled) return;
        setRun(snapshot);
        setError(null);
        if (snapshot.status === "queued" || snapshot.status === "running")
          timer = setTimeout(() => {
            void refresh();
          }, 2000);
      } catch (cause) {
        if (cancelled) return;
        reportClientError("chat-poll", cause);
        setError(
          "Connection interrupted. Reconnect to check this task; it may still be running.",
        );
      }
    };
    void refresh();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [runId, poll, finished, connection]);

  function remember(id: string | null) {
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("run", id);
    else url.searchParams.delete("run");
    window.history.replaceState(null, "", url);
    setRunId(id);
  }

  async function send() {
    if (!draft.trim() || submittingRef.current || runId || disabled) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const text = draft.trim();
      const storageKey = `multitudes:pending:${window.location.pathname}`;
      const saved = pendingSubmission(storageKey);
      const key =
        saved?.input === text && saved.scope === submissionScope
          ? saved.key
          : crypto.randomUUID();
      // Persist before sending: losing the response must not create a second job on retry.
      sessionStorage.setItem(
        storageKey,
        JSON.stringify({ input: text, scope: submissionScope, key }),
      );
      const { id } = await submit(text, key);
      sessionStorage.removeItem(storageKey);
      setRun({
        id,
        input: draft.trim(),
        output: null,
        error: null,
        status: "queued",
      });
      remember(id);
      setDraft("");
    } catch (cause) {
      reportClientError("chat-submit", cause);
      setError(
        "We could not confirm submission. Retry safely with the same task; your draft is preserved.",
      );
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <section
      aria-label="Agent chat"
      className="bg-card flex min-h-[620px] flex-col overflow-hidden rounded-xl border shadow-sm"
    >
      <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
        <div className="flex items-center gap-2 text-sm">
          <span className="bg-primary size-1.5 rounded-full" />
          <span className="font-medium">Task workspace</span>
          <span className="text-muted-foreground hidden sm:inline">
            / {modelLabel}
          </span>
        </div>
        {finished && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              remember(null);
              setRun(null);
              setError(null);
            }}
          >
            New task
          </Button>
        )}
        {runId && runHref && (
          <a
            className="text-primary text-xs hover:underline"
            href={runHref(runId)}
          >
            Inspect trajectory ↗
          </a>
        )}
      </div>
      <Conversation className="h-[420px] flex-none">
        <ConversationContent className="mx-auto w-full max-w-3xl p-6 md:p-8">
          {run ? (
            <RunConversation run={run} />
          ) : runId ? (
            <p role="status" className="text-muted-foreground">
              Restoring task…
            </p>
          ) : (
            <ConversationEmptyState
              title="What are we working on?"
              description="Give your agent a task. Follow its progress and review the result."
              icon={<SparklesIcon className="text-primary mb-3 size-8" />}
            />
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <div className="mx-auto mt-auto w-full max-w-3xl space-y-3 px-5 pb-5">
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Unable to continue</AlertTitle>
            <AlertDescription>
              {error}
              {runId && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setError(null);
                    setConnection((value) => value + 1);
                  }}
                >
                  Reconnect
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}
        {!runId && (
          <Suggestions>
            <Suggestion
              suggestion="Break down a complex decision"
              onClick={setDraft}
              disabled={disabled}
            />
            <Suggestion
              suggestion="Review a plan for risks"
              onClick={setDraft}
              disabled={disabled}
            />
          </Suggestions>
        )}
        <form
          className="bg-background focus-within:ring-ring/30 rounded-xl border p-3 focus-within:ring-2"
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
        >
          <Textarea
            aria-label="Task"
            placeholder={
              disabled ? "Sign in to start a task" : "Describe your task…"
            }
            value={draft}
            maxLength={64000}
            onChange={(event) => setDraft(event.target.value)}
            disabled={disabled || submitting || !!runId}
            className="min-h-20 resize-none border-0 bg-transparent! p-1 shadow-none focus-visible:ring-0"
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                void send();
              }
            }}
          />
          <div className="mt-2 flex items-center justify-between gap-4">
            <span className="text-muted-foreground text-[11px]">
              {runId
                ? "This task is saved. You can return to this URL."
                : "Each task starts a fresh conversation."}
            </span>
            <Button
              type="submit"
              size="icon"
              aria-label="Send task"
              disabled={disabled || submitting || !!runId || !draft.trim()}
            >
              {submitting ? (
                <LoaderCircleIcon className="size-4 animate-spin" />
              ) : (
                <ArrowUpIcon className="size-4" />
              )}
            </Button>
          </div>
        </form>
      </div>
    </section>
  );
}
