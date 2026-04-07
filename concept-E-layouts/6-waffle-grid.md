# Layout 6: Waffle Grid

## Concept

Represent each person as a **small colored cell** in a grid. Color = department. The grid is an abstract mosaic at rest — beautiful, and the proportions immediately communicate population composition without text. Hover a cell to see the person's name. Click to see their full explanation. Excluded people are faded cells in a separate row. The downstream impact sits below the grid as a compact footer.

## Design hypothesis

Lists are information-efficient but visually dead. Charts are visual but abstract. A waffle grid sits in between — each cell *is* a person (concrete, countable) but the arrangement and color create an aggregate visual impression (abstract, proportional). If the grid makes admins say "I can see the shape of this population at a glance," it's doing something neither a list nor a bar chart can do. This is the most "beauty for beauty's sake" variant — it tests whether visual distinctiveness has value in an enterprise admin tool.

## Visual specification

### At rest (the default state)

The component renders as a single card with three zones:

**Zone 1: Match count + exclusion indicator**

A single line at the top: "25 people" in 16px, 600 weight, left-aligned. If exclusions exist, "2 excluded" in 13px amber on the same line, clickable to expand layer detail.

**Zone 2: The waffle grid (the hero)**

A CSS grid of small colored squares. Each square represents one person. The grid flows left-to-right, top-to-bottom, filling rows.

Cell sizing:
- Each cell is a square. Target size: 24×24px with a 3px gap between cells.
- The grid width is determined by the container. Cells per row = floor(container_width / (cell_size + gap)). For a 612px container (660px card minus 48px padding), that's ~22 cells per row.
- For 25 people: 2 rows of 22 + 1 row of 3. The last row is left-aligned (not justified).

Cell appearance:
- Each cell has a border-radius of 4px (softly rounded, not circular)
- Fill color is determined by department using a fixed, muted palette:

```
Engineering  → #5B8DEF (blue)
Sales        → #4CAF7D (green)
Finance      → #E8A838 (amber)
Marketing    → #D468C8 (pink)
HR           → #7C6FD4 (purple)
Legal        → #5CC0C0 (teal)
Operations   → #E07060 (coral)
(default)    → #A0A0A0 (gray)
```

These colors should be accessible against a white background (3:1 contrast minimum). They're chosen to be cohesive as a palette — when viewed together, the grid looks like a designed artifact, not a random collection.

Cell sort order: Group by department so same-colored cells cluster together. Within a department, sort by name. This makes the color blocks visible as contiguous regions.

**Hover behavior:**
- Hovering a cell: the cell grows slightly (scale 1.3, transition 100ms) and shows a tooltip above it with the person's name, title, and department. E.g., "Sarah Chen — Staff Engineer, Engineering"
- Other cells in the same department brighten slightly; cells in different departments dim to 60% opacity. This "focus" effect highlights the department cluster.

**Click behavior:**
- Clicking a cell selects the person. The cell gets a 2px `accent` border. A detail card appears below the grid showing the full "why in / why not" explanation. Clicking another cell or clicking outside dismisses it.

**Legend:**
Below the grid, a compact legend row showing the department colors. Each legend item: a small 10×10 color swatch + the department name + count in parentheses. E.g., "● Engineering (8)  ● Sales (6)  ● Finance (4)  ..."

The legend items are clickable — clicking a department in the legend highlights (full opacity) those cells and dims the others, similar to the hover behavior but persistent. Click again to clear the filter.

**Excluded people:**
If there are people excluded by evaluation layers, render them as a separate row below the main grid, with a 12px vertical gap and a subtle label: "Excluded by system filters" in 11px `textMuted` above the row.

The excluded cells use the same color scheme but at 30% opacity (heavily faded). They still show tooltips on hover, and the tooltip includes the exclusion reason: "Omar Farouk — Treasury Analyst, Finance. Excluded: role status is Pending."

**Zone 3: Downstream impact footer**

Below the legend, a compact impact line: "Referenced by 3 policies · 2,402 people affected" with a "Details" link. Expands to show per-policy breakdown with sensitivity tiers. Same interaction as the current `DownstreamImpact`.

### The overall visual impression

