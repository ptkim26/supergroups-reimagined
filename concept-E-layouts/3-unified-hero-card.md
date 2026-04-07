# Layout 3: Unified Hero Card

## Concept

Merge the match count, population preview, exclusion indicator, and downstream impact into **one single card**. Not three sections inside a card — one designed artifact where the count is the headline, the composition is the subhead, the people are the body, and the impact is the footer. The card is a portrait of this population.

## Design hypothesis

The "bolted on" feeling comes from three independent components that don't know about each other visually. If they're composed as one unified card with intentional typographic hierarchy, the whole below-conditions area becomes a single object that reads like a magazine spread — beautiful when you glance at it, informative when you study it.

## Visual specification

### At rest (the default state)

One card with generous padding (24px), a clean card shadow, and 16px border-radius. White background. Inside:

**Hero number (top center)**
- The member count rendered large and bold: "25" at 48px, font-weight 800, `text` color, centered
- Immediately below: "people" in 14px, font-weight 400, `textSecondary`, centered
- If there are exclusions: a subtle line below "people" — "2 excluded by system filters" in 13px amber text, centered. This is a clickable link that toggles the exclusion detail (see interactions below).
- Generous whitespace below: 20px margin-bottom

**Composition pills (below the number)**
- A centered, wrapping row of small pills showing the population breakdown by the most relevant dimension (department by default)
- Each pill: `surfaceAlt` background, 1px `border` border, rounded-full, 12px font, 500 weight
- Format: "Engineering 8" · "Sales 6" · "Finance 4" · etc.
- If there are more than 5 distinct values, show the top 4 and a "+ 3 more" pill in `textMuted`
- The pills are not interactive — they're informational. They communicate the population shape in the same space a subtitle would occupy.
- 16px margin-bottom

**Avatar row (below pills)**
- A centered row of 5-7 overlapping avatars (32px each, -10px overlap)
- If total > 7, a "+18" overflow circle at the end
- Below the avatars: a centered link in `accent` color, 13px: "Show all 25 people"
- Clicking the link or any avatar opens the full member list (see interactions)
- 16px margin-bottom

**Divider**
- A thin horizontal line (1px, `border` color) spanning the card width minus padding
- 16px margin top and bottom

**Impact footer (bottom)**
- If there are downstream policies: a single line showing the impact
- Left-aligned: a small icon or indicator dot in the highest sensitivity tier's color
- Text: "Feeds into **3 policies** affecting **2,402 people**" — the bold segments are `text` color, the rest is `textSecondary`, 14px
- This line is clickable — clicking expands the per-policy breakdown inline

If there are no downstream policies, the divider and footer are omitted entirely. The card ends after the avatar row.

### Expanded states

**Member list expansion:**
When "Show all 25 people" is clicked, the avatar row transforms. The overlapping stack dissolves and the full member list appears in place, pushing the card taller. Each person row: avatar (28px), name (14px, 500 weight), title · department · location (13px, `textSecondary`). Each person is clickable for a "why" explanation popover.

A "Collapse" link at the bottom of the list returns to the avatar-row state.

Paginated at 20 people per page when total > 20.

**Exclusion expansion:**
When the "2 excluded" text is clicked, a detail section slides in below the hero number (above the composition pills). It shows each evaluation layer with its label, description, and the names of excluded people — same content as the current `EvaluationLayersIndicator`. Clicking again collapses it.

**Impact expansion:**
When the impact footer line is clicked, the per-policy list appears below it within the card. Each policy row shows: sensitivity tier badge (colored pill), policy name, domain, affected count. Same content as the current `DownstreamImpact` expanded view.

### Typography and spacing rhythm

The card uses a clear typographic hierarchy:
1. **48px hero number** — the first thing the eye hits
2. **14px "people" label** — immediate context for the number
3. **12px composition pills** — secondary context, population shape
4. **32px avatars** — visual warmth, human faces
5. **14px impact line** — structural context, what this group controls

This hierarchy should feel intentional. The whitespace between zones is generous (16-20px), creating breathing room. The card should never feel cramped — if content overflows, let the card grow vertically rather than compressing spacing.

## Scale behavior

- **5 people:** The hero number is "5". All 5 avatars show with no overflow. The composition pills might be few ("Engineering 3 · Sales 2"). The card is compact and clean. Consider auto-expanding the member list when count is ≤ 10, since the avatar row adds a click for little benefit.

- **25 people:** The core case. The card looks like a well-designed dashboard tile. 5-7 visible avatars, 4-5 composition pills, a meaningful impact line.

- **100 people:** The hero number is large ("100"). The composition pills truncate to top 4 + "more." The avatar overflow count is prominent ("+93"). The member list, when expanded, is paginated.

- **500+ people:** Same visual structure, but the composition pills shift to showing percentages alongside counts: "Engineering 48% · Sales 22% · ..." when the absolute numbers get large. The member list pagination is essential. Consider adding a search field in the member list when count > 50.

## Inline behavior (compact = true, 480px width)

- Hero number drops to 36px
- "people" label drops to 13px
- Composition pills: show top 3 + overflow
- Avatar row: 4 avatars instead of 7, 26px size
- Impact footer: "3 policies · 2,402 affected" (shorter text)
- All padding reduces from 24px to 16px
- The card otherwise maintains the same structure — it scales down gracefully because the hierarchy is typographic, not spatial

## Interaction model

| Action | Result |
|--------|--------|
| **View at rest** | Hero number, composition pills, avatar row, impact footer — one card |
| **Click "2 excluded"** | Exclusion detail expands inline below the hero number |
| **Click "Show all 25 people"** | Avatar row transforms into full member list |
| **Click a person** | Explanation popover appears below the person row |
| **Click impact footer** | Per-policy breakdown expands inline within the card |
| **Click "Collapse"** | Member list collapses back to avatar row |

## Accessibility notes

- The hero number should have `aria-label="25 people"` (not just "25")
- The "2 excluded" link needs `aria-expanded` state and should announce the expansion to screen readers
- Composition pills should be wrapped in a `role="list"` with each pill as a `role="listitem"`
- The avatar row should have `aria-label="Population preview. Showing 5 of 25 people."` and the "Show all" link should describe its action clearly
- When the member list is expanded, focus should move to the first person row
- The impact footer expansion should manage focus to the first policy row

## What this layout tests

- Does merging everything into one card feel unified or just tall?
- Is the hero number effective — does "25" in large type communicate more than "25 people" in a summary bar?
- Do the composition pills pull their weight, or are they visual noise between the number and the faces?
- Does the card maintain its visual appeal as it grows taller (expanded states)?
