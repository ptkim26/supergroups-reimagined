# Technical specification — Supergroups reimagined

Derived from the research handoff, research synthesis, landscape analysis, and quantitative data pull. This spec is intended to align a cross-functional team, seed four divergent prototype explorations, and serve as the evaluative framework when we test those prototypes.

---

## Problem framing

### What the system needs to do that it doesn't do today

Supergroups is a workforce policy targeting layer consumed billions of times per month by machines and misunderstood daily by humans. These are not separate problems. The system lacks a legible contract at every layer: with the admins who operate it, with the internal teams that build on it, and with itself (53 million groups, 67% untyped, no lifecycle tracking, no reference counting).

Technically, the system needs to:

1. **Make membership explainable.** Given any group and any person, the system must be able to answer "why in" or "why not" — including the effects of invisible evaluation layers (role states, scope, provisioning groups, parent constraints, temporal evaluation). Today, these layers exist but are not surfaced. The result is a system that produces correct outputs for reasons humans cannot verify.

2. **Make change safe.** Editing a group can silently alter app access, payroll targeting, compliance scope, or device policy for thousands of people. Today, the system has no preview of downstream effects, no staging, no approval gates, and no rollback. The blast radius is "enormous" (internal characterization) but untraceable.

3. **Make reuse the default path.** 0.33% of groups are reused. 38% of companies that adopt saved groups stop at one. The system creates millions of groups per month and has no mechanism to deduplicate, surface existing matches, or expire unused objects. Every unreused group is wasted compute on dependency tracking refreshes.

4. **Separate the human interface from the machine interface.** 53 million groups exist. 220 sessions per month visit supergroup pages. The system's primary consumers are other Rippling products, not admins. Today, one interface tries to serve both — producing a rule builder that's too complex for admins and too constrained for machines.

5. **Give groups an identity.** 67% of groups have no type. The system cannot answer what a group is for, which product owns it, whether it's temporary or persistent, or whether anything still references it. Without group identity, you cannot build governance, lifecycle management, or intelligible admin experiences.

### Where the boundaries of this problem are

**In scope:**
- The admin experience of creating, understanding, editing, and governing groups
- The platform contract that consumer products (payroll, benefits, IT, compliance) integrate against
- The data model for group identity, lifecycle, and provenance
- The representation layer that makes rules legible across the UI-API boundary
- Change safety: preview, staging, approval, rollback

**Out of scope for this spec (but architecturally considered):**
- Non-human identity (agents, service accounts) — the data model must not preclude it, but no user need exists internally today
- Continuous verification / real-time event-driven evaluation — the architecture must not make it structurally impossible, but the current user base isn't asking for it
- Downstream entitlement graph ("what does this group grant across all systems?") — high external signal but no internal demand data; requires a separate technical spike
- Migration of the 53 million existing groups — a critical operational problem, but one that follows design decisions rather than preceding them. However: the new provenance, lifecycle, and explainability capabilities apply only to new groups. For the admin experience to be coherent, the system must also present legacy groups in the new UI. This means the constrained rendering (UR-5) and explanation engine (UR-1) must degrade gracefully for groups that lack metadata or use rule shapes the constrained renderer can't handle. Prototype evaluation should include at least one scenario with a legacy group to test this degradation.

---

## User segments for evaluation

The research has no segmentation by company size, and all user behavior is inferred from support tickets and analytics — biased toward users confused enough to file tickets. The spec's requirements apply broadly, but their relative importance shifts across admin archetypes. Prototypes should be tested against all three.

**Small-company generalist** (<200 employees): Manages HR, IT, and benefits in one role. Likely thinks in people, not rules. May genuinely need a people-picker with a dynamic upgrade path. The reuse problem barely exists here — few policies, few groups. UR-5 (natural expression) and UR-1 (explainability) matter most. UR-4 (reuse) may not matter at all.

**Mid-market HR/IT admin** (200–5,000 employees): The primary population where the conceptual gap is most acute. Needs dynamic rules but didn't choose to become a power user. This is the archetype most of the research describes — the one filing tickets about "all full-time employees in the US." UR-5 (natural expression), UR-3 (progressive transparency), and UR-1 (explainability) are all critical.

