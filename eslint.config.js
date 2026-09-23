import eslint from '@eslint/js';
import astro from 'eslint-plugin-astro';
import tseslint from 'typescript-eslint';

// Libraries the redesign retired (§3.8, E8). They left package.json with the last
// legacy files (§3.10 step 4); this keeps them from coming back, since every
// component builds on native elements instead. design:check rule 9 repeats this
// over the sources that ESLint does not parse.
const RETIRED_LIBRARIES = [
  '@base-ui/react',
  '@base-ui/react/*',
  'class-variance-authority',
  'cn',
  'tw-animate-css',
];

const RETIRED_MESSAGE = 'Dependencia retirada por §3.8 (E8).';

// lucide-react stays, but only behind src/components/icons/Glyph.tsx (C-R7).
const GLYPH_MESSAGE =
  'lucide-react solo se importa desde src/components/icons/Glyph.tsx (C-R7); los demás iconos son sprites del juego.';

export default [
  {
    // src/styles/tokens.css and src/styles/theme.css are generated too; Prettier
    // skips them through .prettierignore and ESLint never reads CSS.
    ignores: ['dist/**', '.astro/**', 'node_modules/**', 'coverage/**', 'src/lib/design/tokens.ts'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...astro.configs['flat/recommended'],
  {
    // Node scripts and configuration files: eslint.configs.recommended declares
    // no environment, so its globals have to be listed.
    files: ['**/*.mjs'],
    languageOptions: {
      globals: {
        Buffer: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        process: 'readonly',
      },
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
    },
  },
  {
    files: ['src/**/*.{ts,tsx,astro}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['lucide-react'], message: GLYPH_MESSAGE },
            { group: RETIRED_LIBRARIES, message: RETIRED_MESSAGE },
          ],
        },
      ],
    },
  },
  {
    files: ['src/components/icons/Glyph.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [{ group: RETIRED_LIBRARIES, message: RETIRED_MESSAGE }] },
      ],
    },
  },
];
