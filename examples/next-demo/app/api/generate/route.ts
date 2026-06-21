import { join } from "node:path";
import {
  createGenerationHandler,
  type WebHandler,
} from "@skinmint/server";
import { MeshyProvider, MockProvider, type Provider } from "@skinmint/core";
import { FileSystemBlobStorage, FileGenerationStore } from "@skinmint/store";

// Persist optimized models + history locally under .skinmint-data (gitignored).
// Swap FileSystem* for S3BlobStorage to use Cloudflare R2 / AWS S3.
const dataDir = join(process.cwd(), ".skinmint-data");
const storage = new FileSystemBlobStorage(join(dataDir, "models"));
const store = new FileGenerationStore(join(dataDir, "generations.json"));

// One handler per distinct key (so each has its own provider/in-flight state),
// sharing the same storage + store so history/gallery is unified.
const handlers = new Map<string, WebHandler>();

function handlerForKey(apiKey: string | undefined): WebHandler {
  const id = apiKey ?? "__mock__";
  let handler = handlers.get(id);
  if (!handler) {
    const provider: Provider = apiKey
      ? new MeshyProvider({ apiKey })
      : new MockProvider({ stepsToComplete: 4 });
    handler = createGenerationHandler({
      provider,
      storage,
      store,
      maxPromptLength: 600,
      optimize: { draco: true, quantize: true, textureFormat: "webp", textureQuality: 85 },
    });
    handlers.set(id, handler);
  }
  return handler;
}

// Key resolution: per-request header (BYO key from Settings) → server env → mock.
function resolveKey(request: Request): string | undefined {
  return (
    request.headers.get("x-meshy-key")?.trim() ||
    process.env.MESHY_API_KEY ||
    undefined
  );
}

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handlerForKey(resolveKey(request))(request);
}

export async function GET(request: Request) {
  return handlerForKey(resolveKey(request))(request);
}
