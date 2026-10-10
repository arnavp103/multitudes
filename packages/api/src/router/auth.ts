import type { TRPCRouterRecord } from "@trpc/server";

import { publicProcedure } from "../trpc";

export const authRouter = {
  getSession: publicProcedure.query(({ ctx }) => {
    return ctx.session
      ? {
          user: {
            id: ctx.session.user.id,
            name: ctx.session.user.name,
            image: ctx.session.user.image,
          },
        }
      : null;
  }),
} satisfies TRPCRouterRecord;
