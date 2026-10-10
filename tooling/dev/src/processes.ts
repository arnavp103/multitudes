import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { setTimeout } from "node:timers/promises";
import { fileURLToPath } from "node:url";

export const root = fileURLToPath(new URL("../../../", import.meta.url));
/** Allocate a loopback port independently for every worktree/test invocation. */
export async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("No port allocated");
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return address.port;
}
const running = new Set<ReturnType<typeof launch>>();
/**
 * Detached groups never see the terminal's Ctrl-C, so stop them ourselves. Handlers stay
 * installed because the signal arrives several times (terminal, version.mjs, pnpm) and a
 * repeat with no listener would kill us before the groups are gone.
 */
export const interrupted = new Promise<NodeJS.Signals>((resolve) => {
  for (const signal of ["SIGINT", "SIGTERM"] as const)
    process.on(signal, () => {
      resolve(signal);
      void Promise.all([...running].map((child) => child.stop())).finally(() =>
        process.exit(130),
      );
    });
});
/** Managed process group: tear down the full Next/pnpm tree, including on failed tests. */
export function launch(
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  cwd = root,
) {
  const child = spawn(command, args, {
    cwd,
    env,
    stdio: "inherit",
    detached: process.platform !== "win32",
  });
  const done = new Promise<number>((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });
  void done.catch(() => undefined);
  let stopping: Promise<void> | undefined;
  const managed = {
    child,
    done,
    stop() {
      stopping ??= (async () => {
        if (child.exitCode !== null || child.signalCode !== null || !child.pid)
          return;
        const pid = child.pid;
        const signal = (value: NodeJS.Signals) => {
          try {
            if (process.platform === "win32") child.kill(value);
            else process.kill(-pid, value);
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
          }
        };
        signal("SIGTERM");
        const timer = globalThis.setTimeout(() => signal("SIGKILL"), 10_000);
        try {
          await done;
        } finally {
          clearTimeout(timer);
        }
      })();
      return stopping;
    },
  };
  running.add(managed);
  void done.finally(() => running.delete(managed)).catch(() => undefined);
  return managed;
}
/** Fail fast if a server exits instead of waiting out a readiness timeout. */
export async function waitHealthy(
  url: string,
  process: ReturnType<typeof launch>,
) {
  for (let attempt = 0; attempt < 120; attempt++) {
    if (process.child.exitCode !== null)
      throw new Error(`Server exited before readiness: ${url}`);
    try {
      if ((await fetch(url, { signal: AbortSignal.timeout(1000) })).ok) return;
    } catch {
      /* Server is still binding its port. */
    }
    await setTimeout(500);
  }
  throw new Error(`Server did not become healthy: ${url}`);
}
