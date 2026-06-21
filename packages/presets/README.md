# @skinmint/presets

Curated presets and a deterministic **prompt builder**. The idea: users pick
from options, not blank text boxes — and the same selection always produces the
same prompt.

```ts
import { buildPrompt, STYLES, CHARACTERS, ACTIONS, ACCESSORIES } from "@skinmint/presets";

const { prompt } = buildPrompt({
  style: "voxel",
  character: "knight",
  action: "idle",
  accessories: ["sword"],
});
```

## What's inside

| Export | What it is |
| --- | --- |
| `STYLES` | style presets (e.g. voxel / low-poly / toy) |
| `CHARACTERS` | character presets |
| `ACTIONS` | pose / action presets |
| `ACCESSORIES` | add-on presets |
| `FRAMING` | the shared framing suffix (`full body, single character, …`) |
| `buildPrompt(selection)` | combine a selection into a clean prompt + metadata |

Plus the types: `StylePreset`, `CharacterPreset`, `ActionPreset`,
`AccessoryPreset`, `PromptSelection`, `BuildResult`, `Topology`, `ModelType`,
`PoseMode`.

## Why deterministic

A selection → a fixed prompt means results are reproducible and debuggable, and
the UI can show options instead of asking people to write prompt-ese. It's used
by the legacy text→mesh track; the Minecraft track mostly relies on curated
characters and direct names, but the builder is here when you need to compose a
prompt from choices.

## Build & test

```bash
pnpm --filter @skinmint/presets build
pnpm --filter @skinmint/presets test
```
