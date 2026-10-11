"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { InboxIcon, PlusIcon, SearchIcon } from "lucide-react";

import { Badge } from "./badge";
import { Button } from "./button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./card";
import { Checkbox } from "./checkbox";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "./empty";
import { Input } from "./input";
import { Label } from "./label";
import { Metric } from "./metric";
import { Progress } from "./progress";
import { Switch } from "./switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";
import { TACHYON_DIRECTIONS, useTachyonDirection } from "./tachyon";
import { Textarea } from "./textarea";

/**
 * Living reference for Tachyon: every swatch, size, and curve below is read
 * from the active tokens, so it doubles as a visual test for each direction.
 */
export function TachyonSpecimen() {
  const [direction] = useTachyonDirection();
  const current = TACHYON_DIRECTIONS.find((item) => item.id === direction);
  return (
    <div className="grid gap-(--tc-stack)">
      <header>
        <p className="eyebrow">Design system / {direction}</p>
        <h1>Tachyon</h1>
        <p className="text-muted-foreground text-lead max-w-2xl">
          {current?.name}: {current?.summary.toLowerCase()}. Switch directions
          from the sidebar footer to compare the same components.
        </p>
      </header>

      <Section
        title="Colour"
        note="Neutrals per direction; accents swap with the logo."
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Paper", "--tc-paper"],
            ["Surface", "--tc-surface"],
            ["Sunken", "--tc-sunken"],
            ["Ink", "--tc-ink"],
            ["Ink muted", "--tc-ink-muted"],
            ["Line strong", "--tc-line-strong"],
            ["Signal", "--tachyon-signal"],
            ["Flare", "--tachyon-flare"],
            ["Trace", "--tachyon-trace"],
            ["Positive", "--tc-positive"],
            ["Caution", "--tc-caution"],
            ["Critical", "--tc-critical"],
          ].map(([name, token]) => (
            <Swatch key={token} name={name ?? ""} token={token ?? ""} />
          ))}
        </div>
      </Section>

      <Section title="Type" note="Minor-third scale from a 14px body.">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <Card>
            <CardContent className="grid gap-3">
              {[
                ["hero", "text-hero", "Every run, explained"],
                ["display", "text-display", "How your agents are doing"],
                ["heading", "text-heading", "Evaluation quality"],
                ["title", "text-title", "Model usage this week"],
                ["lead", "text-lead", "Durable trajectories from production."],
                [
                  "body",
                  "text-body",
                  "Cases are immutable. Save a new case to revise an expectation.",
                ],
                [
                  "caption",
                  "text-caption",
                  "Terminal runs, includes queue and judging",
                ],
              ].map(([name, size, sample]) => (
                <div
                  key={name}
                  className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-baseline gap-3"
                >
                  <span className="type-data text-caption text-muted-foreground">
                    {name}
                  </span>
                  <span
                    className={`${size} ${name === "hero" || name === "display" || name === "heading" ? "type-display" : ""} truncate`}
                  >
                    {sample}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="grid gap-4">
              <Role name="Display">
                <span className="type-display text-title">Agent studio</span>
              </Role>
              <Role name="Body">
                <span className="text-body">
                  Review production trajectories and turn failures into tests.
                </span>
              </Role>
              <Role name="Data">
                <span className="type-data text-body">
                  run_7f3a9c · 0.0041 USD · 1,284 tok
                </span>
              </Role>
              <Role name="Readout">
                <span className="type-readout text-display">98.6%</span>
              </Role>
              <Role name="Note">
                <span className="type-note text-lead text-primary">
                  p95 includes queue time
                </span>
              </Role>
            </CardContent>
          </Card>
        </div>
      </Section>

      <Section
        title="Controls"
        note="New York sizing: 36px controls, 32px small."
      >
        <Card>
          <CardContent className="grid gap-5">
            <div className="flex flex-wrap items-center gap-2">
              <Button>Queue run</Button>
              <Button variant="secondary">Save draft</Button>
              <Button variant="outline">Refresh</Button>
              <Button variant="ghost">Cancel</Button>
              <Button variant="destructive">Revoke sessions</Button>
              <Button variant="link">View trajectory</Button>
              <Button size="icon" variant="outline" aria-label="Add">
                <PlusIcon />
              </Button>
              <Button disabled>Disabled</Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm">Small</Button>
              <Button size="sm" variant="outline">
                Small outline
              </Button>
              <Button size="lg">Large action</Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge>Default</Badge>
              <Badge variant="secondary">Secondary</Badge>
              <Badge variant="outline">Outline</Badge>
              <Badge variant="destructive">Destructive</Badge>
              <span className="status completed">completed</span>
              <span className="status running">running</span>
              <span className="status failed">failed</span>
            </div>
          </CardContent>
        </Card>
      </Section>

      <Section title="Form" note="Labels above fields; help and errors below.">
        <Card className="max-w-3xl">
          <CardHeader className="border-b">
            <CardTitle>Define a good outcome</CardTitle>
            <CardDescription>
              Write expectations independently of the original answer.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="specimen-name">Name</Label>
                <Input
                  id="specimen-name"
                  defaultValue="Refund policy summary"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="specimen-search">Dataset</Label>
                <div className="relative">
                  <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                  <Input
                    id="specimen-search"
                    className="pl-9"
                    placeholder="Search datasets"
                  />
                </div>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="specimen-rubric">Rubric</Label>
              <Textarea
                id="specimen-rubric"
                rows={3}
                placeholder="What makes this answer correct and useful?"
              />
              <p className="text-muted-foreground text-caption">
                Leave blank to grade with assertions only.
              </p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="specimen-threshold">Pass threshold</Label>
              <Input
                id="specimen-threshold"
                aria-invalid
                defaultValue="1.4"
                className="max-w-40"
              />
              <p className="text-destructive text-caption">
                Enter a number between 0 and 1.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-6">
              <Label className="font-normal">
                <Checkbox defaultChecked /> Case-sensitive matching
              </Label>
              <Label className="font-normal">
                <Switch defaultChecked /> Use LLM judge
              </Label>
            </div>
          </CardContent>
          <CardFooter className="justify-end gap-2 border-t">
            <Button variant="ghost">Cancel</Button>
            <Button>Save case</Button>
          </CardFooter>
        </Card>
      </Section>

      <Section title="Data" note="Readouts, tables, and progress.">
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric
            label="Execution success"
            value="96.2%"
            detail="412 completed, 16 failed"
          />
          <Metric
            label="Recorded model cost"
            value="$3.4120"
            detail="1,204 calls, agent and judge"
          />
          <Metric
            label="P95 latency"
            value="8.4s"
            detail="Includes queue and judging"
          />
        </div>
        <Card>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Input</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  [
                    "Summarize our platform",
                    "production",
                    "completed",
                    "0.0041",
                  ],
                  ["Draft a refund reply", "evaluation", "running", "0.0017"],
                  [
                    "Compare two vendor quotes",
                    "production",
                    "failed",
                    "0.0009",
                  ],
                  [
                    "Plan the Q3 launch checklist",
                    "evaluation",
                    "completed",
                    "0.0062",
                  ],
                ].map(([input, mode, status, cost]) => (
                  <TableRow key={input}>
                    <TableCell>{input}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {mode}
                    </TableCell>
                    <TableCell>
                      <span className={`status ${status}`}>{status}</span>
                    </TableCell>
                    <TableCell className="type-data text-right">
                      ${cost}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <div className="grid max-w-md gap-2">
          <div className="text-caption text-muted-foreground flex justify-between">
            <span>Experiment progress</span>
            <span className="type-data">18 / 24 cases</span>
          </div>
          <Progress value={75} />
        </div>
      </Section>

      <Section title="Navigation and empty states">
        <Tabs defaultValue="conversation">
          <TabsList>
            <TabsTrigger value="conversation">Conversation</TabsTrigger>
            <TabsTrigger value="configuration">Configuration</TabsTrigger>
            <TabsTrigger value="events">Events</TabsTrigger>
          </TabsList>
          <TabsContent value="conversation">
            <Card>
              <CardContent>
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <InboxIcon />
                    </EmptyMedia>
                    <EmptyTitle>No eval cases yet</EmptyTitle>
                    <EmptyDescription>
                      Author a case, or promote a production run to start a
                      regression suite.
                    </EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                    <Button>Author a case</Button>
                    <span className="type-note text-primary text-lead">
                      start with a failure you have seen
                    </span>
                  </EmptyContent>
                </Empty>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </Section>

      <Section
        title="Shape and elevation"
        note="Radius follows hierarchy: control, panel, sheet."
      >
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Flat", "--tc-elevation-0"],
            ["Resting", "--tc-elevation-1"],
            ["Floating", "--tc-elevation-2"],
            ["Modal", "--tc-elevation-3"],
          ].map(([name, token]) => (
            <div
              key={token}
              className="bg-raised grid h-24 place-content-center rounded-lg border text-center"
              style={{ boxShadow: `var(${token})` }}
            >
              <span className="text-body">{name}</span>
              <span className="type-data text-caption text-muted-foreground">
                {token}
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Motion"
        note="Easing tokens, drawn as the Bezier curves they are."
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Standard", "--tc-ease-standard", "--tc-duration-quick"],
            ["Enter", "--tc-ease-enter", "--tc-duration-scene"],
            ["Exit", "--tc-ease-exit", "--tc-duration-base"],
            ["Spring", "--tc-ease-spring", "--tc-duration-base"],
          ].map(([name, ease, duration]) => (
            <EasingCurve
              key={ease}
              name={name ?? ""}
              ease={ease ?? ""}
              duration={duration ?? ""}
            />
          ))}
        </div>
      </Section>
    </div>
  );
}

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-3">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <h2 className="text-title! mb-0!">{title}</h2>
        {note && <p className="text-muted-foreground text-caption">{note}</p>}
      </div>
      {children}
    </section>
  );
}