At rest, the card should look like a carefully arranged color swatch or a small mosaic. The clustering by department creates visible regions of color. The proportions are immediately readable: "there's a lot of blue (Engineering) and some green (Sales)." The small gap between cells and the rounded corners give it a polished, designed feel — not a spreadsheet.

## Scale behavior

- **5 people:** The grid is a single row of 5 cells. The visual is minimal but still communicates department distribution through color. At this scale, consider increasing cell size to 32×32px to give the grid more visual presence.

- **25 people:** The core design case. 2-3 rows of colored cells. The clustering is visible and meaningful. This is where the grid looks best.

- **100 people:** 5-6 rows. The grid fills more vertical space but is still scannable. The department clusters become more dramatic. Cell size stays at 24px. The legend becomes more important for decoding colors. Consider allowing the legend department clicks to filter the grid down and show a member list for just that department.

- **500+ people:** The grid becomes very large (20+ rows). At this scale, the waffle grid transitions to a **summary mode**: instead of one cell per person, show one cell per ~10 people (each cell represents a bucket). The legend shows percentages. The tooltip shows "~10 people in Engineering (San Francisco)" instead of an individual name. A "Show full grid" option renders all cells if the user wants granularity.

  The transition point: if `members.length > 200`, use the summary/bucketed mode. Below 200, use individual cells.

## Inline behavior (compact = true, 480px width)

- Cell size reduces to 18×18px with 2px gaps
- The grid fits ~23 cells per row in 480px (after padding)
- The legend is hidden — the colors speak for themselves in compact mode. If the user needs the legend, they can expand the full view.
- Hover tooltips still work but are positioned to stay within the 480px bounds
- The excluded row is hidden — replaced by a text line "2 excluded by system filters" that's expandable
- The impact footer shortens: "3 policies · 2,402 affected"

## Interaction model

| Action | Result |
|--------|--------|
| **View at rest** | Colored grid mosaic, legend row, impact footer |
| **Hover a cell** | Cell grows, tooltip with name/title/dept, department peers highlighted |
| **Click a cell** | Cell selected, explanation card appears below grid |
| **Click a legend department** | Cells for that department stay full opacity, others dim. Click again to clear. |
| **Click "2 excluded"** | Layer breakdown expands inline |
| **Click "Details" on impact** | Policy breakdown expands inline |

## Accessibility notes

This is the variant with the most significant accessibility considerations:

- The grid must be navigable by keyboard. Implement as a `role="grid"` with `role="row"` and `role="gridcell"` elements. Arrow keys navigate cells. Enter/Space selects a cell.
- Each cell must have an `aria-label`: "Sarah Chen, Staff Engineer, Engineering department"
- The color legend is essential — color is never the sole channel. The legend provides text labels for each color. Screen readers should be able to access the legend to understand the color mapping.
- The department highlight (dimming non-selected departments) must not rely only on opacity changes. Add a subtle border or size change to highlighted cells as a secondary visual indicator.
- The excluded row must be clearly identified: `aria-label="People excluded by system filters"` on the sub-grid.
- Tooltips must be accessible via keyboard focus, not only mouse hover.
- For the summary mode (500+ people), screen readers should announce "Approximately 48 people in Engineering" rather than requiring navigation of individual cells.

## Color palette definition

The department color palette is a critical design element. It must be:
1. **Cohesive** — the colors work together as a set, not as random assignments
2. **Distinguishable** — any two adjacent colors in the grid must be visually distinct
3. **Accessible** — each color has ≥3:1 contrast against white
4. **Stable** — the same department always gets the same color (deterministic mapping, not random)

If a department appears in the data that isn't in the predefined map, assign it the gray default. For the prototype, the 7 departments in the mock data are the ones that matter.

## What this layout tests

- Does a visual mosaic communicate population composition faster than a bar chart or a member list?
- Do admins find the grid beautiful and engaging, or decorative and confusing?
- Is hover-to-discover sufficient, or do admins want names visible by default?
- Does the department clustering create a useful mental model of the population?
- At what scale does the grid stop being useful and start being overwhelming?
- Does this visual style feel appropriate for an enterprise admin tool, or does it feel like it belongs in a consumer product?
