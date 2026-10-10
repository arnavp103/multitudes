"use client";

import { useEffect } from "react";

import { Alert, AlertDescription, AlertTitle } from "@multitudes/ui/alert";
import { Button } from "@multitudes/ui/button";

import { reportError } from "~/logger/browser";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => reportError("webapp", error), [error]);
  return (
    <main className="mx-auto max-w-xl p-8">
      <Alert variant="destructive">
        <AlertTitle>Unable to load this page</AlertTitle>
        <AlertDescription>
          Check your access and try again. If this continues, share the
          reference with an administrator.
          {error.digest && <code>{error.digest}</code>}
        </AlertDescription>
      </Alert>
      <Button className="mt-4" onClick={reset}>
        Try again
      </Button>
    </main>
  );
}
