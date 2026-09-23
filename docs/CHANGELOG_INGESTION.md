# Changelog Ingestion

Status: **manual today**. The launcher feed importer is a future roadmap item; bot access to the official Discord is not available.

## Paths

1. **Launcher feed (future, see `ROADMAP.md`):** a daily GitHub Action reads `https://pokealliance.com/launcher/feed` (the same news the launcher caches in `PokeAlliance/cache/feed.json`: news `id`, `cat`, `title`, `created_at` and an HTML body) and adds new entries by `id`.
2. **Manual entry (current):** the owner or an administrator pastes a Discord announcement or a launcher news item.
3. **Authorized Discord reader (optional future path):** a dedicated Alliance Codex app reads only the approved announcement/changelog channel if PokeAlliance administrators grant access.

Every path produces change entries that go through the same review before they update game data. No work waits for bot access.

## Change entry

```text
id            stable key (feed id or Discord message id)
fecha         publication instant (UTC)
titulo        original title
resumen       own summary in es/en, never the copied body
entidades     ids of the affected content/ records
```

The HTML body is untrusted input: parse it with an allowlist and never render it directly. An entry missing from a later feed does not delete the stored entry. Canonical game terms are protected before translation; the original text stays Portuguese unless an authored translation is added.

## Processing

```text
feed entry or manual paste
  → change entry
  → owner confirms the affected content/ records
  → content/ values updated
  → translations and guides that depend on them flagged for review
  → rebuild
```

## Discord authorization (only if automation is revisited)

An administrator of the PokeAlliance Discord must add the Alliance Codex app, limit it to the announcement/changelog channel, grant `VIEW_CHANNEL` and `READ_MESSAGE_HISTORY` and the minimum message-content access, and approve public reuse of changelog content. Incoming webhooks only send content into Discord; historical reading needs a bot/Gateway or authenticated REST reader with a snowflake cursor, rate limits, backoff and idempotency. Bot tokens and Discord IDs stay server-only.

## Open decisions

- Whether PokeAlliance administrators authorize a Discord app.
- Review roles and publication timing for change entries.
