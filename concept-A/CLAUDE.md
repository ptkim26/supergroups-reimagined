# Prototype A — The Transparent Machine

## Core hypothesis

Trust comes from making the system's logic visible and manipulable — not from hiding complexity behind simpler abstractions. The current system is illegible, and the fix is legibility, not simplification. If admins can see exactly what the rules do, see exactly how evaluation layers affect membership, and see exactly what changes before they commit — they'll trust the system, even if it looks complex.

This prototype bets that the right mental model for groups is **rules you can read**, not people you can pick. It resolves the "over-powerful and under-capable" tension by making the power legible rather than constraining it.

## What this prototype explores

**The "Filters + Options" constrained builder as the primary and sufficient interface — no AI, no natural language, no people-picker.**

The structured rule builder (field → operator → value, composed with AND/OR) is the only authoring interface. Every rule, including machine-authored ones, renders in this format. The bet is that if the builder is clear enough, readable enough, and responsive enough, it closes the conceptual gap on its own.

**Ambient, always-on transparency instead of progressive disclosure.**

There is no "simple view" that hides evaluation layers. The default view shows the full picture: the rule definition, the invisible filters (role states, scope, provisioning groups, parent constraints), and their effects on membership — all at once, all the time. The interface is information-dense by design, closer to a spreadsheet or IDE than a wizard.

The hypothesis is that progressive disclosure — hiding things and revealing them on demand — is actually what erodes trust. Users don't investigate hidden panels. They either see the answer or assume the system is hiding something. Show everything, and let visual hierarchy do the work that hiding/revealing usually does.

**Inline expansion as the explanation mechanism.**

Clicking any condition, filter, or member shows its relationship to everything else in-place. Click a condition → see which members it matches. Click a member → see which conditions they match and which evaluation layers affect them. Click an invisible filter indicator → see who it excludes and why. No drawers, no side panels, no modals. Everything expands in context.

**Live differential preview for change safety.**

As the user edits a rule, the membership preview updates in real time (or near-real-time). Added members appear highlighted. Removed members appear highlighted differently. The diff is not a separate step — it's the editing experience itself. The blast-radius summary (which downstream consumers are affected) is always visible in a compact reference bar.

**Suggestion-inline reuse.**

As the user builds conditions, the system checks for structurally similar saved groups and surfaces them inline: "2 existing groups match these conditions." The user can switch to an existing group without leaving the builder. Reuse is a contextual suggestion, not a separate search step.

## Interaction paradigm

The interface is a **single, dense, responsive workspace** — not a multi-step flow.

- Left region: the rule builder (constrained Filters + Options format). Every condition is a chip that can be clicked to see its effect.
- Center region: the live membership preview. Updates as rules change. Members are clickable for per-member explanation.
- Right region (compact): evaluation layers active on this group, downstream consumers, and blast-radius summary. Always visible, never hidden.
- No steps, no "next" buttons, no wizard. The admin sees the full picture on one screen and edits in place.

## What this prototype should prove or disprove

1. **Can density replace disclosure?** If admins see everything at once, do they understand it — or do they freeze? The research says users abandon at the membership step. This prototype tests whether that's because the membership step hides too much (this prototype's bet) or shows too much (the counter-argument).

2. **Is the constrained builder sufficient without AI?** If "Filters + Options" is clear, responsive, and paired with live preview, does the admin need natural language as a crutch? Or is structured input actually *more* trustworthy because the admin can see exactly what they specified?

3. **Does real-time differential preview replace staging?** If the user can see exactly who enters and leaves as they edit, do they still need a separate "review changes" step? Or does the live diff provide enough confidence to commit directly?

4. **Does ambient transparency overwhelm the small-company generalist?** This prototype is likely strongest for the enterprise IT admin and mid-market admin. If the small-company generalist can't parse the dense interface, that's a meaningful finding about where transparency hits diminishing returns.

## What this prototype should NOT do

- **No AI-assisted authoring.** No natural language input, no "describe your group" prompt. The builder must stand on its own. If AI is needed, that's a signal that the builder failed.
- **No people picker or example-based entry.** The entry point is always the rule builder. Users start by describing conditions, not selecting people. This is the core bet — don't hedge it.
- **No progressive disclosure.** No "simple mode" vs "advanced mode." No hidden panels that reveal detail. Everything is visible by default. Visual hierarchy (size, weight, color, position) is the only mechanism for managing attention.
- **No multi-step wizard flow.** The entire experience is a single workspace. If it requires steps to be usable, the information architecture needs revision, not a wizard wrapper.
- **No downstream impact visualization beyond the compact reference bar.** This prototype shows downstream consumers as a list with member counts, not as a visual map or narrative. Keep the blast radius representation minimal and structural — that's prototype D's territory.

## Technical constraints

- The rule builder must render any valid AST from the canonical representation. Rules that can't be rendered in Filters + Options format must fall through to a structural tree view — never silently simplified.
- Membership preview must update within 2 seconds of a rule change. Use optimistic rendering with skeleton states if the backend is slower.
- Per-member explanation (click a person → see why they're in/out) must display within 500ms. If this requires mock data during prototyping, that's acceptable — but the interaction pattern must feel real-time.
- Must include at least one scenario with a legacy group (untyped, complex rule shape) to test graceful degradation.
- Must include at least one scenario inside an inline component context (e.g., selecting a group within a policy builder modal) to test whether the dense workspace compresses into a constrained viewport.

## Evaluation focus

This prototype is the strongest test of **UR-1 (explainability)** and **UR-3 (transparency)**. If it works, it proves that transparency alone can solve the trust crisis. If it fails, it proves that simplification (prototypes B/C) or reframing (prototype D) is necessary.

Evaluate primarily on:
- Can a mid-market admin edit a group and correctly predict the outcome before committing?
- Can an admin who didn't create a group explain what it does within 60 seconds?
- Does the admin feel confident or overwhelmed? (Confidence self-report)
- Does the small-company generalist struggle more than the other segments, or does density scale down?

---

## Build contract (do not modify)

- Your root component must be named ConceptA
- It must live at concept-A/index.tsx and be the default export
- It must accept one prop: `entryState: EntryState` (type defined in shell/types.ts — read it before building)
- It must start from the shared entry point defined in entryState
- Do not create your own dev server, package.json, or vite config — the unified shell handles all of that
- Do not import from other concept folders
- All state is local to your component tree unless explicitly shared via entryState
