// Vitest runs through Astro's Vite config so that .astro files compile in unit
// tests (§14.2). `getViteConfig` merges astro.config.mjs, which already carries
// the `@content` alias; both aliases are repeated here so the config reads on
// its own and so a `vitest` run outside Astro still resolves them.
import { fileURLToPath, URL } from 'node:url';

import { getViteConfig } from 'astro/config';
import type {} from 'vitest/config';

const contentDir = process.env.VISUAL === '1' ? './tests/visual/content' : './content';

export default getViteConfig({
  resolve: {
    alias: {
      // The schemas never follow the data (§14.5, «con los mismos esquemas»), so this
      // more specific entry stays on content/schemas/ and has to be declared first.
      '@content/schemas': fileURLToPath(new URL('./content/schemas', import.meta.url)).replace(
        /[\\/]$/,
        '',
      ),
      '@content': fileURLToPath(new URL(contentDir, import.meta.url)).replace(/[\\/]$/, ''),
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx}'],
    passWithNoTests: false,
    globals: false,
  },
});