**Enterprise IT administrator** (5,000+ employees): Likely comfortable with rule logic. Needs governance, audit, blast-radius tooling, and change safety more than hand-holding on rule authoring. UR-2 (change safety) and UR-6 (provenance) matter most. UR-5 (natural expression) may matter least — this user can learn a constrained builder.

These are evaluation archetypes, not design targets. A prototype that works brilliantly for the mid-market admin but breaks the enterprise admin's workflow is a net loss — the enterprise admin is the one managing groups that affect thousands of people.

---

## User requirements

### UR-1: Membership explainability

**User need:** When I look at a group, I need to immediately understand who's in it and why — including when the system's hidden evaluation layers (role states, scope, provisioning groups, parent constraints) are affecting the result.

**Acceptance criteria:**
- For any individual in a group: the system displays which rule conditions they match
- For any individual excluded from a group: the system displays the reason (didn't match conditions, filtered by role state, excluded by scope, blocked by parent constraint)
- When invisible filters affect the result count, the system proactively indicates this (e.g., "3 people excluded by role state filters") without requiring the user to open a diagnostic panel
- Explanation is generated from the evaluation engine's actual logic, not from a separate display heuristic

**Constraints:**
- Must work at the speed of the preview interaction — explanation cannot require a full async recomputation
- Must handle groups up to the P99 size without degradation (current P99 latency: 22s for largest customers; target: under 3s for explanation of a single member)
- In tension with **UR-3** (transparency vs. overwhelm): surfacing all evaluation layers simultaneously will overwhelm most users, but hiding them erodes trust

**Confidence: High.** Multiple observed sources — support tickets, stakeholder interviews, competitive product decisions (Entra documents attribute write permissions as attack surface, Cedar makes explainable authorization a commodity).

### UR-2: Change safety

**User need:** Before I commit a change to a group, I need to see what will happen — who enters, who leaves, and what downstream policies, apps, or workflows are affected. I need the option to stage, review, and reverse changes.

**Acceptance criteria:**
- Editing a group produces a diff: members added, members removed, with counts and names
- The diff includes downstream impact summary: which policies, apps, integrations, or workflows reference this group (even if we can't yet enumerate the full entitlement chain)
- Changes can be staged (saved as draft without taking effect) for groups flagged as sensitive
- Changes to groups above a configurable blast-radius threshold require explicit confirmation or approval
- A change log exists: who changed what, when, and the before/after state

**Constraints:**
- Downstream impact requires the system to maintain a reference map (which consumers reference which groups). This does not exist today and is a prerequisite infrastructure investment.
- Staging/drafts introduce a "group version" concept that adds state management complexity
- In tension with **UR-5** (express intent naturally): the more safety layers we add, the heavier the editing flow becomes for simple changes

**Confidence: High.** Observed in internal P0 incident history, JumpCloud's approval gates, Entra's prohibition on dynamic membership for role-assignable groups, and feature flag systems' treatment of change safety as first-class.

### UR-3: Progressive transparency

**User need:** I need to understand what the system is doing, but I don't need to see everything at once. The system should show me the right level of detail for my current task and let me go deeper when I choose to.

**Acceptance criteria:**
- Default view shows the group definition in a human-readable form (closer to "Full-time employees in the US" than `role_state = active AND employment_type = full_time AND work_location.country = US`)
- Invisible filters that affect the result are indicated (not hidden, not fully expanded — indicated)
- Expanding an indicator reveals the specific filter and its effect
- "Why is this person in/out?" is a single interaction from the member list
- The system never shows a member count or preview without accounting for all active evaluation layers

**Constraints:**
- Progressive disclosure requires careful information architecture — three levels feels right (summary → indicators → full explanation), but the specific breakpoints depend on prototyping
- In tension with **UR-1** (explainability): UR-1 says "explain everything"; UR-3 says "don't overwhelm." The resolution is progressive disclosure, but the design of that disclosure is a prototyping question, not a spec question.

**Confidence: High** that the need exists. **Medium** on the right disclosure model — this is a primary prototyping question.

### UR-4: Reuse-first interaction model

This requirement has two distinct sub-problems that share evidence but require different solutions.

**UR-4a: Discoverability** — Can admins find existing groups when they want to reuse one?

**User need:** When I need a group for a policy, I should find the one that already exists before building a new one. The system should guide me toward reuse the way a search engine guides toward existing results.

**Acceptance criteria:**
- The default entry point for group selection is search/browse, not creation
- Existing groups are findable by description, membership shape, or natural language query — not only by name
- Creating a new group requires a minimum of: name, purpose, and owner (the provenance requirement from UR-6)

**Constraints:**
- Requires a search/matching capability over the saved group corpus that doesn't exist today
- The 53 million unsaved groups are noise, not signal — reuse applies to the curated (saved) layer, not the full corpus
- In tension with **UR-5** (natural expression): the fastest way to express intent is often to just build the group. Forcing a search/browse step adds friction to the common case. The design needs to make reuse faster than creation, not just available.

**Confidence: High.** The current UX defaults to creation over selection — this is directly observed in the product's history and stakeholder testimony.

**UR-4b: Deduplication** — Is the system creating redundant groups that should be consolidated?

**User need:** When a user starts building a group, the system should surface matching existing groups before allowing creation ("3 groups already target this population").

**Acceptance criteria:**
- The system detects when a group being created substantially overlaps with an existing saved group
- Overlap detection works on rule structure, membership shape, or both

**Constraints:**
- We don't know the actual redundancy rate among saved groups. The 0.33% reuse rate is alarming, but most of the 53 million groups are system-generated and *should* be unique (a payroll targeting group for California isn't meant to be reused by a benefits policy in New York). Among the 178K saved groups, we don't know if overlap is a real problem or if admins intentionally create similar-but-distinct groups for different purposes.
- The matching/deduplication engine is a technical spike (see System Requirements) — the right similarity metric and acceptable latency are unknown.

**Confidence: Medium.** The evidence for low reuse is strong, but the data can't distinguish between "I couldn't find an existing group" (discoverability failure) and "I didn't need to reuse one" (intentional creation). Discoverability is the higher-confidence bet. Deduplication requires validation.

### UR-5: Natural intent expression

**User need:** I should be able to describe the group I want in terms I understand — department, location, employment type — without learning boolean logic, RQL, or the system's internal rule structure.

**Acceptance criteria:**
- The primary authoring interface uses constrained, human-readable patterns (the "Filters + Options" model from the confidence synthesis: field → operator → value, composed with AND/OR)
- The system renders complex rules in the same human-readable form, even if they were authored programmatically
- For rules that exceed the constrained model's expressiveness, the system shows them in a read-only "advanced" view rather than silently misrepresenting them
- AI-assisted authoring (natural language → rule) is additive: it generates rules in the same constrained model, so users can read and modify the output

**Constraints:**
- The UI-API contract mismatch must be resolved: the current system represents inclusion/exclusion as "2 things, not 4" (Ryan S.), causing arbitrary RQL to render incorrectly in the UI. The new rule representation must be round-trippable — any rule created in the UI can be read by the API and vice versa, without lossy translation.
- Less than 10% of customers create complex rules. The constrained model covers the vast majority of use cases. The question is what happens at the boundary — when a rule is too complex for the constrained UI.
- In tension with **system expressiveness**: the machine API needs full RQL power. The human UI needs constrained simplicity. These must share a data model but not a rendering.

**Confidence: Medium.** Inferred from behavioral signals (low complex rule usage, support ticket patterns). No direct user research exists on how admins want to express group intent. The "Filters + Options" model is a strong hypothesis but untested.

### UR-6: Group identity and provenance

**User need:** When I encounter a group I didn't create — as a new admin, an auditor, or someone inheriting a colleague's work — I need to understand what it is, what it's for, and what it controls, without institutional memory.

**Acceptance criteria:**
- Every group has required metadata: name, owner (person or team), purpose (human-readable), product domain (which Rippling product owns it), and lifecycle intent (persistent, temporary, or system-managed)
- Groups display when they were last evaluated, what changed, and who last modified them
- Groups surface their consumers: which policies, apps, or workflows reference them
- System-generated groups are visually and structurally distinct from admin-created groups

**Constraints:**
- Retroactively classifying 53 million existing groups is not feasible through metadata alone — the system will need inference heuristics (based on creation source, rule shape, consumer references) for legacy groups
- Requiring provenance at creation adds friction to programmatic consumers who currently create groups with no metadata
- This is a platform contract change, not just a UI change — consumer teams must supply provenance data

**Confidence: High.** 67% untyped groups, declining reuse ratio, and 17,000 companies with 1,000+ groups each all point to a governance failure that begins at the identity layer.

---

## Success metrics

How we'll know whether the redesigned system is working. These are evaluative — they tell us what to measure, not what to build. Prototypes can take divergent approaches and still be scored against the same outcomes.

### Leading indicators (measurable during prototype testing)

- **Edit flow completion rate** in task-based usability sessions (baseline: 33% in production). Target direction: up.
- **Time-to-understanding for inherited groups** — can a participant who didn't create a group explain what it does and who it affects? Measured as time-to-correct-answer in test sessions.
- **Reuse rate in task-based sessions** — when given a task where a matching group exists, does the participant find it? (No production baseline exists for this; prototype testing establishes the first benchmark.)
- **Confidence self-report** — after making a change to a group, does the participant report understanding what happened? (Likert scale, pre/post comparison across prototypes.)

### Lagging indicators (measurable post-launch)

- **Saved group reuse rate** — target: >5% within 6 months of launch (up from 0.33%). This is a 15x improvement that's still modest in absolute terms.
- **Edit completion rate** — target: >50% (up from 33%).
- **Support ticket volume** for "who's in this group" / "why is this person included/excluded" class of questions — target: 40% reduction within two quarters.
- **Untyped group rate on new creates** — target: 0% (enforcement at creation time).

### Platform health indicators

- **Consumer reference registration coverage** — percentage of active consumers with registered group references. Target: >80% within two quarters of the reference API shipping.
- **Group lifecycle distribution** — the percentage of groups in `active` vs. `dormant` vs. `archived` states, tracked as a proxy for whether lifecycle management is working.

---

## System requirements

### Data model

**What we're certain about:**

- **Rule representation must be canonical and round-trippable.** One representation that the UI renders, the API accepts, and the engine evaluates. The current UI-API mismatch (inclusion/exclusion treated as "2 things, not 4") must be eliminated. The representation should be a structured AST (abstract syntax tree) that can be serialized to a constrained human-readable form and to full RQL without lossy translation.

- **Group metadata must be a first-class schema, not optional fields.** Required: `name`, `owner_id`, `owner_type` (person | team | system), `purpose` (free text), `product_domain` (enum of Rippling product areas), `lifecycle_intent` (persistent | temporary | system-managed), `created_by`, `created_at`, `last_evaluated_at`, `last_modified_by`, `last_modified_at`.

- **Groups need a lifecycle state machine.** States: `draft` → `active` → `dormant` → `archived`. Transitions: `draft→active` on first publish. `active→dormant` after configurable period with no consumer references. `dormant→archived` on explicit action or after expiration. `archived` groups stop being refreshed by dependency tracking.

- **Consumer references must be tracked as a first-class relationship.** A reference map: `group_id → [(consumer_type, consumer_id, consumer_product)]`. This enables downstream impact preview (UR-2) and lifecycle management (dormancy detection). This does not exist today and is the highest-priority infrastructure prerequisite.

**What requires a technical spike:**

- **The performance characteristics of the explanation engine.** UR-1 requires per-member explanation. Generating "why in/why out" for a single member against a rule tree with 5 invisible evaluation layers needs to be fast enough for interactive use (target: <500ms). Whether this can be derived from the existing evaluation path or requires a parallel explanation path is an open technical question.

- **The matching/deduplication engine for reuse.** UR-4 requires suggesting existing groups that match a user's intent. This could be rule-structural similarity (same conditions, different order), membership overlap (>90% same people), or semantic similarity (natural language description matching). The right approach depends on the size and shape of the saved group corpus and the acceptable latency for suggestion.

- **Draft/staging state management.** UR-2 introduces group versions (a draft state that doesn't affect downstream consumers until published). This adds complexity to the evaluation pipeline: the system must know which version is "live" and which is "staged." The interaction between drafts and real-time evaluation needs investigation — particularly for groups that are consumed by other groups (composition).

- **Rule complexity distribution.** The spec's AST-to-constrained-rendering strategy assumes most human-created rules can be displayed in the constrained "Filters + Options" model, with complex rules falling through to a read-only advanced view. We don't have data on what percentage of saved groups fit the constrained model. Query a stratified sample of groups (by group type and creation source) to determine: what percentage of rules can be represented as field/operator/value triples composed with AND/OR? If <80% of saved/human-created groups fit the constrained model, the rendering strategy needs revision. If >95% fit, the assumption holds.

### Interaction context constraint

The supergroup component is embedded in 14+ surfaces across Rippling (payroll policy builder, benefits targeting, integration assignment, workflow automation, etc.). Only 220 sessions/month visit the standalone supergroup pages. Most admin encounters with groups happen inside a modal or drawer within another product.

All user-facing capabilities specified in this document — membership explanation, change diff, blast-radius indicators, progressive transparency — must be deliverable in both the standalone group experience and the inline component embedded in consumer products. The inline context is more constrained (less screen real estate, different user intent, interruptive flow) and is where most admin interactions actually occur.

Prototypes should include at least one scenario where the user encounters a group inside a policy builder or assignment flow, not just in the Supergroups app.

### State management

- Group definitions are the source of truth. Membership is derived (computed from rules + attributes + evaluation layers), not stored.
- The system must distinguish between the "published" state (what downstream consumers see) and the "editing" state (what the admin is working on). These must not leak into each other.
- Change history must be retained as an immutable log: who changed what, when, and the before/after rule state. This is the foundation for audit, rollback, and the change log in UR-2.
- Evaluation results must include metadata about which layers were applied (scope, role states, provisioning groups, parent constraints) — this is the data source for UR-1's explanation and UR-3's progressive transparency.

### Performance constraints

| Operation | Target | Current state | Notes |
|---|---|---|---|
| Membership preview (≤1,000 members) | <2s | Unreliable (crashes, empty results, DATASET_COUNT_EXCEEDED) | Preview reliability is a prerequisite — spec before speed |
| Membership preview (>1,000 members) | <5s, paginated | P99: 22s for largest customers | Pagination is non-negotiable for large groups |
| Per-member explanation | <500ms | Does not exist | Spike needed to validate feasibility |
| Change diff (who enters/leaves) | <3s | Does not exist | Depends on ability to evaluate rule against current vs. proposed state |
| Group search/match suggestions | <1s | Does not exist | Must search over saved groups, not all 53M |
| Downstream impact lookup | <1s | Does not exist | Depends on reference map infrastructure |

### Accessibility requirements

- All interactive elements (rule builder, member list, preview, diff view) must meet WCAG 2.1 AA.
- Rule conditions must be expressible and navigable via keyboard alone.
- Member explanations ("why in/why out") must be available to screen readers — not only as visual indicators.
- Color must not be the sole channel for any status information (included/excluded, draft/published, active/dormant).
- Focus management must be explicit in the rule builder: adding, removing, or reordering conditions must maintain logical focus position.

---

## Architectural considerations

### Decision 1: Rule representation — Structured AST vs. constrained form vs. dual representation

This is the decision that most shapes every other decision. The current system has a UI that represents rules differently from how the engine evaluates them (the "2 things, not 4" problem). This mismatch is the root of the structural illegibility.

**Option A: Single canonical AST.** One structured tree representation that the UI renders, the API accepts, and the engine evaluates. The UI applies a constrained rendering (Filters + Options) to the AST. Rules that exceed the constrained rendering's expressiveness fall through to a read-only "advanced" view. Round-trippable by definition.

**Option B: Constrained form with escape hatch.** The UI operates on a simplified rule model (field/operator/value triples composed with AND/OR). Complex rules authored via API are stored in their native form and shown as read-only in the UI. Two representations coexist, with a mapping layer between them.

**Option C: Dual representation with sync.** Two fully writable models (constrained UI form + full RQL) kept in sync through bidirectional transformation. Users can switch between them.

**Recommendation: Option A.** A single AST eliminates the class of bugs where the UI and engine disagree about rule shape. The constrained rendering is a *view* of the AST, not a separate data model. When the UI can't render a rule in constrained form, it falls through to a structural view of the AST rather than silently misrepresenting it. Option B creates a permanent bifurcation. Option C creates a sync problem that will generate subtle bugs for years.

**Risk:** The AST must be expressive enough for all current RQL use cases while remaining renderable in constrained form for the common cases. This requires careful AST design — the node types, composition rules, and rendering logic must be specified together. A spike on AST design should be the first technical workstream.

### Decision 2: Evaluation architecture — Synchronous preview vs. async computation vs. hybrid

The current system runs nightly recomputations and has P99 latency of 22 seconds for large customers. The user requirements demand interactive preview (<2s), per-member explanation (<500ms), and change diffs (<3s). The external landscape is converging on continuous evaluation. These three forces pull in different directions.

**Option A: Synchronous evaluation for all operations.** Preview, explanation, diff, and membership are all computed on-demand. No cached membership lists. Pure derived state.

**Option B: Cached membership with synchronous preview.** The system maintains a cached membership list (updated on attribute changes or on a schedule). Preview and diff operations compute against the cache. Explanation queries the evaluation engine on-demand for individual members.

**Option C: Event-driven incremental evaluation.** Attribute changes emit events. The system incrementally updates group membership as events arrive, rather than recomputing from scratch. Preview and diff operate against the incrementally maintained state.

**Recommendation: Option B for the initial system, architected to migrate toward Option C.** Pure synchronous evaluation (A) won't meet performance targets for large groups — evaluating a rule against 50,000 employees on every preview is too slow. Event-driven incremental (C) is the right long-term architecture (and the path to continuous verification) but requires significant infrastructure investment and a mature event system. Option B gives us interactive performance now (cached membership is fast to diff against) while establishing the pattern of "membership as derived state with explanation on demand" that C extends.

**The migration path matters more than the initial choice.** The cache must be designed as a materialized view that *could* be incrementally maintained, even if the first implementation uses batch refresh. This means: cache entries must carry provenance (which rule matched, which evaluation layers applied), not just a boolean "in/out." That provenance is what makes explanation possible (UR-1) and what makes incremental update possible later.

### Decision 3: Human interface boundary — Where does the admin experience end and the platform API begin?

The data is unambiguous: the system's primary consumers are machines (53 million groups, billions of evaluations/month), and the human interface serves ~500 users per week. Today, one interface tries to serve both. The result is a rule builder that's too complex for admins and an API that's too constrained for machines.

**Option A: Unified interface with progressive complexity.** One surface that starts simple and reveals power as needed. Admin-facing features and API-facing features are the same system, just different entry points.

**Option B: Explicitly separated interfaces with a shared data model.** The admin experience is a distinct product surface (the Saved Supergroups app, the inline group picker) that operates on a curated layer. The machine API is a separate interface with full expressiveness. Both read and write to the same underlying data model.

**Option C: Admin experience as a consumer of the platform API.** The admin UI is built entirely on top of the public API — it's a "first-party consumer" with no special access. Everything the admin can do, the API can do.

**Recommendation: Option B, with Option C as the platform aspiration.** The admin and the API have fundamentally different needs. The admin needs to see 20 saved groups, not 53 million system objects. The API needs full RQL expressiveness, not a constrained builder. Forcing these through one interface produces an experience that serves neither well. Option B acknowledges this reality. The admin experience operates on the "curated layer" (saved, intentional, human-owned groups) while the API operates on the full corpus.

However, the admin experience should be *built on* the platform API where possible (Option C aspiration). This ensures the API is capable enough for real use and prevents the admin experience from accumulating special-case access that bypasses the platform contract. The gap between B and C should narrow over time as the API matures.

**Implication for prototyping:** Prototypes should focus exclusively on the admin experience. The API design is a separate workstream that should be informed by prototyping outcomes but not blocked by them.

### Decision 4: Change management model — Inline safety vs. explicit staging

UR-2 requires change safety: preview, diff, approval, rollback. The question is how heavyweight this should be — and whether it's always-on or triggered by risk.

**Option A: Always-on staging.** Every edit creates a draft. Drafts must be explicitly published. All groups go through the same flow.

**Option B: Risk-proportional gates.** Simple changes (adding a filter value) apply immediately with a confirmation diff. Changes above a blast-radius threshold (affecting >N people, touching sensitive policies, modifying groups referenced by >M consumers) require staging and/or approval.

**Option C: Optimistic with undo.** Changes apply immediately. The system provides a time-bounded undo window (like Gmail's "undo send"). After the window closes, changes are permanent.

**Recommendation: Option B.** Always-on staging (A) adds friction to every interaction, including trivial ones — and the data shows most groups are simple. Optimistic with undo (C) doesn't work for a system where changes propagate immediately to downstream consumers (you can't "undo" an access change that already provisioned). Risk-proportional gates (B) match how the problem actually scales: most groups are low-risk (small, few consumers), and the safety investment should concentrate where the blast radius is large.

**The blast-radius calculation must be explicit and visible.** The system should show the user: "This group is referenced by 4 policies affecting 2,300 people." That number is the input to the risk gate — and it's also the transparency that builds trust (UR-3). The safety mechanism and the transparency mechanism are the same data, rendered differently.

**Open question for prototyping:** Where is the right threshold? What counts as "sensitive"? This needs user testing — the prototypes should explore different gate triggers and see which ones feel proportional vs. burdensome.

---

## What this spec intentionally leaves open

These are the questions the prototypes exist to answer. They are unresolvable through analysis and require users reacting to concrete alternatives.

### 1. The progressive disclosure model for transparency

The spec establishes three levels (summary → indicators → full explanation) but does not prescribe how they render or what triggers movement between levels. The prototypes should explore at least:

- **Ambient indicators** — always-visible signals that invisible filters are active (badge, count adjustment, subtle text)
- **Drawer/panel explanation** — a side panel with per-member "why in/why out"
- **Inline expansion** — clicking a filter chip or condition expands to show its effect on membership
- **Conversational explanation** — "Ask why" as a natural language interaction

The right model depends on whether admins want to *scan* (ambient) or *investigate* (drawer). The data suggests both — but we don't know the ratio or the triggering conditions.

### 2. The reuse interaction pattern

The spec says reuse should be the default path, but the specific interaction is open:

- **Search-first** — the group picker opens to a search field, not a creation form
- **Suggestion-inline** — as the user builds conditions, the system suggests matching existing groups ("3 groups already target this population")
- **Template-based** — common group shapes are pre-built; the user customizes rather than creates
- **Browse-by-shape** — groups are browsable by their membership shape (department, location, employment type) rather than by name

### 3. The natural expression interface

The spec recommends the "Filters + Options" constrained model and AI-assisted authoring as additive. But the prototypes should test:

- **Filters + Options alone** — is the constrained model sufficient for 90% of use cases without AI?
- **Natural language as primary input** — does "all full-time employees in the US" as the starting point work better than a structured builder?
- **Hybrid** — natural language generates a structured rule that the user can then refine in the constrained builder
- **Example-based** — "start with these 5 people, generalize to a rule" as an entry point

The research says less than 10% create complex rules, but we don't know if that's because users don't need complexity or because they can't express it.

### 4. The right visual language for blast radius and downstream impact

The spec requires downstream impact to be visible, but the rendering is open:

- **Numeric summary** — "Affects 2,300 people across 4 policies"
- **Impact map** — visual representation of which systems are affected
- **Narrative** — "Removing this condition will remove 47 people from the California Benefits policy"
- **Differential** — side-by-side before/after with highlighted changes

This is a prototyping question because the right answer depends on how much detail admins actually want before committing a change — and that varies by risk tolerance and role.

---

## Constraints and non-negotiables

### Accessibility

- WCAG 2.1 AA compliance across all interactive surfaces. No exceptions for "advanced" features.
- The rule builder must be fully operable via keyboard. This is not cosmetic — rule builders are notoriously inaccessible, and ours will be evaluated against competitors that are shipping accessible alternatives.
- Screen reader support for membership explanations: "why in/why out" must be available as structured text, not only visual annotation.

### Preview correctness

For any valid rule, the membership preview must return a result set that matches what the evaluation engine would produce. Zero tolerance for empty results when members exist, wrong membership after rule changes, or silently swallowed errors. This is a blocking prerequisite before any performance optimization or UX work begins — everything built on top of the preview (explainability, change diffs, progressive transparency) depends on the preview being truthful.

Current state: LogRocket data shows previews returning empty results for "Everyone" groups, wrong membership after adding conditions, `DATASET_COUNT_EXCEEDED` errors, and crashes on date field interactions — in a sample of just 99 reviewed sessions. The error density in a small population suggests a systemic reliability problem, not edge cases.

### Performance budgets

- Membership preview for groups ≤1,000 members: **<2 seconds** to first render.
- Per-member explanation: **<500ms** from interaction to displayed result.
- Change diff: **<3 seconds** from edit to rendered diff.
- These are user-facing interaction budgets, not server-side targets. They include network latency and rendering. Server-side targets should be set at 60% of these budgets.

### Data privacy

- Membership explanations must respect the requesting user's data access permissions. An admin who cannot see salary data must not receive "excluded because salary < $100,000" as an explanation.
- The change log must be access-controlled: who can see group change history should follow the same permission model as who can edit the group.
- Preview and diff operations must not expose member data beyond what the requesting user is authorized to see.

### Platform contract

- The rule AST is the canonical representation. No consumer may bypass it to write rules in a form the AST cannot represent.
- Group provenance (owner, product domain, lifecycle intent) is required at creation for all new groups, including programmatically created ones. Consumer teams must adapt.
- The reference map (which consumers reference which groups) is maintained by the platform, not self-reported by consumers. Consumers register references through the API; the platform validates and tracks them.

### What we will not build

- A general-purpose query language for admins. RQL stays as the machine interface. The admin experience operates on constrained patterns.
- Percentage-based rollout for group membership. Unlike feature flags, partial access is often worse than no access. Change safety uses preview/staging/approval, not probabilistic deployment.
- Non-human identity support in the initial system. The data model must not preclude it (the `owner_type` field accepts types beyond `person`), but we will not design agent governance UX without internal demand signal.

---

## How to use this spec for prototype evaluation

### Parallel research stream

The research corpus is heavily weighted toward failure modes. Prototypes will be evaluated not just against confused newcomers but also against successful power users — which means we need their input. Alongside prototyping, interview 5–8 customers who actively use saved Supergroups (10+ saved groups) to understand their mental model, their workflow, and what they'd change. Findings from these interviews should inform the evaluation phase: a design that fixes confusion for newcomers but breaks the workflow of the only people who figured it out is a net loss.

This is a parallel stream, not a blocker. Prototyping proceeds immediately. Interview findings sharpen the evaluation criteria and may reweight the user segments.

### Evaluation rubric

Each prototype should be evaluated against the user requirements (UR-1 through UR-6) with this rubric:

| Criterion | What to evaluate |
|---|---|
| **Explainability** (UR-1) | Can a user look at a group and understand who's in it and why without assistance? |
| **Change confidence** (UR-2) | Does the user feel safe making a change? Do they understand the impact before committing? |
| **Progressive transparency** (UR-3) | Does the interface feel clean by default and informative when investigated? Does it avoid both opacity and overwhelm? |
| **Discoverability** (UR-4a) | Does the user find an existing group before creating a new one? Is reuse faster than creation? |
| **Deduplication signal** (UR-4b) | When a new group overlaps with an existing one, does the system surface it? Does the user act on it? |
| **Natural expression** (UR-5) | Can the user describe their intent without learning the system's rule syntax? |
| **Readability at rest** (UR-6) | Can someone who didn't create the group understand it? |

Additionally, evaluate each prototype on:

- **Performance perception:** Does the interface feel responsive, even before backend targets are met? (Skeleton states, optimistic updates, progressive loading)
- **Failure communication:** When something goes wrong (preview fails, rule is invalid, evaluation times out), does the system communicate clearly and suggest a next step?
- **Scale behavior:** Does the prototype's interaction model hold up at 5 members? 500? 5,000? 50,000?