function Role({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <span className="text-muted-foreground text-caption">{name}</span>
      {children}
    </div>
  );
}

function Swatch({ name, token }: { name: string; token: string }) {
  return (
    <div className="bg-card flex items-center gap-3 rounded-lg border p-2">
      <span
        className="size-10 shrink-0 rounded-md border"
        style={{ background: `var(${token})` }}
      />
      <span className="grid min-w-0">
        <span className="text-body">{name}</span>
        <span className="type-data text-caption text-muted-foreground truncate">
          {token}
        </span>
      </span>
    </div>
  );
}

/** Resolved value of a custom property on <html>, refreshed on theme changes. */
function useToken(token: string) {
  const [direction] = useTachyonDirection();
  const [value, setValue] = useState("");
  useEffect(() => {
    const read = () =>
      setValue(
        getComputedStyle(document.documentElement)
          .getPropertyValue(token)
          .trim(),
      );
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-direction"],
    });
    return () => observer.disconnect();
  }, [token, direction]);
  return value;
}

function EasingCurve({
  name,
  ease,
  duration,
}: {
  name: string;
  ease: string;
  duration: string;
}) {
  const value = useToken(ease);
  const time = useToken(duration);
  const [x1 = 0, y1 = 0, x2 = 1, y2 = 1] = (
    /cubic-bezier\(([^)]+)\)/.exec(value)?.[1] ?? "0,0,1,1"
  )
    .split(",")
    .map(Number);
  const point = (x: number, y: number) => `${8 + x * 104} ${112 - y * 80}`;
  return (
    <div className="bg-card grid gap-2 rounded-lg border p-3">
      <svg viewBox="0 0 120 140" className="h-32 w-full" fill="none">
        <rect
          x={8}
          y={32}
          width={104}
          height={80}
          className="stroke-(--tc-line)"
          strokeDasharray="2 3"
        />
        <line
          x1={8}
          y1={112}
          x2={8 + x1 * 104}
          y2={112 - y1 * 80}
          className="stroke-(--tc-ink-muted)"
        />
        <line
          x1={112}
          y1={32}
          x2={8 + x2 * 104}
          y2={112 - y2 * 80}
          className="stroke-(--tc-ink-muted)"
        />
        <circle
          cx={8 + x1 * 104}
          cy={112 - y1 * 80}
          r={2.5}
          className="fill-(--tc-ink-muted)"
        />
        <circle
          cx={8 + x2 * 104}
          cy={112 - y2 * 80}
          r={2.5}
          className="fill-(--tc-ink-muted)"
        />
        <path
          d={`M${point(0, 0)} C${point(x1, y1)} ${point(x2, y2)} ${point(1, 1)}`}
          className="stroke-primary"
          strokeWidth={2}
        />
      </svg>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-body">{name}</span>
        <span className="type-data text-caption text-muted-foreground">
          {time}
        </span>
      </div>
    </div>
  );
}
