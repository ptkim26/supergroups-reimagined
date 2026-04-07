# Build Prompts

Eight copy-paste prompts for building the Concept E layout variants. Prompts 1-7 build individual layout components. Prompt 8 integrates them all into Concept E with a HUD switcher. Prompts 1-7 can run in parallel across separate chat sessions. Prompt 8 runs last, after all 7 are done.

---

## Prompt 1: Faceted Summary

```
Read these files in full before doing anything:

1. `prototype/concept-E-layouts/README.md` — the shared interface contract and design tokens
2. `prototype/concept-E-layouts/1-faceted-summary.md` — the full spec for this layout
3. `prototype/concept-E/index.tsx` — the existing Concept E code (for design tokens, Avatar component, helper functions, and existing component patterns)
4. `prototype/shell/types.ts` — the shared type contract

Then create a single file at `prototype/concept-E-layouts/layout-1-faceted-summary.tsx`.

This file must:
- Default-export a React component that accepts `PopulationDisplayProps` as defined in the README
- Import types only from `../shell/types`
- Be fully self-contained: copy the design tokens (C, S, FONT), Avatar component, formatValue, fieldLabels, employmentTypeLabels, roleStateLabels, tierColor, and tierLabel helpers from concept-E/index.tsx into this file. Do NOT import from concept-E.
- Implement the full layout described in the spec: faceted summary with composition bar charts as the hero, collapsible member list, exclusion indicator, and downstream impact footer
- Handle the `compact` prop for 480px inline mode
- Include all interaction states: facet segment click filtering, member list expansion, person explanation popovers, exclusion detail expansion, policy detail expansion

Do NOT modify concept-E/index.tsx or any other file. Only create the one layout file.

Build it with craft. The quality bar is prototype-grade — it needs to feel intentional and polished when demoed, not pixel-perfect for production. Use inline styles consistent with the rest of concept-E.
```

---

## Prompt 2: Composition Strip

```
Read these files in full before doing anything:

1. `prototype/concept-E-layouts/README.md` — the shared interface contract and design tokens
2. `prototype/concept-E-layouts/2-composition-strip.md` — the full spec for this layout
3. `prototype/concept-E/index.tsx` — the existing Concept E code (for design tokens, Avatar component, helper functions, and existing component patterns)
4. `prototype/shell/types.ts` — the shared type contract

Then create a single file at `prototype/concept-E-layouts/layout-2-composition-strip.tsx`.

This file must:
- Default-export a React component that accepts `PopulationDisplayProps` as defined in the README
- Import types only from `../shell/types`
- Be fully self-contained: copy the design tokens (C, S, FONT), Avatar component, formatValue, fieldLabels, employmentTypeLabels, roleStateLabels, tierColor, and tierLabel helpers from concept-E/index.tsx into this file. Do NOT import from concept-E.
- Implement the full layout described in the spec: a single horizontal band with hero count (left), avatar stack + composition hint (center), and policy badge (right), with click-to-expand detail panels below
- Handle the `compact` prop for 480px inline mode
- Include all interaction states: zone hover effects, click to expand member list / exclusion detail / policy breakdown, person explanation popovers, panel switching

Do NOT modify concept-E/index.tsx or any other file. Only create the one layout file.

Build it with craft. The quality bar is prototype-grade — it needs to feel intentional and polished when demoed, not pixel-perfect for production. Use inline styles consistent with the rest of concept-E.
```

---

## Prompt 3: Unified Hero Card

```
Read these files in full before doing anything:

1. `prototype/concept-E-layouts/README.md` — the shared interface contract and design tokens
2. `prototype/concept-E-layouts/3-unified-hero-card.md` — the full spec for this layout
3. `prototype/concept-E/index.tsx` — the existing Concept E code (for design tokens, Avatar component, helper functions, and existing component patterns)
4. `prototype/shell/types.ts` — the shared type contract

Then create a single file at `prototype/concept-E-layouts/layout-3-unified-hero-card.tsx`.

This file must:
- Default-export a React component that accepts `PopulationDisplayProps` as defined in the README
- Import types only from `../shell/types`
- Be fully self-contained: copy the design tokens (C, S, FONT), Avatar component, formatValue, fieldLabels, employmentTypeLabels, roleStateLabels, tierColor, and tierLabel helpers from concept-E/index.tsx into this file. Do NOT import from concept-E.
- Implement the full layout described in the spec: one unified card with hero number (48px centered), composition pills, avatar row with "Show all" link, divider, and impact footer — all as one designed artifact
- Handle the `compact` prop for 480px inline mode (reduced sizes per spec)
- Include all interaction states: member list expansion (avatar row transforms into full list), exclusion detail expansion, impact footer expansion, person explanation popovers, auto-expand member list when count ≤ 10

Do NOT modify concept-E/index.tsx or any other file. Only create the one layout file.

Build it with craft. The quality bar is prototype-grade — it needs to feel intentional and polished when demoed, not pixel-perfect for production. Use inline styles consistent with the rest of concept-E. Pay particular attention to the typographic hierarchy: the 48px hero number, the pill sizing, the spacing rhythm. This variant lives or dies on typography.
```

