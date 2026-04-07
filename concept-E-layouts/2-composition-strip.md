# Layout 2: Composition Strip

## Concept

Replace vertical stacking with a **single horizontal band** that puts the count, the people, and the downstream impact on one line. Everything is a peer — nothing is a child section buried below something else. The strip is the "zoomed out" view. Clicking any part of it expands detail downward.

## Design hypothesis

The current layout feels bolted-on because each section is vertically stacked with its own card/box, creating a tall column of drawers. If the three data elements (count, population, impact) are compressed into one dense horizontal band, the page feels lighter and the relationship between elements becomes spatial (left-to-right flow) rather than hierarchical (top-to-bottom stacking).

## Visual specification

### At rest (the default state)

One horizontal band, approximately 56-64px tall, with a subtle background (`surfaceAlt`) and rounded corners (12px). Inside it, three zones sit side by side:

**Left zone: Hero count (flex: 0 0 auto)**
- The number in large weight: "25" at ~28px font, `text` color, font-weight 700
- Below it, in small muted text (12px): "people"
- If there are exclusions, a tiny amber dot and "2 excluded" in 11px amber text appears below "people"
- Left padding: 16px

**Center zone: Avatar stack + composition hint (flex: 1)**
- A row of 5-6 overlapping avatars (28px each, -8px overlap) centered in the available space
- If there are more than 6 people, a "+19" overflow circle at the end
- Below the avatars, a single line of muted text (12px): the top 2-3 dimension values from the population. E.g., "Mostly Engineering · San Francisco" — derived by finding the most common department and location among members. This gives a one-line "shape" hint.

**Right zone: Policy badge (flex: 0 0 auto)**
- If there are downstream policies: a compact badge showing "3 policies" in 13px weight-500 text, with "2,402 affected" in 12px muted text below
- If there are no policies: this zone is empty and the center zone fills the space
- Right padding: 16px

All three zones are vertically centered within the band.

### Expanded states

Each zone of the strip is independently clickable. Clicking a zone opens a detail panel **below** the strip (not replacing it — the strip stays visible as a summary bar). Only one detail panel can be open at a time.

**Click the count (left zone):**
Opens the exclusion detail panel below the strip. Shows the evaluation layer breakdown: which layers are active, who they exclude, with per-person names and layer descriptions. Same data as the current `EvaluationLayersIndicator` expanded state. This panel only appears if there are exclusions; if there are none, clicking the count opens the member list instead.

**Click the avatars (center zone):**
Opens the full member list below the strip. Same format as the current `PopulationPreview`: avatar rows with name, title, department, location. Each person is clickable for a "why in / why not" explanation. Paginated if > 20 people.

**Click the policy badge (right zone):**
Opens the downstream impact detail panel below the strip. Shows per-policy breakdown with sensitivity tier badges, domain labels, and affected counts. Same data as the current `DownstreamImpact` expanded state.

### Visual cues for clickability

- Each zone has a subtle hover state: background transitions to `rgba(0,0,0,0.04)` on hover
- The active/expanded zone gets a 2px bottom border in `accent` color, aligned with the expanded panel below
- A small chevron (▾) appears on hover next to the zone content, in `textMuted` color

### The strip-to-panel connection

When a panel is open, it should feel visually connected to the strip above it. Use a small 8px inverted tab/notch at the top of the panel, aligned with the clicked zone, to create the visual connection. The panel has the same border-radius (12px) and a subtle card shadow.

## Scale behavior

- **5 people:** All 5 avatars show with no overflow counter. The composition hint might be trivial ("All Engineering · San Francisco") — still useful as confirmation. The strip works fine at this scale.

- **25 people:** The core case. 5 avatars + "+20" overflow. Composition hint is informative. The strip is dense and scannable.

- **100 people:** The avatars are the same (5 visible + "+95"). The hero count is larger ("100"). The composition hint may need to shift to showing the dominant segment as a percentage: "48% Engineering · 6 locations." The member list panel, when open, is paginated.

- **500+ people:** Same visual treatment, but the composition hint becomes a percentage breakdown. The member list panel should include a search field at the top when there are more than 50 members.

## Inline behavior (compact = true, 480px width)

The strip adapts by stacking slightly:

- The three zones still sit on one line, but with reduced padding (10px instead of 16px)
- The hero count drops to 22px font
- The avatar stack shows 3 avatars instead of 5
- The composition hint text is hidden (the avatars are sufficient)
- The policy badge shows only "3 policies" (drops the affected count)
- Expanded panels below the strip take full width

If the 480px width is too tight for the three-zone layout, fall back to a two-line version: count + avatars on line 1, policy badge on line 2. This should only happen when the strip's three zones can't fit without wrapping.

## Interaction model

| Action | Result |
|--------|--------|
| **View at rest** | See count, avatar stack, composition hint, policy badge — all on one line |
| **Hover a zone** | Subtle background change + chevron appears |
| **Click count** | Exclusion detail panel opens below (or member list if no exclusions) |
| **Click avatars** | Full member list opens below |
| **Click policy badge** | Policy breakdown opens below |
| **Click a different zone** | Current panel closes, new one opens (crossfade, 150ms) |
| **Click the same zone again** | Panel closes |
| **Click a person in member list** | Explanation popover inline |

## Accessibility notes

- The strip must function as a toolbar with `role="toolbar"` and `aria-label="Population summary"`
- Each zone is a button (`role="button"`) with an `aria-expanded` attribute matching its panel state
- The expanded panel has `role="region"` with `aria-labelledby` pointing to the zone button
- Avatar images need `alt` text with the person's name; the overflow counter needs `aria-label="and 20 more people"`
- Keyboard navigation: Tab between zones, Enter/Space to expand, Escape to collapse

## What this layout tests

- Does a single horizontal band feel less "bolted on" than three stacked sections?
- Do admins discover the click-to-expand interaction, or does the strip feel like a static summary?
- Is the composition hint ("Mostly Engineering · San Francisco") useful, or do admins ignore it?
- Does the strip maintain its visual balance across different scale points (5 vs. 100 vs. 500)?
