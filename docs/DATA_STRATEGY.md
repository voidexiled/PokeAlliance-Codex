# Data Strategy

Status: Phase 2 foundation. For the definitive relational model, canonical record contract and migration mapping, see [DATA_MODEL.md](DATA_MODEL.md). This file remains the pipeline and provenance rationale behind that model.

## Pipeline

```text
Public evidence
  → raw research records
  → source-specific staging records
  → canonical normalized datasets
  → application database and static build inputs
```

Each boundary is explicit. Raw records preserve what a source said; staging reflects a parser; normalized records express Alliance Codex conclusions; the application database serves product access patterns. A correction in one layer must remain traceable backward.

## Identity

Domain entities use opaque or namespaced stable IDs plus stable canonical slugs. Names are attributes, never primary keys. Variants/forms are modeled explicitly after research determines their identity rules; they are not flattened into arbitrary display strings.

Conceptual entity name fields:

```ts
type EntityName = {
  canonicalName: string;
  aliases: string[];
  searchKeywords: Partial<Record<'es' | 'en', string[]>>;
  localizedNames?: Partial<Record<'es' | 'en', {
    value: string;
    sourceEvidenceId: string;
  }>>;
};
```

`localizedNames` is optional and evidence-backed. It is not a license to translate game terms automatically.

## Facts, provenance and uncertainty

A material normalized fact needs:

- subject/entity and field or relationship;
- normalized value;
- evidence references;
- verification status (`confirmed`, `supported`, `inferred`, `unknown`, `conflicted`, `deprecated`);
- confidence rationale, not only a number;
- observed/verified timestamps;
- optional effective version/range;
- normalizer version.

Missing values remain `null` with an associated unknown record where meaningful. `null`, absent and “not applicable” are distinct. Inference is permitted only when labeled, reasoned and never rendered as confirmed.

## Localization architecture

The system separates `contentLocale` from `gameTerminologyMode`. Initial locales are `es` and `en`; canonical terminology is the only initial terminology mode. Configuration owns `defaultLocale`, `supportedLocales` and `fallbackLocale`.

One entity is shared by all locales. Editorial resources use translations keyed by locale and can track `original`, `translated`, `reviewed`, `needs_review` or `outdated`. Fallback returns existing authored content and can disclose the mismatch; it never synthesizes a translation silently.

Entity slugs remain canonical across `/es/` and `/en/`. Editorial slugs may be localized if Phase 2 confirms a clean redirect/canonical strategy. HTML language, localized metadata, canonical links, hreflang, Open Graph and sitemap alternates are generated centrally.

## Structured editorial references

Editorial content should reference game entities by stable ID when it adds navigational or correctness value, for example `item:oran-berry` or an equivalent AST node. The authoring format is deferred until Phase 2; plain text remains acceptable where structure adds no value. Broken reference validation is mandatory once the format is selected.

## Proposed dataset envelopes

Every dataset includes schema version, generated timestamp, generator/importer version and source snapshot IDs. Records sort deterministically. JSON Schema (or a generated equivalent) validates interchange data; Zod will validate runtime boundaries once the application exists.

Candidate normalized families—not final database tables—are:

- entities: Pokémon, forms/variants, moves, items, held items, locations, NPCs, quests, hunts;
- mechanics: elements, effects, boosts, stars, utilities, acquisition/drop rules;
- analysis: tactical roles, rotation eligibility and tier assertions with methodology;
- editorial: guides and localized content units;
- governance: sources, evidence, claims, conflicts, unknowns and terminology.

## Database consolidation rules

PostgreSQL design waits for representative Phase 1 samples. Phase 2 will choose table boundaries from actual cardinality, query and correction patterns. JSONB is acceptable for source payloads and genuinely irregular evidence, not as a substitute for understood relational structure. No locale-specific duplicate entity tables are allowed.

## Imports and manual correction

Importers are idempotent and never write directly to curated normalized files or production tables. Manual curation uses explicit override records with author, reason, timestamp and superseded evidence. Import diffs must not erase curated decisions silently.

## Fixtures

Synthetic fixtures are stored outside research/normalized data, visibly marked `fixture`, and use invented neutral values that cannot be mistaken for PokeAlliance facts. UI builds never promote them into source-backed content.

## Validation and release controls

- Syntax/schema validation.
- Stable ID and unique slug checks.
- Referential integrity and allowed enum checks.
- Every publishable material claim has provenance.
- Locale and canonical-name policy checks.
- Conflict/unknown counts and coverage deltas.
- Large-change thresholds requiring review.
- Deterministic regeneration check.

No dataset becomes application-ready merely because it parses.
