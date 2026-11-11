# Astryx Theme Configuration

## Base Theme
Starting from `@astryxdesign/theme-neutral`, defined via `defineTheme` in `viewer/src/theme.ts`.

## Tokens Changed

All colors are derived directly from the existing viewer CSS variables in `viewer/src/styles.css` without inventing any colors:

| Token Name | Light Value | Dark Value | Source CSS Variable |
|---|---|---|---|
| `--color-accent` | `#1971c2` | `#4dabf7` | `--accent` |
| `--color-accent-muted` | `#e7f5ff` | `#17324a` | `--accent-soft` |
| `--color-text-accent` | `#1971c2` | `#4dabf7` | `--accent` |
| `--color-icon-accent` | `#1971c2` | `#4dabf7` | `--accent` |
| `--color-background-body` | `#f5f6f8` | `#14171c` | `--bg` |
| `--color-background-surface` | `#ffffff` | `#1c2027` | `--panel` |
| `--color-background-card` | `#ffffff` | `#1c2027` | `--panel` |
| `--color-background-popover` | `#ffffff` | `#222831` | `--panel` / `--panel-2` |
| `--color-background-muted` | `#f1f3f5` | `#222831` | `--panel-2` |
| `--color-border` | `#dee2e6` | `#333b46` | `--line` |
| `--color-border-emphasized` | `#ced4da` | `#414b58` | `--line-strong` |
| `--color-text-primary` | `#212529` | `#e9ecef` | `--ink` |
| `--color-text-secondary` | `#6c757d` | `#9aa4b2` | `--muted` |
| `--color-icon-primary` | `#212529` | `#e9ecef` | `--ink` |
| `--color-icon-secondary` | `#6c757d` | `#9aa4b2` | `--muted` |
| `--color-success` | `#2f9e44` | `#2f9e44` | `--ok` |
| `--color-warning` | `#e67700` | `#e67700` | `--warn` |
| `--color-error` | `#e03131` | `#e03131` | `--error` |

## Theme Mode & Settings
- Mode is configured as `mode="system"` on the root Astryx `<Theme>` provider in `viewer/src/main.tsx`.
- Light mode is the default when standard media queries evaluate to light.
- Dark theme option is kept hidden in the Settings modal.
