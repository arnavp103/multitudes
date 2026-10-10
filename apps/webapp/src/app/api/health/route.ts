import { healthResponse } from "@multitudes/observability/health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public, dependency-free health check for App Runner, ALB and container probes. */
export function GET() {
  return healthResponse();
}
