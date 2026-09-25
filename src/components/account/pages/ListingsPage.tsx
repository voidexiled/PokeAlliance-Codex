import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { versioned } from '@/lib/assets/version';
import { CardGrid } from '@/components/cards/CardGrid';
import { CardGroup } from '@/components/cards/CardGroup';
import { ListingCard, type ListingCardListing } from '@/components/cards/ListingCard';
import { Chip } from '@/components/content/Chip';
import { EmptyState } from '@/components/content/EmptyState';
import { Notice } from '@/components/content/Notice';
import { Button } from '@/components/controls/Button';
import { Dialog, initialFocus } from '@/components/controls/Dialog';
import { ToggleGroup } from '@/components/controls/ToggleGroup';
import { Section } from '@/components/layout/Section';
import { decodeItems, decodeItemsRefs } from '@/components/items/config';
import { decodePokedex, decodeRefs } from '@/components/pokedex/config';
import { previewListing, type ListingPreviewData } from '@/components/trade/ListingPreview';
import type { Locale } from '@/i18n/config';
import { listingLayout, trackCount } from '@/lib/cards/layout';
import { formatRelative } from '@/lib/format/dates';
import { formatInteger } from '@/lib/format/numbers';
import { usePanels } from '@/lib/game/panels';
import { mapSupabaseError, type SupabaseFailure } from '@/lib/supabase/errors';
import { listMyListings, setListingStatus } from '@/lib/supabase/trade';
import { ESTADOS_ANUNCIO, TIPOS_ACTIVO, visibleStatus } from '@/lib/trade/types';
import type { Anuncio, EstadoAnuncio } from '@/lib/trade/types';

import { PageError } from './PageError';
import type { ListingActionKey, ListingsPageData, ListingsPageTexts, PageContext } from './types';

// «Mis anuncios» (spec 9.16.3, 9.7.8), the body of `/{l}/cuenta/anuncios/` in the account frame,
// a chunk of its own:
//
// - «Crear anuncio» and the state filter with the count of each state, kept in `?estado=`.
// - Every own listing, newest first, as the cards of 9.5.8 (`ListingCard`, one `CardGroup` per
//   asset type), built with the preview builder of the publish page from the two PR5 data files,
//   so a card here says what it says in the list. Under each card: its state when the card does
//   not say it (expired, completed, withdrawn), «Editar» while it is published or reserved, and
//   the actions 9.7.8 allows in it.
// - «Retirar» and «Marcar completado» cannot be undone: each asks first (an alert dialog with the
//   focus on «Volver»). The others act at once.
// Every call goes through src/lib/supabase/trade.ts; the database decides every permission.

/** The value of the state filter that keeps every listing. */
const ALL = 'todos';

/** A listing state the seller sets (9.7.8). */
type SetStatus = Exclude<EstadoAnuncio, 'expirado'>;

/** The actions of 9.7.8 by the state a listing is shown in. */
const ACTIONS: Readonly<
  Record<EstadoAnuncio, readonly (readonly [ListingActionKey, SetStatus])[]>
> = {
  publicado: [
    ['reserve', 'reservado'],
    ['complete', 'completado'],
    ['withdraw', 'retirado'],
  ],
  reservado: [
    ['release', 'publicado'],
    ['complete', 'completado'],
    ['withdraw', 'retirado'],
  ],
  expirado: [['renew', 'publicado']],
  completado: [],
  retirado: [],
};

/** Cards from this index on load their art lazily (7.4.2). */
const EAGER_CARDS = 4;

type Load<T> =
  { state: 'loading' } | { state: 'error'; error: unknown } | { state: 'ready'; data: T };

interface ListingsPageProps extends PageContext {
  texts: ListingsPageTexts;
  data: ListingsPageData;
}

interface OwnListing {
  anuncio: Anuncio;
  /** The state it is shown in: `publicado` or `reservado` past `expira` are `expirado` (9.7.8). */
  state: EstadoAnuncio;
  card: ListingCardListing;
}

/** An action that asks first. */
interface Asking {
  listing: OwnListing;
  key: 'complete' | 'withdraw';
  status: SetStatus;
}

function isState(value: string | null): value is EstadoAnuncio {
  return (ESTADOS_ANUNCIO as readonly string[]).includes(value ?? '');
}

/** The filter of `?estado=`: a state, or every listing. */
function readFilter(): string {
  const value = new URLSearchParams(window.location.search).get('estado');
  return isState(value) ? value : ALL;
}

function filterHref(filter: string): string {
  const params = new URLSearchParams(window.location.search);
  if (filter === ALL) params.delete('estado');
  else params.set('estado', filter);
  const query = params.toString();
  return `${window.location.pathname}${query === '' ? '' : `?${query}`}`;
}

