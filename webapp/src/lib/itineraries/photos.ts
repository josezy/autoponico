import 'server-only';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * Photos for daily logs and clone cards.
 * Postgres stores the object key. Bytes go to object storage (S3-compatible)
 * or, when that is not configured, to a local directory that implements the
 * same interface for development.
 */
export type StoredPhoto = {
  key: string;
  contentType: string;
  byteSize: number;
};

export type PhotoPutInput = {
  itineraryId: string;
  filename: string;
  contentType: string;
  body: Buffer;
};

export interface PhotoStorage {
  put(input: PhotoPutInput): Promise<StoredPhoto>;
  /** URL the browser can load. Presigned for object storage. */
  urlFor(key: string): Promise<string>;
  get(key: string): Promise<{ body: Buffer; contentType: string } | null>;
  delete(key: string): Promise<void>;
}

export const PHOTO_CONTENT_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;

const globalForPhotos = globalThis as unknown as { photoStorage?: PhotoStorage };

export function getPhotoStorage(): PhotoStorage {
  if (!globalForPhotos.photoStorage) {
    globalForPhotos.photoStorage = createPhotoStorage();
  }
  return globalForPhotos.photoStorage;
}

export function createPhotoStorage(): PhotoStorage {
  const driver = (process.env.PHOTO_STORAGE || '').toLowerCase();
  if (driver === 's3' || (driver !== 'local' && process.env.S3_BUCKET)) {
    return new S3PhotoStorage();
  }
  return new LocalPhotoStorage(process.env.PHOTO_LOCAL_DIR || path.join(process.cwd(), 'data', 'photos'));
}

function extensionFor(contentType: string): string {
  if (contentType === 'image/png') return '.png';
  if (contentType === 'image/webp') return '.webp';
  if (contentType === 'image/gif') return '.gif';
  return '.jpg';
}

export function buildObjectKey(itineraryId: string, filename: string, contentType: string): string {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 40) || 'photo';
  const named = /\.(png|jpe?g|webp|gif)$/i.test(safe) ? safe : `${safe}${extensionFor(contentType)}`;
  return `itineraries/${itineraryId}/${randomUUID()}-${named}`;
}

export function assertSafeObjectKey(key: string): void {
  if (!/^[a-zA-Z0-9/._-]+$/.test(key) || key.includes('..') || key.startsWith('/')) {
    throw new Error('Invalid photo key');
  }
}

function contentTypeFor(filename: string, fallback: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  return fallback || 'application/octet-stream';
}

export class LocalPhotoStorage implements PhotoStorage {
  constructor(private readonly root: string) {}

  private resolve(key: string): string {
    assertSafeObjectKey(key);
    const root = path.resolve(this.root);
    const full = path.resolve(root, key);
    if (full !== root && !full.startsWith(root + path.sep)) {
      throw new Error('Invalid photo key');
    }
    return full;
  }

  async put(input: PhotoPutInput): Promise<StoredPhoto> {
    const key = buildObjectKey(input.itineraryId, input.filename, input.contentType);
    const full = this.resolve(key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, input.body);
    return { key, contentType: input.contentType, byteSize: input.body.length };
  }

  async urlFor(key: string): Promise<string> {
    assertSafeObjectKey(key);
    return `/api/photos/${key.split('/').map(encodeURIComponent).join('/')}`;
  }

  async get(key: string): Promise<{ body: Buffer; contentType: string } | null> {
    try {
      const body = await readFile(this.resolve(key));
      return { body, contentType: contentTypeFor(key, 'application/octet-stream') };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolve(key), { force: true });
  }
}

export class S3PhotoStorage implements PhotoStorage {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor() {
    const bucket = process.env.S3_BUCKET;
    if (!bucket) throw new Error('S3_BUCKET is required when PHOTO_STORAGE=s3');
    this.bucket = bucket;
    this.client = new S3Client({
      region: process.env.S3_REGION || 'auto',
      endpoint: process.env.S3_ENDPOINT || undefined,
      forcePathStyle: Boolean(process.env.S3_ENDPOINT),
      credentials: process.env.S3_ACCESS_KEY_ID
        ? {
            accessKeyId: process.env.S3_ACCESS_KEY_ID,
            secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
          }
        : undefined,
    });
  }

  async put(input: PhotoPutInput): Promise<StoredPhoto> {
    const key = buildObjectKey(input.itineraryId, input.filename, input.contentType);
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: input.body,
      ContentType: input.contentType,
    }));
    return { key, contentType: input.contentType, byteSize: input.body.length };
  }

  async urlFor(key: string): Promise<string> {
    assertSafeObjectKey(key);
    const base = process.env.S3_PUBLIC_URL_BASE;
    if (base) {
      return `${base.replace(/\/$/, '')}/${key.split('/').map(encodeURIComponent).join('/')}`;
    }
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), { expiresIn: 60 * 60 });
  }

  async get(key: string): Promise<{ body: Buffer; contentType: string } | null> {
    assertSafeObjectKey(key);
    try {
      const response = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      const bytes = await response.Body?.transformToByteArray();
      if (!bytes) return null;
      return {
        body: Buffer.from(bytes),
        contentType: response.ContentType || 'application/octet-stream',
      };
    } catch (error) {
      if ((error as { name?: string }).name === 'NoSuchKey') return null;
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    assertSafeObjectKey(key);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
