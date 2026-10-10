import { APP_VERSION, GIT_SHA } from "./build-info.generated";

export { APP_VERSION, GIT_SHA };

/** Lightweight process health; deliberately independent of databases and model providers. */
export function healthSnapshot(ready = true) {
  return {
    status: ready ? "ok" : "unavailable",
    version: APP_VERSION,
    sha: GIT_SHA,
  };
}

/** Never cache a health response at the browser, CDN, or reverse proxy. */
export function healthResponse(ready = true): Response {
  return Response.json(healthSnapshot(ready), {
    status: ready ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
