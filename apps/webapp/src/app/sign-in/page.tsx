import Link from "next/link";
import { redirect } from "next/navigation";

import { getSession } from "~/auth/server";
import { AuthPage } from "../_components/auth-page";
import { PasswordAuth } from "../_components/password-auth";

export const dynamic = "force-dynamic";

export default async function SignInPage() {
  if (await getSession()) redirect("/");
  return (
    <AuthPage
      title="Sign in"
      description="Welcome back to your agent workspace."
      footer={
        <>
          New here?{" "}
          <Link href="/sign-up" className="text-foreground underline">
            Create an account
          </Link>
        </>
      }
    >
      <PasswordAuth mode="sign-in" />
    </AuthPage>
  );
}
