import type { NextRequest } from "next/server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import { appRouter, createTRPCContext } from "@multitudes/api";

import { auth } from "~/auth/server";
import { logger } from "~/logger/server";

// Same-origin API: cross-origin callers receive no CORS grant.
const handler = async (req: NextRequest) => {
  const response = await fetchRequestHandler({
    endpoint: "/api/trpc",
    router: appRouter,
    req,
    createContext: () =>
      createTRPCContext({
        auth: auth,
        headers: req.headers,
      }),
    onError({ error, path }) {
      logger.error({ procedure: path, err: error }, "tRPC request failed");
    },
  });

  return response;
};

export { handler as GET, handler as POST };
