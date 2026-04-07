# What the data actually says

A research synthesis across QPRs, stakeholder interviews, support signals, behavioral data, competitive analysis, and design explorations — oriented toward the greenfield question: if we were starting Supergroups from scratch, what would the evidence tell us to build?

---

## The headline finding

The Supergroups corpus tells two stories at once, and the team has been living in the tension between them for at least three quarters.

**Story one** is about a platform in crisis. P0 incidents, existential scaling risks, backdoor integrations, silent failures, and a dependency tracking system that one engineer described as a "ticking time bomb." This is the story that gets executive attention, drives emergency reprioritization, and dominates QPR narratives.

**Story two** is about a concept that never landed with users. Admins don't understand dynamic grouping. They think they need to manually select people. They can't tell what a group does, who's in it, or what happens when they change it. Less than 10% of customers create complex rules. 70% of all Supergroups have no type — they're nameless, unclassified objects floating in a system that has 30.7 million of them.

These two stories appear to be treated as separate problems — one for engineering, one for design. They are not. They share a root cause: **Supergroups has been a capability in search of a legible contract — both with the teams that build on it and the humans who operate it.** The platform's internal illegibility (no canonical interface, no enforced boundaries) and its external illegibility (users can't read it, can't predict it, can't trust it) are the same problem expressed at different layers of the stack.

A greenfield design that only addresses one side will reproduce the other.

---

## What users are actually struggling with

### The conceptual gap is deeper than "AND/OR is confusing"

The QPR support ticket analysis surfaces a consistent pattern: users believe they need to manually assemble group members by selecting individuals. They don't understand that groups can be defined dynamically using shared attributes like department, location, or employment type.

This is not a UI problem. It is a **mental model failure**. The system presents a rule builder, but users arrive expecting a people picker. The distance between what they expect and what they encounter is so large that no amount of UI polish on the rule builder will close it — because the user hasn't accepted the premise of rules in the first place.

The confidence synthesis document (Section 2) names this accurately: "The core issue is not lack of power. The core issue is lack of confidence." But I'd push further. Confidence is the *symptom*. The root cause is that the system's organizing metaphor — "define a group by describing its rules" — doesn't match how most admins think about groups. They think: "these 12 people." The system thinks: "anyone matching these conditions."

**What's missing from the data:** We have no direct user research on this conceptual gap. The support ticket analysis is secondhand. There are no interview transcripts, no recorded usability sessions, no diary studies. The team is inferring user mental models from support signals, which biases toward users who are already confused enough to file tickets. We don't know what the silent majority is doing — are they muddling through, working around the system, or simply not using it?

**Confidence level:** High that the gap exists. Medium on its depth and distribution. We're reasoning from a biased sample.

### Role states are a hidden failure mode

The Q3 QPR flags "significant confusion around why certain individuals do or do not appear when assigning policies or reviewing groups." Role state filters (active, pending, terminated) are not visibly surfaced or explained.

This is particularly insidious because role states are a *platform concern* that leaks into the *user experience*. An admin building a group for "all engineers in California" doesn't think about role states at all. But the system does — and it silently filters people based on state, producing results the admin can't explain. The Q3 QPR links to an actual customer ticket where someone was angry about this.

The membership drawer concept (confidence synthesis, Section 8) is designed to address this: "Why did the system arrive at this result?" But the drawer is positioned as an optional, progressive-disclosure diagnostic tool. The role state problem suggests something stronger is needed: the system should *proactively surface when invisible filters are affecting the result*, not wait for the user to go looking.

**Confidence level:** High. This is directly observed in support signals and internally acknowledged.

### Provisioning groups and parent constraints are invisible layers

The Q3 QPR notes: "Users are often unaware that a provisioning group may be applied under the hood." The parent constraint indicator guideline confirms this is a known gap — one important enough that a formal pattern was designed for consumer teams to surface these constraints.

But look at what the guideline actually says: the SG platform team is *not* building this into the component in Q1–Q3 2026. Consumer teams are expected to roll their own indicator. The guideline itself is meticulously crafted — thoughtful about affordances, copy principles, and visual hierarchy — but the fact that it exists as a *workaround pattern* tells you something about platform priorities. The membership drawer will eventually absorb this, but "eventually" is doing a lot of work.

