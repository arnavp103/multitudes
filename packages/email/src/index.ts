import type { ReactElement } from "react";
import { render, toPlainText } from "@react-email/render";
import { z } from "zod/v4";

import { withSpan } from "@multitudes/observability/context";
import { createLogger } from "@multitudes/observability/logger";

export interface RenderedEmail {
  from: string;
  to: string[];
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
}
/** Implement this contract in a provider adapter; credentials stay in the composing app. */
export interface EmailTransport {
  name: string;
  send: (message: RenderedEmail) => Promise<{ messageId: string }>;
}
const envelope = z.object({
  from: z.email(),
  to: z.array(z.email()).min(1).max(50),
  subject: z
    .string()
    .min(1)
    .max(200)
    .refine((value) => !/[\r\n]/.test(value)),
  idempotencyKey: z.string().min(1).max(200),
});

/** Rendering is provider-independent and is also usable for previews and tests. */
export async function renderEmail(element: ReactElement) {
  const html = await render(element);
  return { html, text: toPlainText(html) };
}

/** Explicit dependency injection: no default provider, no implicit sends, no automatic retries. */
export function createMailer(transport?: EmailTransport) {
  const logger = createLogger("multitudes-email");
  return {
    async send(input: {
      from: string;
      to: string[];
      subject: string;
      idempotencyKey: string;
      react: ReactElement;
    }) {
      if (!transport) throw new Error("Email transport is not configured");
      const message = envelope.parse(input);
      return withSpan(
        "email.send",
        { "email.provider": transport.name },
        async () => {
          const rendered = await renderEmail(input.react);
          try {
            const result = await transport.send({ ...message, ...rendered });
            logger.info(
              {
                provider: transport.name,
                recipient_count: message.to.length,
                message_id: result.messageId,
              },
              "Email accepted by provider",
            );
            return result;
          } catch (err) {
            logger.error(
              { provider: transport.name, err },
              "Email delivery request failed",
            );
            throw err;
          }
        },
      );
    },
  };
}