---

## Prompt 4: Temporal Heartbeat

```
Read these files in full before doing anything:

1. `prototype/concept-E-layouts/README.md` — the shared interface contract and design tokens
2. `prototype/concept-E-layouts/4-temporal-heartbeat.md` — the full spec for this layout
3. `prototype/concept-E/index.tsx` — the existing Concept E code (for design tokens, Avatar component, helper functions, and existing component patterns)
4. `prototype/shell/types.ts` — the shared type contract

Then create a single file at `prototype/concept-E-layouts/layout-4-temporal-heartbeat.tsx`.

This file must:
- Default-export a React component that accepts `PopulationDisplayProps` as defined in the README
- Import types only from `../shell/types`
- Be fully self-contained: copy the design tokens (C, S, FONT), Avatar component, formatValue, fieldLabels, employmentTypeLabels, roleStateLabels, tierColor, and tierLabel helpers from concept-E/index.tsx into this file. Do NOT import from concept-E.
- Implement the full layout described in the spec: SVG sparkline showing 30-day population trend as the hero, with the current count at the endpoint, recent changes annotation below, exclusion indicator, and a compact footer with avatar stack + policy badge
- Build the sparkline data from the `members` array using startDate fields (see the `buildSparklineData` function in the spec)
- Render the sparkline as an SVG with step-line path, gradient fill, endpoint circle, and count labels
- Handle the `compact` prop for 480px inline mode
- Include all interaction states: sparkline hover with date tooltip, recent change name clicks, member list expansion, exclusion detail, policy breakdown

Do NOT modify concept-E/index.tsx or any other file. Only create the one layout file.

Build it with craft. The quality bar is prototype-grade — it needs to feel intentional and polished when demoed, not pixel-perfect for production. Use inline styles consistent with the rest of concept-E. The sparkline is the centerpiece — make it feel like a real data visualization, not a placeholder. The gradient fill, the step line, and the endpoint treatment all matter.
```

---

## Prompt 5: Split Panel

```
Read these files in full before doing anything:

1. `prototype/concept-E-layouts/README.md` — the shared interface contract and design tokens
2. `prototype/concept-E-layouts/5-split-panel.md` — the full spec for this layout
3. `prototype/concept-E/index.tsx` — the existing Concept E code (for design tokens, Avatar component, helper functions, and existing component patterns)
4. `prototype/shell/types.ts` — the shared type contract

Then create a single file at `prototype/concept-E-layouts/layout-5-split-panel.tsx`.

This file must:
- Default-export a React component that accepts `PopulationDisplayProps` as defined in the README
- Import types only from `../shell/types`
- Be fully self-contained: copy the design tokens (C, S, FONT), Avatar component, formatValue, fieldLabels, employmentTypeLabels, roleStateLabels, tierColor, and tierLabel helpers from concept-E/index.tsx into this file. Do NOT import from concept-E.
- Implement the full layout described in the spec: two-column layout with population (left, 60%) and downstream impact (right, 40%) side by side, separated by a subtle vertical divider
- The left panel contains: match count, composition bar, full member list with pagination and person explanation popovers
- The right panel contains: "Downstream impact" header, total affected count, always-visible policy list with sensitivity tier badges
- When `compact` is true (480px), collapse to single-column vertical layout
- Include all interaction states: exclusion detail expansion in left panel, person explanation popovers, member list pagination, search field when count > 30

Do NOT modify concept-E/index.tsx or any other file. Only create the one layout file.

Build it with craft. The quality bar is prototype-grade — it needs to feel intentional and polished when demoed, not pixel-perfect for production. Use inline styles consistent with the rest of concept-E. The visual balance between the two panels is critical — the left panel should be denser, the right panel calmer. They should feel like two halves of one card.
```

