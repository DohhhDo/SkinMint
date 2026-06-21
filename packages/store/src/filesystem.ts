import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type {
  BlobStorage,
  GenerationRecord,
  GenerationStore,
  NewGenerationRecord,
  StoredBlob,
} from "./types";

const CONTENT_TYPE_SIDECAR = ".type";

/** Stores blobs as files under a directory. App-served (not public). */
export class FileSystemBlobStorage implements BlobStorage {
  readonly isPublic = false;
  constructor(private readonly dir: string) {}

  private path(key: string): string {
    return join(this.dir, key);
  }

  async put(key: string, data: Uint8Array, contentType: string): Promise<void> {
    const file = this.path(key);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, data);
    await writeFile(file + CONTENT_TYPE_SIDECAR, contentType, "utf8");
  }

  async get(key: string): Promise<StoredBlob | null> {
    try {
      const file = this.path(key);
      const data = await readFile(file);
      const contentType = await readFile(file + CONTENT_TYPE_SIDECAR, "utf8").catch(
        () => "application/octet-stream",
      );
      return { data: new Uint8Array(data), contentType };
    } catch {
      return null;
    }
  }

  url(key: string): string {
    return key;
  }
}

/** Stores generation records in a single JSON file. */
export class FileGenerationStore implements GenerationStore {
  constructor(private readonly file: string) {}

  private async readAll(): Promise<GenerationRecord[]> {
    try {
      return JSON.parse(await readFile(this.file, "utf8")) as GenerationRecord[];
    } catch {
      return [];
    }
  }

  private async writeAll(records: GenerationRecord[]): Promise<void> {
    await mkdir(dirname(this.file), { recursive: true });
    await writeFile(this.file, JSON.stringify(records, null, 2), "utf8");
  }

  async create(record: NewGenerationRecord): Promise<GenerationRecord> {
    const now = new Date().toISOString();
    const full: GenerationRecord = {
      status: "pending",
      createdAt: now,
      updatedAt: now,
      ...record,
    };
    const all = await this.readAll();
    await this.writeAll([full, ...all.filter((r) => r.id !== full.id)]);
    return full;
  }

  async update(
    id: string,
    patch: Partial<Omit<GenerationRecord, "id" | "createdAt">>,
  ): Promise<GenerationRecord | null> {
    const all = await this.readAll();
    const existing = all.find((r) => r.id === id);
    if (!existing) return null;
    const updated: GenerationRecord = {
      ...existing,
      ...patch,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };
    await this.writeAll(all.map((r) => (r.id === id ? updated : r)));
    return updated;
  }

  async get(id: string): Promise<GenerationRecord | null> {
    return (await this.readAll()).find((r) => r.id === id) ?? null;
  }

  async list(limit = 50): Promise<GenerationRecord[]> {
    return (await this.readAll())
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }
}
