import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from "@react-email/components";

/** Previewable example: no provider and no sending side effect. */
export default function RunCompleted({
  runUrl = "https://example.com",
  title = "Your agent task is ready",
}: {
  runUrl?: string;
  title?: string;
}) {
  const url = new URL(runUrl);
  if (url.protocol !== "https:") throw new Error("Email links must use HTTPS");
  return (
    <Html>
      <Head />
      <Preview>{title}</Preview>
      <Body
        style={{
          backgroundColor: "#10181c",
          color: "#e8edef",
          fontFamily: "Arial, sans-serif",
          padding: "40px 16px",
        }}
      >
        <Container
          style={{
            maxWidth: 520,
            backgroundColor: "#192227",
            padding: 32,
            borderRadius: 12,
          }}
        >
          <Text style={{ color: "#9bddcd", fontSize: 12, letterSpacing: 2 }}>
            MULTITUDES
          </Text>
          <Heading>{title}</Heading>
          <Text>
            Your task has finished. Open the workspace to review its result.
          </Text>
          <Button
            href={url.toString()}
            style={{
              backgroundColor: "#9bddcd",
              color: "#102521",
              padding: "12px 20px",
              borderRadius: 6,
            }}
          >
            View task
          </Button>
        </Container>
      </Body>
    </Html>
  );
}
