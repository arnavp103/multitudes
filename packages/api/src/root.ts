import { agentRouter } from "./router/agent";
import { authRouter } from "./router/auth";
import { postRouter } from "./router/post";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  auth: authRouter,
  agent: agentRouter,
  post: postRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
