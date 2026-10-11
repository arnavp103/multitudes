import { Button } from "@multitudes/ui/button";
import { TachyonBackdrop } from "@multitudes/ui/tachyon-backdrop";

import { signIn } from "~/server/actions";

export default function Login() {
  return (
    <>
      <TachyonBackdrop />
      <main className="login tc-stagger">
        <p className="eyebrow">Multitudes / internal</p>
        <h1>Agent studio</h1>
        <p className="text-lead text-muted-foreground">
          Review production trajectories. Turn failures into regression tests.
        </p>
        <section className="panel mt-2 grid gap-3">
          <form action={signIn}>
            <Button size="lg">Continue with Discord</Button>
          </form>
          <p className="muted">
            Access requires a verified account with a Studio role.
          </p>
        </section>
      </main>
    </>
  );
}
