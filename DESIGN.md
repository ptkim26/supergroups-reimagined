# Design System: Notion (adapted for admin tool prototypes)

> This file is derived from [awesome-design-md/notion](https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/notion/DESIGN.md). It captures the visual foundations — color, typography, spacing, elevation, component patterns — for use by AI coding agents when building or reskinning prototype UI. The original targets marketing pages; this adaptation is for a data-dense admin tool (filter builders, population lists, rule displays, change diffs). Strip marketing-specific patterns (hero sections, trust bars, logo grids) and lean on the foundational tokens.

## 1. Visual Theme & Atmosphere

Warm neutrals rather than cold grays. The page canvas is pure white (`#ffffff`) but text is warm near-black (`rgba(0,0,0,0.95)`). The warm gray scale (`#f6f5f4`, `#31302e`, `#615d59`, `#a39e98`) carries subtle yellow-brown undertones, giving the interface a tactile, almost analog warmth.

Inter font (or system equivalent) is the backbone. At display sizes, use negative letter-spacing. Weight range: 400 for body, 500 for UI elements, 600 for semi-bold labels, 700 for headings.

**Border philosophy**: ultra-thin `1px solid rgba(0,0,0,0.1)` borders — whisper-weight division. **Shadow system**: multi-layer stacks with cumulative opacity never exceeding 0.05.

**Key Characteristics:**
- Inter with negative letter-spacing at heading sizes (-0.25px at 22px, -0.5px at 26px+)
- Warm neutral palette: grays carry yellow-brown undertones (`#f6f5f4` warm white, `#31302e` warm dark)
- Near-black text via `rgba(0,0,0,0.95)` — not pure black
- Ultra-thin borders: `1px solid rgba(0,0,0,0.1)` throughout — whisper-weight
- Multi-layer shadow stacks with sub-0.05 opacity
- Notion Blue (`#0075de`) as the singular accent color for CTAs and interactive elements
- Pill badges (9999px radius) with tinted blue backgrounds for status indicators
- 8px base spacing unit

## 2. Color Palette & Roles

### Primary
- **Near-Black** (`rgba(0,0,0,0.95)`): Primary text, headings, body copy.
- **Pure White** (`#ffffff`): Page background, card surfaces, button text on blue.
- **Notion Blue** (`#0075de`): Primary CTA, link color, interactive accent — the only saturated color.

### Warm Neutral Scale
- **Warm White** (`#f6f5f4`): Background surface tint, section alternation, subtle card fill.
- **Warm Dark** (`#31302e`): Dark surface background.
- **Warm Gray 500** (`#615d59`): Secondary text, descriptions, muted labels.
- **Warm Gray 300** (`#a39e98`): Placeholder text, disabled states, caption text.

### Semantic Colors
- **Teal** (`#2a9d99`): Success states, positive indicators.
- **Green** (`#1aae39`): Confirmation, completion badges.
- **Orange** (`#dd5b00`): Warning states, attention indicators.
- **Red** (`#DC2626`): Error, destructive, removal indicators.
- **Purple** (`#7C3AED`): Premium features, system/advanced indicators.

### Interactive
- **Active Blue** (`#005bab`): Button hover/pressed state.
- **Focus Blue** (`#097fe8`): Focus ring on interactive elements.
- **Badge Blue Bg** (`#f2f9ff`): Pill badge background, tinted blue surface.
- **Badge Blue Text** (`#097fe8`): Pill badge text.

### Shadows & Depth
- **Card Shadow**: `rgba(0,0,0,0.04) 0px 4px 18px, rgba(0,0,0,0.027) 0px 2.025px 7.85px, rgba(0,0,0,0.02) 0px 0.8px 2.93px, rgba(0,0,0,0.01) 0px 0.175px 1.04px`
- **Deep Shadow**: `rgba(0,0,0,0.01) 0px 1px 3px, rgba(0,0,0,0.02) 0px 3px 7px, rgba(0,0,0,0.02) 0px 7px 15px, rgba(0,0,0,0.04) 0px 14px 28px, rgba(0,0,0,0.05) 0px 23px 52px`
- **Whisper Border**: `1px solid rgba(0,0,0,0.1)`

