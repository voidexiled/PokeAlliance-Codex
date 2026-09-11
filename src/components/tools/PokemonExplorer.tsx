import { useMemo, useState } from 'react';

import {
  getRosterElementsLabel,
  getRosterRoleLabel,
  getRosterTierLabel,
  getRosterVariantLabel,
  publicPokemonRoster,
  publicPokemonRosterMeta,
  type PublicPokemonRecord,
} from '@/lib/tools/pokemon-roster';

type Locale = 'es' | 'en';
type Mode = 'compare' | 'tiers';

type Props = {
  locale: Locale;
};

const copy = {
  es: {
    tabs: { compare: 'Comparar', tiers: 'Explorar tiers' },
    compareEyebrow: 'Comparación directa',
    compareTitle: 'Elige dos variantes',
    compareDescription:
      'Consulta los campos publicados de la wiki en paralelo. Este resumen no calcula daño ni decide cuál Pokémon es mejor.',
    pickerSearch: 'Filtrar opciones',
    pickerPlaceholder: 'Nombre o número…',
    first: 'Pokémon A',
    second: 'Pokémon B',
    compareTable: 'Resumen comparado',
    field: 'Campo',
    number: 'Número',
    variant: 'Variante',
    generation: 'Generación',
    level: 'Nivel mostrado',
    tier: 'Tier',
    role: 'Función',
    elements: 'Elementos',
    detail: 'Ficha detallada',
    available: 'Disponible',
    unavailable: 'No indicado',
    tiersEyebrow: 'Roster público',
    tiersTitle: 'Explorar por tier',
    tiersDescription:
      'Filtra las variantes que aparecen en la instantánea pública y revisa qué información está disponible para cada una.',
    search: 'Buscar',
    searchPlaceholder: 'Nombre, número o elemento…',
    allTiers: 'Todos los tiers',
    allRoles: 'Todas las funciones',
    allVariants: 'Todas las variantes',
    normal: 'Normal',
    shiny: 'Shiny',
    results: 'resultados',
    useInCompare: 'Usar en comparar',
    noResults: 'No hay variantes que coincidan con esos filtros.',
    sourceTitle: 'Fuente y límite',
    source:
      'Este explorador usa un snapshot público del roster de la wiki. Incluye identidad, variante, nivel, tier, función y elementos; no incluye fórmulas de daño, movesets ni ubicaciones.',
    snapshot: 'snapshot',
    record: 'variantes registradas',
  },
  en: {
    tabs: { compare: 'Compare', tiers: 'Explore tiers' },
    compareEyebrow: 'Direct comparison',
    compareTitle: 'Choose two variants',
    compareDescription:
      'Read the wiki-published fields side by side. This summary does not calculate damage or decide which Pokémon is better.',
    pickerSearch: 'Filter options',
    pickerPlaceholder: 'Name or number…',
    first: 'Pokémon A',
    second: 'Pokémon B',
    compareTable: 'Comparison summary',
    field: 'Field',
    number: 'Number',
    variant: 'Variant',
    generation: 'Generation',
    level: 'Displayed level',
    tier: 'Tier',
    role: 'Role',
    elements: 'Elements',
    detail: 'Detailed page',
    available: 'Available',
    unavailable: 'Not stated',
    tiersEyebrow: 'Public roster',
    tiersTitle: 'Explore by tier',
    tiersDescription:
      'Filter the variants present in the public snapshot and review which fields are available for each one.',
    search: 'Search',
    searchPlaceholder: 'Name, number or element…',
    allTiers: 'All tiers',
    allRoles: 'All roles',
    allVariants: 'All variants',
    normal: 'Normal',
    shiny: 'Shiny',
    results: 'results',
    useInCompare: 'Use in compare',
    noResults: 'No variants match these filters.',
    sourceTitle: 'Source and boundary',
    source:
      'This explorer uses a public wiki roster snapshot. It includes identity, variant, level, tier, role and elements; it does not include damage formulas, movesets or locations.',
    snapshot: 'snapshot',
    record: 'registered variants',
  },
} as const;

const defaultFirst =
  publicPokemonRoster.find((record) => record.route === 'gen/1/bulbasaur')?.route ??
  publicPokemonRoster[0]?.route ??
  '';
const defaultSecond =
  publicPokemonRoster.find((record) => record.route === 'gen/1/charmander')?.route ??
  publicPokemonRoster[1]?.route ??
  '';

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase();
}

function getOptionLabel(record: PublicPokemonRecord, locale: Locale): string {
  return `${record.displayName} · ${getRosterVariantLabel(record, locale)}`;
}

