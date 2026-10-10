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
  provider: "gemini" | "deepseek" | "bedrock" | "openai";
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
        submit={(input) => sendPlayground(input, config)}
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
            <select
              id="provider"
              value={config.provider}
              onChange={(event) =>
                setConfig({
                  ...config,
                  provider: event.target.value as typeof config.provider,
                  modelId:
                    event.target.value === "gemini"
                      ? "gemini-3.8-flash"
                      : event.target.value === "deepseek"
                        ? "deepseek-flash"
                        : "",
                })
              }
            >
              <option value="gemini">Gemini AI Studio</option>
              <option value="deepseek">DeepSeek</option>
              <option value="bedrock">AWS Bedrock</option>
              <option value="openai">OpenAI</option>
            </select>
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