## 3. Typography Rules

### Font Family
`Inter, -apple-system, system-ui, "Segoe UI", Helvetica, Arial, sans-serif`

### Hierarchy

| Role | Size | Weight | Line Height | Letter Spacing | Use |
|------|------|--------|-------------|----------------|-----|
| Page Title | 22px | 700 | 1.27 | -0.25px | Group name, page heading |
| Section Heading | 16px | 700 | 1.50 | normal | Section titles |
| Body Large | 16px | 600 | 1.50 | normal | Emphasized body, count headers |
| Body | 14px | 400 | 1.50 | normal | Standard reading text |
| Body Medium | 14px | 500 | 1.50 | normal | Interactive text, filter values |
| Caption | 13px | 500 | 1.43 | normal | Metadata, secondary labels |
| Caption Light | 13px | 400 | 1.43 | normal | Descriptions |
| Badge | 12px | 600 | 1.33 | +0.125px | Pill badges, tags, status labels |
| Micro | 11px | 400 | 1.33 | +0.125px | Small metadata, timestamps |

### Principles
- Negative letter-spacing on headings, positive on badges, normal on body
- Four-weight system: 400 (read), 500 (interact), 600 (emphasize), 700 (announce)
- Minimum readable body text: 14px. 12-13px only for badges, micro labels, captions.

## 4. Component Patterns (admin tool)

### Buttons
- **Primary**: `#0075de` bg, `#ffffff` text, 4px radius, `8px 16px` padding
- **Secondary**: `rgba(0,0,0,0.05)` bg, near-black text, 4px radius
- **Ghost**: transparent bg, near-black text, subtle bg on hover (`rgba(0,0,0,0.04)`)
- **Pill Badge**: `#f2f9ff` bg, `#097fe8` text, 9999px radius, `4px 8px` padding, 12px weight 600

### Cards & Containers
- Background: `#ffffff`
- Border: `1px solid rgba(0,0,0,0.1)` (whisper)
- Radius: 12px (cards), 8px (inline containers), 4px (inputs/buttons)
- Shadow: card shadow stack for elevated elements

### Inputs & Selects
- Background: `#ffffff`
- Border: `1px solid rgba(0,0,0,0.1)`
- Padding: `6px 8px`
- Radius: 4px
- Placeholder: `#a39e98`
- Focus: blue outline ring

### Filter Rows
- Clean, flat, minimal chrome — like Notion/Linear filter rows
- Combinator badges (AND/OR): pill style
- Row hover: `#f6f5f4` background
- Delete: ghost button, visible on hover

### Person Rows
- Hover: `#f6f5f4` background
- Name: 14px weight 500
- Details: 13px weight 400, `#615d59`
- No borders between rows — use spacing
- Avatar: warm-toned, whisper border

### Section Labels
- 12px weight 600, letter-spacing +0.5px, uppercase, `#a39e98`
- No border below — use spacing

## 5. Layout Principles

- Base spacing unit: 8px
- Generous vertical rhythm: 16-24px between sections within a panel
- White sections alternate with warm white (`#f6f5f4`) for visual rhythm
- Border radius scale: 4px (functional), 8px (containers), 12px (cards), 9999px (pills)
- Borders are whispers, shadows are for elevation

## 6. Depth & Elevation

| Level | Treatment | Use |
|-------|-----------|-----|
| Flat | No shadow, no border | Page background |
| Whisper | `1px solid rgba(0,0,0,0.1)` | Standard borders, dividers |
| Card | 4-layer shadow stack | Content cards, panels |
| Deep | 5-layer shadow stack | Modals, popovers, featured |
| Focus | `2px solid #097fe8` outline | Keyboard focus |
