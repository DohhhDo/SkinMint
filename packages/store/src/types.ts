/** A stored binary blob (e.g. an optimized GLB). */
export interface StoredBlob {
  data: Uint8Array;
  contentType: string;
}

/**
 * Pluggable binary storage for model files. Local implementations are served
 * by the app; cloud implementations (S3/R2) expose their own public URLs.
 */
export interface BlobStorage {
  /** True when `url(key)` returns a directly-fetchable public URL (S3/R2). */
  readonly isPublic: boolean;
  put(key: string, data: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<StoredBlob | null>;
  /** Public URL for a key. Only meaningful when `isPublic` is true. */
  url(key: string): string;
}

export type GenerationRecordStatus =
  | "pending"
  | "running"
  | "succeeded"
  | "failed";

/** A persisted generation, for history / gallery. */
export interface GenerationRecord {
  id: string;
  prompt: string;
  status: GenerationRecordStatus;
  modelUrl?: string;
  thumbnailUrl?: string;
  error?: string;
  /** Whether a refine (texture/color) pass was requested. */
  refine?: boolean;
  /** Provider task id of the refine pass, once started (multi-stage tracking). */
  refineTaskId?: string;
  /** ISO timestamps. */
  createdAt: string;
  updatedAt: string;
}

export type NewGenerationRecord = Pick<GenerationRecord, "id" | "prompt"> &
  Partial<Omit<GenerationRecord, "id" | "prompt">>;

/** Pluggable metadata store for generation records. */
export interface GenerationStore {
  create(record: NewGenerationRecord): Promise<GenerationRecord>;
  update(
    id: string,
    patch: Partial<Omit<GenerationRecord, "id" | "createdAt">>,
  ): Promise<GenerationRecord | null>;
  get(id: string): Promise<GenerationRecord | null>;
  /** Most-recent first. */
  list(limit?: number): Promise<GenerationRecord[]>;
}
