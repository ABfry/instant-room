import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/infrastructure/adapters/y-websocket-entry.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  splitting: true,
  clean: true,
  outExtension({ format }) {
    return {
      js: format === 'esm' ? '.mjs' : '.cjs',
    }
  },
  external: ['yjs', 'y-protocols', '@hocuspocus/server', 'y-websocket', 'ws', 'lib0'],
})
