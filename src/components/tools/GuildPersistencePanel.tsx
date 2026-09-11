import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Session, SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import {
  createUserGuild,
  listGuildDailySnapshots,
  listUserGuilds,
  replaceUserGuildDailyExport,
  sha256Hex,
  type SupabaseGuild,
} from '@/lib/supabase/guilds';
import type { GuildExportPayload } from '@/lib/tools/guild-ranking';
import type { GuildDailySnapshot } from '@/lib/tools/guild-daily-history';

type Locale = 'es' | 'en';

type Props = {
  locale: Locale;
  payload?: GuildExportPayload;
  serializedPayload: string;
  sourceLocator: string;
  sourceTimeZone: string;
  onRemoteHistoryLoaded?: (snapshots: GuildDailySnapshot[]) => void;
};

const copy = {
  es: {
    eyebrow: 'Cuenta y archivo',
    title: 'Guardar historial de la guild',
    description:
      'Inicia sesión para guardar este export en tu guild. El servidor conserva un export por fecha de Server Save y reemplaza el anterior si vuelves a cargarlo.',
    unavailable: 'La conexión con Supabase todavía no está configurada en este entorno.',
    email: 'Correo',
    password: 'Contraseña',
    signIn: 'Iniciar sesión',
    signUp: 'Crear cuenta',
    switchToSignUp: '¿Aún no tienes cuenta? Crear una',
    switchToSignIn: 'Ya tengo una cuenta',
    signedAs: 'Sesión activa',
    signOut: 'Cerrar sesión',
    guild: 'Guild',
    chooseGuild: 'Selecciona una guild',
    createGuild: 'Crear guild',
    guildName: 'Nombre de la guild',
    create: 'Crear y seleccionar',
    save: 'Guardar este export',
    noExport: 'Carga un JSON válido para habilitar el guardado.',
    noGuild: 'Crea o selecciona una guild para guardar el export.',
    saved: 'Export guardado',
    replaced: 'El export de ese día fue reemplazado y quedó registrado en el historial.',
    firstSave: 'El export quedó registrado como el primer snapshot de ese día.',
    signUpNotice:
      'La cuenta fue creada. Si Supabase solicita confirmación, revisa tu correo antes de iniciar sesión.',
    errors: {
      missingFields: 'Escribe tu correo y contraseña.',
      missingGuildName: 'Escribe un nombre para la guild.',
      authRequired: 'Inicia sesión para continuar.',
      generic: 'No se pudo completar la operación.',
    },
  },
  en: {
    eyebrow: 'Account and archive',
    title: 'Save guild history',
    description:
      'Sign in to save this export to your guild. The server keeps one export per Server Save date and replaces it if you load that date again.',
    unavailable: 'Supabase is not configured in this environment yet.',
    email: 'Email',
    password: 'Password',
    signIn: 'Sign in',
    signUp: 'Create account',
    switchToSignUp: 'Need an account? Create one',
    switchToSignIn: 'I already have an account',
    signedAs: 'Active session',
    signOut: 'Sign out',
    guild: 'Guild',
    chooseGuild: 'Select a guild',
    createGuild: 'Create guild',
    guildName: 'Guild name',
    create: 'Create and select',
    save: 'Save this export',
    noExport: 'Load a valid JSON export to enable saving.',
    noGuild: 'Create or select a guild to save the export.',
    saved: 'Export saved',
    replaced: "That day's export was replaced and recorded in the history.",
    firstSave: 'The export was recorded as the first snapshot for that day.',
    signUpNotice:
      'The account was created. If Supabase requests confirmation, check your email before signing in.',
    errors: {
      missingFields: 'Enter your email and password.',
      missingGuildName: 'Enter a guild name.',
      authRequired: 'Sign in to continue.',
      generic: 'The operation could not be completed.',
    },
  },
} as const;

function guildKeyFromName(value: string): string {
  return (
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'guild'
  );
}

function resultError(error: string | null, fallback: string): string {
  return error?.trim() || fallback;
}

