import { afterAll, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FilesystemStorage, MemoryStorage } from './storage';

describe('MemoryStorage', () => {
  it('stores and returns a memory reference', async () => {
    const s = new MemoryStorage();
    const { url, ref } = await s.write('a/b.txt', new Uint8Array([1, 2, 3]), 'text/plain');
    expect(url).toBe('memory:a/b.txt');
    expect(ref).toBe('a/b.txt');
    expect(s.get('a/b.txt')?.data).toEqual(new Uint8Array([1, 2, 3]));
  });
});

describe('FilesystemStorage', () => {
  let dir: string;

  afterAll(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  it('writes a file within the base directory and builds a URL', async () => {
    dir = await mkdtemp(join(tmpdir(), 'rne-store-'));
    const storage = new FilesystemStorage({ baseDir: dir, baseUrl: '/exports' });
    const { url, ref } = await storage.write('docs/out.txt', new TextEncoder().encode('hi'), 'text/plain');
    expect(url).toBe('/exports/docs/out.txt');
    expect(await readFile(ref, 'utf8')).toBe('hi');
  });

  it('rejects path traversal keys but allows in-bounds keys', async () => {
    const storage = new FilesystemStorage({ baseDir: dir });
    // Genuine traversal escapes the base dir → rejected.
    await expect(storage.write('../escape.txt', new Uint8Array([0]), 'text/plain')).rejects.toThrow(
      /unsafe storage key/,
    );
    await expect(
      storage.write('foo/../../escape.txt', new Uint8Array([0]), 'text/plain'),
    ).rejects.toThrow(/unsafe storage key/);
    // A leading slash is stripped, keeping the file inside the base dir.
    await expect(
      storage.write('/etc/passwd', new Uint8Array([0]), 'text/plain'),
    ).resolves.toBeTruthy();
    // An interior `..` that stays within bounds is allowed.
    await expect(
      storage.write('sub/../within.txt', new Uint8Array([0]), 'text/plain'),
    ).resolves.toBeTruthy();
  });
});
