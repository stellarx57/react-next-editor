import type { StorageAdapter } from './types';

/**
 * In-memory {@link StorageAdapter} — useful for tests and serverless contexts
 * that hand bytes off elsewhere. URLs are `memory:` references.
 */
export class MemoryStorage implements StorageAdapter {
  private files = new Map<string, { data: Uint8Array; contentType: string }>();

  async write(key: string, data: Uint8Array, contentType: string) {
    this.files.set(key, { data, contentType });
    return { url: `memory:${key}`, ref: key };
  }

  get(key: string): { data: Uint8Array; contentType: string } | undefined {
    return this.files.get(key);
  }

  keys(): string[] {
    return [...this.files.keys()];
  }
}

export interface FilesystemStorageOptions {
  /** Directory rendered files are written under. */
  baseDir: string;
  /**
   * Public base URL files are served from. The returned `url` is
   * `${baseUrl}/${key}`. If omitted, `url` mirrors the on-disk path.
   */
  baseUrl?: string;
}

/**
 * Filesystem {@link StorageAdapter} (F-6.10). Writes rendered files under a base
 * directory and returns a URL/reference. Uses `node:fs` lazily so the module can
 * be imported anywhere without eagerly pulling Node built-ins.
 */
export class FilesystemStorage implements StorageAdapter {
  private readonly baseDir: string;
  private readonly baseUrl?: string;

  constructor(options: FilesystemStorageOptions) {
    this.baseDir = options.baseDir;
    this.baseUrl = options.baseUrl;
  }

  async write(key: string, data: Uint8Array, _contentType: string) {
    const { join, dirname } = await import('node:path');
    const { mkdir, writeFile } = await import('node:fs/promises');
    // Prevent path traversal in the key.
    const safeKey = key.replace(/\.\.(?:[/\\]|$)/g, '').replace(/^[/\\]+/, '');
    const filePath = join(this.baseDir, safeKey);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, data);
    const url = this.baseUrl ? `${this.baseUrl.replace(/\/$/, '')}/${safeKey}` : filePath;
    return { url, ref: filePath };
  }
}