**The broader pattern:** Supergroups has multiple invisible evaluation layers (scope, role states, provisioning groups, parent constraints, temporal evaluation) that the user can't see, can't understand, and can't predict. Each one was added to solve a real problem. None of them were surfaced in the UI when they were added. The result is a system where the gap between "what the user built" and "what the system does" grows with every feature.

---

## What the platform signals reveal

### The interface crisis is both technical and conceptual

Jeff's QPR commentary is unusually blunt: "The health of the Supergroups and Dependency Tracking team and system are not green." The Q2 direction one-pager names the stakes: "We're paying for ambiguity with incidents, unsafe usage patterns, and reactive toil."

The interface problem has two dimensions:

1. **No canonical interface exists.** Teams interact with Supergroups through "brittle, inconsistent functions or directly with internals." Ryan S. confirms: "No way to find, create, edit supergroups or change rules/conditions" via API. The public API is limited to role retrieval by ID.

2. **The UI-API contract is itself incoherent.** Ryan S. describes a fundamental mismatch: "UI treats inclusion rules/lists and exclusion rules/lists as 2 things, not 4." This means arbitrary RQL sent via API won't render properly in the UI. The UI and the engine disagree about the shape of the data.

For a greenfield design, this second point is the more important one. The first is a matter of building an API. The second is a design flaw in how the system represents rules — the UI's abstraction is lossy. Any new design would need to decide: does the UI represent the full rule tree faithfully, or does it continue to simplify? If it simplifies, where does the truth live, and how does the user access it?

### Saved Supergroups are the reuse mechanism that nobody uses

The metrics are stark:

- 30.7M Supergroups exist in the system
- 148K are saved groups
- That's 0.5% reuse

Ryan S. calls this out: "Each saved group = one fewer refresh needed." Jeff frames it as a cost optimization opportunity. But the product adoption data from Q3 QPR tells a more specific story: 1,400 customers have at least one saved Supergroup, and only 551 have more than one.

This means saved Supergroups aren't failing at scale — they're failing at the concept level. Customers create one, perhaps during onboarding, and then never create another. The system makes it easier to create a new inline group every time than to find and reuse an existing one.

Ryan S. names the historical reason: "Experience built before saved groups existed." The inline group creation flow predates the saved group feature, and the UX still defaults to creation rather than selection.

**What this means for greenfield:** A from-scratch design would likely invert this — make reuse the default path and creation the exception. The data suggests the current UX *trains* users to create disposable groups. At 30.7 million groups and accelerating, this is a design decision with direct infrastructure cost.

### The 70% untyped problem is a data governance failure

70% of all Supergroups have no `GROUP_TYPE`. The metrics doc frames this as a "transparency gap." It's worse than that — it's a data governance failure that compounds every other problem.

Without types, you can't classify groups. You can't tell admins what a group is for. You can't segment for migration. You can't build intelligent defaults. You can't clean up. The system is accumulating undifferentiated objects at a rate of millions per month, and it has no metadata to reason about them.

The proposed fix (require GROUP_TYPE at creation time, targeting 0% untyped on new creates) is necessary but insufficient. It addresses the *inflow* problem but not the 21.4 million existing untyped groups. And it assumes consumer teams will provide meaningful types — but the top types in the data (`WORKFLOW_AUTOMATOR_TEMP_UTILITY`, `DEFAULT_GROUP`) suggest that even typed groups may not carry useful semantic information.

---

## What the organizational signals reveal

### The team has been in reactive mode for at least four quarters

Reading the QPRs in sequence (Q3 2025 → Q4 2025 → Q1 2026) reveals a consistent pattern:

- **Q3 2025:** "Our progress was challenged by both cross-team dependencies and urgent re-prioritizations." Supergroup redesign deprioritized. DT "chronically underfunded."
- **Q4 2025:** "Once again de-prioritize core Supergroups initiatives — including the redesign, DT reliability, and defining supergroups interfaces — to accommodate critical cross-functional asks."
- **Q1 2026:** Q1 is "foundational work." The redesign appears as a 20-week initiative on the Q1 plan but the confidence synthesis reframes it as not-a-redesign.

