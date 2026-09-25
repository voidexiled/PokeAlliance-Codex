import '@/styles/components/account-characters.css';

import { useCallback, useEffect, useId, useState } from 'react';
import type { SubmitEvent } from 'react';

import { fill, plural } from '@/i18n/messages/types';
import { playerNameProblem } from '@/lib/account/registration';
import { readCachedAccount, writeCachedAccount } from '@/lib/account/session-cache';
import { mapSupabaseError } from '@/lib/supabase/errors';
import {
  addCharacter,
  canAddCharacter,
  listMyCharacters,
  refreshCachedAccount,
  removeCharacter,
  setMainCharacter,
  type AccountCharacter,
  type TradeOperation,
} from '@/lib/supabase/trade';
import { NOMBRE_JUGADOR_MAX, PERSONAJES_MAX } from '@/lib/trade/limits';

import { Button } from '@/components/controls/Button';
import { fieldId } from '@/components/controls/TextField';
import { Section } from '@/components/layout/Section';

import { AuthInput, AuthNotice, ErrorLine } from '../auth/ui';
import { characterRefusal, isCharacterReason, mainFirst, removeBlock } from './characters';
import { updateAccountProfile } from './profile-save';
import { readCharacterTexts, type CharacterTexts } from './texts';
import type { PanelContext } from './types';

// «Personajes» (owner rule of 2026-09-24; Personajes.dc.html and its phone board): the account's
// game characters, up to PERSONAJES_MAX, each a player name and a world of content/mundos.json.
//
// - A row: the name, the world as a chip, «Principal» on the main one and how many listings were
//   published as it, as a link to «Mis anuncios». «Hacer principal» on the others; «Editar» only
//   without listings; «Quitar» is offered without listings on a character that is not the main
//   one, and otherwise drawn unavailable with the reason in its tooltip (a line on a phone).
// - «Añadir personaje» opens the form inline: the player name and the world slots. A name another
//   account holds is refused by the database (`player_name_taken`) and said under the name.
// - The database has no rename: «Editar» of the main character saves the profile (the database
//   renames a main character without listings in place); of another one it adds the new
//   character and removes the old one, so a failure leaves the old one where it was.
// - After «Hacer principal» the header cache is read again (`refreshCachedAccount`) so the chip
//   and its menu show the new main character; the other changes only update the count the menu
//   shows as «+N personajes».

type Draft = { player: string; world: string };
type Refusal = { lead: string; text: string | null };

const EMPTY: Draft = { player: '', world: '' };

/** The section, once the page's «Personajes» texts are known (panel/texts.ts). */
export default function CharactersSection(props: PanelContext) {
  const text = readCharacterTexts();
  return text === null ? null : <Characters {...props} text={text} />;
}

