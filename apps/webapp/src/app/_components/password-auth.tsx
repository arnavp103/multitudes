"use client";

import { useRouter } from "next/navigation";

import { MIN_PASSWORD_LENGTH } from "@multitudes/auth/password";
import { CredentialsForm } from "@multitudes/ui/credentials-form";

import { authClient } from "~/auth/client";

/** Email/password sign-in or sign-up through Better Auth, then return to the workspace. */
export function PasswordAuth({ mode }: { mode: "sign-in" | "sign-up" }) {
  const router = useRouter();
  return (
    <CredentialsForm
      mode={mode}
      minPasswordLength={MIN_PASSWORD_LENGTH}
      submit={async ({ name, email, password }) => {
        const { error } =
          mode === "sign-up"
            ? await authClient.signUp.email({
                name: name ?? "",
                email,
                password,
              })
            : await authClient.signIn.email({ email, password });
        if (error) return error.message ?? "Unable to continue. Try again.";
        router.replace("/");
        router.refresh();
        return null;
      }}
    />
  );
}
