import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Button } from "@multitudes/ui/button";

import { auth, getSession } from "~/auth/server";

export async function AuthShowcase() {
  const session = await getSession();

  if (!session) return null;

  return (
    <div className="flex items-center gap-3">
      <p className="hidden text-xs sm:block">
        <span>{session.user.name}</span>
      </p>

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
