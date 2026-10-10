import { toNextJsHandler } from "better-auth/next-js";

import { studioAuth } from "~/server/access";

export const runtime = "nodejs";
export function GET(request: Request) {
  return toNextJsHandler(studioAuth()).GET(request);
}
export function POST(request: Request) {
  return toNextJsHandler(studioAuth()).POST(request);
}