The Q2 direction one-pager attempts to break this cycle: "We won't accept unbounded interrupts that displace the platform agenda without explicit tradeoffs." But the organizational dynamics are strong. Supergroups is consumed by every product team, which means every product team has P0 asks. The team's centrality makes it perpetually interruptible.

**For greenfield thinking, this matters because:** Any redesigned system would need to be architecturally resistant to this dynamic — not just organizationally. A system with a clean interface contract, enforced boundaries, and self-service capabilities would reduce the *surface area for interruption*, not just the willingness to accept it.

### Design has been structurally under-resourced

The resourcing trajectory:

- **Q3 2025:** 0.25 designer allocation, shared across multiple teams
- **Q4 2025:** 0.25 designer, with QPR noting "execution velocity constrained by insufficient design resourcing"
- **Q1 2026:** Dedicated designer (Paul), but joining a system with deep legacy debt and no prior design continuity

Jeff's Q1 commentary names it directly: "Execution velocity constrained by insufficient design resourcing. Single designer shared across three platform teams led to late-stage design changes."

This isn't just a capacity problem — it's a quality problem. The work that *has* been done (confidence synthesis, parent constraint guideline, containment analysis) is remarkably thorough and well-reasoned. But it's all *analysis and guidelines*, not shipped product. The team has had enough design capacity to understand the problems clearly but not enough to solve them.

### AI is being positioned as the conceptual gap closer

The AI strategy appears across multiple QPRs and the Q2 direction doc. The pitch: users who can't build rules can describe their intent in natural language, and the AI translates.

This is a reasonable short-term play. But it carries a risk the data doesn't surface: **AI as a bridge can become AI as a crutch.** If the underlying system remains illegible, the AI becomes a permanent translation layer between the user and the system. The user never builds a mental model of Supergroups; they just talk to the AI. This works until:

- The AI makes a mistake and the user can't verify it
- The user needs to debug or modify an AI-created group
- The user needs to understand a group someone else created (without AI)

The confidence synthesis (Section 4) proposes a better foundation: "Filters + Options" as a human-readable framing of the boolean logic. This is the kind of structural legibility that would make AI *additive* rather than *essential*. But Filters + Options is a UI redesign, and the redesign keeps getting pushed.

---

## What's contradictory in the evidence

### The system is both over-powerful and under-capable

RQL can express almost anything — Ryan S. confirms Supergroups is responsible for "90-95% of all RQL usage (billions/month)." Yet less than 10% of customers create complex rules. The system's power is almost entirely consumed by *other systems*, not by the humans it's supposed to serve.

Meanwhile, users are filing support tickets asking how to create a group for "all full-time employees in the US" — a query the system can trivially express. The power exists; the access doesn't.

This is a classic platform paradox: the system was built for expressiveness, but it's consumed for simplicity. A greenfield design would need to decide which master it serves. The evidence suggests the answer is both — but through different interfaces. The rule engine should remain expressive (for programmatic consumers). The human interface should be opinionated about common patterns (for admins). These are not the same surface.

### Confidence says "not a redesign" but the evidence says "needs one"

The confidence synthesis document is explicitly framed as "maturity work, not reinvention." It's careful to say: "Does not change the Supergroups engine. Does not remove expressiveness. Does not require migrations."

But the evidence points in a harder direction:

- 70% untyped groups (governance failure)
- 0.5% saved group reuse (UX failure)
- Users don't understand dynamic grouping (conceptual failure)
- UI-API contract mismatch (structural failure)
- Multiple invisible evaluation layers (transparency failure)

These are not maturity gaps. They are *design debts* that accumulated because the system was built capability-first, legibility-second. The confidence framing makes sense as an organizational strategy (avoiding stakeholder anxiety around "redesign"), but it may understate what's actually needed.

### Users want manual control, but the system's value is automation

The Q3 QPR surfaces a common feature request: "ability to add individuals manually or in bulk, outside of dynamic or saved group logic." Users want CSV uploads and direct selection.

This directly contradicts the system's value proposition. If users are asking to manually manage group membership, they've either rejected the dynamic model or never understood it. But manual management at Rippling's scale (companies with 50,000 employees) is operationally unsustainable — which is why Supergroups exists.

