# Prototype F (stepback) — Flat multi-entity archive

> **Archive note:** This folder is a frozen copy of the original Concept F multi-entity implementation — the "step-back" version where multi-entity is expressed as a HUD toggle, an inline count breakdown on the group card, entity filter tabs above the member list, per-person entity badges, and a one-line "matching across all 3 entities" hint. It is preserved unmodified so it can be demoed alongside the "skip" version that now lives in `concept-F/`. Do not edit this folder; changes belong in `concept-F/`.

# Prototype F — The Embedded Experience

## Core hypothesis

The next evolution of the supergroup experience should invest more in the **output side** (preview, transparency, refinement, reuse) than the **input side** (the builder). The embedded context — where most admin encounters with groups actually happen — forces this by constraining the builder's footprint. NL becomes the primary interaction medium because it serves both creation and reuse, and it's the most spatially efficient authoring surface.

## What this prototype explores

### 1. The group card

A compact, informationally dense representation of a supergroup. Shows: rule summary in plain language, live member count, evaluation layer indicator ("3 excluded by system filters"), downstream consumer count. This is the unit of embedded experience — what most admins see when a group is referenced in a policy. Every representation is honest about its compression level: the NL summary indicates when it's simplified ("+1 more condition"), and evaluation layers always survive the compression.

### 2. NL-first entry point that collapses picker/builder

When the admin types intent ("full-time employees in California"), the system responds with two paths: (a) saved groups that match ("2 existing groups match"), and (b) generated filter rows if no match. The admin can select an existing group (renders as a group card) or create from generated rows. NL is the entry point for both reuse and creation — collapsing the picker/builder distinction into a single interaction.

### 3. Bidirectional refinement from preview

Each person in the population preview is clickable. Clicking shows structured per-condition pass/fail (Entra-style). For people who shouldn't be there, offer a "Suggest adjustment" action that proposes a rule change. NL also supports editing commands against the current rule state: "remove contractors," "add everyone in the SF office," "why is Sarah in this group?"

### 4. Reimagined host flow

A simulated policy builder (benefits eligibility) that gives the supergroup definition a dedicated phase — not a cramped form field. Two variants:
- **(a) Standard 480px drawer** — the compact experience most admins encounter today
- **(b) Expanded integration** — the group definition gets full-width or a side panel alongside the policy context

## Design decisions

### Inherited from Concept E (validated bets)
- Flat filter rows as the primary authoring interface
- Deterministic live preview tethered to the builder
- Evaluation layer transparency with progressive disclosure
- Save gating (can't save until preview is computed)
- NL-as-accelerator, not replacement

### New in Concept F
- **Group card as the atomic unit.** The compressed representation carries signals 1–4 from the exploration doc (count, evaluation layer indicator, save gate, rule summary in plain language). Signals 5–7 (per-member explain, downstream impact, change diff) live behind expansion.
- **NL as reuse accelerator.** Before generating filter rows, the NL input searches saved groups. Reuse becomes the default path because intent expression and group selection share the same input.
- **Bidirectional preview.** The population preview is interactive — clickable people with structured diagnostic, and "suggest adjustment" that proposes rule changes to exclude someone.
- **NL as editing interface.** Beyond initial authoring, NL commands operate on the current rule state. Constrained vocabulary: "add [condition]," "remove [condition]," "exclude [value]," "why is [person] in this group?"
- **Host flow as a design provocation.** The prototype shows what policy builders *should* look like if they give group definition room to breathe, not just what the component looks like compressed into a standard drawer.

### LOGI (locally optimized, globally incoherent) discipline
Every representation derives from the same source of truth (rule AST + evaluation result). No representation omits information that would change the admin's understanding. The group card says "47 people" and always shows evaluation layer exclusions. The NL summary indicates when it's lossy ("+1 more condition"). Different resolutions, same truth.

## What this prototype should prove or disprove

1. **Does the NL-first entry point increase reuse?** If admins encounter existing groups before they start building, do they select them more often?
2. **Does the group card earn trust without requiring inspection?** Can an admin look at the compressed card and feel confident about what the group does, without expanding to the full surface?
3. **Does bidirectional refinement from the preview work?** When admins can see *why* a person matches and get a suggested rule adjustment, do they refine rules more precisely?
4. **Does the reimagined host flow produce higher confidence than the compressed drawer?** If we give the group definition more space in the policy builder, do admins make better decisions?
5. **Is NL-as-editing-interface faster than direct filter manipulation?** For common edits (add condition, remove condition, adjust value), is NL faster than clicking through dropdowns?

## Build contract

- Root component: `ConceptF`
- File: `concept-F/index.tsx`, default export
- Prop: `entryState: EntryState` (from `shell/types.ts`)
- No imports from other concept folders
- All state local to component tree
- Uses shared types from `shell/types.ts` and data from `shell/mockData.ts`
