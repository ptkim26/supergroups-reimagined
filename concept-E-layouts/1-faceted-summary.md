# Layout 1: Faceted Summary

## Concept

Lead with the population's **composition** — not its census. Instead of showing a list of 25 names, show that this population is "8 Engineering, 6 Sales, 4 Finance, 3 Marketing, 2 HR, 1 Legal, 1 Operations" and "12 San Francisco, 8 New York, 5 Austin." The member list is secondary. The shape is the story.

## Design hypothesis

Admins care more about whether the right *types* of people are captured than about specific individuals. If the composition breakdown answers the question "does this look right?" faster than scanning a member list, then faceted summary is a better default than a member list.

## Visual specification

### At rest (the default state)

The component renders as a single card with three zones stacked vertically:

**Zone 1: Match summary line**
A single line at the top: bold count ("25 people") on the left. If there are exclusions, an amber pill on the right: "2 excluded." Clicking "2 excluded" expands an inline explanation of which layers are excluding whom (same data as current `EvaluationLayersIndicator`).

**Zone 2: Facet bars (the hero)**
Two or three horizontal bar charts, one per meaningful dimension. The dimensions to show are determined dynamically by which fields appear in the current rule's conditions, plus department as a default. Each bar chart:

- Has a label on the left ("Department", "Location")
- Shows a horizontal stacked bar where each segment is color-coded by value and proportionally sized
- Below the bar, a legend row of the top 3-4 values with counts: "Engineering 8 · Sales 6 · Finance 4 · 4 others"
- Each segment and legend item is clickable — clicking filters the member list (zone 3) to show only people in that segment

Color assignments: Use a fixed palette mapped to values. For departments, assign colors deterministically (e.g., hash the department name to pick from a 10-color palette). Keep the palette muted and cohesive — not a rainbow. Think: Notion database chart colors, Linear project colors.

The bar itself should be 8-10px tall, with rounded ends, on a subtle background track. The segments should have 1px gaps between them for visual separation.

**Zone 3: Member list (collapsed by default)**
Below the facet bars, a text link: "Show all 25 people." Clicking it reveals the full member list — same format as the current `PopulationPreview` (avatar, name, title, department, location). Each person is clickable for a "why in / why not" explanation popover.

When a facet segment is clicked (e.g., "Engineering"), the member list expands automatically, filtered to show only the people in that segment. A chip above the list shows the active filter: "Showing: Engineering (8 people)" with an × to clear.

**Zone 4: Downstream impact (footer)**
Below the member list area, the downstream impact section. A compact line: "Referenced by 3 policies · 2,402 people affected" with a "Details" link that expands to show the per-policy breakdown with sensitivity tiers.

### Visual hierarchy (what catches the eye first)

1. The count ("25 people") — large, bold
2. The facet bars — colorful, proportional, scannable
3. The downstream impact line — subtle but present
4. The member list — hidden by default, accessible

### Transitions and animation

- When a facet segment is clicked, the member list slides open with a gentle ease (200ms, ease-out)
- The active segment in the bar brightens slightly; other segments dim to 60% opacity
- Clearing the filter reverses: member list slides closed, bar segments return to full opacity

## Scale behavior

- **5 people:** The facet bars show only the dimensions that have variation (if all 5 are in Engineering, don't show a department bar — it's a single block). The member list auto-expands since the population is small enough to scan. The bar chart is still useful even at this scale because it shows the dimension breakdown.

- **25 people:** The core design case. Facet bars are proportional and readable. The member list is collapsed. This is where the composition-over-census tradeoff is most visible.

- **100 people:** Facet bars show the top 5-6 values per dimension, with a "+ N others" overflow. The legend truncates to top 4 with a count for the rest. The member list, when expanded, is paginated (20 per page).

- **500+ people:** Same as 100, but the bar proportions are more dramatic (one segment dominates). The member list pagination becomes essential. Consider adding a search field above the member list when count > 50.

## Inline behavior (compact = true, 480px width)

- The facet bars render at reduced height (6px instead of 10px)
- The legend row shows top 2 values + "N others" instead of top 4
- The member list, when expanded, shows 5 people per page instead of 8
- The downstream impact line truncates to "3 policies · 2,402 affected" (drops "Referenced by" and "people")

## Interaction model

| Action | Result |
|--------|--------|
| **View at rest** | See count, facet bars, policy footer |
| **Click facet segment** | Member list expands, filtered to that segment |
| **Click "Show all N people"** | Member list expands, unfiltered |
| **Click a person** | Explanation popover appears below the person row |
| **Click "2 excluded"** | Exclusion layer details expand inline below the match summary |
| **Click "Details" on policy line** | Policy breakdown expands inline |

## Accessibility notes

- Facet bars must have `role="img"` with an `aria-label` describing the composition (e.g., "Department breakdown: Engineering 8, Sales 6, Finance 4, Marketing 3, HR 2, Legal 1, Operations 1")
- Each clickable segment must be keyboard-focusable and have an `aria-label` with its value and count
- The color palette must maintain a 3:1 contrast ratio against the bar track background
- The member list expansion must manage focus — when it opens, focus moves to the first person row or the filter chip
- The active filter chip must be announced to screen readers: "Filtered to Engineering, 8 people. Press escape or click × to clear."

## What this layout tests

- Does seeing the population's *shape* answer "does this look right?" faster than scanning names?
- Do admins click into facet segments to investigate, or do they immediately go to "Show all"?
- Is the member list being secondary (collapsed) a friction or a feature?
