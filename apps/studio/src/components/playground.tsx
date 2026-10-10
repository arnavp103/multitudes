"use client";

import { useState } from "react";

import { SYSTEM_PROMPT } from "@multitudes/agent/prompts";
import { AgentChat } from "@multitudes/ui/agent-chat";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@multitudes/ui/card";
import { Input } from "@multitudes/ui/input";
import { Label } from "@multitudes/ui/label";
import { Textarea } from "@multitudes/ui/textarea";

import { pollPlayground, sendPlayground } from "~/server/actions";

/** Configuration changes apply to the next task; each queued run keeps its own snapshot. */
export function Playground({
  provider,
  modelId,
}: {
  provider: "gemini";
  modelId: string;
}) {
  const [config, setConfig] = useState({
    provider,
    modelId,
    systemPrompt: SYSTEM_PROMPT,
  });
  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
      <AgentChat
        submissionScope={JSON.stringify(config)}
        submit={(input, requestKey) =>
          sendPlayground(input, requestKey, config)
        }
        poll={pollPlayground}
        runHref={(id) => `/runs/${id}`}
      />
      <Card>
        <CardHeader>
          <CardTitle>Agent settings</CardTitle>
          <CardDescription>Applied when you start a new task.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="provider">Provider</Label>
            <Input id="provider" value="Gemini AI Studio" readOnly />
          </div>
          <div className="space-y-2">
            <Label htmlFor="model">Model ID</Label>
            <Input
              id="model"
              value={config.modelId}
              onChange={(event) =>
                setConfig({ ...config, modelId: event.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="system">System prompt</Label>
            <Textarea
              id="system"
              rows={9}
              value={config.systemPrompt}
              onChange={(event) =>
                setConfig({ ...config, systemPrompt: event.target.value })
              }
            />
          </div>
          <p className="text-muted-foreground text-xs leading-5">
            Tasks use the same agent runtime as production and evaluations.
            Configuration is saved with each run.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