---

## Prompt 6: Waffle Grid

```
Read these files in full before doing anything:

1. `prototype/concept-E-layouts/README.md` — the shared interface contract and design tokens
2. `prototype/concept-E-layouts/6-waffle-grid.md` — the full spec for this layout
3. `prototype/concept-E/index.tsx` — the existing Concept E code (for design tokens, Avatar component, helper functions, and existing component patterns)
4. `prototype/shell/types.ts` — the shared type contract

Then create a single file at `prototype/concept-E-layouts/layout-6-waffle-grid.tsx`.

This file must:
- Default-export a React component that accepts `PopulationDisplayProps` as defined in the README
- Import types only from `../shell/types`
- Be fully self-contained: copy the design tokens (C, S, FONT), Avatar component, formatValue, fieldLabels, employmentTypeLabels, roleStateLabels, tierColor, and tierLabel helpers from concept-E/index.tsx into this file. Do NOT import from concept-E.
- Implement the full layout described in the spec: a CSS grid of colored squares where each cell = one person, color = department, sorted by department so same-colored cells cluster together
- Include the department color palette defined in the spec (blue for Engineering, green for Sales, etc.)
- Implement hover behavior: cell grows (scale 1.3), tooltip with name/title/dept, same-department cells highlight while others dim
- Implement click behavior: cell selected with accent border, explanation card below grid
- Render excluded people as faded cells in a separate row below the main grid
- Include the color legend with clickable department filtering
- Handle the `compact` prop for 480px inline mode (smaller cells, hidden legend)
- Include the downstream impact footer with expandable policy detail
- If members.length > 200, use the summary/bucketed mode described in the spec

Do NOT modify concept-E/index.tsx or any other file. Only create the one layout file.

Build it with craft. The quality bar is prototype-grade — it needs to feel intentional and polished when demoed, not pixel-perfect for production. Use inline styles consistent with the rest of concept-E. This is the most visually distinctive variant — the grid should look like a designed artifact, a color swatch or mosaic. The department color palette is critical: the colors must be cohesive as a set and visually pleasing when arranged as a grid.
```

---

## Prompt 7: Baseline Refined

```
Read these files in full before doing anything:

1. `prototype/concept-E-layouts/README.md` — the shared interface contract and design tokens
2. `prototype/concept-E-layouts/7-baseline-refined.md` — the full spec for this layout
3. `prototype/concept-E/index.tsx` — the existing Concept E code (for design tokens, Avatar component, helper functions, and existing component patterns)
4. `prototype/shell/types.ts` — the shared type contract

Then create a single file at `prototype/concept-E-layouts/layout-7-baseline-refined.tsx`.

This file must:
- Default-export a React component that accepts `PopulationDisplayProps` as defined in the README
- Import types only from `../shell/types`
- Be fully self-contained: copy the design tokens (C, S, FONT), Avatar component, formatValue, fieldLabels, employmentTypeLabels, roleStateLabels, tierColor, and tierLabel helpers from concept-E/index.tsx into this file. Do NOT import from concept-E.
- Implement the full layout described in the spec: one continuous card containing the match count/exclusion indicator, population member list, and downstream impact — separated by subtle 1px internal dividers, NOT by separate cards
- This is the control variant: same information and interaction model as the current concept-E below-conditions area, but rendered as one unified card instead of three separate components
- NO section labels like "Population" — the content is self-describing
- Handle the `compact` prop for 480px inline mode
- Include all interaction states: exclusion detail expansion, person explanation popovers, member list pagination/expansion, policy breakdown expansion

Do NOT modify concept-E/index.tsx or any other file. Only create the one layout file.

Build it with craft. The quality bar is prototype-grade — it needs to feel intentional and polished when demoed, not pixel-perfect for production. Use inline styles consistent with the rest of concept-E. Since this is the control group, the visual refinement matters: the internal dividers, the consistent padding alignment, the removal of section labels. It should feel like one designed card, not three components crammed together.
```

---

## Prompt 8: Integration (run this LAST, after all 7 layouts are built)

