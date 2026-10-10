import { createLogger } from "@multitudes/observability/logger";

/**
 * The webapp's one server-side logger: import this rather than calling
 * `createLogger`, so every server module shares a service name and stream.
 * Use `~/logger/browser` from client components.
 */
export const logger = createLogger("multitudes-webapp");
