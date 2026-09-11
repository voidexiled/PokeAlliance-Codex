export interface SupabasePublicConfig {
  url: string;
  anonKey: string;
}

export function getSupabasePublicConfig(): SupabasePublicConfig | null {
  const url = import.meta.env.PUBLIC_SUPABASE_URL?.trim();
  const anonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) {
    return null;
  }

  return { url, anonKey };
}