/** The two data files the cards read, fetched once, only when the account has listings (PR5). */
function useCatalogue(data: ListingsPageData, wanted: boolean) {
  const [catalogue, setCatalogue] = useState<Load<Omit<ListingPreviewData, 'worlds'>>>({
    state: 'loading',
  });
  useEffect(() => {
    if (!wanted) return undefined;
    let active = true;
    const read = (url: string) =>
      fetch(versioned(url)).then((response) => {
        if (!response.ok) throw new Error(`${url}: ${response.status}`);
        return response.json() as Promise<unknown>;
      });
    Promise.all([read(data.pokedexUrl), read(data.itemsUrl)]).then(
      ([pokedex, items]) => {
        if (!active) return;
        setCatalogue({
          state: 'ready',
          data: {
            pokemon: new Map(decodePokedex(pokedex).map((row) => [row.id, row])),
            elements: decodeRefs(pokedex).elementos,
            items: new Map(decodeItems(items).map((row) => [row.id, row])),
            itemRefs: decodeItemsRefs(items),
            categories: data.categories,
            auras: data.auras,
            addons: data.addons,
            sprites: data.sprites,
            diamonds: data.diamonds,
          },
        });
      },
      (error: unknown) => {
        if (active) setCatalogue({ state: 'error', error });
      },
    );
    return () => {
      active = false;
    };
  }, [data, wanted]);
  return catalogue;
}

/** «Publicados 3»: the option of a filter with its count. */
function countLabel(label: string, n: number, locale: Locale): ReactNode {
  return (
    <>
      {label} <span className="ac-account-count">{formatInteger(n, locale)}</span>
    </>
  );
}