export function GuildPersistencePanel({
  locale,
  payload,
  serializedPayload,
  sourceLocator,
  sourceTimeZone,
  onRemoteHistoryLoaded,
}: Props) {
  const strings = copy[locale];
  const client = useMemo(() => getSupabaseBrowserClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [guilds, setGuilds] = useState<SupabaseGuild[]>([]);
  const [selectedGuildId, setSelectedGuildId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [guildName, setGuildName] = useState(payload?.guild ?? '');
  const [busy, setBusy] = useState<'auth' | 'guild' | 'save' | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadGuildList = useCallback(async (supabase: SupabaseClient) => {
    const result = await listUserGuilds(supabase);
    if (result.error) {
      setError(result.error);
      return;
    }

    const nextGuilds = result.data ?? [];
    setGuilds(nextGuilds);
    setSelectedGuildId((current) =>
      nextGuilds.some((guild) => guild.guild_id === current)
        ? current
        : (nextGuilds[0]?.guild_id ?? ''),
    );
  }, []);

  const loadRemoteHistory = useCallback(async () => {
    if (!client || !session || !selectedGuildId) return;
    const selectedGuild = guilds.find((guild) => guild.guild_id === selectedGuildId);
    if (!selectedGuild) return;

    const result = await listGuildDailySnapshots(client, selectedGuild);
    if (result.error) {
      setError(result.error);
      return;
    }
    onRemoteHistoryLoaded?.(result.data ?? []);
  }, [client, guilds, onRemoteHistoryLoaded, selectedGuildId, session]);

  useEffect(() => {
    if (!client) return;

    let active = true;
    void client.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError) {
        setError(sessionError.message);
        return;
      }
      setSession(data.session);
      if (data.session) void loadGuildList(client);
    });

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setMessage('');
      setError('');
      if (nextSession) {
        window.setTimeout(() => void loadGuildList(client), 0);
      } else {
        setGuilds([]);
        setSelectedGuildId('');
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [client, loadGuildList]);

  useEffect(() => {
    void loadRemoteHistory();
  }, [loadRemoteHistory]);

  useEffect(() => {
    if (!guildName.trim() && payload?.guild) setGuildName(payload.guild);
  }, [guildName, payload?.guild]);

  async function handleAuth(event: { preventDefault: () => void }) {
    event.preventDefault();
    if (!client) return;
    if (!email.trim() || !password) {
      setError(strings.errors.missingFields);
      setMessage('');
      return;
    }

    setBusy('auth');
    setError('');
    setMessage('');
    const result =
      authMode === 'sign-in'
        ? await client.auth.signInWithPassword({ email: email.trim(), password })
        : await client.auth.signUp({ email: email.trim(), password });
    setBusy(null);

    if (result.error) {
      setError(result.error.message);
      return;
    }
    if (authMode === 'sign-up' && !result.data.session) {
      setMessage(strings.signUpNotice);
    }
  }

  async function handleSignOut() {
    if (!client) return;
    setBusy('auth');
    const result = await client.auth.signOut();
    setBusy(null);
    if (result.error) setError(result.error.message);
  }

  async function handleCreateGuild(event: { preventDefault: () => void }) {
    event.preventDefault();
    if (!client || !session) {
      setError(strings.errors.authRequired);
      return;
    }
    if (!guildName.trim()) {
      setError(strings.errors.missingGuildName);
      return;
    }

    setBusy('guild');
    setError('');
    setMessage('');
    const result = await createUserGuild(client, {
      guildKey: guildKeyFromName(guildName),
      worldKey: 'pokealliance',
      displayName: guildName.trim(),
    });
    setBusy(null);

    if (result.error || !result.data) {
      setError(resultError(result.error, strings.errors.generic));
      return;
    }

    await loadGuildList(client);
    setSelectedGuildId(result.data.guild_id);
    setMessage(`${strings.createGuild}: ${result.data.display_name || result.data.guild_key}`);
  }

  async function handleSave() {
    if (!client || !session) {
      setError(strings.errors.authRequired);
      return;
    }
    if (!payload || !selectedGuildId) {
      setError(payload ? strings.noGuild : strings.noExport);
      return;
    }

    setBusy('save');
    setError('');
    setMessage('');
    const digest = await sha256Hex(serializedPayload.trim() || JSON.stringify(payload));
    const result = await replaceUserGuildDailyExport(client, {
      guildId: selectedGuildId,
      payload,
      sourceLocator: sourceLocator.trim() || 'manual-paste',
      payloadDigest: digest,
      sourceTimeZone,
    });
    setBusy(null);

    if (result.error || !result.data) {
      setError(resultError(result.error, strings.errors.generic));
      return;
    }

    setMessage(
      `${strings.saved}: ${result.data.observation_date}. ${
        result.data.replaced_count > 0 ? strings.replaced : strings.firstSave
      }`,
    );
  }

  return (
    <section className="guild-account-panel wiki-panel" aria-labelledby="guild-account-heading">
      <div className="guild-tool-heading">
        <div>
          <p className="eyebrow">{strings.eyebrow}</p>
          <h2 id="guild-account-heading">{strings.title}</h2>
        </div>
        <span className="status-label" data-status={client ? 'supported' : 'pending'}>
          {client ? (session ? strings.signedAs : 'Supabase') : 'Local'}
        </span>
      </div>
      <p className="guild-tool-description">{strings.description}</p>

      {!client ? (
        <p className="guild-message">{strings.unavailable}</p>
      ) : session ? (
        <div className="guild-account-content">
          <div className="guild-account-toolbar">
            <span className="guild-account-email">{session.user.email || strings.signedAs}</span>
            <button
              className="guild-secondary-button"
              type="button"
              onClick={() => void handleSignOut()}
              disabled={busy === 'auth'}
            >
              {strings.signOut}
            </button>
          </div>

          <div className="guild-account-grid">
            <label className="guild-field">
              <span>{strings.guild}</span>
              <select
                value={selectedGuildId}
                onChange={(event) => setSelectedGuildId(event.target.value)}
              >
                <option value="">{strings.chooseGuild}</option>
                {guilds.map((guild) => (
                  <option key={guild.guild_id} value={guild.guild_id}>
                    {guild.display_name || guild.guild_key}
                  </option>
                ))}
              </select>
            </label>
            <form className="guild-create-form" onSubmit={(event) => void handleCreateGuild(event)}>
              <label className="guild-field">
                <span>{strings.guildName}</span>
                <input
                  value={guildName}
                  onChange={(event) => setGuildName(event.target.value)}
                  placeholder={payload?.guild || 'Family One'}
                />
              </label>
              <button className="guild-secondary-button" type="submit" disabled={busy === 'guild'}>
                {busy === 'guild' ? '…' : strings.create}
              </button>
            </form>
          </div>

          <div className="guild-account-actions">
            <button
              className="guild-primary-button"
              type="button"
              onClick={() => void handleSave()}
              disabled={busy === 'save' || !payload || !selectedGuildId}
            >
              {busy === 'save' ? '…' : strings.save}
            </button>
            <span className="guild-account-hint">
              {!payload ? strings.noExport : !selectedGuildId ? strings.noGuild : sourceLocator}
            </span>
          </div>
        </div>
      ) : (
        <div className="guild-auth-layout">
          <form className="guild-auth-form" onSubmit={(event) => void handleAuth(event)}>
            <label className="guild-field">
              <span>{strings.email}</span>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <label className="guild-field">
              <span>{strings.password}</span>
              <input
                type="password"
                autoComplete={authMode === 'sign-in' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <button className="guild-primary-button" type="submit" disabled={busy === 'auth'}>
              {busy === 'auth' ? '…' : authMode === 'sign-in' ? strings.signIn : strings.signUp}
            </button>
          </form>
          <button
            className="guild-text-button"
            type="button"
            onClick={() => {
              setAuthMode((current) => (current === 'sign-in' ? 'sign-up' : 'sign-in'));
              setError('');
              setMessage('');
            }}
          >
            {authMode === 'sign-in' ? strings.switchToSignUp : strings.switchToSignIn}
          </button>
        </div>
      )}

      {error ? <p className="guild-message guild-message-error">{error}</p> : null}
      {message ? <p className="guild-message">{message}</p> : null}
    </section>
  );
}
