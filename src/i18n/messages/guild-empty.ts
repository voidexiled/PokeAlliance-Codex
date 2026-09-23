import type { Locale } from '../config';

// «Sin cortes» of Guild (spec §10.5): the one sentence the prerendered Guild HTML must not
// carry (CA-10.13). An island's props are written into its HTML, so GuildRoot takes this
// sentence from this module, inside its own script, instead of receiving it with the `guild`
// namespace. es.ts and en.ts read `guild.empty` from here, so the dictionaries stay its source.
export const GUILD_EMPTY: Readonly<Record<Locale, string>> = {
  es: 'Importa un export de guild para ver el análisis.',
  en: 'Import a guild export to see the analysis.',
};