function getRecord(route: string): PublicPokemonRecord {
  return (
    publicPokemonRoster.find((record) => record.route === route) ??
    publicPokemonRoster[0] ?? {
      path: '',
      route: '',
      generation: '',
      number: '',
      name: '—',
      displayName: '—',
      image: '',
      level: null,
      tier: null,
      displayTier: null,
      role: '',
      elements: [],
      variant: '',
      detailAvailable: false,
    }
  );
}

function getDetailLabel(record: PublicPokemonRecord, strings: (typeof copy)[Locale]): string {
  return record.detailAvailable ? strings.available : strings.unavailable;
}

export function PokemonExplorer({ locale }: Props) {
  const strings = copy[locale];
  const [mode, setMode] = useState<Mode>('compare');
  const [firstRoute, setFirstRoute] = useState(defaultFirst);
  const [secondRoute, setSecondRoute] = useState(defaultSecond);
  const [pickerQuery, setPickerQuery] = useState('');
  const [tierQuery, setTierQuery] = useState('');
  const [tierFilter, setTierFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [variantFilter, setVariantFilter] = useState('all');

  const first = getRecord(firstRoute);
  const second = getRecord(secondRoute);
  const normalizedPickerQuery = normalize(pickerQuery.trim());

  const pickerOptions = useMemo(() => {
    if (!normalizedPickerQuery) return publicPokemonRoster;
    const selected = publicPokemonRoster.filter(
      (record) => record.route === firstRoute || record.route === secondRoute,
    );
    const matches = publicPokemonRoster.filter((record) =>
      normalize(
        `${record.displayName} ${record.name} ${record.number} ${record.variant} ${getRosterElementsLabel(record)}`,
      ).includes(normalizedPickerQuery),
    );
    return [...new Map([...selected, ...matches].map((record) => [record.route, record])).values()];
  }, [firstRoute, normalizedPickerQuery, secondRoute]);

  const tierOptions = useMemo(
    () =>
      [...new Set(publicPokemonRoster.map(getRosterTierLabel))].sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true }),
      ),
    [],
  );
  const visibleTierRecords = useMemo(() => {
    const normalizedQuery = normalize(tierQuery.trim());
    return publicPokemonRoster.filter((record) => {
      const searchable = normalize(
        `${record.displayName} ${record.name} ${record.number} ${getRosterElementsLabel(record)}`,
      );
      const matchesQuery = !normalizedQuery || searchable.includes(normalizedQuery);
      const matchesTier = tierFilter === 'all' || getRosterTierLabel(record) === tierFilter;
      const matchesRole = roleFilter === 'all' || getRosterRoleLabel(record) === roleFilter;
      const matchesVariant = variantFilter === 'all' || record.variant === variantFilter;
      return matchesQuery && matchesTier && matchesRole && matchesVariant;
    });
  }, [roleFilter, tierFilter, tierQuery, variantFilter]);

  const comparisonRows = [
    { label: strings.number, first: `#${first.number}`, second: `#${second.number}` },
    {
      label: strings.variant,
      first: getRosterVariantLabel(first, locale),
      second: getRosterVariantLabel(second, locale),
    },
    { label: strings.generation, first: first.generation, second: second.generation },
    { label: strings.level, first: first.level ?? '—', second: second.level ?? '—' },
    { label: strings.tier, first: getRosterTierLabel(first), second: getRosterTierLabel(second) },
    { label: strings.role, first: getRosterRoleLabel(first), second: getRosterRoleLabel(second) },
    {
      label: strings.elements,
      first: getRosterElementsLabel(first),
      second: getRosterElementsLabel(second),
    },
    {
      label: strings.detail,
      first: getDetailLabel(first, strings),
      second: getDetailLabel(second, strings),
    },
  ];

  function useInCompare(route: string) {
    setFirstRoute(route);
    setMode('compare');
  }

  return (
    <div className="pokemon-explorer" data-testid="pokemon-explorer">
      <div className="tool-tabs" role="tablist" aria-label={strings.tabs.compare}>
        <button
          className="tool-tab"
          data-active={mode === 'compare'}
          aria-selected={mode === 'compare'}
          role="tab"
          type="button"
          onClick={() => setMode('compare')}
        >
          {strings.tabs.compare}
        </button>
        <button
          className="tool-tab"
          data-active={mode === 'tiers'}
          aria-selected={mode === 'tiers'}
          role="tab"
          type="button"
          onClick={() => setMode('tiers')}
        >
          {strings.tabs.tiers}
        </button>
      </div>

      {mode === 'compare' ? (
        <section className="tool-section" aria-labelledby="compare-heading">
          <p className="eyebrow">{strings.compareEyebrow}</p>
          <h2 id="compare-heading" className="tool-heading">
            {strings.compareTitle}
          </h2>
          <p className="tool-description">{strings.compareDescription}</p>

          <div className="tool-picker wiki-panel">
            <label className="tool-field tool-picker-filter">
              <span>{strings.pickerSearch}</span>
              <input
                type="search"
                value={pickerQuery}
                onChange={(event) => setPickerQuery(event.target.value)}
                placeholder={strings.pickerPlaceholder}
              />
            </label>
            <div className="tool-picker-grid">
              <label className="tool-field">
                <span>{strings.first}</span>
                <select value={firstRoute} onChange={(event) => setFirstRoute(event.target.value)}>
                  {pickerOptions.map((record) => (
                    <option key={record.route} value={record.route}>
                      {getOptionLabel(record, locale)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="tool-field">
                <span>{strings.second}</span>
                <select
                  value={secondRoute}
                  onChange={(event) => setSecondRoute(event.target.value)}
                >
                  {pickerOptions.map((record) => (
                    <option key={record.route} value={record.route}>
                      {getOptionLabel(record, locale)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="compare-record-grid">
            {[first, second].map((record) => (
              <article className="compare-record" key={record.route}>
                <div>
                  <p className="eyebrow">{getRosterVariantLabel(record, locale)}</p>
                  <h3>{record.name}</h3>
                  <p className="compare-record-number">#{record.number}</p>
                </div>
                <span className="compare-tier">{getRosterTierLabel(record)}</span>
              </article>
            ))}
          </div>

          <div
            className="tool-table-wrap"
            role="region"
            aria-label={strings.compareTable}
            tabIndex={0}
          >
            <table className="tool-table">
              <caption>{strings.compareTable}</caption>
              <thead>
                <tr>
                  <th scope="col">{strings.field}</th>
                  <th scope="col">{first.name}</th>
                  <th scope="col">{second.name}</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row) => (
                  <tr key={row.label}>
                    <th scope="row">{row.label}</th>
                    <td>{row.first}</td>
                    <td>{row.second}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section className="tool-section" aria-labelledby="tiers-heading">
          <p className="eyebrow">{strings.tiersEyebrow}</p>
          <h2 id="tiers-heading" className="tool-heading">
            {strings.tiersTitle}
          </h2>
          <p className="tool-description">{strings.tiersDescription}</p>

          <div className="tier-filter-grid wiki-panel">
            <label className="tool-field tier-search-field">
              <span>{strings.search}</span>
              <input
                type="search"
                value={tierQuery}
                onChange={(event) => setTierQuery(event.target.value)}
                placeholder={strings.searchPlaceholder}
              />
            </label>
            <label className="tool-field">
              <span>{strings.tier}</span>
              <select value={tierFilter} onChange={(event) => setTierFilter(event.target.value)}>
                <option value="all">{strings.allTiers}</option>
                {tierOptions.map((tier) => (
                  <option key={tier} value={tier}>
                    {tier}
                  </option>
                ))}
              </select>
            </label>
            <label className="tool-field">
              <span>{strings.role}</span>
              <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
                <option value="all">{strings.allRoles}</option>
                <option value="PVE">PVE</option>
                <option value="PVP">PVP</option>
                <option value="—">—</option>
              </select>
            </label>
            <label className="tool-field">
              <span>{strings.variant}</span>
              <select
                value={variantFilter}
                onChange={(event) => setVariantFilter(event.target.value)}
              >
                <option value="all">{strings.allVariants}</option>
                <option value="normal">{strings.normal}</option>
                <option value="shiny">{strings.shiny}</option>
              </select>
            </label>
          </div>

          <p className="tool-result-count" aria-live="polite">
            {visibleTierRecords.length} {strings.results}
          </p>

          {visibleTierRecords.length > 0 ? (
            <div className="tier-list" role="list">
              {visibleTierRecords.map((record) => (
                <div className="tier-row" role="listitem" key={record.route}>
                  <div className="tier-row-name">
                    <strong>{record.name}</strong>
                    <span>#{record.number}</span>
                  </div>
                  <span className="tier-row-variant">{getRosterVariantLabel(record, locale)}</span>
                  <span className="tier-row-tier">{getRosterTierLabel(record)}</span>
                  <span className="tier-row-role">{getRosterRoleLabel(record)}</span>
                  <span className="tier-row-elements">{getRosterElementsLabel(record)}</span>
                  <button
                    className="tier-row-action"
                    type="button"
                    onClick={() => useInCompare(record.route)}
                  >
                    {strings.useInCompare}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="wiki-empty-state">{strings.noResults}</p>
          )}
        </section>
      )}

      <aside className="tool-source-note" aria-label={strings.sourceTitle}>
        <strong>{strings.sourceTitle}</strong>
        <p>{strings.source}</p>
        <code>
          {publicPokemonRosterMeta.recordCount} {strings.record} · {strings.snapshot}{' '}
          {publicPokemonRosterMeta.sourceSnapshot.slice(0, 12)}…
        </code>
      </aside>
    </div>
  );
}
