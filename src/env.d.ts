/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_SITE_URL?: string;
  readonly PUBLIC_SUPABASE_URL?: string;
  readonly PUBLIC_SUPABASE_ANON_KEY?: string;
  /** Build flag: "1" or "true" leaves out records marked "borrador": true. */
  readonly OCULTAR_BORRADORES?: string;
}

/** Content version of public/sprites/ (astro.config.mjs, src/lib/assets/version.ts). */
declare const __AC_SPRITES_VERSION__: string | undefined;
/** Content version of public/pokemon/ (astro.config.mjs, src/lib/assets/version.ts). */
declare const __AC_POKEMON_ART_VERSION__: string | undefined;

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
