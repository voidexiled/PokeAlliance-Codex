# Phase 5 — Pokémon Explorer report

## Delivered

The wiki now includes a localized Compare Pokémon and Tier Explorer surface:

- Spanish: `/es/herramientas/pokemon/`
- English: `/en/herramientas/pokemon/`
- Tools index: `/es/herramientas/` and `/en/herramientas/`

The first view compares two public roster variants in a semantic table. The second filters the same roster by text, tier, role and variant. A row can be sent back to the comparison view without leaving the wiki shell.

The interface intentionally stays inside the approved modern-wiki direction: breadcrumb context, quiet editorial copy, a compact tool panel, a readable table and a dense result list. It does not present a landing-page hero, fabricated score, generic recommendation or decorative data visualization.

## Snapshot provenance

The importer is `scripts/research/import-public-pokemon-roster.ps1`. It reads the public API and writes a reviewable staging artifact; it does not promote the response into canonical normalized content.

- Source: [official-candidate public roster API](https://wiki.pokealliance.com/api/pokemon)
- Staging file: `data/staging/pka-admin-wiki.pokemon-roster.json`
- Retrieved: `2026-09-09T22:30:49-06:00`
- Records: `910`
- Response bytes: `312033`
- Response SHA-256: `69EDE079ED185E3EB1E7C8679DDC1C6D75AABC61CC811D26830F261F716DD8CD`
- Status: `public_staging_snapshot`

The snapshot currently contains public identity, route, image, generation, displayed level, tier, role, elements, variant and detail-availability fields. Ninety-two rows do not publish a role; the UI renders those as `—` instead of treating absence as a classification.

## Explicit limits

This tool does not claim to provide:

- damage calculations, competitive recommendations or a “best Pokémon” ranking;
- complete movesets, loot, mechanics or spawn coordinates;
- a canonical Pokémon count independent of the source’s variant rows;
- proof that a public tier label is a complete game rule;
- Pokémon location data from the in-game “Buscar Ubicación” action.

The client-visible location payload remains an open, separately documented research task in [POKEDEX_LOCATION_CAPTURE_PROTOCOL.md](POKEDEX_LOCATION_CAPTURE_PROTOCOL.md). Community map images remain visual leads and require manual alignment and review before they can become coordinate records.

## Verification

The delivered slice passed:

- `pnpm format:check`
- `pnpm lint`
- `pnpm check`
- `pnpm test` — 5 files, 12 tests
- `pnpm build`
- `pnpm test:e2e` — 3/3, including tab switching and the 910-result tier view

The tool is a functioning public-snapshot explorer, not a production claim that the source data is complete or immutable. Refreshes should be rerun through the importer and reviewed by hash before changing the published boundary.
