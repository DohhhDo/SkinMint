# @skinmint/store

Pluggable persistence for SkinMint: a `BlobStorage` for model files and a
`GenerationStore` for history / gallery records. Local implementations work
with zero external infrastructure; an S3/R2 adapter is provided for production.

```bash
pnpm add @skinmint/store
```

## Blob storage

```ts
import { FileSystemBlobStorage, S3BlobStorage } from "@skinmint/store";

// Local dev — served same-origin by @skinmint/server:
const storage = new FileSystemBlobStorage("./.skinmint-data/models");

// Production — Cloudflare R2 / AWS S3 (public URLs):
const storage = new S3BlobStorage({
  bucket: "models",
  publicBaseUrl: "https://cdn.example.com",
  endpoint: process.env.R2_ENDPOINT,        // omit for AWS S3
  accessKeyId: process.env.S3_ACCESS_KEY_ID,
  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
});
```

| Implementation          | `isPublic` | Notes                                    |
| ----------------------- | ---------- | ---------------------------------------- |
| `MemoryBlobStorage`     | false      | In-process, lost on restart. Tests/demo. |
| `FileSystemBlobStorage` | false      | Files on disk; served by your app.       |
| `S3BlobStorage`         | true       | S3/R2; returns public URLs. Needs the optional `@aws-sdk/client-s3`. |

`isPublic` tells `@skinmint/server` whether to hand the viewer a public URL
(`url(key)`) or to serve the bytes itself.

## Generation store

```ts
import { FileGenerationStore } from "@skinmint/store";

const store = new FileGenerationStore("./.skinmint-data/generations.json");
await store.create({ id: taskId, prompt, status: "running" });
await store.update(taskId, { status: "succeeded", modelUrl });
const recent = await store.list(50); // newest first → gallery
```

| Implementation         | Notes                                  |
| ---------------------- | -------------------------------------- |
| `MemoryGenerationStore`| In-process. Tests/demo.                |
| `FileGenerationStore`  | Single JSON file.                      |

Need Postgres/Prisma/Mongo? Implement the `GenerationStore` interface — it's
four methods (`create`, `update`, `get`, `list`).
