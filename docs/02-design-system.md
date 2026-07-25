# ghstCandidate — Design System

## Vibe
Minimalist. Clean. Whitespace-dominant. Premium SaaS — not a generic "AI startup" template.
Inspiration: [Tsenta.com](https://tsenta.com) — stark, confident, purposeful.

## Core Rules
- **NO AI gradients** (no purple-to-cyan sweeps, no "glowing orbs", no mesh backgrounds).
- **NO emojis** anywhere in the UI.
- **NO decorative illustrations** unless they serve a direct functional purpose.
- Whitespace IS the design. Let it breathe.
- Every element must earn its space.

---

## Color Palette

Colors are used **sparingly** — only for status indicators or specific emphasis points. The base UI is achromatic.

| Token | Value | Usage |
|---|---|---|
| `--color-black` | `#0A0A0A` | Primary text, headings |
| `--color-white` | `#FFFFFF` | Page backgrounds, cards |
| `--color-gray-50` | `#F9FAFB` | Off-white panels, secondary backgrounds |
| `--color-gray-100` | `#F3F4F6` | Input backgrounds, subtle dividers |
| `--color-gray-300` | `#D1D5DB` | Borders, disabled states |
| `--color-gray-500` | `#6B7280` | Secondary / muted text |
| `--color-gray-700` | `#374151` | Body text |
| `--color-gray-900` | `#111827` | High-contrast text on light bg |

### Status Colors (Use ONLY for status indicators)

| Token | Value | Usage |
|---|---|---|
| `--color-status-success` | `#16A34A` | Applied, Confirmed |
| `--color-status-warning` | `#D97706` | Pending Review, Human-in-the-loop prompt |
| `--color-status-error` | `#DC2626` | Failed, Rejected |
| `--color-status-info` | `#2563EB` | Discovered, In Progress |

---

## Typography

### Heading Font: Comfortaa
- **Weight**: Bold (700)
- **Character**: Rounded, geometric, punchy — sets the brand tone without being playful.
- **Import**: `https://fonts.googleapis.com/css2?family=Comfortaa:wght@700&display=swap`
- **Usage**: All `<h1>` through `<h3>` elements, logo/wordmark.

### Body Font: Lato
- **Weight**: Regular (400), Medium (500), Bold (700)
- **Character**: Clean, humanist, highly legible at all sizes.
- **Import**: `https://fonts.googleapis.com/css2?family=Lato:wght@400;500;700&display=swap`
- **Usage**: All body copy, labels, inputs, buttons, navigation.

### Type Scale

| Level | Size | Weight | Font | Usage |
|---|---|---|---|---|
| Display | `3.5rem / 56px` | 700 | Comfortaa | Hero headlines |
| H1 | `2.25rem / 36px` | 700 | Comfortaa | Page titles |
| H2 | `1.5rem / 24px` | 700 | Comfortaa | Section headings |
| H3 | `1.125rem / 18px` | 700 | Comfortaa | Card headings |
| Body Large | `1rem / 16px` | 400 | Lato | Primary body text |
| Body | `0.875rem / 14px` | 400 | Lato | Secondary body text |
| Caption | `0.75rem / 12px` | 500 | Lato | Labels, captions, metadata |

---

## Spacing System (4px base grid)

```
--space-1:  4px
--space-2:  8px
--space-3:  12px
--space-4:  16px
--space-6:  24px
--space-8:  32px
--space-10: 40px
--space-12: 48px
--space-16: 64px
--space-20: 80px
--space-24: 96px
```

---

## Component Aesthetics

### Buttons
- Sharp corners (no `border-radius`), or very subtle `2px` radius maximum.
- Primary: Black background, white text. Hover: `#374151`.
- Secondary: White background, `1px solid #D1D5DB`. Hover: `#F9FAFB` bg.
- No shadow. No gradient.

### Inputs
- `1px solid #D1D5DB` border. Focus: `1px solid #0A0A0A`.
- Background: `#F9FAFB`. Placeholder: `#6B7280`.
- Font: Lato. No rounded corners (max `2px` radius).

### Cards
- Background: `#FFFFFF`. Border: `1px solid #F3F4F6`.
- Subtle `box-shadow: 0 1px 3px rgba(0,0,0,0.06)` at rest.
- Hover: shadow lifts slightly — `0 4px 12px rgba(0,0,0,0.08)`.

---

## Tailwind Config Tokens

```js
// tailwind.config.js mappings
fontFamily: {
  sans: ['Lato', 'sans-serif'],
  heading: ['Comfortaa', 'sans-serif'],
}
```

---

## What This Is NOT
- Not a dark mode dashboard (light-first, always).
- Not neon / glass / frosted panels.
- Not a landing page with big hero blobs.
- Not Bootstrap or Material Design.
