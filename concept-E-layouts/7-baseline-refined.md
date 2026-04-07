# Layout 7: Baseline Refined

## Concept

Keep the same three information sections — match count/exclusions, population member list, downstream impact — but render them as **one continuous card** with visual connectors instead of three separate boxed sections with gaps between them. This is the control group. It tests whether the "bolted on" feeling is caused by the information architecture or just by the visual separation between sections.

## Design hypothesis

The current layout uses three independent components, each with its own card styling, margins, and disclosure triggers. They don't *look* like they belong together. If you merge them into one unified card with subtle internal divisions (like a well-structured form card), the same information might feel cohesive rather than bolted-on. This variant tests whether visual continuity alone — without changing spatial arrangement, information hierarchy, or interaction model — fixes the problem.

## Visual specification

### At rest (the default state)

One card. Single background (white), single shadow (`S.card`), single border-radius (16px). Generous padding (20px). The three sections stack vertically within the card, separated by lightweight internal dividers rather than by being separate cards.

**Section 1: Match summary + exclusion indicator**

The top section within the card:
- Left-aligned: bold count "25 people" in 16px, 600 weight, `text` color
- Same line, right side: if exclusions exist, "2 excluded" as an amber clickable label with the same styling as the current `EvaluationLayersIndicator` summary line
- If the user clicks "2 excluded" or a "Details" link, the layer breakdown expands inline below this line, *within the card*. It pushes the subsequent sections down. When collapsed, the section is a single line.

Below section 1, a **subtle internal divider**: a 1px line in `border` color, with 12px vertical margin above and below. This line spans the full width of the card's content area (not edge-to-edge — respects the card padding).

**Section 2: Population**

The population preview, styled the same as the current `PopulationPreview` but without its own card/box styling:

- Count header: an avatar stack (5 overlapping avatars, 28px, -8px overlap) + "25 people" label + if > 20, a "+N" overflow circle
- Below: person rows (avatar, name, title · department · location)
- Each person row has a subtle hover state (background → `surfaceAlt`)
- Each person is clickable → explanation popover appears inline below the row
- When showing ≤ 20 people: show all, paginated at 8 per page
- When showing > 20 people: show first 5 with a "Show all N people" expandable link

This section has NO border, NO shadow, NO border-radius of its own. It's just content within the parent card.

Below section 2, another subtle internal divider (same 1px line).

**Section 3: Downstream impact**

The impact section, styled the same as the current `DownstreamImpact` but without its own card styling:

- Summary line: "Referenced by **3 policies** · 2,402 people affected" — bold on the policy count, `textSecondary` on the rest. Right side: "Details" link in `accent`.
- Clicking "Details" expands the per-policy list inline: each policy with sensitivity tier badge, name, domain, affected count.
- When collapsed: single line. When expanded: the policy list renders below, with the card growing to accommodate.

No border, no shadow. Just content within the parent card.

### Visual continuity details

The key to making this feel unified rather than stacked:

1. **One card, one shadow.** The three sections share a single card container. There's no visual gap between them — only subtle 1px internal dividers.

2. **Consistent padding.** All three sections use the same horizontal padding (20px). The left edges of all content align perfectly.

3. **Consistent typography.** The section "headers" (match count, avatar row header, impact summary) all use the same font size and weight treatment. They're not `<Section label="...">` wrappers with uppercase labels — they're content lines that happen to lead their sections.

4. **No section labels.** Do NOT add "Population" or "Downstream impact" as section headers. The content is self-describing. The current concept E uses `<Section label="Population">` wrappers — this variant removes those labels. The match count line leads naturally into the member list, which leads into the impact line.

5. **Internal dividers, not gaps.** The dividers are thin, muted, and inline — not the 12-16px gaps that currently separate the three card components. The visual rhythm is continuous.

### Comparison to current

What changes from the current concept-E rendering:

| Aspect | Current | This variant |
|--------|---------|-------------|
| Container | Three separate cards with gaps | One card with internal dividers |
| Section labels | "Population", etc. as uppercase headers | No labels — content is self-describing |
| Card styling per section | Each section has its own shadow/radius | Single outer shadow/radius |
| Vertical spacing between sections | 12-16px gaps between cards | 1px dividers with 12px margin |
| Interaction model | Each section has its own expand/collapse | Same disclosure model, but within one card |

What stays the same:
- The information in each section (match count, people list, policy list)
- The disclosure patterns (click to expand exclusions, click a person, click Details for policies)
- The pagination model for the member list
- The sensitivity tier badges on policies
- The explanation popover format

## Scale behavior

- **5 people:** The card is compact — three short sections within one card. The internal dividers are proportionally prominent at this scale. Consider reducing divider margin to 8px when the card is short.

- **25 people:** The core case. The card is a comfortable reading length. The first page of 8 people is visible, with pagination controls. The single-card treatment feels clean.

- **100 people:** The member list section dominates the card vertically. When paginated, only 8-10 people are visible per page. The card is tall but not unreasonably so. The impact footer stays anchored at the bottom.

- **500+ people:** The member list pagination and/or search becomes essential. The card can grow very tall when the member list is expanded. Consider adding a max-height on the member list portion (400px) with internal scrolling, so the impact footer remains visible without scrolling past 500 names.

## Inline behavior (compact = true, 480px width)

- Card padding reduces to 14px
- Avatar stack shows 3 avatars instead of 5
- Member list shows 5 per page instead of 8
- Person rows use compact layout (smaller avatars, no subtitle line)
- Impact summary shortens: "3 policies · 2,402 affected"
- Internal dividers use 8px margin instead of 12px
- The single-card treatment is especially valuable in compact mode — the three separate cards currently eat a lot of vertical space with their individual padding and margins

## Interaction model

| Action | Result |
|--------|--------|
| **View at rest** | One card: match count line → divider → population list → divider → impact line |
| **Click "2 excluded"** | Exclusion detail expands inline within the card, between section 1 and the divider |
| **Click a person** | Explanation popover below the person row |
| **Click "Show all"** | Member list expands within the card |
| **Click "Details" on impact** | Policy breakdown expands inline at the bottom of the card |

Identical to the current interaction model. Only the visual container changes.

## Accessibility notes

- The card should have `role="region"` with `aria-label="Population summary"`
- Internal dividers are `role="separator"` elements
- All existing accessibility attributes from the current `EvaluationLayersIndicator`, `PopulationPreview`, and `DownstreamImpact` components carry over unchanged
- The removal of section labels means the structure relies on content semantics — ensure the match count line, member list, and impact line are distinct enough for screen reader users to navigate

## What this layout tests

- Is the "bolted on" feeling caused by visual separation (three cards) or by information architecture (three separate concepts)?
- If visual continuity alone makes the area feel unified, the other 6 variants may be solving the wrong problem
- Does removing section labels make the content harder to scan, or is the content self-describing?
- This is the control group — it establishes the minimum intervention needed. If it scores well, the more ambitious variants need to beat it, not just match it.
