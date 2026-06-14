import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'core/index': 'src/core/index.ts',
    'export/index': 'src/export/index.ts',
    'persistence/index': 'src/persistence/index.ts',
  },
  format: ['esm', 'cjs'],
  outExtension({ format }) {
    return { js: format === 'cjs' ? '.cjs' : '.js' };
  },
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  splitting: true,
  minify: false,
  // React is a peer dependency; `docx` is optional and lazily imported. Keep external
  // so consumers' single React instance is used and the export libs stay code-split.
  external: ['react', 'react-dom', 'react/jsx-runtime', 'docx'],
  async onSuccess() {
    // Emit the stylesheet at a stable, documented path: dist/styles.css
    const { copyFile } = await import('node:fs/promises');
    await copyFile('src/styles/editor.css', 'dist/styles.css');
  },
});
