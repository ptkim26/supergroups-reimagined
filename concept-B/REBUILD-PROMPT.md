# Concept B rebuild prompt

Paste this as the opening message in a new Claude Code chat.

---

Go into `prototype/concept-B`. Read all of these files first, in full, before doing anything:

1. `CLAUDE.md` — the hypothesis and build contract
2. `spec.md` — the full technical specification
3. `research-synthesis.md` — the research findings the hypothesis is derived from
4. `../shell/types.ts` — the shared type contract (EntryState, Person, SavedGroup, etc.)
5. `../shell/mockData.ts` — the current mock dataset
6. `REBUILD-PROMPT.md` — this file, which contains the detailed design direction

Then **replace `index.tsx` entirely** with a rebuilt implementation. Follow the build contract in CLAUDE.md exactly: default export named `ConceptB`, accepts `{ entryState: EntryState }`, no dev server/package.json/vite config.

---

## Why we're rebuilding

The first implementation drifted from the hypothesis. It built a creation wizard that produces a saved group as an artifact — pick people → see proposed rule → name it → save it. That's a workflow for creating group *objects*. The hypothesis is about a paradigm shift in how admins relate to populations of people.

The core problem: every flow started with "I want to create/view/edit a saved group." That's the current system's mental model with nicer entry points. The hypothesis says the frame should be "I want to describe a population of people." The group is infrastructure. The population is what the admin actually cares about.

Three specific failures in the first version:

1. **The inline flow was a group picker, not a population describer.** The spec says 220 sessions/month visit standalone SG pages vs. thousands of inline encounters. The inline context is the primary context. The first version treated it as a dropdown of saved groups. It needs to start with "who should this apply to?" not "which group do you want?"

2. **The temporal dimension was absent.** The entire value proposition of dynamic rules over static lists is temporal — rules stay current, lists rot. The first version never demonstrated this. The bridge step proposed a rule but never showed what that rule would have done over time: "This rule would have automatically added 2 people when they joined Engineering last month." Without that proof, there's no reason for a skeptical admin to trust dynamic over manual.

3. **The mock dataset was too thin.** 15 people means every list fits on screen, every pattern is clean, and the people-first model never hits its ceiling. The research synthesis specifically asks: at what scale does narrative explanation break down? The prototype needs to surface that tension, not avoid it.

---

## Design direction for the rebuild

### The organizing principle

**The population is the primary object, not the group.** A group is a saved handle for a population description. The admin thinks "full-time engineers in the US" — that's a population. Whether it's saved as a named group, used inline in a policy, or referenced by three downstream consumers is secondary. Every flow should start from "who" and arrive at "rule" as a natural consequence, not as a form to fill out.

### The four flows, rebuilt

**1. Inline flow (the centerpiece, not the afterthought)**

This is the most important flow because it's where most admins actually encounter groups — inside a policy builder, a benefits assignment, an IT provisioning flow.

Entry: The admin is in a policy builder. They need to target a population. The component opens with "Who should this apply to?" — not a list of saved groups.

The admin can:
- **Type an attribute phrase** ("full-time in California", "Engineering department") and see the matching population materialize in real time. The system parses these into rule conditions visibly.
- **Search for a person by name** to seed the selection, then generalize ("Sarah Chen → people like Sarah → full-time, Engineering, San Francisco").
- **Browse existing populations** (the saved groups, presented by their population shape, not by group name). If a matching population already exists, the system surfaces it: "A group called 'US Full-Time Employees' already covers this population."

The result: the admin has described a population. If it matches a saved group, that group is selected. If it's new, the system offers to save it. The admin never has to think in terms of "groups" unless they choose to.

Keep this compact — it lives inside a modal or drawer in a host product.

**2. Standalone create: the population canvas**

Not a wizard. A single live surface.

Left/primary area: a text input + attribute chips that build up a population description. As the admin adds conditions (by typing, by selecting from suggestions, or by clicking a person and saying "people like this"), the matching population appears immediately below — faces, names, counts.

The living-population proof: once a rule exists, show a "Recent changes" section: "If this rule had been active for the last 30 days: 2 people would have been added (hired into Engineering), 1 would have been removed (transferred to Sales)." Use the mock data's start dates and department info to simulate this. This is the moment the admin sees why dynamic beats static. Make it feel real.

The bridge moment: if the admin started by selecting specific people, show the generalization as before — "These people all share X. A rule using these conditions would capture them and stay current." But now it's embedded in the canvas, not a separate wizard step. The admin can toggle attributes on/off and watch the population update.

The "no clean pattern" case: if selected people don't share attributes, be honest. Show what partial patterns exist ("8 of your 12 people are in Engineering — want to start with that and add the others manually?"). The cross-functional project team is a real use case, not an error state.

Scale behavior: when the population exceeds ~20 people, the interface should shift from showing every face to showing a summary with sample members and a count. The "Why?" explanation per person still works but you access it by clicking into the member, not by scanning a full list. This transition should feel natural, not jarring.

**3. View: a population snapshot, not a detail page**

When viewing an existing group, lead with the people. Not metadata, not rule definition.

- **First thing visible:** the population — who's in this group right now, shown as people with faces and names (paginated if large), with a readable sentence describing the rule underneath.
- **Second thing visible:** recent population changes — "Since last month: +2 added, -1 removed" with names and narrative reasons. This makes the living-population concept concrete even at rest.
- **Third thing visible:** downstream impact — which policies reference this population, how many people are affected through each.
- **Deep info (expandable):** provenance metadata, evaluation layers, full rule definition. Important for governance, but not the lead.

