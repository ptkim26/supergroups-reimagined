# Prototype D — The Policy Control Plane

## Core hypothesis

The frame is wrong. The system's usability problems are not about how you define a group — they're about what the group does and who's accountable for it. Admins don't wake up thinking "I need to manage group membership." They think "I need to make sure the right people are on the California payroll" or "I need to know who has access to our financial systems." Groups are invisible infrastructure between intent and consequence. Making the infrastructure more legible is necessary but insufficient — the organizing frame should be **what the group controls**, not who it contains.

This prototype bets that **groups are policy audiences, not people lists**. It resolves the "group-as-list vs. group-as-policy-audience" tension by going fully toward the policy-audience model and testing whether admins can think in terms of consequences rather than membership.

## What this prototype explores

**Impact-first navigation as the primary organizing frame.**

The entry point is not "your groups." It's "your policies and what they affect." The admin sees a map of their policies, apps, workflows, and integrations — with the groups that target each one visible as the connecting layer. A group is always shown in context: "US Full-Time Employees → used by: California Benefits, US Payroll, Okta SSO provisioning."

Navigating to a group from this context means the admin always arrives with downstream awareness. They never see a group in isolation — they see it connected to what it does.

**Ambient impact indicators as the transparency model.**

Every group always displays what it controls: a compact list of downstream consumers (policies, apps, workflows) with affected member counts. This is not a drill-down or a panel — it's the default state of every group view. The group definition (rules, membership) is secondary to the group's impact.

Evaluation layers (role states, scope, provisioning groups, parent constraints) are surfaced as "policy constraints" — reframed from hidden system filters to visible governance controls. "This group is constrained by the Benefits Eligibility policy, which requires active role status. 3 people are excluded by this constraint." The constraint belongs to the policy, not to the group engine.

**Impact maps for blast-radius visualization.**

When editing a group, the change preview is an impact map: a visual representation of which downstream systems are affected, how many people are affected in each, and what the membership delta looks like in each policy context. Not a before/after people list — a system-level view of consequences.

The map answers: "If I change this group, which policies change? How many people in each? Which policies are high-sensitivity (payroll, compliance) vs. low-sensitivity (chat channels, LMS courses)?" The sensitivity tier is a first-class visual element.

**Policy-driven templates for reuse and creation.**

Instead of "create a group," the entry point is "I need a targeting audience for [policy type]." The system presents templates shaped by policy requirements: "Benefits policies typically target by employment type + location. Here are your existing groups that fit this shape." If no existing group fits, the template pre-fills the common conditions and the admin customizes.

Reuse is structural: "The US Payroll policy and the California Benefits policy both use 'US Full-Time Employees.' Changing it affects both." The admin sees the shared audience before deciding whether to reuse or fork.

**Explicit staging with sensitivity tiers for change safety.**

All groups have a sensitivity tier, derived from their downstream consumers:
- **Tier 1 (critical):** References payroll, compliance, or access control policies. Changes require staging + explicit approval.
- **Tier 2 (standard):** References benefits, integration assignments, or workflow automations. Changes show a diff and require confirmation.
- **Tier 3 (low):** References chat channels, LMS courses, surveys. Changes apply with a confirmation diff.

Sensitivity is derived from the reference map, not manually assigned. The system knows what the group controls and gates changes proportionally.

## Interaction paradigm

The interface is a **connected policy graph with groups as the targeting layer**.

- **Home view: the policy map.** A structured overview of the admin's policies, apps, and workflows — grouped by domain (payroll, benefits, IT, compliance). Each item shows its targeting group and a member count. This is the primary navigation.
- **Group view: always in context.** Clicking a group from the policy map opens it with its downstream connections visible. The rule definition and membership preview are present but secondary to the impact summary. The admin sees "what this group does" before "who this group contains."
- **Edit view: impact-first diff.** Editing a group shows the impact map alongside the rule builder. Changes to the rule instantly update the impact map, showing the membership delta per downstream consumer. The sensitivity tier determines the confirmation/staging flow.
- **Creation flow: policy-driven.** Creating a new group starts from a policy context: "What is this group for?" The system suggests templates and existing groups based on the policy domain. The admin customizes from there.

## What this prototype should prove or disprove

