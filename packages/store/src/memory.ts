import type {
  BlobStorage,
  GenerationRecord,
  GenerationStore,
  NewGenerationRecord,
  StoredBlob,
} from "./types";

/** In-memory blob storage. App-served (not public). Lost on restart. */
export class MemoryBlobStorage implements BlobStorage {
  readonly isPublic = false;
  private readonly blobs = new Map<string, StoredBlob>();

  async put(key: string, data: Uint8Array, contentType: string): Promise<void> {
    this.blobs.set(key, { data, contentType });
  }

  async get(key: string): Promise<StoredBlob | null> {
    return this.blobs.get(key) ?? null;
  }

  url(key: string): string {
    return key;
  }
}

/** In-memory generation store. Lost on restart. */
export class MemoryGenerationStore implements GenerationStore {
  private readonly records = new Map<string, GenerationRecord>();

  async create(record: NewGenerationRecord): Promise<GenerationRecord> {
    const now = new Date().toISOString();
    const full: GenerationRecord = {
      status: "pending",
      createdAt: now,
      updatedAt: now,
      ...record,
    };
    this.records.set(full.id, full);
    return full;
  }

  async update(
    id: string,
    patch: Partial<Omit<GenerationRecord, "id" | "createdAt">>,
  ): Promise<GenerationRecord | null> {
    const existing = this.records.get(id);
    if (!existing) return null;
    const updated: GenerationRecord = {
      ...existing,
      ...patch,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };
    this.records.set(id, updated);
    return updated;
  }

  async get(id: string): Promise<GenerationRecord | null> {
    return this.records.get(id) ?? null;
  }

  async list(limit = 50): Promise<GenerationRecord[]> {
    return [...this.records.values()]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }
}
