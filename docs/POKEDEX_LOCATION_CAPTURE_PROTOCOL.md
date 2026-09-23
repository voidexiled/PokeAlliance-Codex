# Pokédex location lookup — future capture protocol

Status: planned research path; not executed yet.

## Purpose

Determine whether the client's `Buscar Ubicación` action receives a structured relation between a Pokémon/variant and map coordinates. The objective is to understand the data shape, not to automate gameplay or reproduce private sessions.

This is an optional future acquisition path. The map preview, client markers and reviewed community contributions can continue without it.

## Narrow capture scope

The observation should begin with an ordinary client session and one known Pokémon. Capture only the traffic or client-visible data directly associated with this sequence:

```text
open Pokédex → select Pokémon → press Buscar Ubicación → map opens → markers appear
```

The useful fields, if present, are:

- Pokémon identity and variant;
- location or spawn identifier;
- `x`, `y`, `z` or floor/area values;
- conditions such as hunt, level, time, access or world;
- response version or timestamp when exposed.

## Explicit exclusions

Do not collect or store:

- account credentials, session cookies, authorization headers or tokens;
- unrelated chat, player, guild or personal data;
- all-client traffic outside the lookup action;
- modified client binaries, injected code, bypasses or anti-cheat-sensitive material;
- replayed, fuzzed or automated requests.

The capture must remain observational and read-only. The game's rules prohibit bots, macros and software that automates or interferes with the game; this protocol is not permission to build a gameplay automation tool.

## Resulting record

After reviewing the capture, only the game data goes into `content/` (no source, capture date or client version, D-012):

```json
{
  "pokemon": "charmander",
  "ubicaciones": [{ "x": null, "y": null, "z": null, "tipo": "spawn_area" }]
}
```

The `null` values above are placeholders for the example; unknown coordinates stay `null` and are never published as `0`. Raw captures remain outside the repository unless their privacy and redistribution scope are explicitly reviewed.

## Validation before map use

1. Confirm the selected Pokémon and variant match the visible client state.
2. Confirm that every returned coordinate includes its floor or coordinate-system context.
3. Compare the location against the OTMM-derived base and the client screenshot.
4. Keep multiple locations as separate records; do not overwrite one location with another.
5. Write the record to `content/` only after the owner confirms it.

If the action returns only an area name or image reference, keep it as an area. It is not an exact coordinate record.

## Expected result

The best outcome is a reusable, scrubbed response schema that lets the project collect Pokémon locations one at a time and later decide whether a safe, reviewed importer is worthwhile. If no readable response is exposed, the research should stop at the same boundary and use manual contributions instead.
