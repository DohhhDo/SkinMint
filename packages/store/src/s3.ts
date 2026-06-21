import type { BlobStorage, StoredBlob } from "./types";

export interface S3BlobStorageConfig {
  bucket: string;
  /** Public base URL the bucket/CDN serves from, e.g. https://cdn.example.com */
  publicBaseUrl: string;
  /** Custom endpoint for S3-compatible services (Cloudflare R2, MinIO). */
  endpoint?: string;
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  /** Key prefix within the bucket. */
  prefix?: string;
}

/**
 * S3 / R2 / S3-compatible blob storage. Returns public URLs, so the app does
 * not proxy the bytes. Requires the optional `@aws-sdk/client-s3` dependency.
 */
export class S3BlobStorage implements BlobStorage {
  readonly isPublic = true;
  private clientPromise: Promise<unknown> | null = null;
  private readonly prefix: string;

  constructor(private readonly config: S3BlobStorageConfig) {
    this.prefix = config.prefix ? config.prefix.replace(/\/$/, "") + "/" : "";
  }

  private async client(): Promise<{ send: (cmd: unknown) => Promise<unknown> }> {
    if (!this.clientPromise) {
      this.clientPromise = import("@aws-sdk/client-s3").then(({ S3Client }) => {
        const { region, endpoint, accessKeyId, secretAccessKey } = this.config;
        return new S3Client({
          region: region ?? "auto",
          endpoint,
          forcePathStyle: Boolean(endpoint),
          credentials:
            accessKeyId && secretAccessKey
              ? { accessKeyId, secretAccessKey }
              : undefined,
        });
      });
    }
    return this.clientPromise as Promise<{ send: (cmd: unknown) => Promise<unknown> }>;
  }

  private fullKey(key: string): string {
    return this.prefix + key;
  }

  async put(key: string, data: Uint8Array, contentType: string): Promise<void> {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await this.client();
    await client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: this.fullKey(key),
        Body: data,
        ContentType: contentType,
      }),
    );
  }

  async get(key: string): Promise<StoredBlob | null> {
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await this.client();
    try {
      const res = (await client.send(
        new GetObjectCommand({ Bucket: this.config.bucket, Key: this.fullKey(key) }),
      )) as { Body?: { transformToByteArray(): Promise<Uint8Array> }; ContentType?: string };
      if (!res.Body) return null;
      return {
        data: await res.Body.transformToByteArray(),
        contentType: res.ContentType ?? "application/octet-stream",
      };
    } catch {
      return null;
    }
  }

  url(key: string): string {
    return `${this.config.publicBaseUrl.replace(/\/$/, "")}/${this.fullKey(key)}`;
  }
}
