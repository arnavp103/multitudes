# @multitudes/evals

Eval case authoring, experiment launch, deterministic grading, and the LLM judge.
Used by Studio server actions and the backend worker.

## File tree

```text
packages/evals/
├── src/
│   ├── index.ts          # caseSchema, gradeOutput, authorCase, launchExperiment
│   ├── judge.ts          # judgeOutput (tool-free Strands agent), parseVerdict
│   └── prompts/judge.ts  # JUDGE_PROMPT and the JUDGE_PROMPTS registry by version
└── test/                 # grading/judge unit tests; judge integration over mocked HTTP
```

## Conventions

- Cases are immutable. A revision is a new case ID, so earlier experiments stay
  comparable; add no update path.
- Judge prompt change: add a new key to `JUDGE_PROMPTS`, point
  `JUDGE_PROMPT_VERSION` at it, and keep every old entry. Saved cases store their
  `promptVersion` and must still resolve. Calibrate against human-scored examples.
- New grading behaviour gets a new `evaluatorVersion` string rather than changing
  an existing one (`text-assertions/v1` here, `text-and-judge/v1` in the worker).
- Grading fails closed: invalid JSON, out-of-range scores, or a non-final stop
  reason throw and count as execution failures. Assertions match case-sensitively.
- The judge has no tools, temperature 0, `retryStrategy: null`, and is metered as
  `purpose: "judge"` through `@multitudes/ai`.
- Eval runs answer tool calls from the case's frozen `toolFixtures`
  (`createFixtureServices`). Keep production data and credentials away from eval
  tools and judges.
- `launchExperiment` enqueues the experiment and all trials in one transaction
  under the caller's `requestKey`.
- `test:integration` here needs no database or API key; it mocks Google HTTP and
  injects a usage store.
