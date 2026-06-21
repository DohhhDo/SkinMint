# @skinmint/react

React hooks for SkinMint text-to-3D generation. Framework-light: the hook just
talks to your [`@skinmint/server`](../server) endpoint over `fetch` — no other
`@skinmint` runtime dependency.

```bash
pnpm add @skinmint/react
```

## `useTextTo3D`

```tsx
"use client";
import { useTextTo3D } from "@skinmint/react";
import { GeneratedModelViewer } from "@skinmint/viewer";

export function Studio() {
  const { generate, phase, progress, modelUrl, error, isLoading } =
    useTextTo3D({ endpoint: "/api/generate" });

  return (
    <>
      <button onClick={() => generate({ prompt: "a cute robot" })} disabled={isLoading}>
        {isLoading ? `Generating… ${progress}%` : "Generate"}
      </button>
      {error && <p>{error}</p>}
      <GeneratedModelViewer modelUrl={modelUrl} autoRotate />
    </>
  );
}
```

It POSTs the prompt, then polls status until the model is ready. The returned
`modelUrl` drops straight into `<GeneratedModelViewer />`.

## API

`useTextTo3D({ endpoint, pollIntervalMs?, timeoutMs? })` returns:

| Field       | Description                                              |
| ----------- | ------------------------------------------------------- |
| `generate`  | `(input) => Promise<string \| undefined>` — start a run |
| `reset`     | Cancel any in-flight run and clear state                |
| `phase`     | `"idle" \| "starting" \| "running" \| "succeeded" \| "failed"` |
| `progress`  | `0–100`                                                 |
| `modelUrl`  | Ready model URL (once succeeded)                        |
| `taskId`    | Provider task id                                        |
| `error`     | Error message, if any                                   |
| `isLoading` | `true` while starting or running                        |

`generate(input)` accepts `{ prompt, artStyle?, negativePrompt?, targetPolycount?, topology?, seed?, refine?, extra? }`.
Calls are abortable: a new `generate()` (or `reset()`) cancels the previous run.
