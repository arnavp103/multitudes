import type { Attributes } from "@opentelemetry/api";
import type { SpanProcessor } from "@opentelemetry/sdk-trace-base";

const contentAttribute =
  /^(?:system[._]prompt|gen_ai\.(?:.*\.messages|system_instructions|tool\.(?:definitions|call\.(?:arguments|result))|agent\.(?:input|output))|content|message|prompt|completion|input|output)$/i;

/** Remove model content before any exporter sees an ended span, including SDK span events. */
export function contentPrivacyProcessor(captureContent = false): SpanProcessor {
  const scrub = (attributes: Attributes | undefined, modelEvent = false) => {
    if (!attributes) return;
    for (const key of Object.keys(attributes)) {
      if (
        key === "exception.message" ||
        key === "exception.stacktrace" ||
        (!captureContent && (modelEvent || contentAttribute.test(key)))
      )
        delete attributes[key];
    }
  };
  return {
    onStart() {
      /* Content can also be attached after span creation. Scrub at export. */
    },
    onEnd(span) {
      scrub(span.attributes);
      for (const event of span.events)
        scrub(event.attributes, event.name.startsWith("gen_ai."));
      // SDK error descriptions may contain provider response bodies.
      delete span.status.message;
    },
    forceFlush: () => Promise.resolve(),
    shutdown: () => Promise.resolve(),
  };
}
