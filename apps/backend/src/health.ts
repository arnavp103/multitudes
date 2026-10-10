import { createServer } from "node:http";

import { healthSnapshot } from "@multitudes/observability/health";

/** Expose process readiness on the worker's container port without calling downstream services. */
export async function startHealthServer(options: {
  port: number;
  isReady: () => boolean;
  host?: string;
}) {
  const server = createServer((request, response) => {
    if (request.url?.split("?")[0] !== "/api/health") {
      response.writeHead(404).end();
      return;
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { Allow: "GET, HEAD" }).end();
      return;
    }
    const ready = options.isReady();
    response.writeHead(ready ? 200 : 503, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });
    response.end(
      request.method === "HEAD"
        ? undefined
        : JSON.stringify(healthSnapshot(ready)),
    );
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port, options.host ?? "0.0.0.0", () => {
      server.off("error", reject);
      resolve();
    });
  });
  return {
    server,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  };
}
