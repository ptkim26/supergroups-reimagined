# Concept E — Layout Variant Explorations

## What this is

Seven alternative layouts for the "below conditions" area in Concept E. Each variant renders the same data — matched population, exclusions, and downstream impact — in a different spatial and visual arrangement.

The goal: find the layout that is both **beautiful at rest** (communicates population shape at a glance without reading a single name) and **functional on inspection** (lets admins drill into member details, exclusion reasons, and policy impact when they need to).

These layout explorations are **orthogonal to the competitive rule-builder findings**. The layouts address how membership results are *displayed*; the competitive research ([`Research/competitive-ux-nested-filtering-workforce-hcm-iam.md`](../../Research/competitive-ux-nested-filtering-workforce-hcm-iam.md)) addresses how rules are *authored*. The rule-builder changes (nested filter groups, save gating, per-member explain) live in `concept-E/rule-group-editor.tsx` and `concept-E/index.tsx`.

All seven variants share one interface contract. They can be built independently and in parallel. A final integration step wires them into Concept E behind a floating HUD that lets you toggle between layouts.

---

## Shared interface contract

Every layout variant exports a single default React component that accepts this props shape:

```typescript
import type { Person, RuleGroup, EvaluationLayer, PolicyRef } from '../shell/types';

export interface PopulationDisplayProps {
  /** People who match the current rule AND pass evaluation layers */
  members: Person[];
  /** The full employee roster (for context/stats) */
  allPeople: Person[];
  /** The current rule being evaluated */
  rule: RuleGroup;
  /** Active evaluation layers */
  layers: EvaluationLayer[];
  /** People who match the rule but are excluded by evaluation layers, grouped by layer */
  excludedByLayers: { layer: EvaluationLayer; people: Person[] }[];
  /** Downstream policies that reference this group */
  policies: PolicyRef[];
  /** True when rendered inside a 480px inline drawer */
  compact?: boolean;
}
```

This maps directly to data already computed inside Concept E's `ViewMode`, `EditMode`, and `CreateView`. No new data derivation is needed.

---

## Shared design tokens

Each layout file should copy these tokens from `concept-E/index.tsx` rather than importing them (keeps each file self-contained for parallel builds):

```typescript
const C = {
  bg: '#ffffff',
  surface: '#ffffff',
  surfaceAlt: '#f6f5f4',
  border: 'rgba(0,0,0,0.1)',
  borderStrong: 'rgba(0,0,0,0.2)',
  text: 'rgba(0,0,0,0.95)',
  textSecondary: '#615d59',
  textMuted: '#a39e98',
  accent: '#0075de',
  accentHover: '#005bab',
  accentLight: '#f2f9ff',
  accentBorder: '#d0e8ff',
  green: '#2a9d99',
  greenLight: '#f0faf9',
  greenBorder: '#b2e2e0',
  amber: '#dd5b00',
  amberLight: '#fff7f0',
  amberBorder: '#fdd0a8',
  red: '#d32d2d',
  redLight: '#fef2f2',
  redBorder: '#fccaca',
  purple: '#7C3AED',
  purpleLight: '#f5f3ff',
  purpleBorder: '#ddd6fe',
};

const FONT = 'Inter, -apple-system, system-ui, "Segoe UI", Helvetica, Arial, sans-serif';

const S = {
  card: 'rgba(0,0,0,0.04) 0px 4px 18px, rgba(0,0,0,0.027) 0px 2.025px 7.85px, rgba(0,0,0,0.02) 0px 0.8px 2.93px, rgba(0,0,0,0.01) 0px 0.175px 1.04px',
};
```

Each file should also include a local copy of the `Avatar` component and the `formatValue` / label helpers from concept-E. Reference `concept-E/index.tsx` for the exact implementations.

---

## Shared helpers to copy

These small helpers from `concept-E/index.tsx` should be copied into each layout file:

- **`Avatar`** — renders a colored circle with initials
- **`formatValue(field, val)`** — maps employment type / role state codes to labels
- **`fieldLabels`** — maps field keys to display names
- **`employmentTypeLabels`** / **`roleStateLabels`** — value display maps
- **`tierColor(tier)`** / **`tierLabel(tier)`** — sensitivity tier display helpers

---

## Output contract

Each layout variant lives at:

```
prototype/concept-E-layouts/layout-{N}-{name}.tsx
```

Each file:
- Default-exports a React component matching `PopulationDisplayProps`
- Imports types only from `../shell/types`
- Is fully self-contained (all tokens, helpers, and sub-components are local)
- Does NOT import from `concept-E/index.tsx` or any other concept folder

---

## The seven variants

| # | Name | One-liner |
|---|------|-----------|
| 1 | Faceted Summary | Composition bar charts by dimension; population shape is the hero |
| 2 | Composition Strip | Compact horizontal band: hero number + avatars + policy count on one line |
| 3 | Unified Hero Card | Single card merging count, composition, members, and impact into one object |
| 4 | Temporal Heartbeat | Sparkline of membership count over 30 days; the population has a visible pulse |
| 5 | Split Panel | Population and downstream impact side by side as peers |
| 6 | Waffle Grid | Colored cell grid where each cell = one person; abstract mosaic at rest |
| 7 | Baseline Refined | Current three sections merged into one continuous card (the control) |

See each variant's spec file for full details.

---

## HUD integration (final step)

After all 7 layout files are built, a final integration pass modifies `concept-E/index.tsx` to:

1. Import all 7 layout components
2. Add a `layoutVariant` state (1-7, default 7)
3. Render a floating HUD pill (fixed, bottom-right) with buttons for each layout
4. Replace the inline `EvaluationLayersIndicator` + `PopulationPreview` + `DownstreamImpact` rendering in `ViewMode`, `EditMode`, and `CreateView` with the selected layout component
5. Add a small label above the layout area showing the variant name (for screenshots)

The HUD is orthogonal to the scenario picker — you can be in any scenario (view, edit, create, inline, advanced, legacy) and switch layouts independently.
