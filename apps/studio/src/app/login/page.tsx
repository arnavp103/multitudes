import { signIn } from "~/server/actions";

export default function Login() {
  return (
    <main className="login">
      <p className="eyebrow">MULTITUDES / INTERNAL</p>
      <h1>Agent studio</h1>
      <p>
        Review production trajectories. Turn failures into regression tests.
      </p>
      <form action={signIn}>
        <button>Continue with Discord</button>
      </form>
      <p className="muted">
        Access requires a verified email on the studio allowlist.
      </p>
    </main>
  );
}
