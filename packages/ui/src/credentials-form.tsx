"use client";

import type { FormEvent } from "react";
import { useState } from "react";

import { Alert, AlertDescription } from "./alert";
import { Button } from "./button";
import { Field, FieldGroup, FieldLabel } from "./field";
import { Input } from "./input";

export interface Credentials {
  /** Present only when the form collects a display name (sign-up). */
  name?: string;
  email: string;
  password: string;
}

/**
 * Email/password form shared by the product sign-in/sign-up pages and Studio
 * sign-in. Framework- and auth-client-agnostic: the app supplies `submit`,
 * which resolves to an error message to display, or `null` once it has
 * navigated away.
 */
export function CredentialsForm({
  mode,
  submit,
  minPasswordLength,
}: {
  mode: "sign-in" | "sign-up";
  submit: (credentials: Credentials) => Promise<string | null>;
  minPasswordLength: number;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const signUp = mode === "sign-up";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (name: string) => {
      const value = form.get(name);
      return typeof value === "string" ? value : "";
    };
    setPending(true);
    setError(null);
    try {
      const failure = await submit({
        ...(signUp ? { name: text("name").trim() } : {}),
        email: text("email").trim(),
        password: text("password"),
      });
      setError(failure);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <FieldGroup>
        {signUp && (
          <Field>
            <FieldLabel htmlFor="credentials-name">Name</FieldLabel>
            <Input
              id="credentials-name"
              name="name"
              autoComplete="name"
              required
              maxLength={200}
            />
          </Field>
        )}
        <Field>
          <FieldLabel htmlFor="credentials-email">Email</FieldLabel>
          <Input
            id="credentials-email"
            name="email"
            type="email"
            autoComplete="email"
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="credentials-password">Password</FieldLabel>
          <Input
            id="credentials-password"
            name="password"
            type="password"
            autoComplete={signUp ? "new-password" : "current-password"}
            minLength={signUp ? minPasswordLength : undefined}
            required
          />
        </Field>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <Button type="submit" disabled={pending}>
          {signUp ? "Create account" : "Sign in"}
        </Button>
      </FieldGroup>
    </form>
  );
}
