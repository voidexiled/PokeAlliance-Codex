import type { SupabaseClient } from '@supabase/supabase-js';

import type { ListingCardLabels } from '@/components/cards/ListingCard';
import type { PaginationLabels } from '@/components/controls/Pagination';
import type { SpriteProps } from '@/components/game/Sprite';
import type {
  ListingPreviewDiamonds,
  ListingPreviewEntity,
  ListingPreviewSprites,
} from '@/components/trade/ListingPreview';
import type {
  ContactLabels,
  OperationReviewMessages,
  OperationsMessages,
} from '@/components/trade/OperationsPanel';
import type { Locale } from '@/i18n/config';
import type { MessageLeaf } from '@/i18n/messages/types';
import type { TipLabels } from '@/lib/game/tips';
import type { AccountSummary } from '@/lib/supabase/trade';
import type { EstadoAnuncio, TipoActivo } from '@/lib/trade/types';
import type { UnitPriceLabels } from '@/lib/trade/unit-price';

import type { UiLabels } from '../AccountPanel';

// The shapes of the three Comercio pages of the account (AccountPage.tsx): what the page gathers
// from the dictionary and the registries (the one place that knows their paths, 13.2) and what
// each body, a chunk of its own, receives. Types only: no module here ships any code.

/** What every page body gets from AccountPage once the account is known. */
export interface PageContext {
  client: SupabaseClient;
  userId: string;
  locale: Locale;
  account: AccountSummary;
  ui: UiLabels;
  /** «Reintentar». */
  retry: string;
  /** The heading of the page's first section: its entry of the nav («Reputación»…). */
  heading: string;
}

/** «Mi perfil» (`/{l}/cuenta/perfil/`): the reputation and the reviews. */
export interface ProfilePageTexts {
  reputation: {
    /** «Como vendedor», «Como comprador». */
    asSeller: string;
    asBuyer: string;
    /** `ui.money.outOf`: «de 5», after the score. */
    outOf: string;
    /** «{n} operación» / «{n} operaciones». */
    deals: MessageLeaf;
    /** «{n} comprador distinto» / «{n} compradores distintos». */
    buyers: MessageLeaf;
    /** «{n} vendedor distinto» / «{n} vendedores distintos». */
    sellers: MessageLeaf;
    /** «Sin reseñas todavía.» */
    none: string;
    /** Name of the distribution: «Reseñas por estrellas». */
    distribution: string;
    /** «{n} estrella» / «{n} estrellas». */
    stars: MessageLeaf;
  };
  reviews: {
    /** «Reseñas», the heading of the second section. */
    title: string;
    /** Name of «Recibidas» / «Hechas». */
    filterLabel: string;
    received: string;
    given: string;
    /** «{n} de 5». */
    score: string;
    /** «como vendedor» / «como comprador»: the account's role in the deal. */
    role: { seller: string; buyer: string };
    /** «Operación {number}». */
    deal: string;
    /** «Editar»: to «Mis operaciones», where the deal's review is edited. */
    edit: string;
    /** «Oculta por moderación». */
    hidden: string;
    /** «Cuenta eliminada». */
    deletedAccount: string;
    noneReceived: string;
    noneGiven: string;
  };
  pages: PaginationLabels;
  /** `ui.pagination`: the name of the pages nav. */
  pagination: string;
}

/** The actions of 9.7.8 by their key. */
export type ListingActionKey = 'reserve' | 'release' | 'complete' | 'withdraw' | 'renew';

/** «Mis anuncios» (`/{l}/cuenta/anuncios/`). */
export interface ListingsPageTexts {
  /** Name of the state filter: «Estado del anuncio». */
  filter: string;
  /** «Todos». */
  all: string;
  /** The filter options: «Publicados», «Reservados»… */
  states: Record<EstadoAnuncio, string>;
  /** The state under a card that is not published: «Reservado», «Expirado»… */
  state: Record<Exclude<EstadoAnuncio, 'publicado'>, string>;
  /** «Aún no publicaste anuncios.» */
  none: string;
  /** «Ningún anuncio en este estado.» */
  noneInState: string;
  /** «Crear anuncio». */
  create: string;
  /** «Editar»: opens the composer on the listing. */
  edit: string;
  actions: Record<ListingActionKey, string>;
  /** The name of each asset type, the title of its group. */
  types: Record<TipoActivo, string>;
  /** The two actions that cannot be undone ask first; «Volver» is the safe button. */
  confirm: {
    withdrawTitle: string;
    withdrawText: string;
    completeTitle: string;
    completeText: string;
    back: string;
  };
  /** `ui.dataError`: the two data files did not arrive. */
  dataError: string;
  pinHint: string;
  or: string;
  tooltip: TipLabels;
}

/** What the cards of the own listings are built from (9.7.6), as on the publish page. */
export interface ListingsPageData {
  /** `/{l}/pokedex/datos.json` (PR5). */
  pokedexUrl: string;
  /** `/{l}/items/datos.json` (PR5). */
  itemsUrl: string;
  /** `nombre` of each Market category, by id. */
  categories: Readonly<Record<string, string>>;
  /** Each aura by id: its name and its ball sprite. */
  auras: Readonly<Record<string, ListingPreviewEntity>>;
  /** Each addon by id: its name and its sprite. */
  addons: Readonly<Record<string, ListingPreviewEntity>>;
  /** `nombre` of each world of content/mundos.json, by id. */
  worlds: Readonly<Record<string, string>>;
  sprites: ListingPreviewSprites;
  diamonds: ListingPreviewDiamonds;
  /** The sprite of each asset type, beside the title of its group (DP2). */
  typeSprites: Readonly<Record<TipoActivo, SpriteProps | null>>;
  /** Every text of `ListingCard`. */
  card: ListingCardLabels;
  /** «Unsellable», a game term. */
  unsellable: string;
  /** The price per unit of a listing (owner rule 2026-09-24). */
  unitPrice: UnitPriceLabels;
  /** «Cualquier mundo»: the tag of a Pokédólares listing. */
  anyWorld: string;
}

/** «Mis operaciones» (`/{l}/cuenta/operaciones/`): the texts of `OperationsPanel`. */
export interface OperationsPageTexts {
  messages: OperationsMessages;
  review: OperationReviewMessages;
  channels: ContactLabels;
}

/** The body of a page: which page, and its texts and data. */
export type AccountPageBody =
  | { page: 'reputacion'; texts: ProfilePageTexts }
  | { page: 'anuncios'; texts: ListingsPageTexts; data: ListingsPageData }
  | { page: 'operaciones'; texts: OperationsPageTexts };
