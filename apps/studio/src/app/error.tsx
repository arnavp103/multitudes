"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main>
      <h1>Unable to load the studio</h1>
      <p>
        Check your account access and server configuration. Failed form
        submissions may have invalid or missing fields.
      </p>
      <button onClick={reset}>Try again</button>
    </main>
  );
}
