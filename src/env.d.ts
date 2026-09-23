/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_SITE_URL?: string;
  readonly PUBLIC_SUPABASE_URL?: string;
  readonly PUBLIC_SUPABASE_ANON_KEY?: string;
  /** Build flag: "1" or "true" leaves out records marked "borrador": true. */
  readonly OCULTAR_BORRADORES?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
