"use client";

import { AgentChat } from "@multitudes/ui/agent-chat";

import { pollTask, sendTask } from "~/server/chat";

export function Chat({ signedIn }: { signedIn: boolean }) {
  return <AgentChat submit={sendTask} poll={pollTask} disabled={!signedIn} />;
}
