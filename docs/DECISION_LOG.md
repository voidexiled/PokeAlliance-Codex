# Decision Log

## D-001 — Later execution order controls initialization

- Date: 2026-09-09
- Status: accepted
- Context: the broad product brief asks for planning followed by immediate foundation work, while the dedicated execution-order brief explicitly forbids application initialization until planning, deep research and data-model consolidation finish.
- Decision: follow the dedicated execution order. It is more specific and explicitly describes itself as mandatory.
- Consequence: Phase 1 continues before Astro/Supabase/UI work.

## D-002 — Preserve original prompts verbatim

- Date: 2026-09-09
- Status: accepted
- Context: future chats must not depend on conversation context or attachment availability.
- Decision: store the three original prompts verbatim under `docs/requirements/`, with `docs/PROJECT_SPEC.md` as the stable index.
- Consequence: summaries may evolve, but original requirements remain auditable.

## D-003 — Repository files are the continuity source

- Date: 2026-09-09
- Status: accepted
- Decision: every substantial session updates `docs/CURRENT_STATUS.md`; chat memory is supplemental only.
- Consequence: a new agent can resume from checkout, phase evidence and exact next action.

## D-004 — Guild member identity uses the in-game name

- Date: 2026-09-09
- Status: accepted for guild research model
- Context: the project owner confirms that two players cannot have the same in-game name.
- Decision: use the normalized in-game name as the guild member identifier within the relevant game/world scope. Preserve the display form separately when needed.
- Consequence: contribution and daily snapshots can join by name. A future rename must create an explicit alias/identity transition if historical continuity is desired; the system must not silently merge different names.

## D-005 — Guild daily values and goal matrix

- Date: 2026-09-10
- Status: accepted for the current tool implementation; game evidence pending
- Context: the owner specified level-dependent daily values and requested independent normal/premium targets for total points, dailies and contribution.
- Decision: calculate daily points per member using `0–149 = 150`, `150–349 = 300` and `350+ = 600`; represent each goal family with optional daily and weekly values, with both values enforced when both are present.
- Consequence: a residual contribution pace is calculated per member level when total-points and dailies goals exist without an explicit contribution goal. The old global `points per daily` and editable residual donation field are no longer part of the form.
