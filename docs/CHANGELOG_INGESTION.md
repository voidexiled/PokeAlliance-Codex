# Discord Changelog Ingestion

Status: **local launcher-feed ingestion available; Discord remains manual-only**. Bot access to the official Discord is not currently available.

## Decision

Support three ingestion paths with one review/publishing pipeline:

1. **Local launcher feed (current):** ingest the owner-supplied `PokeAlliance/cache/feed.json`, which currently exposes structured news IDs, categories, titles, HTML bodies and timestamps.
2. **Manual moderated Discord import (current):** the project owner or an administrator pastes a message or supplies its Discord message link/export.
3. **Authorized Discord ingestion (future optional path):** a dedicated Alliance Codex Discord app/bot reads only the approved changelog/announcement channel if access becomes available.

No path publishes game facts directly. Each creates immutable raw source records and candidate changes that require validation/review. No work should be blocked waiting for bot access.

## Local launcher feed contract

Record the source file hash, feed `updated_at`, news `id`, `cat`, `title`, `created_at` and sanitized body. The HTML body is untrusted input: parse with an allowlist and never render it directly. A changed source hash produces a diff against stable news IDs. Missing news in a later cache does not automatically delete prior evidence.

The current structural extraction is reproducible with `scripts/research/profile-launcher-feed.ps1` and is summarized in `data/research/launcher-feed-profile.json`. It stores headings and content hashes while keeping raw HTML in the Git-ignored inbox.

## Authorization required for future automation

An administrator of the PokeAlliance Discord must:

- add the Alliance Codex app/bot;
- limit it to the relevant announcement/changelog channel;
- grant `VIEW_CHANNEL` and `READ_MESSAGE_HISTORY`;
- enable the minimum message-content access required by the selected API flow;
- approve retention and public reuse expectations for changelog content.

Discord's current API can retrieve channel messages using `before`/`after` pagination. Message content fields require appropriate message-content access. Incoming webhooks only send content *into* Discord; they do not provide historical channel ingestion. A bot/Gateway or authenticated REST reader is the relevant mechanism.

## Raw record contract

Store at least:

```text
discordGuildId
discordChannelId
discordMessageId
authorId / authorRoleSnapshot
publishedAt (instant)
editedAt (instant or null)
retrievedAt (instant)
contentOriginal
attachments metadata
messageUrl
contentHash
ingestionMethod
```

Discord IDs and tokens are never exposed in a client bundle. Bot tokens remain server-only secrets. Store only data approved for this product; do not mirror unrelated Discord conversation.

## Processing

```text
Discord/manual raw message
  → immutable source snapshot
  → parsed change candidates
  → reviewer confirms affected entities/facts
  → normalized effective-dated changes
  → stale dependent translations/guides flagged
  → rebuild/revalidation
```

Edits and deletions create new audit events; they do not silently erase the prior snapshot. The source text remains Portuguese unless an authored translation is added. Canonical game terms are protected before translation.

## Freshness

For automated ingestion, persist a cursor based on Discord snowflake/message ID and poll conservatively or receive Gateway events. A scheduled reconciliation fetch catches missed edits/events. Rate limits, backoff and idempotency are mandatory.

## Manual operation — active policy

Manual updates remain fully supported and use the same schema. The reviewer must provide the message link/ID when available, publication date, original content and any attachments. Manual ingestion is preferable to unauthorized automation.

## Open decisions

- Guild/channel IDs and whether the channel is an Announcement channel, only if automation is revisited.
- Whether PokeAlliance administrators authorize the app, only if automation is revisited.
- Polling versus Gateway event flow.
- Review roles and publication SLA.
