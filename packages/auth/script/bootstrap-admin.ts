import { parseArgs } from "node:util";
import { z } from "zod/v4";

import { db, pool } from "@multitudes/db/client";

import type { AppRole } from "../src/permissions";
import { provisionAccount } from "../src/credentials";
import { roles } from "../src/permissions";

const usage = `Usage: pnpm auth:bootstrap-admin <email> [--password] [--name <name>] [--role <role>]

Without --password, promote an existing verified account (unchanged behaviour).
With --password, read a password from the terminal (or stdin when piped) and set
it as the account's email/password login, creating a verified account if none
exists. Existing sessions for that account are revoked.

--role defaults to admin; choose one of: ${Object.keys(roles).join(", ")}.`;

/** Read a line from a TTY without echoing it, so passwords never reach argv or shell history. */
function promptHidden(question: string) {
  return new Promise<string>((resolve, reject) => {
    const stdin = process.stdin;
    let value = "";
    const finish = (error?: Error) => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.off("data", onData);
      process.stdout.write("\n");
      if (error) reject(error);
      else resolve(value);
    };
    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === "\r" || char === "\n") return finish();
        if (char === "\u0003") return finish(new Error("Cancelled"));
        value = char === "\u007f" ? value.slice(0, -1) : value + char;
      }
    };
    process.stdout.write(question);
    stdin.setRawMode(true);
    stdin.setEncoding("utf8");
    stdin.on("data", onData);
    stdin.resume();
  });
}

/** Prompt twice on a terminal; otherwise take the first line of piped stdin. */
async function readPassword() {
  if (process.stdin.isTTY) {
    const password = await promptHidden("Password: ");
    if ((await promptHidden("Confirm password: ")) !== password)
      throw new Error("Passwords did not match");
    return password;
  }
  let input = "";
  for await (const chunk of process.stdin) input += String(chunk);
  return input.split(/\r?\n/)[0] ?? "";
}

/** Operator-only Studio provisioning; see `provisionAccount` for the verification rules. */
try {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      password: { type: "boolean", default: false },
      name: { type: "string" },
      role: { type: "string", default: "admin" },
    },
  });
  const parsed = z
    .object({
      email: z.email(),
      role: z.enum(Object.keys(roles) as [AppRole, ...AppRole[]]),
      name: z.string().trim().min(1).max(200).optional(),
    })
    .safeParse({ email: positionals[0], role: values.role, name: values.name });
  if (!parsed.success || positionals.length !== 1) throw new Error(usage);
  const { email, role, name } = parsed.data;
  const password = values.password ? await readPassword() : undefined;

  const created = await provisionAccount(db, { email, role, name, password });
  console.info(
    `${created ? "Created a verified account with" : "Granted"} ${role} access${password ? " and set its password" : ""}`,
  );
} finally {
  await pool.end();
}
