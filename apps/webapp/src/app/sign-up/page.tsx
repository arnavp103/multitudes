import Link from "next/link";
import { redirect } from "next/navigation";

import { getSession } from "~/auth/server";
import { AuthPage } from "../_components/auth-page";
import { PasswordAuth } from "../_components/password-auth";

export const dynamic = "force-dynamic";

export default async function SignUpPage() {
  if (await getSession()) redirect("/");
  return (
    <AuthPage
      title="Create an account"
      description="Start working with your agent."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/sign-in" className="text-foreground underline">
            Sign in
          </Link>
        </>
      }
    >
      <PasswordAuth mode="sign-up" />
    </AuthPage>
  );
}
