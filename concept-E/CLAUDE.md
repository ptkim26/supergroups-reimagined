# Prototype E — The Obvious Default

## External UX benchmarks (nested filters / rule builders)

**Complete.** Full competitive UX teardown across 10 products (3 cloud IAM, 4 HCM/HRIS, 2 marketing automation analogues, 2 productivity references): [`Research/competitive-ux-nested-filtering-workforce-hcm-iam.md`](../../Research/competitive-ux-nested-filtering-workforce-hcm-iam.md).

Key finding: no product in the set combines full boolean expressiveness + global population preview + per-member explain. The combination is a greenfield design opportunity for Rippling.

See also: [`Research/research-synthesis-what-the-data-actually-says.md`](../../Research/research-synthesis-what-the-data-actually-says.md) — gap #4 (competitive analysis of the core experience) is now resolved and links the teardown.

### Steal

- **Entra ID validation detail.** Per-condition pass/fail breakdown in membership explain — shows exactly which conditions passed and which failed for a given person. Structured, not narrative.
- **Google Workspace save gate.** Cannot save until the system has computed and displayed the resulting membership. Forces preview-before-commit.
- **HubSpot-style filter groups.** Visual nesting of AND/OR groups in a flat interface. "+ Add filter group" creates a nested group inline without mode-switching.

### Avoid

- **Okta activate-without-preview.** Lets admins activate group rules without ever seeing who matches. Root cause of trust erosion.
- **HubSpot estimated counts.** Marketing-style "~2,400 contacts" is inappropriate for deterministic workforce membership. Admins need exact counts.
- **Entra builder/text schism.** Visual builder and text-mode editor use different representations. Edits in one can't round-trip to the other. One system, one truth.

## Core hypothesis

The system's usability failures don't require a paradigm shift. They require the straightforward thing, built well: **default simple filter rows with optional nested filter groups** (Notion-like), **deterministic live preview**, **per-member explain**, and **save gating**.

The bet: if the filter builder starts flat and visible (not hierarchical by default), allows nesting when needed via "+ Add filter group" (not forced from the start), the preview is live and trustworthy (not separate and unreliable), save is gated on preview-ready (not fire-and-forget), system filters are transparent (not hidden), and natural language accelerates but doesn't replace structured input — the admin trusts the system without needing the conceptual bridges that A–D propose.

This IS a hypothesis: that a clean filter model with optional nesting + live preview + save gating is sufficient without entry-point tricks. The other prototypes test clever reframings — rules-first density (A), people-first bridging (B), conversation-first AI (C), policy-first impact (D). This one tests whether cleverness is unnecessary.

## What this prototype explores

**Flat-by-default filter builder with optional nested groups as the primary authoring interface.**

Visible filter rows, not a drill-down menu. Each condition is a row: `[Field ▾] [Operator ▾] [Value ▾]`. Add a row with "+ Add condition." Toggle AND/OR between rows. Every part of the rule is visible and editable at all times — no stack navigation, no category drilling, no hidden sub-menus.

When the admin needs boolean nesting (e.g., "(Engineering OR Finance) AND US"), they click "+ Add filter group" to create a nested group with its own combinator. Groups can be nested recursively. This maps directly to the `RuleGroup` AST in `shell/types.ts`. The flat default covers 90% of cases; nesting handles the rest without a mode switch.

This is the interaction pattern from Notion filters and HubSpot filter groups. It works because every element is visible, the state is always readable, and nesting is additive rather than structural.

**Deterministic live population preview tightly coupled to the filter builder.**

As filters are added, changed, or removed, the matching population below updates immediately. Not in a separate step, not in a different panel — directly below the filter builder on the same surface. The population shows faces, names, and exact counts. No estimated counts, no marketing-style approximations.

The connection between "what I specified" and "who matches" is the tightest possible feedback loop.

**Per-member explain with structured condition pass/fail.**

Clicking any person opens a structured explanation: which conditions they passed (with values), which they failed (with actual vs. expected), and whether any evaluation layer excluded them. Modeled after Entra ID's per-condition validation detail.

**Save gating on preview-ready state.**

Create/Save is disabled until: (1) the rule has at least one valid condition, and (2) the membership preview has been computed for the current rule snapshot. No Okta-style activate-without-preview. The admin always sees who will be affected before committing.

**Natural language as accelerator, not replacement.**

A text input above the filter builder: "Describe who should be in this group..." The admin types "full-time employees in California" and the system pre-fills the filter rows. The filters are visible, editable, and the source of truth. The NL input is a shortcut to get there faster.

**Limitation:** The NL accelerator currently applies parsed conditions to the root group only. It cannot produce nested filter groups from natural language input. This is a deliberate scope boundary — NL is for fast flat-filter entry; complex nesting requires manual construction.

**Transparent evaluation layers with progressive disclosure.**

When system filters affect the population, the interface shows an ambient indicator: "47 match your filters. 5 excluded by system filters." Clicking the indicator expands to show each active layer, its description, and who it excludes.

**One authoring system with graceful rendering fallback.**

The filter builder (~90% of rules): Flat rows with optional nested groups. This is what every admin sees when creating or editing a group.

When viewing a group authored via API or by a power user with rules that exceed the editable filter model (formula-based conditions, org-relationship traversals), the interface shows the membership list, per-person explanations, downstream impact, and evaluation layers — all identical to the builder-renderable experience. The rule section renders a read-only structured summary instead of the editable filter builder.