The tension is real: the *correct* behavior for the system (dynamic rules) is not what users *want* (manual control). No amount of UI improvement resolves this if users fundamentally don't trust dynamic evaluation. The trust problem has to be solved first — likely through transparency (show me exactly what the system is doing) before automation (let the system do it for you).

---

## What's missing from the corpus

1. **Direct user research.** No interview transcripts, usability session recordings, or diary studies appear in the corpus. Everything about user behavior is inferred from support tickets, stakeholder interpretation, or product analytics. This is a significant gap for a system touching 20,000+ companies.

2. **Consumer team research.** The stakeholder chats (Darshil, Jeff, Ryan S.) provide internal engineering perspectives. But the *product teams* consuming Supergroups — payroll, benefits, IT, compliance — are represented only through their escalations. We don't know what their ideal integration looks like, what they've had to work around, or what capabilities they wish they had.

3. **Segmentation by company size.** The data treats all companies as one population. But the QPR notes that largest customers experience P99 latency of 22s vs. 14s for others. The experience of Supergroups at 50 employees and 50,000 employees is likely fundamentally different. We don't know how.

4. **Competitive analysis of the *core* experience.** The competitive analysis covers async job outcomes (Workday, Gusto, Salesforce, etc.) — a specific feature area. There's no competitive analysis of how other platforms handle the *core* problem: rule-based employee grouping. How does Workday's Organization Builder compare? Gusto's team management? BambooHR's custom grouping? This is a significant blind spot for greenfield thinking.

5. **Downstream impact data.** When a Supergroup is wrong — membership is incorrect, a rule misfires, a scheduled change fails silently — what happens downstream? We know the blast radius is "enormous" (README) but we don't have data on *which* downstream consequences are most frequent, most costly, or most trust-destroying.

6. **Success cases.** The corpus is heavily weighted toward problems. But 11,400 customers have at least one saved Supergroup, and the system handles billions of RQL evaluations per month. What are the customers who *do* use it well doing differently? What patterns work?

---

## Five tensions a greenfield design must hold

These aren't problems to solve. They're design forces that any new system would need to navigate deliberately.

**1. Rule engine vs. people picker.** Users think in people. The system thinks in rules. The interface must bridge this gap without pretending it doesn't exist — which means the system needs to be fluent in both modes and know when to switch.

**2. Reuse vs. creation.** The economics of the platform (compute cost, refresh load, consistency) favor reuse. The current UX favors creation. A new design would need to make reuse the path of least resistance — which is a UX challenge, not a feature request.

**3. Transparency vs. overwhelm.** The system has multiple invisible evaluation layers (scope, role states, provisioning groups, parent constraints, temporal evaluation). Surfacing all of them simultaneously would overwhelm users. Not surfacing them erodes trust. The design needs progressive disclosure that earns confidence incrementally, not a debug panel that dumps everything.

**4. Platform rigidity vs. consumer flexibility.** Internal consumers need Supergroups to be a stable, predictable component with a strict contract. But they also need it to adapt to wildly different contexts (payroll targeting vs. survey distribution vs. access control). The platform contract must be rigid in the right places and flexible in the right places — and those places aren't obvious.

**5. Legibility at rest vs. power in action.** The confidence synthesis nails this framing. A group definition needs to be readable by someone who didn't create it — which means it needs to be self-describing, not just editable. Most of today's 30.7 million groups are opaque objects that only the system understands.

---

## Where I'd direct the next round of inquiry

If this were a real research program, I'd prioritize three moves:

**First: Talk to users who succeed.** Find the customers who actively use saved Supergroups, who create complex rules, who manage groups across entities. Understand what they figured out that others didn't. This is likely where the product's actual value proposition lives — in the patterns that work, not just the ones that break.

**Second: Map the downstream blast radius.** When a group is wrong, trace what happens. Pick 5-10 real incidents and follow the chain: what was the group used for? Who was affected? What was the business impact? How long until someone noticed? This would give the team a concrete vocabulary for risk that goes beyond "blast radius is enormous."

**Third: Do the competitive analysis on the core experience.** How do other workforce platforms handle rule-based grouping? Not the scheduling piece, not the async piece — the fundamental "define who this applies to" interaction. The team is solving this problem in a vacuum right now.