```
Read these files in full before doing anything:

1. `prototype/concept-E-layouts/README.md` — the shared interface contract and HUD integration plan
2. `prototype/concept-E/index.tsx` — the current Concept E implementation
3. `prototype/shell/types.ts` — the shared type contract
4. All 7 layout files:
   - `prototype/concept-E-layouts/layout-1-faceted-summary.tsx`
   - `prototype/concept-E-layouts/layout-2-composition-strip.tsx`
   - `prototype/concept-E-layouts/layout-3-unified-hero-card.tsx`
   - `prototype/concept-E-layouts/layout-4-temporal-heartbeat.tsx`
   - `prototype/concept-E-layouts/layout-5-split-panel.tsx`
   - `prototype/concept-E-layouts/layout-6-waffle-grid.tsx`
   - `prototype/concept-E-layouts/layout-7-baseline-refined.tsx`

Then modify `prototype/concept-E/index.tsx` to integrate all 7 layout variants behind a HUD switcher. Here is what to do:

**1. Import all 7 layout components:**
```typescript
import Layout1 from '../concept-E-layouts/layout-1-faceted-summary';
import Layout2 from '../concept-E-layouts/layout-2-composition-strip';
import Layout3 from '../concept-E-layouts/layout-3-unified-hero-card';
import Layout4 from '../concept-E-layouts/layout-4-temporal-heartbeat';
import Layout5 from '../concept-E-layouts/layout-5-split-panel';
import Layout6 from '../concept-E-layouts/layout-6-waffle-grid';
import Layout7 from '../concept-E-layouts/layout-7-baseline-refined';
```

**2. Define the layout metadata:**
```typescript
const LAYOUTS = [
  { key: 1, label: 'Faceted Summary', icon: '◧' },
  { key: 2, label: 'Composition Strip', icon: '━' },
  { key: 3, label: 'Unified Hero', icon: '▣' },
  { key: 4, label: 'Temporal Heartbeat', icon: '〜' },
  { key: 5, label: 'Split Panel', icon: '◫' },
  { key: 6, label: 'Waffle Grid', icon: '⊞' },
  { key: 7, label: 'Baseline', icon: '▤' },
] as const;
```

**3. Add layout state to the main ConceptE component:**
Add a `layoutVariant` state (number 1-7, default 7) at the top level of the `ConceptE` component so it persists across scenario changes.

**4. Create a PopulationDisplay wrapper component:**
Create a component that takes the layout variant number and `PopulationDisplayProps`, and renders the appropriate layout component:

```typescript
function PopulationDisplay({ variant, ...props }: PopulationDisplayProps & { variant: number }) {
  const Layout = [Layout1, Layout2, Layout3, Layout4, Layout5, Layout6, Layout7][variant - 1];
  if (!Layout) return null;
  return <Layout {...props} />;
}
```

**5. Replace the inline rendering in ViewMode, EditMode, and CreateView:**
In each of these components, find where `EvaluationLayersIndicator`, `PopulationPreview`, and `DownstreamImpact` are rendered. Replace those three components with a single `<PopulationDisplay>` call, passing:
- `variant` from the parent state
- `members` — the already-computed member list
- `allPeople` — `data.people`
- `rule` — the current rule
- `layers` — the evaluation layers
- `excludedByLayers` — the already-computed exclusion data
- `policies` — the group's consumers / downstream policies
- `compact` — the inline flag

The `EvaluationLayersIndicator`, `PopulationPreview`, and `DownstreamImpact` components should stay in the file (they may still be used internally by layout-7-baseline-refined), but they are no longer rendered directly in the mode components.

**6. Add a floating HUD:**
Render a fixed-position HUD pill in the bottom-right corner of the viewport. The HUD:
- Position: `fixed`, bottom: 16px, right: 16px, z-index: 9999
- Background: white with the `S.deep` shadow, border-radius 12px, padding 8px
- Contains a row of small buttons, one per layout. Each button shows the icon and is 32x32px with border-radius 8px.
- The active layout button has `accent` background with white text
- Hovering a button shows a tooltip with the layout label
- The HUD also has a small label above the buttons: "Layout" in 10px uppercase muted text

**7. Add a layout label above the rendered area:**
In each mode component, above where `PopulationDisplay` is rendered, add a small label: the layout name in 11px, uppercase, 600 weight, `textMuted` color, with letter-spacing 0.5px. E.g., "FACETED SUMMARY". This makes screenshots self-documenting.

Do NOT create any new files. Only modify concept-E/index.tsx. The layout variant components are already built — you are wiring them in.

The scenario picker (view, edit, create, inline, advanced, legacy) in the shell should continue to work unchanged. The layout HUD is orthogonal — you can be in any scenario and switch layouts independently.
```
