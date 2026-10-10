import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { setTimeout } from "node:timers/promises";

export const root = new URL("../../../", import.meta.url).pathname;
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
  return {
    child,
    done,
    async stop() {
      if (child.exitCode !== null || !child.pid) return;
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
    },
  };
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
