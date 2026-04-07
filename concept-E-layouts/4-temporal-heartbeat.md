# Layout 4: Temporal Heartbeat

## Concept

The hero element isn't the count — it's the **count over time**. A sparkline or step chart shows how the population has changed over the last 30 days. The current count sits at the rightmost point. Recent changes are annotated directly below the chart. The population feels alive because you can see it breathing.

## Design hypothesis

The current layout presents the population as a static snapshot — "25 people, here they are." But the entire value proposition of dynamic rules over static lists is that rules stay current. If the first thing an admin sees is evidence that this population *moves* — "+2 joined this month" visualized as a rising line — that's the moment the admin understands why dynamic matters. This layout makes the temporal dimension the primary visual, not a buried section.

## Visual specification

### At rest (the default state)

The component renders as a single card with four zones:

**Zone 1: Sparkline with hero count (the centerpiece)**

A horizontal chart area, approximately 80-100px tall, spanning the full card width. The chart shows the population count over the last 30 days as a step line (population changes are discrete events, not continuous trends, so a step line is more accurate than a smooth curve).

Implementation: Since this is a prototype with mock data, simulate the 30-day history from the `members` array using `startDate` fields. Walk backward from today:
- Start with the current member count
- For each member whose `startDate` is within the last 30 days, subtract 1 from the count at that date (they hadn't joined yet)
- For terminated members whose `startDate` is older, add 1 at a simulated departure date (use 15 days ago as a default)
- This produces a series of (date, count) points

The chart:
- X-axis: last 30 days. No axis labels — just a thin baseline at the bottom
- Y-axis: implicit. The line fills most of the vertical space. No grid lines, no axis labels.
- The line: 2px stroke in `accent` color. Step-style (horizontal segments with vertical jumps at change points).
- The current count: a filled circle (6px) at the rightmost point, with the count rendered as a bold number (24px, 700 weight) positioned just above and to the left of the dot. E.g., "25" floating above the endpoint.
- The starting count (30 days ago): a smaller, muted number (14px, `textMuted`) at the leftmost point. E.g., "22"
- The area below the line: a very subtle gradient fill — `accentLight` at the line, fading to transparent at the baseline. This gives the chart visual weight without being chart-junk.

Below the chart, a subtle label: "Last 30 days" in 11px `textMuted`, right-aligned.

If the count hasn't changed in 30 days (no recent additions or removals), the sparkline is a flat horizontal line. That's fine — it communicates stability. Add a subtle annotation: "No changes in the last 30 days."

**Zone 2: Recent changes annotation**

Directly below the sparkline, a compact section listing the specific changes:

- If there are additions: a green pill "+2 joined" followed by names and dates on the next line. "Zara Ahmed joined Mar 20 · Tomás Silva joined Mar 28" in 13px, `textSecondary`. Each name is clickable for a "why" explanation.
- If there are removals: a red pill "-1 left" followed by the name and reason. "Mei Lin — terminated Feb 15" in 13px, `textSecondary`.
- If there are both: additions first, then removals, separated by 8px vertical space.
- If there are no changes: this zone is omitted.

**Zone 3: Exclusion indicator**

If there are exclusions, a single line below the changes annotation: "2 excluded by system filters" in 13px amber text. Clickable to expand the layer detail inline (same as current `EvaluationLayersIndicator` behavior). If no exclusions, this zone is omitted.

**Zone 4: Population + impact footer**

A compact footer area with two side-by-side sections:

- Left: avatar stack (5 overlapping avatars, 26px) + "Show all 25 people" link in `accent`
- Right: "3 policies · 2,402 affected" in 13px `textSecondary`, clickable to expand policy detail

These are deliberately secondary. The sparkline is the hero; the people and impact are accessible but not the lead.

### Expanded states

**Member list:**
Clicking "Show all 25 people" or any avatar opens the full member list below the footer, within the card. Same format as current `PopulationPreview`. The sparkline and annotation stay visible above — the card grows taller.

**Exclusion detail:**
Clicking "2 excluded" expands the layer breakdown inline, same as current behavior.

**Policy detail:**
Clicking the policy text on the right expands per-policy breakdown below the footer.

### Chart rendering

The sparkline should be rendered as an SVG element — not a canvas. This keeps it crisp at all scales and accessible. The SVG should have:
- `viewBox` set to the 30-day range × count range
- `preserveAspectRatio="none"` so it stretches to fill the container width
- The step line as a `<path>` element
- The gradient fill as a `<linearGradient>` + filled `<path>`
- The endpoint circle as a `<circle>` element
- The count labels as absolutely positioned HTML elements (not SVG text, for better font rendering)

## Scale behavior

- **5 people:** The sparkline has a very narrow Y range (maybe 4 → 5). The chart is still meaningful — a single step up is visible and communicates a recent join. The chart area can be shorter (60px) when the Y range is small.

- **25 people:** The core case. The Y range is ~22-25, showing 2-3 step changes. The chart is readable and the annotation lists specific names.

- **100 people:** The Y range might be 92-100. The steps are proportionally smaller but still visible. The recent changes annotation might list more names — cap at 5 names with "+ N more" overflow.

- **500+ people:** The Y range might be 485-502. Individual steps become small relative to the total. The chart is still useful as a trend indicator, but the annotation carries more weight than the visual. Consider adding percentage-based labels: "+3.5% over 30 days" alongside the absolute change.

## Inline behavior (compact = true, 480px width)

- Sparkline height reduces to 60px
- The hero count drops to 20px font
- The starting count label is hidden (only the current count shows)
- The recent changes annotation truncates to one line: "+2 joined this month" (no individual names)
- The footer stacks vertically: avatars on one line, policy badge on the next
- The gradient fill is omitted (cleaner in tight spaces)

## Interaction model

| Action | Result |
|--------|--------|
| **View at rest** | Sparkline with hero count, recent changes, avatar row + policy badge |
| **Hover the sparkline** | A vertical rule follows the cursor, showing the count at that date as a tooltip: "Mar 15: 23 people" |
| **Click a name in recent changes** | Explanation popover for why that person was added/removed |
| **Click "2 excluded"** | Layer breakdown expands inline |
| **Click avatars or "Show all"** | Member list expands below |
| **Click policy badge** | Policy breakdown expands below |

## Accessibility notes

- The SVG sparkline must have `role="img"` with a descriptive `aria-label`: "Population trend over last 30 days. Started at 22, currently 25. 2 people joined, 1 person left."
- The hover tooltip should also be keyboard-accessible — arrow keys move through dates when the chart is focused
- Recent change names are links/buttons with appropriate labels
- All expandable sections use `aria-expanded` attributes

## Simulating the 30-day history

Since this is a prototype with mock data, the builder should generate the sparkline data from the `members` array:

```typescript
function buildSparklineData(members: Person[], allPeople: Person[]): { date: string; count: number }[] {
  const today = new Date('2026-04-03');
  const points: { date: string; count: number }[] = [];
  
  for (let i = 30; i >= 0; i--) {
    const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = date.toISOString().slice(0, 10);
    // Count members whose startDate is on or before this date
    // and who are still active (not terminated, or terminated after this date)
    const count = members.filter(p => p.startDate <= dateStr).length;
    points.push({ date: dateStr, count });
  }
  
  return points;
}
```

This is approximate — it doesn't account for rule changes, only for people entering via start date. That's fine for a prototype.

## What this layout tests

- Does seeing the population's history make admins trust the dynamic rule more?
- Is the sparkline informative at different scales, or does it only work at small populations?
- Do admins hover the sparkline to explore the timeline, or is it just a glanceable decoration?
- Does the temporal emphasis feel like it belongs in Concept E's "obvious default" character, or does it feel like it's imported from Concept B's "living population" territory?
