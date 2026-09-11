# Temporal and Time-Zone Architecture

## Domain rule

The currently reported PokeAlliance Server Save occurs at local midnight in Brazil. Until directly verified from an official channel, represent it as:

```text
localTime: 00:00:00
timeZone: America/Sao_Paulo
calendar: iso8601
evidenceStatus: supported_user_provided
```

Do not store `21:00` as the Server Save time. That is the current conversion for a visitor in `America/Monterrey` and occurs on the previous local calendar date. Offsets can change independently; named IANA zones preserve the rule.

## Temporal model

- Persist exact events as `Temporal.Instant`-compatible ISO strings.
- Persist recurring civil-time rules as local time + named IANA time zone + recurrence semantics.
- Materialize the next Server Save by creating the next `00:00[America/Sao_Paulo]` zoned date-time, then convert it to an instant.
- Convert that instant to the visitor's IANA zone for display.
- Use the selected content locale for formatting, independently from time zone.
- Allow a manual user time-zone preference; browser time zone is only the default suggestion.

Conceptual flow:

```text
00:00 America/Sao_Paulo
  → Temporal.ZonedDateTime
  → Temporal.Instant
  → visitorZone (for example America/Monterrey)
  → localized display in es/en
```

## Storage

Store:

- canonical time-zone identifier (`America/Sao_Paulo`);
- civil time and recurrence rule;
- evidence/source and effective dates;
- calculated occurrence instants when events are materialized;
- user-preferred IANA time zone when explicitly chosen.

Never persist only a UTC offset such as `-03:00`, and never infer a time zone from content language or country alone.

## Browser/runtime support

Temporal is Stage 4 and has shipped in current Firefox, Chromium and Node releases, but compatibility must still be tested against the project's eventual browser/runtime matrix, especially Safari. During Phase 3:

1. feature-detect native `Temporal`;
2. use a maintained production polyfill only where required;
3. centralize date/time operations in one adapter;
4. test zone conversion, previous-day display, DST/historical changes and locale formatting;
5. avoid loading a polyfill on clients that do not need it.

The TC39 proposal repository's documentation/playground polyfill is explicitly not for production. Select the production dependency only after checking current compatibility and package status during implementation.

## UI rules

- Label the canonical game time and the viewer-local conversion when ambiguity matters.
- Example: `Server Save: 00:00 BRT · 21:00 en tu zona (día anterior)`.
- Show the IANA-zone-derived abbreviation only as presentation, never as stored identity.
- Dates in changelogs store the source instant and render in the viewer's zone; preserve the original source timestamp in metadata/tooltips where useful.
- Relative time must not replace an exact timestamp for rules or changelog evidence.
