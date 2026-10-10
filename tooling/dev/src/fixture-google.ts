/** Process-local HTTP fixture, loaded explicitly by dev/E2E runners. Never imported by production apps. */
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = input instanceof Request ? input.url : String(input);
  if (new URL(url).hostname !== "generativelanguage.googleapis.com")
    return originalFetch(input, init);
  return new Response(
    `data: ${JSON.stringify({
      candidates: [
        {
          content: {
            role: "model",
            parts: [{ text: "Fixture result: your task completed." }],
          },
          finishReason: "STOP",
          index: 0,
        },
      ],
      usageMetadata: {
        promptTokenCount: 100,
        candidatesTokenCount: 10,
        totalTokenCount: 110,
      },
    })}\n\n`,
    { headers: { "content-type": "text/event-stream" } },
  );
};