This is a rendering boundary, not a tier or mode. The system detects automatically based on rule shape: if the rule fits the filter builder model (field/operator/value + AND/OR groups), it renders as editable. If it exceeds that model, the rule section gracefully degrades to a read-only view. The user never chooses or switches between modes.

**Change safety with blast radius preview.**

When editing a group, the system shows a diff before committing: people added, people removed, downstream impact with sensitivity tiers, and risk-proportional gates.

**Reuse via inline suggestion.**

As the admin builds filters in create mode, the system checks for matching saved groups and surfaces suggestions inline.

## Interaction paradigm

The interface is a **single, clean surface with a tight feedback loop** — closer to a well-designed form than a workspace, wizard, or conversation.

- **Top (optional):** NL accelerator input. "Describe who should be in this group..." One-shot input that pre-fills the filter rows below.
- **Middle:** Filter builder. Each row is `[Field ▾] [Operator ▾] [Value ▾]` with AND/OR toggles. "+ Add condition" adds a row. **"+ Add filter group"** creates a nested group with its own combinator. Groups render with visual nesting (indent + border).
- **Below filters:** Evaluation layer indicator. "47 match. 5 excluded by system filters." Expandable to show each layer and its effect.
- **Below indicator:** Live population preview. Faces, names, and an exact count that updates as filters change. Each person is clickable for structured "why in / why not" explanation.
- **Right sidebar or bottom panel (in edit mode):** Change diff and downstream impact summary.

For complex rules (API-authored): the filter builder section is replaced by a read-only rule summary + an "Edit rule" toggle. Everything else is identical.

For the inline context (480px drawer): the same surface compressed.

No steps, no "next" buttons, no wizard. If the admin needs to name the group, set an owner, or configure provenance, those fields are on the same surface alongside the filters.

## What this prototype should prove or disprove

1. **Is the "obvious" design sufficient?** If a filter builder + live preview + transparent layers produces the same or better comprehension, confidence, and completion rates as A–D, the implication is that the current system's failures are about execution quality, not conceptual framing.

2. **Does NL-as-accelerator add value without adding dependency?**

3. **When the builder can't render a rule, does the read-only fallback still feel like the same system?**

4. **Does this design scale across all three admin archetypes?**

5. **Is "transparent system filters" the right progressive disclosure level?**

6. **Does save gating improve trust without adding friction?** If admins find the disabled-save state reassuring (they know the system is computing), save gating is working. If they find it annoying (they want to save and go), it's adding friction without trust benefit.

## What this prototype should NOT do

- **No people-first entry point.** That's Concept B's territory.
- **No conversational interface.** NL is a one-shot accelerator, not a conversation. That's Concept C.
- **No policy-first navigation.** That's Concept D.
- **No ambient information density.** Progressive disclosure, not everything-at-once. That's Concept A.
- **No wizard or multi-step flow.** Everything on one surface.
- **No estimated counts.** Exact deterministic membership only.

## Technical constraints

- The filter builder must render any rule that fits the group model (field/operator/value conditions composed with AND/OR at any nesting depth via `RuleGroup`). Rules that exceed this model must fall through to read-only advanced view.
- `RuleGroup` from `shell/types.ts` is the single source of truth for rule state. `CreateView` and `EditMode` operate on `RuleGroup` directly — not on flat `FilterRow[]` that get converted.
- The recursive `RuleGroupEditor` in `concept-E/rule-group-editor.tsx` handles rendering and editing of `RuleGroup` trees at any depth.
- Membership preview must update immediately when filters change.
- Per-member explanation shows structured per-condition pass/fail.
- Create/Save is disabled until preview is ready AND rule has at least one valid condition.
- Must include scenarios for: create, view, edit, inline-select, complex-rule, legacy, and high-stakes create (policyContext sensitivity tier 1).

### Mock data expansion

Expand the shared mock data to at least 40 people locally. Requirements:
- 7+ departments, 6+ locations, mix of employment types
- At least 3 pending and 2 terminated role states
- Start dates spread across 2023–2026
- At least 2 recent joiners
- At least 1 saved group with 25+ members
- At least 1 saved group with a nested rule to test the read-only rendering fallback

### Required scenarios

All four scenario types from the shared contract, plus:
- **View complex rule group:** Open a group with a complex nested rule (API-authored, can't render in builder).
- **View legacy group:** Open `sg-legacy` with degraded rendering.
- **High-stakes create:** Create with a tier-1 policyContext; extra confirmation before save.

## Evaluation focus

This prototype is the strongest test of whether **execution quality on the obvious design** beats **paradigm innovation**. Evaluate primarily on:
- Does the filter builder feel faster and more predictable than the current hierarchical editor?
- Does the live population preview close the trust gap?
- Does NL-as-accelerator get used?
- Does the two-tier model feel coherent?
- Does save gating feel like a safety net or a speed bump?
- Can a new admin understand an existing group within 60 seconds?

---

## Build contract (do not modify)

- Your root component must be named ConceptE
- It must live at concept-E/index.tsx and be the default export
- It must accept one prop: `entryState: EntryState` (type defined in shell/types.ts — read it before building)
- It must start from the shared entry point defined in entryState
- Do not create your own dev server, package.json, or vite config — the unified shell handles all of that
- Do not import from other concept folders
- All state is local to your component tree unless explicitly shared via entryState
