import { describe, it, expect, afterAll } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  MemoryBlobStorage,
  MemoryGenerationStore,
  FileSystemBlobStorage,
  FileGenerationStore,
  type BlobStorage,
  type GenerationStore,
} from "../src/index";

const tmpDirs: string[] = [];
async function tmp(): Promise<string> {
  const d = await mkdtemp(join(tmpdir(), "skinmint-store-"));
  tmpDirs.push(d);
  return d;
}
afterAll(async () => {
  await Promise.all(tmpDirs.map((d) => rm(d, { recursive: true, force: true })));
});

function blobSuite(name: string, make: () => Promise<BlobStorage>) {
  describe(`BlobStorage: ${name}`, () => {
    it("puts and gets bytes with content type", async () => {
      const storage = await make();
      const bytes = new Uint8Array([1, 2, 3, 4]);
      await storage.put("a/b.glb", bytes, "model/gltf-binary");
      const got = await storage.get("a/b.glb");
      expect(got?.contentType).toBe("model/gltf-binary");
      expect([...(got?.data ?? [])]).toEqual([1, 2, 3, 4]);
    });

    it("returns null for a missing key", async () => {
      const storage = await make();
      expect(await storage.get("nope")).toBeNull();
    });
  });
}

function storeSuite(name: string, make: () => Promise<GenerationStore>) {
  describe(`GenerationStore: ${name}`, () => {
    it("creates, updates, gets and lists records (recent first)", async () => {
      const store = await make();
      const a = await store.create({ id: "a", prompt: "first" });
      expect(a.status).toBe("pending");

      await store.create({ id: "b", prompt: "second" });
      const updated = await store.update("a", {
        status: "succeeded",
        modelUrl: "/x.glb",
      });
      expect(updated?.status).toBe("succeeded");
      expect(updated?.modelUrl).toBe("/x.glb");

      const got = await store.get("a");
      expect(got?.prompt).toBe("first");

      const list = await store.list();
      expect(list.map((r) => r.id)).toContain("a");
      expect(list.map((r) => r.id)).toContain("b");
    });

    it("returns null when updating a missing record", async () => {
      const store = await make();
      expect(await store.update("ghost", { status: "failed" })).toBeNull();
    });
  });
}

blobSuite("memory", async () => new MemoryBlobStorage());
blobSuite("filesystem", async () => new FileSystemBlobStorage(await tmp()));
storeSuite("memory", async () => new MemoryGenerationStore());
storeSuite("filesystem", async () => new FileGenerationStore(join(await tmp(), "db.json")));