1. **Is downstream impact the right organizing frame?** The spec identifies "know what a group controls" as an inferred need with strong external signal but no confirmed internal demand. This prototype tests whether admins think in terms of policy consequences — or whether membership (who's in the group) is genuinely the primary concern, and impact is secondary.

2. **Do sensitivity tiers feel proportional or bureaucratic?** Automatically gating changes by downstream sensitivity is the most opinionated change safety model. Does staging for Tier 1 groups feel protective or obstructive? Do Tier 3 groups feel appropriately lightweight? Where does the system over- or under-gate?

3. **Does policy-driven creation reduce group sprawl?** If the entry point is "what policy needs a targeting audience" rather than "build a group," do admins create fewer redundant groups? Does the template-driven approach naturally surface reuse opportunities?

4. **Does the impact map communicate blast radius better than numbers or narratives?** Compared to prototype A's compact reference bar, prototype B's narrative, and prototype C's conversational narration — does a visual map of affected systems help the admin make better decisions? Or is it noise?

5. **Does this frame work for the small-company generalist?** A 50-person company might have 3 policies and 2 groups. The policy graph is trivial. Does this frame add overhead for simple cases — or does it still clarify the relationship between groups and their effects?

## What this prototype should NOT do

- **No people-first entry point.** The entry point is always policies or downstream consumers, never a people picker or search. The admin arrives at groups through what they affect, not through who they contain. That's prototype B's territory.
- **No conversational interface.** No chat, no natural language input. The rule builder uses the constrained Filters + Options format. The policy context and impact visualization do the conceptual work — AI is not needed. That's prototype C's territory.
- **No ambient "everything visible" information density.** The interface uses the policy map as the primary navigation and reveals group details in context — not a dense single-screen workspace. Visual hierarchy guides attention through the policy-to-group-to-membership path. That's prototype A's territory.
- **No narrative member explanations.** Member explanations use structured format (which conditions matched, which evaluation layers applied), not natural language sentences. The narrative energy in this prototype is spent on impact communication, not membership explanation. That's prototype B's territory.
- **No example-based or people-browsing reuse.** Reuse is discovered through policy context and templates, not through browsing people or membership shapes.

## Technical constraints

- The policy map requires the consumer reference map data. For prototyping, this can be mocked — but the mock data must include at least 3 sensitivity tiers, at least 2 groups shared across multiple policies, and at least 1 group with no downstream consumers (orphaned).
- The impact map must update in response to rule changes within 3 seconds (per spec performance targets for change diff).
- Sensitivity tiers must be derived from the mock reference data, not manually assigned. The system must demonstrate automatic tier calculation: a group referenced by a payroll policy is automatically Tier 1.
- Must include one scenario where the admin wants to change a Tier 1 group — the staging/approval flow must be concrete, not a stub.
- Must include one scenario where the admin encounters a group from the standalone Supergroups app (not from a policy context) — to test whether the impact-first frame holds when the admin arrives at a group directly rather than through the policy map.
- Must include at least one inline component scenario (group selection within a policy builder — this prototype should show the policy context carrying through into the inline selector).

## Evaluation focus

This prototype is the strongest test of **UR-2 (change safety)**, **UR-6 (provenance)**, and the "group-as-list vs. group-as-policy-audience" tension. If it works, it proves that the governance and impact frame is what admins were missing. If it fails, it proves that admins think in membership, not consequences — and that the other prototypes' people-centric or rule-centric frames are closer to how the work actually happens.

Evaluate primarily on:
- Does the enterprise IT admin navigate more efficiently through the policy map than through a group list?
- When making a change to a shared group, does the impact map help the admin make a better decision than a member diff alone?
- Do sensitivity tiers match the admin's intuition about which changes are risky?
- Does the mid-market admin understand the policy frame, or do they want to "just find the group"?
- Does policy-driven creation lead to higher reuse rates in task-based testing?

---

## Build contract (do not modify)

- Your root component must be named ConceptD
- It must live at concept-D/index.tsx and be the default export
- It must accept one prop: `entryState: EntryState` (type defined in shell/types.ts — read it before building)
- It must start from the shared entry point defined in entryState
- Do not create your own dev server, package.json, or vite config — the unified shell handles all of that
- Do not import from other concept folders
- All state is local to your component tree unless explicitly shared via entryState
