import { useMemo, useState, type SyntheticEvent } from 'react';
import { SearchIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export type SearchItem = {
  id: string;
  name: string;
  collection: string;
  href: string;
  meta: string;
  summary: string;
  status: string;
};

type Props = {
  items: SearchItem[];
  locale: 'es' | 'en';
  initialQuery?: string;
  emptyLabel?: string;
};

const copy = {
  es: {
    placeholder: 'Buscar Pokémon, misión, objeto o sistema…',
    submit: 'Buscar',
    results: 'resultados',
    noResults: 'No hay registros que coincidan con esa búsqueda.',
    supported: 'respaldado',
  },
  en: {
    placeholder: 'Search Pokémon, quest, item or system…',
    submit: 'Search',
    results: 'results',
    noResults: 'No records match that search.',
    supported: 'supported',
  },
} as const;

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase();
}

export function ContentSearch({ items, locale, initialQuery = '', emptyLabel }: Props) {
  const [query, setQuery] = useState(initialQuery);
  const strings = copy[locale];
  const filtered = useMemo(() => {
    const needle = normalize(query.trim());
    if (!needle) return items;
    return items.filter((item) =>
      normalize(`${item.name} ${item.collection} ${item.meta} ${item.summary}`).includes(needle),
    );
  }, [items, query]);

  function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const url = new URL(window.location.href);
    if (query.trim()) url.searchParams.set('q', query.trim());
    else url.searchParams.delete('q');
    window.history.replaceState({}, '', url);
  }

  return (
    <div className="grid gap-5">
      <form
        className="wiki-search-local flex flex-col gap-2 sm:flex-row"
        role="search"
        onSubmit={handleSubmit}
      >
        <label className="sr-only" htmlFor="content-search">
          {strings.placeholder}
        </label>
        <Input
          id="content-search"
          className="min-h-10 flex-1"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={strings.placeholder}
          type="search"
        />
        <Button className="min-h-10" type="submit" variant="outline">
          <SearchIcon data-icon="inline-start" />
          {strings.submit}
        </Button>
      </form>

      <p
        className="border-b border-border pb-3 font-mono text-xs uppercase tracking-[0.1em] text-muted-foreground"
        aria-live="polite"
      >
        {filtered.length} {strings.results}
      </p>

      {filtered.length > 0 ? (
        <div className="wiki-data-list">
          {filtered.map((item) => (
            <a
              className="wiki-data-row group no-underline transition-colors hover:border-accent/60"
              href={item.href}
              key={item.id}
            >
              <div className="wiki-data-row-name">
                <span className="eyebrow block">{item.collection}</span>
                <h2 className="mt-1 text-base font-semibold tracking-tight text-foreground">
                  {item.name}
                </h2>
              </div>
              {item.meta && <p className="wiki-data-row-meta">{item.meta}</p>}
              <div className="flex items-center gap-3">
                {item.summary && (
                  <p className="wiki-data-row-summary hidden lg:block">{item.summary}</p>
                )}
                <span className="status-label" data-status={item.status}>
                  {item.status.replaceAll('_', ' ')}
                </span>
              </div>
            </a>
          ))}
        </div>
      ) : (
        <p className="wiki-empty-state text-sm text-muted-foreground">
          {emptyLabel ?? strings.noResults}
        </p>
      )}
    </div>
  );
}