export default function ListingsPage({
  client,
  userId,
  locale,
  account,
  ui,
  retry,
  heading,
  texts,
  data,
}: ListingsPageProps) {
  const handle = account.username ?? '';
  const [load, setLoad] = useState<Load<Anuncio[]>>({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [filter, setFilter] = useState<string>(readFilter);
  const [pending, setPending] = useState<string | null>(null);
  const [actionError, setActionError] = useState<SupabaseFailure | null>(null);
  const [asking, setAsking] = useState<Asking | null>(null);
  const [askingOpen, setAskingOpen] = useState(false);
  const hasListings = load.state === 'ready' && load.data.length > 0;
  const catalogue = useCatalogue(data, hasListings);
  // The rest of every panel of the cards (`/{l}/paneles.json`), once it is here.
  const panels = usePanels(locale);
  // The moment the list was read: states and «hace 12 min» are relative to it.
  const [now, setNow] = useState(() => Date.now());

  const reload = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    const read = () => setFilter(readFilter());
    window.addEventListener('popstate', read);
    return () => window.removeEventListener('popstate', read);
  }, []);

  useEffect(() => {
    let active = true;
    setLoad({ state: 'loading' });
    void listMyListings(client, { userId, handle }).then(({ data: rows, error }) => {
      if (!active) return;
      setNow(Date.now());
      if (error !== null || rows === null) setLoad({ state: 'error', error });
      else setLoad({ state: 'ready', data: rows });
    });
    return () => {
      active = false;
    };
  }, [client, userId, handle, attempt]);

  const own = useMemo<OwnListing[] | null>(() => {
    if (load.state !== 'ready' || catalogue.state !== 'ready') return null;
    const preview: ListingPreviewData = { ...catalogue.data, worlds: data.worlds, panels };
    const labels = {
      card: data.card,
      tooltip: texts.tooltip,
      now: '',
      unsellable: data.unsellable,
      unitPrice: data.unitPrice,
      anyWorld: data.anyWorld,
    };
    return load.data.flatMap((anuncio) => {
      const card = previewListing(
        { draft: anuncio, data: preview, labels, locale, hint: texts.pinHint, orLabel: texts.or },
        {
          datetime: anuncio.publicado,
          text: formatRelative(anuncio.publicado, locale, new Date(now)),
        },
      );
      if (card === null) return [];
      const state = visibleStatus(anuncio, now);
      return [
        {
          anuncio,
          state,
          card: {
            ...card,
            href:
              anuncio.estado === 'retirado'
                ? undefined
                : `/${locale}/comercio/anuncio/${encodeURIComponent(anuncio.id)}/`,
            reserved: state === 'reservado',
          },
        },
      ];
    });
  }, [load, catalogue, data, texts, locale, now, panels]);

  async function act(listing: OwnListing, status: SetStatus) {
    setPending(listing.anuncio.id);
    setActionError(null);
    const { error } = await setListingStatus(client, listing.anuncio.id, status);
    setPending(null);
    if (error !== null) setActionError(error);
    else reload();
  }

  function choose(next: string) {
    setFilter(next);
    window.history.pushState(window.history.state, '', filterHref(next));
  }

  function ask(listing: OwnListing, key: ListingActionKey, status: SetStatus) {
    if (key === 'complete' || key === 'withdraw') {
      setAsking({ listing, key, status });
      setAskingOpen(true);
    } else void act(listing, status);
  }

  const create = (
    <Button href={`/${locale}/comercio/publicar/`} variant="solid">
      {texts.create}
    </Button>
  );

  let body: ReactNode;
  if (load.state === 'loading' || (hasListings && catalogue.state === 'loading')) {
    body = <div className="ac-account-busy" aria-busy="true" />;
  } else if (load.state === 'error') {
    body = (
      <PageError
        error={load.error}
        locale={locale}
        retry={retry}
        dismiss={ui.dismiss}
        onRetry={reload}
      />
    );
  } else if (load.data.length === 0) {
    body = <EmptyState action={create}>{texts.none}</EmptyState>;
  } else if (catalogue.state === 'error' || own === null) {
    body = <Notice closeLabel={ui.dismiss}>{texts.dataError}</Notice>;
  } else {
    const counts = new Map<EstadoAnuncio, number>();
    for (const listing of own) counts.set(listing.state, (counts.get(listing.state) ?? 0) + 1);
    const shown = own.filter((listing) => filter === ALL || listing.state === filter);
    body = (
      <>
        <div className="ac-account-toolbar">
          <ToggleGroup
            label={texts.filter}
            value={filter}
            options={[
              { value: ALL, label: countLabel(texts.all, own.length, locale) },
              ...ESTADOS_ANUNCIO.map((state) => ({
                value: state,
                label: countLabel(texts.states[state], counts.get(state) ?? 0, locale),
              })),
            ]}
            onChange={choose}
          />
          {create}
        </div>
        {actionError === null ? null : (
          <Notice closeLabel={ui.dismiss} open onClose={() => setActionError(null)}>
            {mapSupabaseError(actionError, locale)}
          </Notice>
        )}
        {shown.length === 0 ? (
          <EmptyState>{texts.noneInState}</EmptyState>
        ) : (
          TIPOS_ACTIVO.map((tipo) => {
            const group = shown.filter((listing) => listing.card.type === tipo);
            if (group.length === 0) return null;
            const layout = listingLayout(group.map((listing) => listing.card));
            const span = trackCount('listing', layout) + 1;
            return (
              <CardGroup
                key={tipo}
                label={texts.types[tipo]}
                count={group.length}
                sprite={data.typeSprites[tipo]}
                level={3}
                locale={locale}
              >
                <CardGrid family="listing">
                  {group.map((listing, index) => (
                    <div
                      key={listing.anuncio.id}
                      className="ac-account-listing"
                      style={{ gridRow: `span ${span}` }}
                    >
                      <ListingCard
                        listing={listing.card}
                        layout={layout}
                        labels={data.card}
                        locale={locale}
                        hint={texts.pinHint}
                        orLabel={texts.or}
                        diamonds={{ tip: data.diamonds.tip }}
                        loading={index < EAGER_CARDS ? 'eager' : 'lazy'}
                      />
                      <div className="ac-account-listing__actions">
                        {/* The card itself says «Reservado»; the other states only here. */}
                        {listing.state === 'publicado' || listing.state === 'reservado' ? null : (
                          <Chip>{texts.state[listing.state]}</Chip>
                        )}
                        {listing.state === 'publicado' || listing.state === 'reservado' ? (
                          <Button
                            href={`/${locale}/comercio/publicar/?editar=${encodeURIComponent(listing.anuncio.id)}`}
                          >
                            {texts.edit}
                          </Button>
                        ) : null}
                        {ACTIONS[listing.state].map(([key, status]) => (
                          <Button
                            key={key}
                            disabled={pending !== null}
                            onClick={() => ask(listing, key, status)}
                          >
                            {texts.actions[key]}
                          </Button>
                        ))}
                      </div>
                    </div>
                  ))}
                </CardGrid>
              </CardGroup>
            );
          })
        )}
      </>
    );
  }

  const confirm = texts.confirm;
  return (
    <div className="ac-account-page">
      <Section id="cuenta-anuncios" title={heading}>
        {body}
      </Section>
      {asking !== null ? (
        <Dialog
          open={askingOpen}
          onClose={() => {
            setAskingOpen(false);
            setAsking(null);
          }}
          title={asking.key === 'withdraw' ? confirm.withdrawTitle : confirm.completeTitle}
          closeLabel={ui.close}
          alert
          actions={
            <>
              <Button {...initialFocus} onClick={() => setAskingOpen(false)}>
                {confirm.back}
              </Button>
              <Button
                variant="solid"
                disabled={pending !== null}
                onClick={() => {
                  setAskingOpen(false);
                  void act(asking.listing, asking.status);
                }}
              >
                {texts.actions[asking.key]}
              </Button>
            </>
          }
        >
          <p>{asking.key === 'withdraw' ? confirm.withdrawText : confirm.completeText}</p>
        </Dialog>
      ) : null}
    </div>
  );
}
