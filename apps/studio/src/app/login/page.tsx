import { SignInForm } from "~/components/sign-in-form";

export default function Login() {
  return (
    <main className="login">
      <p className="eyebrow">MULTITUDES / INTERNAL</p>
      <h1>Agent studio</h1>
      <p>
        Review production trajectories. Turn failures into regression tests.
      </p>
      <SignInForm />
      <p className="muted">
        Studio accounts are provisioned by an administrator and need a staff
        role.
      </p>
    </main>
  );
}