function Characters({
  client,
  locale,
  messages,
  panel,
  ui,
  worlds,
  account,
  reload,
  text,
}: PanelContext & { text: CharacterTexts }) {
  const uid = fieldId(useId());
  const [list, setList] = useState<AccountCharacter[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  // The inline form: `new` adds a character, an id edits that one.
  const [form, setForm] = useState<'new' | string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [shown, setShown] = useState(false);
  const [refused, setRefused] = useState<Refusal | null>(null);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<{ lead: string; text?: string; ok: boolean } | null>(null);

  useEffect(() => {
    let active = true;
    setLoadError(null);
    listMyCharacters(client).then(
      (result) => {
        if (!active) return;
        if (result.error || result.data === null)
          setLoadError(mapSupabaseError(result.error, locale));
        else setList(result.data);
      },
      (caught: unknown) => {
        if (active) setLoadError(mapSupabaseError(caught, locale));
      },
    );
    return () => {
      active = false;
    };
  }, [client, locale, version]);

  /** The new list, and the count the header menu shows. */
  const apply = useCallback((next: AccountCharacter[]) => {
    setList(next);
    const cached = readCachedAccount();
    if (cached !== null && cached.characters !== next.length) {
      writeCachedAccount({ ...cached, characters: next.length });
    }
  }, []);

  function worldName(key: string): string {
    return worlds.find((world) => world.id === key)?.nombre ?? key;
  }

  /** A refusal in the section's words, or the shared failure text. */
  function refusalOf(result: TradeOperation<unknown>): Refusal {
    if (isCharacterReason(result.reason)) return characterRefusal(result.reason, text);
    return { lead: mapSupabaseError(result.error, locale), text: null };
  }

  function openForm(which: 'new' | AccountCharacter) {
    setForm(which === 'new' ? 'new' : which.id);
    setDraft(which === 'new' ? EMPTY : { player: which.playerName, world: which.worldKey });
    setShown(false);
    setRefused(null);
    setNotice(null);
  }

  function closeForm() {
    setForm(null);
    setDraft(EMPTY);
    setShown(false);
    setRefused(null);
  }

  const errors: { player?: string; world?: string } = {};
  if (shown) {
    if (playerNameProblem(draft.player) !== null) errors.player = text.errors.player_name_invalid;
    if (!worlds.some((world) => world.id === draft.world)) errors.world = text.errors.world_invalid;
  }

  /** One character call: the new list on success, else the refusal (null when it worked). */
  async function run(
    action: () => Promise<TradeOperation<AccountCharacter[]>>,
  ): Promise<Refusal | null> {
    setPending(true);
    try {
      const result = await action();
      if (result.error || result.data === null) return refusalOf(result);
      apply(result.data);
      return null;
    } catch (caught) {
      return { lead: mapSupabaseError(caught, locale), text: null };
    } finally {
      setPending(false);
    }
  }

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || list === null) return;
    setShown(true);
    setRefused(null);
    if (playerNameProblem(draft.player) !== null) {
      document.getElementById(`${uid}-player`)?.focus();
      return;
    }
    if (!worlds.some((world) => world.id === draft.world)) {
      document.getElementById(`${uid}-world-0`)?.focus();
      return;
    }
    const values = { playerName: draft.player.trim().replace(/\s+/g, ' '), worldKey: draft.world };
    const editing = form === 'new' ? null : (list.find((row) => row.id === form) ?? null);
    let refusal: Refusal | null;
    if (editing === null) refusal = await run(() => addCharacter(client, values));
    else if (editing.isMain) refusal = await saveMain(values);
    else refusal = await replace(editing, values);
    if (refusal === null) closeForm();
    else setRefused(refusal);
  }

  /** «Editar» of the main character: the profile save renames it in place. */
  async function saveMain(values: {
    playerName: string;
    worldKey: string;
  }): Promise<Refusal | null> {
    setPending(true);
    try {
      const outcome = await updateAccountProfile(client, {
        username: account.username ?? '',
        player: values.playerName,
        world: values.worldKey,
        country: account.country ?? '',
      });
      if (!outcome.ok) {
        return outcome.field === 'player' && outcome.reason === 'taken'
          ? characterRefusal('player_name_taken', text)
          : { lead: mapSupabaseError(outcome.failure, locale), text: null };
      }
      const next = await listMyCharacters(client);
      if (next.data !== null) apply(next.data);
      await refreshCachedAccount(client).catch(() => undefined);
      reload();
      return null;
    } catch (caught) {
      return { lead: mapSupabaseError(caught, locale), text: null };
    } finally {
      setPending(false);
    }
  }

  /**
   * «Editar» of another character: the new one first and then the old one goes, so a refused
   * name changes nothing. At the limit the old one goes first, and comes back if the new one is
   * refused.
   */
  async function replace(
    old: AccountCharacter,
    values: { playerName: string; worldKey: string },
  ): Promise<Refusal | null> {
    if (list !== null && canAddCharacter(list)) {
      return (
        (await run(() => addCharacter(client, values))) ??
        run(() => removeCharacter(client, old.id))
      );
    }
    const removed = await run(() => removeCharacter(client, old.id));
    if (removed !== null) return removed;
    const added = await run(() => addCharacter(client, values));
    if (added !== null) {
      const restored = await addCharacter(client, {
        playerName: old.playerName,
        worldKey: old.worldKey,
      }).catch(() => null);
      if (restored?.data) apply(restored.data);
    }
    return added;
  }

  async function makeMain(character: AccountCharacter) {
    if (pending) return;
    setNotice(null);
    setRefused(null);
    const refusal = await run(() => setMainCharacter(client, character.id));
    if (refusal !== null) {
      setNotice({ lead: refusal.lead, ok: false });
      return;
    }
    setNotice({
      lead: fill(text.mainChanged, { name: character.playerName }),
      text: text.mainChangedText,
      ok: true,
    });
    // The header chip and its menu show the new main character; the card above too.
    await refreshCachedAccount(client).catch(() => undefined);
    reload();
  }

  async function remove(character: AccountCharacter) {
    if (pending) return;
    setNotice(null);
    setRefused(null);
    const refusal = await run(() => removeCharacter(client, character.id));
    if (refusal !== null) setNotice({ lead: refusal.lead, ok: false });
  }

  const formId = `${uid}-form`;
  const count = list?.length ?? 0;
  const full = list !== null && !canAddCharacter(list);
  const nf = new Intl.NumberFormat(locale);
  const counter = fill(text.count, { n: nf.format(count), max: nf.format(PERSONAJES_MAX) });

  function characterForm(editing: AccountCharacter | null) {
    const describedPlayer = [
      errors.player !== undefined || refused !== null ? `${uid}-player-error` : '',
      `${uid}-help`,
    ]
      .filter(Boolean)
      .join(' ');
    return (
      <form
        id={formId}
        className="ac-chars-form"
        onSubmit={submit}
        noValidate
        aria-labelledby={`${uid}-form-title`}
      >
        <div className="ac-chars-form__head">
          <h3 className="ac-chars-form__title" id={`${uid}-form-title`}>
            {editing === null ? text.add : fill(text.editTitle, { name: editing.playerName })}
          </h3>
          {editing === null ? <span className="ac-chars-count">{counter}</span> : null}
        </div>
        <div className="ac-chars-form__fields">
          <div className="ac-chars-form__player">
            <label className="ac-chars-form__label" htmlFor={`${uid}-player`}>
              {messages.register.player}
            </label>
            <AuthInput
              id={`${uid}-player`}
              name="player"
              value={draft.player}
              onChange={(event) => {
                setDraft((current) => ({ ...current, player: event.target.value }));
                setRefused(null);
              }}
              autoComplete="off"
              spellCheck={false}
              maxLength={NOMBRE_JUGADOR_MAX}
              aria-invalid={errors.player !== undefined || refused !== null ? true : undefined}
              aria-describedby={describedPlayer}
            />
          </div>
          <fieldset
            className="ac-chars-form__world"
            aria-invalid={errors.world === undefined ? undefined : true}
            aria-describedby={errors.world === undefined ? undefined : `${uid}-world-error`}
          >
            <legend className="ac-chars-form__label">{messages.register.world}</legend>
            <div className="ac-auth-slots">
              {worlds.map((world, index) => (
                <label key={world.id} className="ac-auth-slot">
                  <input
                    id={`${uid}-world-${String(index)}`}
                    className="ac-auth-slot__input"
                    type="radio"
                    name={`${uid}-world`}
                    value={world.id}
                    checked={draft.world === world.id}
                    onChange={() => {
                      setDraft((current) => ({ ...current, world: world.id }));
                      setRefused(null);
                    }}
                  />
                  <span className="ac-auth-slot__name">{world.nombre}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="ac-chars-form__actions">
            <Button type="submit" variant="solid" disabled={pending}>
              {editing === null ? text.addSubmit : messages.save}
            </Button>
            <Button onClick={closeForm} disabled={pending}>
              {messages.cancel}
            </Button>
          </div>
        </div>
        {errors.player !== undefined || refused !== null ? (
          <ErrorLine
            id={`${uid}-player-error`}
            lead={errors.player ?? refused?.lead ?? ''}
            text={errors.player === undefined ? (refused?.text ?? undefined) : undefined}
          />
        ) : null}
        {errors.world !== undefined ? (
          <ErrorLine id={`${uid}-world-error`} lead={errors.world} />
        ) : null}
        <p className="ac-chars-form__help" id={`${uid}-help`}>
          {text.help}
        </p>
      </form>
    );
  }

  function row(character: AccountCharacter) {
    if (form === character.id) {
      return <li key={character.id}>{characterForm(character)}</li>;
    }
    const block = removeBlock(character);
    const whyId = `${uid}-why-${character.id}`;
    const listingsHref = `/${locale}/cuenta/perfil/?pestana=anuncios`;
    const listings =
      character.listings > 0 ? (
        <a className="ac-chars-row__listings" href={listingsHref}>
          {fill(plural(locale, character.listings, text.listings), {
            n: nf.format(character.listings),
          })}
        </a>
      ) : (
        <span className="ac-chars-row__none">{text.noListings}</span>
      );
    return (
      <li key={character.id} className="ac-chars-row">
        <p className="ac-chars-row__who">
          <span className="ac-chars-row__name">{character.playerName}</span>
          <span className="ac-chars-chip">{worldName(character.worldKey)}</span>
          {character.isMain ? (
            <span className="ac-chars-chip ac-chars-chip--main">{text.main}</span>
          ) : null}
        </p>
        <p className="ac-chars-row__count">{listings}</p>
        {block === 'listings' ? (
          <p className="ac-chars-row__why-line" aria-hidden="true">
            {text.hasListings}
          </p>
        ) : null}
        <div className="ac-chars-row__actions">
          {character.isMain ? null : (
            <button
              type="button"
              className="ac-chars-action"
              onClick={() => void makeMain(character)}
              disabled={pending}
            >
              {text.makeMain}
            </button>
          )}
          {character.listings === 0 ? (
            <button
              type="button"
              className="ac-chars-action"
              onClick={() => openForm(character)}
              disabled={pending}
            >
              {text.edit}
            </button>
          ) : null}
          {block === null ? (
            <button
              type="button"
              className="ac-chars-action"
              onClick={() => void remove(character)}
              disabled={pending}
            >
              {text.remove}
            </button>
          ) : (
            <span className="ac-chars-tip">
              <button
                type="button"
                className="ac-chars-action ac-chars-action--blocked"
                aria-disabled="true"
                aria-describedby={whyId}
              >
                {text.remove}
              </button>
              <span className="ac-chars-tip__panel" id={whyId} role="tooltip">
                {block === 'listings' ? text.hasListings : text.isMain}
              </span>
            </span>
          )}
        </div>
      </li>
    );
  }

  return (
    <Section id="cuenta-personajes" title={panel.sections.personajes}>
      <p className="ac-panel-intro">{text.intro}</p>
      {notice !== null ? (
        <AuthNotice
          lead={notice.lead}
          text={notice.text}
          ok={notice.ok}
          onClose={() => setNotice(null)}
          closeLabel={ui.dismiss}
        />
      ) : null}
      {loadError !== null ? (
        <AuthNotice
          lead={loadError}
          action={
            <Button onClick={() => setVersion((value) => value + 1)}>{messages.retry}</Button>
          }
        />
      ) : null}
      {list === null ? (
        loadError === null ? (
          <div className="ac-account-busy" aria-busy="true" />
        ) : null
      ) : (
        <ul className="ac-panel-list ac-chars">
          {mainFirst(list).map(row)}
          <li>
            {form === 'new' ? (
              characterForm(null)
            ) : full ? (
              <div className="ac-chars-add">
                <Button disabled>{text.add}</Button>
                <p className="ac-chars-add__limit">
                  <strong>{counter}.</strong> {text.limit}
                </p>
              </div>
            ) : (
              <div className="ac-chars-add">
                <Button onClick={() => openForm('new')} disabled={pending}>
                  {text.add}
                </Button>
                <span className="ac-chars-count">{counter}</span>
              </div>
            )}
          </li>
        </ul>
      )}
    </Section>
  );
}
