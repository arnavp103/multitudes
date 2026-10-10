import { z } from "zod/v4";

import { getTaskStatus } from "@multitudes/db/agent-service";

import { protectedProcedure } from "../trpc";

/** HTTP callers and agent tools share the same service authorization and result shape. */
export const agentRouter = {
  taskStatus: protectedProcedure
    .input(z.object({ runId: z.uuid() }))
    .query(({ ctx, input }) => getTaskStatus(ctx.session.user.id, input)),
};
