# Layout 5: Split Panel

## Concept

Put the population and the downstream impact **side by side** instead of stacking them vertically. The left panel (wider) shows the population — who matches and why. The right panel (narrower) shows the downstream impact — what this group controls. They're equals, not parent and footnote.

## Design hypothesis

The current layout creates an implicit hierarchy: the population is "the content" and the downstream impact is "the footer." But for mid-market and enterprise admins, the downstream impact is arguably *more important* — knowing that this group feeds into payroll, compliance, and access policies is the context that makes the population meaningful. Side-by-side layout asserts that "who matches" and "what it controls" are equally important, and lets admins see both without scrolling.

## Visual specification

### At rest (the default state)

A two-column layout within the card area:

**Left panel (60% width): The Population**

This panel contains the match count, exclusion indicator, and member list — everything about "who."

Top of panel:
- Match count as a bold number: "25 people" in 20px, 700 weight, `text` color
- If exclusions exist: "2 excluded" in 13px amber text on the same line, right of the count. Clickable to expand layer detail below.

Below the count:
- A thin horizontal composition bar (6px tall, full width) showing the population breakdown by department. Color-coded segments, proportional widths. Muted palette. This gives a quick visual fingerprint of the population without taking vertical space. No labels on the bar itself — it's a visual accent.

Below the bar:
- The member list. Shows the first 8 people as avatar rows (avatar, name, title · department · location). Each person is clickable for a "why" explanation.
- If total > 8: paginated with prev/next controls at the bottom.
- A subtle search input appears above the member list when count > 30: "Filter people..." in `textMuted` placeholder.

**Right panel (40% width): The Impact**

This panel contains the downstream impact — everything about "what this group controls."

Top of panel:
- Header: "Downstream impact" in 12px, 600 weight, `textMuted`, uppercase, tracking 0.5px
- Below: the total affected count: "2,402 people affected" in 16px, 600 weight, `text` color

Below the header:
- A list of policies, always expanded (not behind a disclosure). Each policy row:
  - Sensitivity tier badge (colored pill: "Critical" in red, "Standard" in amber, "Low" in green) — 11px, uppercase
  - Policy name in 14px, 500 weight
  - Domain label in 13px, `textSecondary`
  - Affected count in 13px, `textMuted`, right-aligned
  - Each row has 8px vertical padding and a subtle bottom border

Below the policy list:
- If there are more than 5 policies, the list is scrollable (max-height: 300px) with a subtle fade at the bottom edge. In practice, with mock data, this won't trigger — but the design should account for it.

**The gutter between panels:**
- 24px gap between left and right panels
- A subtle vertical divider line (1px, `border` color) centered in the gap
- The divider doesn't span the full height — it starts 8px from the top and ends 8px from the bottom, with rounded ends

### Visual balance

The two panels should feel like two pages of an open book. The left page is denser (more rows, more data), the right page is calmer (fewer items, more whitespace). This asymmetry is intentional — the population is the primary content, the impact is the contextual sidebar.

Both panels share the same card background and outer border-radius. The card has a single subtle shadow. The panels are not separate cards — they're two halves of one card.

### Expanded states

**Exclusion detail (left panel):**
Clicking "2 excluded" expands the layer breakdown below the match count line and above the composition bar. It pushes the member list down within the left panel. The right panel is unaffected.

**Person explanation (left panel):**
Clicking a person in the member list shows the explanation popover inline below that person's row. The right panel is unaffected.

**Policy detail (right panel):**
Since the policies are always visible (not behind a disclosure), there's no expansion needed for the policy list. However, clicking a policy row could highlight it and show additional detail below: "California Benefits Policy: Targets all full-time employees in CA for medical, dental, and vision coverage." This is optional — the policy rows are informative enough on their own.

## Scale behavior

- **5 people:** The left panel shows all 5 people with no pagination. The composition bar might have only 2 segments. The right panel has the same amount of content. The layout is slightly lopsided (empty space at the bottom of the left panel), but this is fine — the visual balance is acceptable.

- **25 people:** The core case. The left panel shows 8 people with pagination. The right panel shows 3-5 policies. Both panels have similar visual weight.

- **100 people:** The left panel has extensive pagination. The composition bar is more varied. The right panel stays the same size. Add the search input above the member list.

- **500+ people:** The left panel's member list becomes search-driven rather than browse-driven. The composition bar is the primary way to understand the population. The right panel may have more policies. The split layout handles this well — the right panel acts as a stable reference while the left panel is explored.

## Inline behavior (compact = true, 480px width)

At 480px, the two-column layout collapses to a **single column** — the left panel stacks above the right panel. This is a standard responsive breakpoint behavior.

When collapsed:
- The population section renders first (count, composition bar, member list)
- Below it, a horizontal divider
- Then the impact section (header, policy list)
- All padding reduces to 12px
- Member list shows 5 per page instead of 8

The compact behavior is equivalent to the current vertical stacking — but when the user switches to a wider context, the side-by-side layout activates. Use the `compact` prop to determine the layout mode.

## Interaction model

| Action | Result |
|--------|--------|
| **View at rest** | Population on the left, policies on the right — all visible without clicks |
| **Click "2 excluded"** | Layer breakdown expands in the left panel |
| **Click a person** | Explanation popover in the left panel |
| **Click a policy row** | Optional: additional policy detail expands in the right panel |
| **Navigate member list pages** | Only the left panel updates |
| **Search members** | Filters the member list in the left panel only |

## Accessibility notes

- The two-panel layout should use `role="region"` for each panel with `aria-label="Population"` and `aria-label="Downstream impact"`
- The vertical divider is decorative (`aria-hidden="true"`)
- The composition bar should have `role="img"` with an `aria-label` describing the breakdown
- Tab order goes through the left panel first, then the right panel (logical reading order)
- In the collapsed (compact) state, the landmark roles stay the same — the content is just stacked

## What this layout tests

- Does making the downstream impact always visible (not behind a disclosure) change how admins evaluate the group?
- Does the side-by-side layout feel like a coherent object or like two unrelated panels?
- Do admins look at the right panel (impact) before or after examining the left panel (population)?
- Is the collapse-to-vertical behavior in compact mode a seamless transition or a jarring reflow?
