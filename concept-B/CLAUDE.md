# Prototype B — The People Bridge

## Core hypothesis

The conceptual gap between "I want these people" and "define a rule that matches them" is the root cause of every usability failure in the system. No amount of rule-builder improvement fixes it — because the user hasn't accepted the premise of rules. The fix is to start from the mental model users already have (people) and bridge them to the model the system needs (rules), rather than asking users to make the leap on their own.

This prototype bets that the right entry point for groups is **people, not rules**. It resolves the "users want manual control, but the system's value is automation" tension by treating manual selection as the on-ramp to dynamic rules — not as a failure mode to be eliminated.

## What this prototype explores

**Example-based group creation as the primary entry point.**

The user starts by picking people — selecting individuals, pasting names, uploading a list. The system analyzes the selection and proposes rules that would match those people dynamically. "These 12 people all share: Full-time, Engineering, United States. Want to create a rule that captures anyone matching those attributes?"

The user sees their specific people AND the generalized rule side by side. They can accept the rule (converting their static list to a dynamic group), modify it, or keep it as a static list. The system makes the bridge visible: "Your 12 people, plus 3 others who also match."

**Narrative explanation as the transparency model.**

Explanations are written in human language, not displayed as filter chips or tree structures. "Sarah Chen is in this group because she's a full-time employee in the Engineering department based in San Francisco." "Marcus Johnson is excluded because his role status is 'pending' — he hasn't completed onboarding."

Every member has a readable explanation. The system speaks in the same language the admin thinks in — people and their attributes, not boolean conditions.

**Before/after people lists for change safety.**

When editing a group, the system shows the change as two lists: people who will be added, and people who will be removed. Not counts — names and faces. The blast radius is expressed as a narrative: "Changing this condition will remove 47 people from the California Benefits policy. Here are the first 10 affected." The admin makes the decision based on people, not numbers.

**Browse-by-shape for reuse.**

Groups are browsable by their population shape: "Groups containing Engineering employees," "Groups based on US locations," "Groups targeting full-time workers." The admin navigates by recognizing the people they're looking for, not by remembering group names or reading rule definitions.

## Interaction paradigm

The interface is a **people-first flow with progressive rule revelation**.

1. **Start with people.** The entry point is always a people context: search for individuals, paste a list, or browse by organizational shape (department, location, team). The admin sees faces and names first.

2. **Bridge to rules.** Once the admin has identified people (explicitly or by browsing), the system proposes the underlying pattern. "These people share these attributes. A dynamic group using these conditions would capture them — and stay current as people join or leave." The rule is shown as a readable sentence, not a builder.

3. **Verify with people.** The preview is always people: who's in, who's out, who's new (people the rule captures that the admin didn't explicitly select). The admin verifies the rule by checking people, not by auditing conditions.

4. **Edit through people.** To modify a group, the admin can either edit the rule directly (constrained builder available but secondary) OR point to a person and say "why is this person here?" / "add people like this person" / "remove people like this person." The system translates people-level intent into rule-level changes.

## What this prototype should prove or disprove

1. **Can you close the conceptual gap by starting from people?** The research shows users arriving with a people-picker mental model and encountering a rule builder. This prototype tests whether starting from people and bridging to rules is more effective than starting from rules and making them readable (prototype A).

2. **Does example-based creation produce better rules?** When the system generalizes from examples ("these 12 people → this rule"), are the resulting rules more accurate to user intent than rules built from scratch in a structured builder? Or do users over-specify (selecting people who happen to share attributes they didn't intend to filter on)?

3. **Does narrative explanation scale?** "Sarah is in this group because..." works for 12 people. Does it work for 1,200? At what point does the admin need to shift from people-level to rule-level reasoning — and does this prototype handle that transition?

4. **Does the small-company generalist archetype actually prefer this?** The spec hypothesizes that small companies think in people. This prototype tests that directly. If small-company admins use the people entry point and mid-market admins skip straight to the rule builder, that's a segmentation finding.

## What this prototype should NOT do

- **No rule-builder-first entry.** The rule builder exists (for editing, for power users) but it is never the first thing the admin sees. The entry point is always people or organizational shapes. If the prototype defaults to the builder, it's not testing the hypothesis.
- **No AI or natural language input.** The system proposes rules by analyzing the selected people, not by interpreting a natural language description. The intelligence is pattern-matching on attributes, not language understanding. This keeps the bridge mechanism inspectable.
- **No impact maps or visual blast-radius diagrams.** Blast radius is expressed as people and narratives: who is affected, and what happens to them. Not as system diagrams or policy graphs — that's prototype D's territory.
- **No information-dense dashboard view.** The interface should feel approachable, not powerful. Whitespace is acceptable. If it looks like a spreadsheet, it's drifting toward prototype A.
- **No conversational UI.** The system proposes and explains, but it doesn't converse. There's no chat interface, no back-and-forth. Proposals are presented as structured suggestions the admin accepts, modifies, or rejects — that's prototype C's territory.

## Technical constraints

- The example-to-rule generalization engine must handle at least three common patterns: department-based, location-based, and employment-type-based grouping. It should identify the minimal set of shared attributes that describe the selected people.
- Narrative explanations must be generated from the evaluation engine's actual logic (the AST), not from a separate template. The words must reflect the real reason, not a plausible-sounding guess.
- The people preview must handle groups up to 5,000 members with pagination. For groups larger than that, the prototype should show a representative sample with a count, not attempt to list everyone.
- Must include one scenario where the example-based approach struggles: the admin selects people who don't share clean attribute patterns (e.g., a cross-functional project team with no common department or location). How does the system handle the gap between "these specific people" and "a rule that describes them"?
- Must include at least one inline component scenario (group selection within a policy builder).

## Evaluation focus

This prototype is the strongest test of **UR-5 (natural expression)** and the "manual control vs. automation" tension. If it works, it proves that the entry point matters more than the builder's design. If it fails, it proves that the people-to-rule bridge is harder than it looks — and that rule literacy may be unavoidable.

Evaluate primarily on:
- Does the small-company generalist complete the group creation flow? (Baseline: 59% creation completion in production)
- When the system proposes a rule from examples, does the admin understand and trust the generalization?
- Does the admin feel ownership of the resulting rule, or does it feel like something the system imposed?
- When the admin needs to edit a group later, can they work at the rule level — or are they stuck at the people level permanently?

---

## Build contract (do not modify)

- Your root component must be named ConceptB
- It must live at concept-B/index.tsx and be the default export
- It must accept one prop: `entryState: EntryState` (type defined in shell/types.ts — read it before building)
- It must start from the shared entry point defined in entryState
- Do not create your own dev server, package.json, or vite config — the unified shell handles all of that
- Do not import from other concept folders
- All state is local to your component tree unless explicitly shared via entryState