Every person in the list has a "Why?" button that produces a narrative explanation derived from the AST, same as before. The explanation engine from the first version (`explainPersonMembership`, `ruleToSentence`) should carry over — that code was solid.

Evaluation layers (role state, scope, provisioning groups) surface as an ambient indicator: "3 people excluded by system filters" — expandable, never hidden, but not dominating the view.

For legacy groups (no name, no owner, `isLegacy: true`): show the population and rule, with a banner that this group lacks metadata. Don't hide them or treat them as broken — they represent the reality of a system with 53M untyped groups.

**4. Edit: population-level questions, rule-level answers**

Entry point: the population list. The admin's mental model for editing is "who's missing?" and "who shouldn't be here?" — not "which condition do I change?"

Primary affordances on each person:
- **"Why?"** — narrative explanation (carry over from v1)
- **"Shouldn't be here"** — the admin flags a person as incorrectly included. The system identifies which rule condition matched them and offers to modify it: "Sarah is here because department is Engineering. Remove all Engineering employees, or just Sarah?" This is the hard translation problem. Don't fake it with a crude `is_not` flip. Show the admin the options and let them choose.
- **"Who's missing?"** — a search for people NOT in the group. The admin finds someone, clicks "should be here", and the system explains why they're excluded and offers to adjust: "Marcus isn't here because his role status is pending. Want to include pending employees?"

Below the member list: the before/after diff, showing who will be added/removed with narrative reasons for each person. The blast radius warning with downstream policy impact stays as-is from v1 — that was correct.

The rule editor exists as a collapsible secondary panel for power users. It is never the entry point.

### Mock data expansion

The current dataset has 15 people. Expand it to **at least 40 people** to stress the scale question. Requirements:

- Multiple departments (Engineering, Sales, Finance, HR, Marketing, Operations, Legal — at least 7)
- Multiple locations (San Francisco, New York, Austin, London, Toronto, Berlin — at least 6)  
- Mix of employment types, with at least 5 contractors and 3 part-timers
- At least 3 pending and 2 terminated role states
- Start dates spread across 2023-2026 so the "recent changes" simulation has material
- At least 2 people who recently "joined" (start date within last 30 days) to show in the living-population proof

Add this to the mock data **within concept-B/index.tsx** as a local extension of the shared mock data. Do NOT modify `../shell/mockData.ts`. Import the shared types but create local people/groups:

```typescript
// Extend the shared mock data with additional people for scale testing
const localPeople: Person[] = [...entryState.data.people, ...additionalPeople];
```

Add at least one saved group with 25+ members to test whether the view/edit flows hold up at moderate scale.

### What to carry over from v1

These pieces were solid and should be preserved or adapted:

- `evaluateRule()` — the AST evaluation engine
- `getMembersForRule()` — membership derivation from rule + layers  
- `ruleToSentence()` — human-readable rule rendering
- `explainPersonMembership()` — narrative per-person explanation from AST
- `findSharedAttributes()` — shared attribute detection for the bridge
- The color/token system (`C` object)
- The `Avatar` component
- The removable attribute chips in the bridge (now embedded in the canvas, not a wizard step)
- The before/after diff structure in edit, with narrative reasons per person
- The blast radius warning with sensitivity tiers
- The deduplication detection (similar existing groups)

### What to discard

- The wizard-step flow model (`pick-people` → `bridge` → `verify`)
- The view flow's metadata-first layout
- The browse flow's current design (replace with population-shape navigation)
- The inline-select flow entirely (rebuild as population describer)
- The `handleRemoveLike` crude `is_not` flip (replace with explicit options)

### Technical constraints (same as CLAUDE.md)

- Component named `ConceptB`, default export from `concept-B/index.tsx`
- Accepts `{ entryState: EntryState }` as only prop
- Starts from the shared entry point defined in `entryState.scenario`
- No dev server, package.json, or vite config
- No imports from other concept folders
- All state local to the component tree
- Must handle all four scenario types: `create`, `view`, `edit`, `inline-select`
- Must handle both `standalone` and `inline` interaction contexts
- Must include the legacy group scenario (`sg-legacy` in mock data)
- Must include at least one inline component scenario

### Quality bar

This is going in front of users for concept testing. The quality bar is:

- Interactions feel responsive and intentional, not like a form
- The population-first mental model is felt, not just described in copy
- Narrative explanations sound like a colleague explaining, not a system reporting
- The living-population proof (recent changes simulation) is visually prominent and emotionally convincing — this is the moment the admin goes "oh, that's why I'd want a rule instead of a list"
- The scale transition (few people → many people) feels natural
- The inline flow is compact enough to live in a 480px-wide drawer and still feel complete

### Do a design review before finishing

After building, pause and evaluate against three standards:

1. **Hypothesis fidelity** — is the population the primary object in every flow, or has the group-as-object crept back in?
2. **The moment** — does the living-population proof actually land? Would a skeptical admin look at it and understand why dynamic matters?
3. **Inline primacy** — is the inline flow good enough to be the centerpiece of a user test, or does it still feel like a sidebar?

If any of these fail, fix before declaring done.
