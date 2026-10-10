import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@multitudes/ui/button";

import { auth, getSession } from "~/auth/server";

/** Header account controls: sign-in/sign-up links, or the signed-in user's menu. */
export async function AuthShowcase() {
  const session = await getSession();

  if (!session) {
    return (
      <div className="flex items-center gap-2">
        <Button asChild size="sm" variant="ghost">
          <Link href="/sign-in">Sign in</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href="/sign-up">Sign up</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <p className="hidden text-xs sm:block">
        <span>{session.user.name}</span>
      </p>

      <Button asChild size="sm" variant="ghost">
        <Link href="/settings">Settings</Link>
      </Button>

      <form>
        <Button
          size="sm"
          variant="outline"
          formAction={async () => {
            "use server";
            await auth.api.signOut({
              headers: await headers(),
            });
            redirect("/");
          }}
        >
          Sign out
        </Button>
      </form>
    </div>
  );
}
