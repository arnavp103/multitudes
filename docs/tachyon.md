# Tachyon design system

Tachyon is the visual foundation shared by `apps/webapp` and `apps/studio`. It is
a layer of CSS custom properties under the shadcn (New York) components in
`packages/ui`. Components read tokens. Apps read components and tokens. Neither
hard-codes colours, radii, shadows, or durations.

Studio `/tachyon` renders every token and component with the live theme. Use it
to check a change in all directions and in light and dark mode.

## Files

| File                                    | Purpose                                                       |
| --------------------------------------- | ------------------------------------------------------------- |
| `tooling/tailwind/tachyon/accent.css`   | The swappable brand accents (edit this when the logo changes) |
| `tooling/tailwind/tachyon/tokens.css`   | Core scales and their defaults                                |
| `tooling/tailwind/tachyon/directions/`  | Exploration directions D1–D4 (temporary, see below)           |
| `tooling/tailwind/tachyon/base.css`     | Element defaults, type utilities, backdrop, page entrance     |
| `tooling/tailwind/theme.css`            | Maps tokens to shadcn variables and the Tailwind theme        |
| `packages/ui/src/fonts.ts`              | Self-hosted typefaces exposed as `--font-*` variables         |
| `packages/ui/src/tachyon.tsx`           | Direction script, `useTachyonDirection`, review switcher      |
| `packages/ui/src/tachyon-backdrop.tsx`  | Decorative backdrop layer per direction                       |
| `packages/ui/src/tachyon-specimen.tsx`  | The `/tachyon` reference page                                 |

## Accent set

Brand colour is three roles, each with a light and dark value, plus an `-ink`
colour for text placed on a filled swatch:

- `--tachyon-signal`: primary actions, focus rings, links, selection
- `--tachyon-flare`: personality: highlighter marks, notes, notices
- `--tachyon-trace`: secondary data series and quiet indicators

The current values are placeholders. Swap them in `accent.css` only. Status
colours (`--tc-positive`, `--tc-caution`, `--tc-critical`) deliberately do not
derive from the accents, so a brand change cannot hide an error state.

## Token families

All tokens are prefixed `--tc-`.

- **Palette**: `paper` (page), `surface` (panels), `raised` (menus), `sunken`
  (wells, secondary), `field` (inputs), `ink`, `ink-muted`, `line`,
  `line-strong`, `outline`, `shade`, `grid`.
- **Type**: families by role: `font-body`, `font-display`, `font-data` (numbers,
  IDs, code), `font-note` (annotations), `font-readout` (metric values), each with
  an optional `*-variation` for variable-font axes. The scale is a minor third
  from a 14px body: `text-caption` 12, `text-body` 14, `text-lead` 17,
  `text-title` 20, `text-heading` 24, `text-display` 34, `text-hero` 42.
- **Density**: `control-h` (36px, New York), `control-h-sm`, `control-h-lg`,
  `control-px`, `panel-pad`, `panel-gap`, `cell-h`, `cell-px`, `nav-h`,
  `header-h`, `sidebar-w`, `page-px`, `page-py`, `stack` (gap between page
  sections).
- **Radius** by hierarchy: `radius-control`, `radius-panel`, `radius-sheet`,
  `radius-badge`.
- **Elevation**: `elevation-0` to `elevation-3` (flat, resting, floating, modal).
- **Transparency**: `glass-alpha`, `glass-blur`, `chrome-alpha`, `scrim`,
  `backdrop-opacity`.
- **Motion**: `ease-standard`, `ease-enter`, `ease-exit`, `ease-spring`,
  `duration-instant|quick|base|slow|scene`, `stagger`, and the page-entrance
  recipe `enter-animation`, `enter-transform`, `enter-filter`. Durations drop to
  zero under `prefers-reduced-motion`.

## Using tokens

Prefer the shadcn semantic utilities (`bg-card`, `text-muted-foreground`,
`border-input`) and Tachyon additions (`bg-sunken`, `text-ink-muted`,
`text-signal`, `text-caption`, `rounded-xl`). Read a token directly with
Tailwind's variable shorthand: `h-(--tc-control-h)`, `gap-(--tc-stack)`,
`border-(color:--tc-outline)`.

Type-role utilities set family, weight, tracking, and axes together:
`type-display`, `type-data` (also tabular numerals), `type-note`, and
`type-readout`. `glass` applies the translucent surface recipe.

Mix colours in `oklab`, not `oklch`. Mixing with `transparent` in `oklch` drops
the hue, and mixing two distant hues in `oklch` walks around the colour wheel.

Every shared component and shell region carries a `data-slot` (and buttons a
`data-variant`). Direction-specific treatments target those attributes from CSS,
so components do not fork per look.

## Directions (round 1)

`data-direction` on `<html>` selects one of four exploration directions. It is
set before first paint from `localStorage` or a `?direction=d1..d4` query
parameter and can be changed from the switcher in the sidebar footer.

- **D1 Cyanotype**: chart paper by day, blueprint by night; linework, registration
  ticks, Bezier construction curves; Archivo, Martian Mono, Architects Daughter.
- **D2 Field**: particle vector field behind frosted glass; Funnel Sans and
  Display, Azeret Mono.
- **D3 Xeno**: alien OS; chamfered panels, orbital linework, dot-matrix readouts;
  Saira, Kode Mono, Doto.
- **D4 Cel**: cel-shaded, outlined, hard hue-shifted shade plates and ribbons;
  Recursive (casual axis for headings and notes).

When a direction is chosen, its values move into `tokens.css`, the other
direction files, fonts, and backdrops are deleted, and the switcher is removed.
