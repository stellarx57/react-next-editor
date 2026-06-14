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
    const { dirname, resolve, relative, isAbsolute, sep } = await import('node:path');
    const { mkdir, writeFile } = await import('node:fs/promises');

    // Resolve the target and assert it stays inside baseDir — robust against
    // traversal sequences (`../`, `....//`, absolute keys, symlinked separators).
    const root = resolve(this.baseDir);
    const cleanedKey = key.replace(/^[/\\]+/, '');
    const filePath = resolve(root, cleanedKey);
    const rel = relative(root, filePath);
    if (rel === '' || rel.startsWith('..') || isAbsolute(rel)) {
      throw new Error(`react-next-editor: unsafe storage key rejected: ${key}`);
    }

    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, data);
    // The public URL uses the path relative to the storage root.
    const urlKey = rel.split(sep).join('/');
    const url = this.baseUrl ? `${this.baseUrl.replace(/\/$/, '')}/${urlKey}` : filePath;
    return { url, ref: filePath };
  }
}
