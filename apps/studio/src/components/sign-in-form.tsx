"use client";

import { useRouter } from "next/navigation";
import { createAuthClient } from "better-auth/react";

import { MIN_PASSWORD_LENGTH } from "@multitudes/auth/password";
import { CredentialsForm } from "@multitudes/ui/credentials-form";

/** Same-origin client: Studio's HTTP auth endpoints apply origin checks and rate limits. */
const authClient = createAuthClient();

/** Staff email/password sign-in. Studio has no sign-up; accounts are provisioned by an operator. */
export function SignInForm() {
  const router = useRouter();
  return (
    <CredentialsForm
      mode="sign-in"
      minPasswordLength={MIN_PASSWORD_LENGTH}
      submit={async ({ email, password }) => {
        const { error } = await authClient.signIn.email({ email, password });
        if (error) return error.message ?? "Unable to sign in. Try again.";
        router.replace("/");
        router.refresh();
        return null;
      }}
    />
  );
}
