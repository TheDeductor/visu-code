# Astryx Discovery

================================================================================
COMMAND: npm run astryx -- docs principles --dense
================================================================================


> vibemap@0.1.0 astryx
> node node_modules/@astryxdesign/cli/clients/cli/bin/astryx.mjs docs principles --dense

package: @astryxdesign/cli

# Principles

core design principles + rules for the design system

## Philosophy

consistency, adaptability, DX. core ideas:

- components over primitives
- semantic tokens over hardcoded values
- theme-agnostic code
- open internals

## Rules

8 rules for on-system app code.

1. use components
2. frame-first layout: shell + region budgets before content (`npx astryx docs layout`)
3. dense data = rows (Table, List/Item) not Cards; Card = widgets/galleries/settings groups
4. StyleX or Tailwind for styling (`npx astryx docs styling`)
5. semantic tokens only (`npx astryx docs tokens`)
6. CSS vars for colors
7. controlled form inputs
8. useLinkComponent() for navigation

## Styling

xstyle prop for component overrides. StyleX or Tailwind for layout.

full guide: `npx astryx docs styling`

## Anti-Patterns

what breaks theming, routing, or layout, and the fix.

x no inline styles on raw elements
x no hardcoded colors — use tokens or Tailwind semantic classes
x no hardcoded spacing
x no hardcoded <a> — use useLinkComponent()
x no Card-wrapped list items — frame first, rows for dense data (`npx astryx docs layout`)
x no decorative Badge — StatusDot/Token for status
x read docs before inventing props

## Tokens

full token reference: `npx astryx docs tokens`

Up: npx astryx docs guides
Previous: npx astryx docs is-my-code-good
Next: npx astryx docs styling-overview


================================================================================
COMMAND: npm run astryx -- docs tokens --dense
================================================================================


> vibemap@0.1.0 astryx
> node node_modules/@astryxdesign/cli/clients/cli/bin/astryx.mjs docs tokens --dense

All Tokens
Complete reference for color, data visualization, syntax, spacing, size, border, focus, radius, shadow, motion, and
typography tokens.

package: @astryxdesign/cli

Token Categories

tokens-color        Semantic colors for consistent theming. All colors use light-dark() for automatic mode switching.
tokens-data         Colors for charts and graphs: one categorical accent per series, a neutral for labels and reference
                    lines, and sequential ramps from 5 (darkest) to 1 (lightest) for ordered scales and heatmaps. Import
                    dataVars from @astryxdesign/core/theme/dataTokens.stylex for CSS-capable code. Source compilation
                    emits the complete 56-variable group when any member is retained and none for an unused graph.
                    Prebuilt CSS consumers load @astryxdesign/core/astryx.css, which defines the complete group for the
                    already-compiled dataVars entry.
tokens-syntax       Code highlighting colors used by CodeBlock. Each defaults to a palette token, so syntax colors
                    follow the theme; defineTheme({syntax}) sets a syntax theme instead.
tokens-spacing      Spacing scale used for padding, gap, and margin. Component gap props map spacing steps to these
                    tokens.
tokens-size         Control heights for consistent sizing across buttons, inputs, and selectors.
tokens-border       Border width for card and input borders.
tokens-focus        The keyboard focus ring, shared by every component that draws one. Override these to restyle focus
                    across the system.
tokens-radius       Numeric scale based on a 4dp base unit. Tokens scale with the theme's radius multiplier;
                    --radius-none and --radius-full are fixed.
tokens-shadow       Elevation shadows (low to med to high) and inset shadows for input state rings.
tokens-duration     Motion duration primitives. Three bands: fast (micro-interactions), medium (entrance/exit), slow
                    (continuous). Min/max variants derive from base × ratio. Of a theme's two `motion` knobs, `tempo`
                    (0.75-1.5) scales every duration here; `character` leaves durations alone. A duration scale beats
                    `tempo` for the bands it sets, and explicit `tokens` beat both. `tempo` leaves these unscaled:
                    finger tracking, momentum, the rubber band, the on-screen keyboard, the press's onset delay, cancel
                    distance and tap flash, hover-intent delays, gesture thresholds, Spinner's and Skeleton's loops, and
                    the 200 ms Reduce Motion cap.
tokens-ease         Easing curves for animations and transitions. Of a theme's two `motion` knobs, `character` sets
                    `--ease-entrance` and `--ease-move`: `crisp` decelerates without overshoot, `expressive` overshoots
                    slightly, and at `standard` both equal `--ease-standard`; `--ease-exit` keeps its own curve at every
                    character. `tempo` leaves curves alone. A duration scale's own fields win over the knobs, and
                    explicit `tokens` win over everything. No curve here shapes motion that follows a finger or the
                    system (dragging, momentum, the rubber band, the on-screen keyboard), and the press's clocks,
                    hover-intent delays and gesture thresholds keep their timing whatever the character.
tokens-typography   Font family stacks for body, code, and heading text.
tokens-text-size    Geometric type scale: round(14 × 1.2^step). Base is 14px (--font-size-base).
tokens-font-weight  Font weight values for body, emphasis, and headings.
tokens-type-scale   Semantic tokens for headings, body, labels, code, supporting text, and display text. References font
                    size and weight tokens. Override via typography.scale in defineTheme.
tokens-usage        How to import and use token variables in StyleX styles.

Open one: npx astryx docs tokens/<name>
Up: npx astryx docs


================================================================================
COMMAND: npm run astryx -- docs theme --dense
================================================================================


> vibemap@0.1.0 astryx
> node node_modules/@astryxdesign/cli/clients/cli/bin/astryx.mjs docs theme --dense

package: @astryxdesign/cli

# Theming

use + create themes: see use-a-theme and author-a-theme.

## Quick start

Install a theme, wrap in `<Theme>` (`import {Theme} from '@astryxdesign/core/theme'`). `npx astryx docs use-a-theme` for full guide.

Wire the generated module once:
```tsx
import {Theme} from '@astryxdesign/core/theme';
import {themes, defaultThemeSlug} from './astryx-themes';

function App() {
  return (
    <Theme theme={themes[defaultThemeSlug]}>
      <YourApp />
    </Theme>
  );
}
```

## Custom themes

`defineTheme` + token overrides + component overrides. `npx astryx docs author-a-theme` for full guide.

Quick start:
```bash
npx astryx theme add stone   # use an existing theme
npx astryx theme eject stone # fork its source to customize
npx astryx theme build src/themes/stone/stoneTheme.ts
```

new palette: `npx astryx theme palette generate palette.config.json --out palette.generated.ts` → review + commit module and receipt → `import {palette} from './palette.generated';` → map semantic tokens to stable stops such as `palette.neutral.light[100]` / `palette.neutral.dark[15]`. regeneration updates mapped roles; generation does not rewrite the theme.

Map semantic tokens to generated palette stops:
```tsx
import {defineTheme} from '@astryxdesign/core/theme';
import {palette} from './palette.generated';

const myTheme = defineTheme({
  name: 'my-theme',
  tokens: {
    '--color-background-surface': [
      palette.neutral.light[100],
      palette.neutral.dark[15],
    ],
  },
});
```

## Icon sizes

theme sets each Icon size's glyph dimension: `width` + `height` on `components.icon['size:sm']` (or xsm/md/lg); semantic names + SVG components alike. px or rem only: a semantic icon takes its font size from the dimension, so em also grows its box. unstyled: xsm/sm/md/lg = 12/16/20/24px at 16px root, scale w/ root font size (rem keeps it). size names are fixed.

Set Icon size dimensions:
```tsx
const brandTheme = defineTheme({
  name: 'brand',
  components: {
    icon: {
      'size:sm': {width: '1.125rem', height: '1.125rem'},
      'size:lg': {width: '1.75rem', height: '1.75rem'},
    },
  },
});
```

## Dark mode

[light, dark] tuples, mode='system'. `npx astryx docs use-a-theme` for full guide.

Light/dark tuple:
```tsx
'--color-accent': ['#0064E0', '#2694FE'],
//                   ^light     ^dark
```

## Integration themes

Install integration. `npx astryx theme add` imports, and `theme eject` forks source. `npx astryx docs use-a-theme` for full guide.

Up: npx astryx docs guides
Previous: npx astryx docs styling-overview
Next: npx astryx docs use-a-theme


================================================================================
COMMAND: npm run astryx -- component --list
================================================================================


> vibemap@0.1.0 astryx
> node node_modules/@astryxdesign/cli/clients/cli/bin/astryx.mjs component --list

Components (174)

name:   AlertDialog
import: @astryxdesign/core/AlertDialog

name:   AppShell
import: @astryxdesign/core/AppShell

name:   AspectRatio
import: @astryxdesign/core/AspectRatio

name:   Avatar
import: @astryxdesign/core/Avatar

name:   AvatarGroup
import: @astryxdesign/core/AvatarGroup

name:   AvatarGroupOverflow
import: @astryxdesign/core/AvatarGroup

name:   AvatarStatusDot
import: @astryxdesign/core/Avatar

name:   Badge
import: @astryxdesign/core/Badge

name:   Banner
import: @astryxdesign/core/Banner

name:   BaseTypeahead
import: @astryxdesign/core/Typeahead

name:   Blockquote
import: @astryxdesign/core/Blockquote

name:   BottomSheet
import: @astryxdesign/core/BottomSheet

name:   BottomSheetSwitcher
import: @astryxdesign/core/BottomSheet

name:   BreadcrumbItem
import: @astryxdesign/core/Breadcrumbs

name:   Breadcrumbs
import: @astryxdesign/core/Breadcrumbs

name:   Button
import: @astryxdesign/core/Button

name:   ButtonGroup
import: @astryxdesign/core/ButtonGroup

name:   Calendar
import: @astryxdesign/core/Calendar

name:   Card
import: @astryxdesign/core/Card

name:   Carousel
import: @astryxdesign/core/Carousel

name:   Center
import: @astryxdesign/core/Center

name:   ChatComposer
import: @astryxdesign/core/Chat

name:   ChatComposerDrawer
import: @astryxdesign/core/Chat

name:   ChatComposerInput
import: @astryxdesign/core/Chat

name:   ChatDictationButton
import: @astryxdesign/core/Chat

name:   ChatLayout
import: @astryxdesign/core/Chat

name:   ChatLayoutScrollButton
import: @astryxdesign/core/Chat

name:   ChatMessage
import: @astryxdesign/core/Chat

name:   ChatMessageBubble
import: @astryxdesign/core/Chat

name:   ChatMessageList
import: @astryxdesign/core/Chat

name:   ChatMessageMetadata
import: @astryxdesign/core/Chat

name:   ChatSendButton
import: @astryxdesign/core/Chat

name:   ChatSystemMessage
import: @astryxdesign/core/Chat

name:   ChatTokenizedText
import: @astryxdesign/core/Chat

name:   ChatToolCalls
import: @astryxdesign/core/Chat

name:   CheckboxInput
import: @astryxdesign/core/CheckboxInput

name:   CheckboxList
import: @astryxdesign/core/CheckboxList

name:   CheckboxListItem
import: @astryxdesign/core/CheckboxList

name:   Citation
import: @astryxdesign/core/Citation

name:   ClickableCard
import: @astryxdesign/core/ClickableCard

name:   Code
import: @astryxdesign/core/Code

name:   CodeBlock
import: @astryxdesign/core/CodeBlock

name:   Collapsible
import: @astryxdesign/core/Collapsible

name:   CollapsibleGroup
import: @astryxdesign/core/Collapsible

name:   CommandPalette
import: @astryxdesign/core/CommandPalette

name:   CommandPaletteEmpty
import: @astryxdesign/core/CommandPalette

name:   CommandPaletteFooter
import: @astryxdesign/core/CommandPalette

name:   CommandPaletteGroup
import: @astryxdesign/core/CommandPalette

name:   CommandPaletteInput
import: @astryxdesign/core/CommandPalette

name:   CommandPaletteItem
import: @astryxdesign/core/CommandPalette

name:   CommandPaletteList
import: @astryxdesign/core/CommandPalette

name:   ComplexSelector
import: @astryxdesign/core/ComplexSelector

name:   ContextMenu
import: @astryxdesign/core/ContextMenu

name:   DateInput
import: @astryxdesign/core/DateInput

name:   DateRangeInput
import: @astryxdesign/core/DateRangeInput

name:   DateTimeInput
import: @astryxdesign/core/DateTimeInput

name:   Dialog
import: @astryxdesign/core/Dialog

name:   DialogHeader
import: @astryxdesign/core/Dialog

name:   Divider
import: @astryxdesign/core/Divider

name:   Drawer
import: @astryxdesign/core/Drawer

name:   DrawerHeader
import: @astryxdesign/core/Drawer

name:   DropdownMenu
import: @astryxdesign/core/DropdownMenu

name:   DropdownMenuCheckboxItem
import: @astryxdesign/core/DropdownMenu

name:   DropdownMenuDivider
import: @astryxdesign/core/DropdownMenu

name:   DropdownMenuGroup
import: @astryxdesign/core/DropdownMenu

name:   DropdownMenuItem
import: @astryxdesign/core/DropdownMenu

name:   DropdownMenuRadioGroup
import: @astryxdesign/core/DropdownMenu

name:   DropdownMenuRadioItem
import: @astryxdesign/core/DropdownMenu

name:   DropdownMenuSubMenu
import: @astryxdesign/core/DropdownMenu

name:   EmptyState
import: @astryxdesign/core/EmptyState

name:   Field
import: @astryxdesign/core/Field

name:   FieldLabel
import: @astryxdesign/core/Field

name:   FieldStatus
import: @astryxdesign/core/FieldStatus

name:   FileInput
import: @astryxdesign/core/FileInput

name:   FormLayout
import: @astryxdesign/core/FormLayout

name:   Grid
import: @astryxdesign/core/Grid

name:   GridSpan
import: @astryxdesign/core/Grid

name:   Heading
import: @astryxdesign/core/Heading

name:   HoverCard
import: @astryxdesign/core/HoverCard

name:   HStack
import: @astryxdesign/core/HStack

name:   Icon
import: @astryxdesign/core/Icon

name:   IconButton
import: @astryxdesign/core/IconButton

name:   InfoTip
import: @astryxdesign/core/InfoTip

name:   InputGroup
import: @astryxdesign/core/InputGroup

name:   InputGroupText
import: @astryxdesign/core/InputGroup

name:   InternationalizationProvider
import: @astryxdesign/core/i18n

name:   Item
import: @astryxdesign/core/Item

name:   Kbd
import: @astryxdesign/core/Kbd

name:   Layout
import: @astryxdesign/core/Layout

name:   LayoutContent
import: @astryxdesign/core/Layout

name:   LayoutFooter
import: @astryxdesign/core/Layout

name:   LayoutHeader
import: @astryxdesign/core/Layout

name:   LayoutPanel
import: @astryxdesign/core/Layout

name:   Lightbox
import: @astryxdesign/core/Lightbox

name:   Link
import: @astryxdesign/core/Link

name:   LinkProvider
import: @astryxdesign/core/Link

name:   List
import: @astryxdesign/core/List

name:   ListItem
import: @astryxdesign/core/List

name:   Markdown
import: @astryxdesign/core/Markdown

name:   MediaTheme
import: @astryxdesign/core/theme

name:   MetadataList
import: @astryxdesign/core/MetadataList

name:   MetadataListItem
import: @astryxdesign/core/MetadataList

name:   MobileNav
import: @astryxdesign/core/MobileNav

name:   MoreMenu
import: @astryxdesign/core/MoreMenu

name:   MultiSelector
import: @astryxdesign/core/MultiSelector

name:   NavIcon
import: @astryxdesign/core/NavIcon

name:   NumberInput
import: @astryxdesign/core/NumberInput

name:   Outline
import: @astryxdesign/core/Outline

name:   OverflowList
import: @astryxdesign/core/OverflowList

name:   Overlay
import: @astryxdesign/core/Overlay

name:   Pagination
import: @astryxdesign/core/Pagination

name:   Popover
import: @astryxdesign/core/Popover

name:   PowerSearch
import: @astryxdesign/core/PowerSearch

name:   ProgressBar
import: @astryxdesign/core/ProgressBar

name:   RadioList
import: @astryxdesign/core/RadioList

name:   RadioListItem
import: @astryxdesign/core/RadioList

name:   ScrollableArea
import: @astryxdesign/core/ScrollableArea

name:   Section
import: @astryxdesign/core/Section

name:   SegmentedControl
import: @astryxdesign/core/SegmentedControl

name:   SegmentedControlItem
import: @astryxdesign/core/SegmentedControl

name:   SelectableCard
import: @astryxdesign/core/SelectableCard

name:   Selector
import: @astryxdesign/core/Selector

name:   SelectorOption
import: @astryxdesign/core/Selector

name:   SideNav
import: @astryxdesign/core/SideNav

name:   SideNavCollapseButton
import: @astryxdesign/core/SideNav

name:   SideNavHeading
import: @astryxdesign/core/SideNav

name:   SideNavItem
import: @astryxdesign/core/SideNav

name:   SideNavSection
import: @astryxdesign/core/SideNav

name:   Skeleton
import: @astryxdesign/core/Skeleton

name:   Slider
import: @astryxdesign/core/Slider

name:   Spinner
import: @astryxdesign/core/Spinner

name:   Stack
import: @astryxdesign/core/Stack

name:   StatusDot
import: @astryxdesign/core/StatusDot

name:   Step
import: @astryxdesign/core/Stepper

name:   Stepper
import: @astryxdesign/core/Stepper

name:   Switch
import: @astryxdesign/core/Switch

name:   Tab
import: @astryxdesign/core/TabList

name:   Table
import: @astryxdesign/core/Table

name:   TableBody
import: @astryxdesign/core/Table

name:   TableCell
import: @astryxdesign/core/Table

name:   TableFooter
import: @astryxdesign/core/Table

name:   TableHeader
import: @astryxdesign/core/Table

name:   TableHeaderCell
import: @astryxdesign/core/Table

name:   TableRow
import: @astryxdesign/core/Table

name:   TableSelectionToolbar
import: @astryxdesign/core/Table

name:   TabList
import: @astryxdesign/core/TabList

name:   TabMenu
import: @astryxdesign/core/TabList

name:   Text
import: @astryxdesign/core/Text

name:   TextArea
import: @astryxdesign/core/TextArea

name:   TextInput
import: @astryxdesign/core/TextInput

name:   Theme
import: @astryxdesign/core/theme

name:   Thumbnail
import: @astryxdesign/core/Thumbnail

name:   TimeInput
import: @astryxdesign/core/TimeInput

name:   Timer
import: @astryxdesign/core/Timer

name:   Timestamp
import: @astryxdesign/core/Timestamp

name:   Toast
import: @astryxdesign/core/Toast

name:   ToggleButton
import: @astryxdesign/core/ToggleButton

name:   ToggleButtonGroup
import: @astryxdesign/core/ToggleButton

name:   Token
import: @astryxdesign/core/Token

name:   Tokenizer
import: @astryxdesign/core/Tokenizer

name:   Toolbar
import: @astryxdesign/core/Toolbar

name:   Tooltip
import: @astryxdesign/core/Tooltip

name:   TopNav
import: @astryxdesign/core/TopNav

name:   TopNavHeading
import: @astryxdesign/core/TopNav

name:   TopNavItem
import: @astryxdesign/core/TopNav

name:   TopNavMegaMenu
import: @astryxdesign/core/TopNav

name:   TopNavMegaMenuFeaturedCard
import: @astryxdesign/core/TopNav

name:   TopNavMegaMenuItem
import: @astryxdesign/core/TopNav

name:   TopNavMenu
import: @astryxdesign/core/TopNav

name:   TreeList
import: @astryxdesign/core/TreeList

name:   Typeahead
import: @astryxdesign/core/Typeahead

name:   TypeaheadItem
import: @astryxdesign/core/Typeahead

name:   VisuallyHidden
import: @astryxdesign/core/VisuallyHidden

name:   VStack
import: @astryxdesign/core/VStack

Import from the path shown (e.g. import {Button} from '@astryxdesign/core/Button')
Usage: npx astryx component <name> [name...]


================================================================================
COMMAND: npm run astryx -- template --list
================================================================================


> vibemap@0.1.0 astryx
> node node_modules/@astryxdesign/cli/clients/cli/bin/astryx.mjs template --list

Page Templates

id:          ai-chat
name:        AI Chat Conversation
description: Transcript of alternating turns carrying mixed rich content inline (markdown, code blocks, collapsible tool-call output) beside a resizable artifact panel that holds generated output while the stream keeps scrolling.

id:          ai-chat-landing
name:        AI Chat Landing
description: Zero-state entry surface centered on a single composer with suggestion chips instead of history, sized for the moment before any content exists. The empty counterpart to a transcript.

id:          dashboard
name:        Analytics Dashboard
description: Three-band analytics: a row of headline tiles, then charts, then supporting tables, all re-reading from one global filter bar. Breadth over depth, a summary surface rather than a drill-down.

id:          login
name:        Basic Login
description: Minimal centered credential form on a plain ground: two fields and a submit, nothing competing for attention. The least-chrome entry surface.

id:          blank
name:        Blank
description: Bare scaffold: one heading slot, one empty content region, no navigation and no chrome. The starting point when every other layout imposes more structure than wanted.

id:          canvas-editor
name:        Canvas Editor
description: Layered artboard workspace: document tabs over a layer rail, a fixed-size frame you zoom on a muted backdrop, and an inspector of position, type, and filter fields that retargets to the selected layer. Objects hold a coordinate rather than reflowing, so moving one never moves another.

id:          library
name:        Card Grid
description: Searchable, browsable card grid with filter tabs and a real empty state: uniform tiles organized by topic, narrowing in place, with no detail surface behind them.

id:          centered-hero
name:        Centered Hero
description: Symmetrical centered stack (headline, short blurb, paired call-to-action buttons) resting on one wide full-bleed picture, with nothing on either flank competing.

id:          payment-form
name:        Checkout Form
description: Long sectioned form running beside a summary that stays visible while the fields scroll and recalculates as they change, ending on a terminal confirm of the total. Sections run contact, address, delivery choice, then card details.

id:          checkout-wizard
name:        Checkout Wizard
description: Multi-step checkout, cart, order, and payment wizard with a running summary that recalculates as answers change. It adapts to its host width, renders the summary first on narrow surfaces, validates every forward path, and completes locally without sending payment.

id:          classic-gallery
name:        Classic Gallery
description: Uniform grid of equal-ratio media tiles under a centered intro, with filter tabs that narrow the set in place. Regular rhythm, unlike the variable-height masonry variant.

id:          table-collapsible
name:        Collapsible Table
description: Several tables on one page, each in a collapsible card with its own columns - for groups that do not share a schema, where one table would stand full of empty cells. One time range drives them all, and rows expand into a history chart. Accounts, integrations, sections, sort, expand, or collapse.

id:          table-comparison
name:        Comparison Table
description: Transposed matrix that puts candidates in the columns and criteria in grouped rows, with a pinned label column that survives horizontal scroll, columns you can swap or add, and best-in-row marks you can toggle. Compare, comparison, matrix, spec sheet, feature grid, pricing table, benchmark, frozen column, sticky column, or side-by-side.

id:          contact-form
name:        Contact Form
description: Flat single-column form mixing control types (text, pill toggles, dropdowns, long free-text) landing on one full-width submit. No steps, no branching, no summary rail.

id:          course-detail
name:        Course Detail
description: Long-form sales page for a single offering, in two columns - read the pitch, then enroll from a sticky rail. The main column holds a preview poster with a fact row, an about block with skill chips, a module syllabus whose sections collapse module by module, an instructor card, reviews with a scored-aspects panel, and a FAQ; the rail holds the price, a self-paced or cohort start picker, and a weekly-pace slider that computes a finish date. The shape for any offering with a curriculum and a purchase panel - a course, class, masterclass, bootcamp, workshop, or training.

id:          dashboard-comparison
name:        Data Dashboard
description: Comparison-heavy analytics behind a persistent filter bar: tiles that each carry an inline sparkline and several period-over-period deltas, then segmented breakdowns underneath. Every number is shown against another number.

id:          form-wizard-dialog
name:        Dialog Wizard
description: Step through a short flow in a dialog, overlay, or popup launched from the page underneath, which stays where it was. Compact step markers and a pinned action row inside a constrained width, rather than the full page a wizard usually gets. Best for two to four short steps - setup, invite, schedule, onboarding - where losing the context underneath would cost more than the flow is worth.

id:          documentation
name:        Documentation Catalog
description: Reference landing that is pure wayfinding: a banner above a grid of category cards linking into sections, with no article content on the surface itself.

id:          documentation-design
name:        Documentation Design
description: Reference article alternating prose with live rendered examples: an interactive preview, a property table, paired do and don't comparisons, and copyable code blocks.

id:          documentation-technical
name:        Documentation Technical
description: Reference article ordered as sequential numbered steps with code at each stage, plus callout cards for prerequisites and onward links. A linear walkthrough rather than a browsable reference.

id:          dashboard-scorecard
name:        Executive Summary Dashboard
description: Report-shaped analytics with a prose rail beside the charts: a scorecard of headline numbers with period deltas and status coloring, goal-attainment bars, a trend grid, and a written commentary column that folds beneath the content when narrow.

id:          file-explorer
name:        File Explorer
description: Hierarchical browser that drills through nested levels as adjacent columns rather than replacing the list each time, with breadcrumb history, switchable list and grid density, and a metadata pane for the selected node.

id:          table-filter
name:        Filterable Table
description: Flat row collection built around progressive filtering: a token bar that escalates into full query syntax, saved views that persist a filter set, column and grouping options, and a resizable detail pane.

id:          form-wizard
name:        Form Wizard
description: Linear multi-step form that moves through one panel at a time, with a horizontal progress track pinned above rather than running down a rail, so every step keeps the full content width for its fields. Only the current step renders, unlike an accordion where each section expands into one long scrolling form. Each advance is validated, and a step left broken stays flagged to jump back to.

id:          dashboard-cohort-funnel
name:        Funnel & Cohort Dashboard
description: Analytics for sequence and retention questions, pairing two shapes a plain dashboard cannot hold: a staged funnel where each step reads as drop-off against the one before, and a two-axis cohort matrix rendered as a heatmap.

id:          gallery-hero
name:        Gallery Hero
description: Centered stack (headline, short blurb, call-to-action buttons) resolving into a multi-image photo grid rather than one wide full-bleed picture, so the imagery reads as a set.

id:          table-grouped
name:        Grouped Table
description: Row collection bundled into collapsible sections with per-group counts, so a long list reads as a handful of blocks that expand and collapse. Query filtering and a resizable inspector for the selected row.

id:          ide
name:        IDE
description: Dense multi-pane workspace of resizable, collapsible regions: a hierarchy tree on one flank, tabbed documents in the middle, a docked drawer along the bottom, an inspector opposite. Drag a divider to resize or collapse any of them.

id:          table-inbox
name:        Inbox Table
description: Two-pane message queue: the table indexes a reading pane rather than being the destination, with a divider you drag to resize. Rows stack when the table narrows, not the window; threads read as collapsible messages; replying opens a composer that leaves the list live.

id:          incident-console
name:        Incident Console (WIP)
description: Dense row queue with an inspector: severity-coded rows grouped by status, a saved-search filter bar, a segmented status control, and a resizable detail pane for the selected row. Rows, not cards, sized for scanning volume.

id:          form-wizard-inline
name:        Inline Wizard
description: Accordion wizard stacking every step in one column: the active step expands in place while finished ones collapse to a single line carrying their result and a way back in. Steps that run themselves expand into a nested stepper that ticks check by check and halts the column where one fails. Best when later steps depend on what earlier ones decided.

id:          kanban-board
name:        Kanban Board
description: Horizontal lanes of draggable cards where the column itself is the status, so drag and drop between lanes is the state change. Fixed columns, variable-height cards.

id:          login-card
name:        Login Card
description: Credential form inside an elevated centered card, third-party provider buttons separated from the fields by a divider, secondary sign-up and legal links beneath.

id:          login-split
name:        Login Split
description: Credential form filling one half of a two-pane split, full-bleed media holding the other. Same fields as the card variant, but the layout carries brand imagery.

id:          login-sso
name:        Login SSO
description: Progressive credential flow that branches on input: the email domain resolves an identity provider and redirects, with a password path as fallback. Two-stage rather than one form.

id:          messaging-shell
name:        Messaging Shell (WIP)
description: Four-column nested navigation narrowing left to right (team workspace, channel list, message stream, thread panel) where each column scopes the next. Dense rows, zero cards.

id:          mixed-gallery
name:        Mixed Gallery
description: Masonry grid of variable-height tiles that pack against each other instead of cropping to a shared ratio, captioned per tile. Irregular rhythm, unlike the uniform gallery.

id:          detail-page
name:        Order Detail
description: Single-record detail in two columns: a summary header with status and actions, a repeating line-item list, a totals block that sums it, and a chronological activity timeline in the rail. The shape for any record holding children plus a history: a customer order with shipping, an invoice, a transaction, or a job.

id:          editor
name:        Page Editor
description: Three-pane authoring workspace: a source palette on one flank, a live canvas in the middle, and an inspector that retargets to whatever is selected. Drag and drop to reorder, edit to see it render immediately.

id:          dashboard-composition
name:        Portfolio Dashboard
description: Analytics for a value-over-time question: balance and change tiles above a stacked area chart of composition through time, closing on a ranked table of the largest contributors.

id:          product-detail
name:        Product Detail
description: Single-item detail pairing a media gallery with a selection column: variant swatches, a quantity stepper, primary and secondary commit actions, and collapsible specification sections below.

id:          product-gallery
name:        Product Gallery
description: Uniform card grid where every tile carries media, title, supporting line, and a price. Browse-to-select only, with no filtering and no detail surface.

id:          dashboard-progress
name:        Project Status Dashboard
description: Status analytics mixing progress and time-axis shapes: a completion donut, a horizontal timeline of dated bars against a today marker, a per-owner table with progress and status, an at-risk list, and a burndown.

id:          table-page
name:        Searchable Table
description: Flat table of uniform rows under a block of record-level facts, narrowed three ways at once - a full-text search box, a scope toggle, and per-column popovers - with sortable and filterable columns, per-row hover detail, and totals derived from the visible rows that flag themselves as partial while a filter is on. The shape for one homogeneous list, not nested rows or groups with their own columns.

id:          dashboard-alert-rail
name:        Service Monitoring Dashboard
description: Always-on analytics with a triage rail: status-colored tiles with sparklines, multi-series time charts over a switchable window, and an independently scrolling alert column that folds into the content when narrow.

id:          settings-dialog
name:        Settings Dialog
description: Preferences inside a modal container with searchable section navigation, so configuration happens without leaving whatever is underneath. Grouped toggles, live preview of appearance choices, rebindable shortcuts.

id:          settings
name:        Settings Form
description: Preferences as one continuously scrolling form, sections stacked in order with no navigation between them. The simplest settings shape: everything reachable by scrolling.

id:          settings-sidebar
name:        Settings Panels
description: Preferences split into nav-switched panels: a persistent section list swaps the pane beside it, and rows edit in place rather than opening a separate form.

id:          shell-nav
name:        Shell Nav
description: Application frame combining both navigation axes: a top menu bar with command-palette search over a resizable hierarchy rail, wrapping placeholder content. For when one axis is not enough.

id:          side-gallery
name:        Side Gallery
description: Asymmetric split section: a copy column of headline, supporting text, and links held against a clustered image collage opposite. Deliberately off-balance, unlike the centered hero.

id:          shell-side-nav
name:        Side Nav
description: Application frame with a single collapsible, resizable left rail carrying grouped history and search, wrapping the main content. Vertical navigation only, no top bar.

id:          table
name:        Simple Table (WIP)
description: Flat row collection where columns sort, rows select into a bulk-action toolbar, and each row carries an overflow menu. Sortable but ungrouped, with no detail pane, the baseline shape.

id:          theme-showcase
name:        Theme Showcase
description: Multi-surface comparison shell: preview palettes, typography, icons and control states across a storefront, checkout, chat and inventory on one responsive canvas. A theme preview and design-system showcase, with an embeddable content view for an existing app shell.

id:          shell-top-nav
name:        Top Nav
description: Application frame with horizontal navigation only: a centered bar whose items open full-width mega-menu panels, over placeholder content that keeps the entire width.

id:          table-tree
name:        Tree Table
description: Hierarchical table where every parent row rolls up from its children - a code repository whose folders show the newest commit beneath them, beside a detail sidebar and a rendered README. Columns resize, siblings sort within their own level, arrow keys walk the rows, and search prunes the tree to matching branches.

id:          form-two-column
name:        Two-column Form
description: Form split into two columns beneath a hero header: inputs on one flank, a persistent context panel opposite that stays put while the fields scroll. Flat, single submit, no steps.

id:          form-wizard-vertical
name:        Vertical Wizard
description: Multi-step wizard with the steps in a fixed left rail that stays visible while the form scrolls, plus a side panel whose guidance follows the focused field. Suits long or unequal steps carrying uploads, previews, and dense review metadata. As width tightens the guidance drops first, then the rail rotates into a horizontal stepper above the form.

id:          work-item-detail
name:        Work Item Detail
description: Single work-item detail in two columns: a title with a status selector, a description, a subtask checklist with progress, an attachments block, and a comment and activity feed in the main column, plus a property rail with assignee, dates, labels, and linked items. The shape for any tracked item with children, properties, and a comment history - a task, ticket, issue, story, bug, card, request, or work item.

Block Templates

id:          AlertDialogDeleteConfirmation
name:        AlertDialog - Delete
description: A delete button that asks the user to confirm before deleting.

id:          AlertDialogAsyncAction
name:        AlertDialog - Loading
description: A confirmation dialog that shows a spinner while the action runs.

id:          AppShellShowcase
name:        AppShell
description: A basic app shell with content padding.

id:          AppShellContentOnly
name:        AppShell - Content Only
description: Minimal shell with no navigation, useful for full-bleed pages, auth screens, or embedded views.

id:          AppShellSideNavOnly
name:        AppShell - Side Nav Only
description: App shell with SideNav header providing app identity, no TopNav needed.

id:          AppShellTopNavOnly
name:        AppShell - Top Nav Only
description: Simple layout with TopNav and no side navigation, suitable for landing pages.

id:          AppShellTopNavWithSideNav
name:        AppShell - Top Nav with Side Nav
description: The most common layout with TopNav for app identity and SideNav for page-level navigation.

id:          AppShellWithBanner
name:        AppShell - With Banner
description: Full layout with TopNav, SideNav, and a dismissable info banner between the nav and content.

id:          AspectRatioShowcase
name:        AspectRatio
description: Three aspect ratio containers at equal height (1:1, 4:3, and 16:9), each showing an image with its ratio labeled below.

id:          AspectRatioWidescreen
name:        AspectRatio - 16:9 Widescreen Image
description: 16:9 widescreen aspect ratio wrapping an image.

id:          AspectRatioCircleImage
name:        AspectRatio - Circle Image
description: Circular container via shape="ellipse" with ratio={1}, ideal for avatars and profile images.

id:          AspectRatioImageGallery
name:        AspectRatio - Image Gallery
description: Grid of images with consistent 4:3 aspect ratios.

id:          AspectRatioWithSkeleton
name:        AspectRatio - Loading Skeleton
description: Aspect ratio container with a skeleton loading placeholder.

id:          AspectRatioSquareImage
name:        AspectRatio - Square Image
description: 1:1 square aspect ratio, ideal for avatars and Instagram-style images.

id:          AvatarShowcase
name:        Avatar
description: Avatars at every size with an image, initials fallback, and a status dot. A quick visual reference for choosing the right size.

id:          AvatarFallbackChain
name:        Avatar - Fallback Chain
description: Demonstrates the avatar fallback chain: primary image, fallback image, initials, then default icon.

id:          AvatarGroup
name:        Avatar - Group
description: Overlap multiple avatars in a row to represent a group of people. Use for team lists, PR reviewers, or participant counts where you want to show faces without taking up much space.

id:          AvatarInitialsFallback
name:        Avatar - Initials
description: Show initials instead of a photo. The avatar extracts the first and last initials from the name automatically. Use when you only have a user name, like in anonymous accounts or new user onboarding.

id:          AvatarInteractive
name:        Avatar - Interactive
description: Make an avatar interactive by passing `href` to render it as a link or `onClick` to render it as a button. Both forms are focusable and show a focus-visible ring for keyboard users. Use for profile links, mention pop-ups, or any avatar people can act on.

id:          AvatarWithImage
name:        Avatar - Photo
description: Show a profile photo at different sizes. Use when you have a user photo URL. If the image fails to load, initials are shown instead.

id:          AvatarWithStatus
name:        Avatar - Status Dot
description: Add a status dot to an avatar to show whether someone is online, away, or busy. Use in chat, messaging, or any UI where knowing availability matters.

id:          AvatarTooltip
name:        Avatar - Tooltip
description: By default an avatar shows its name in a tooltip on hover and keyboard focus. Pass a string to show custom text instead, or false to turn the tooltip off.

id:          AvatarUserCard
name:        Avatar - User Card
description: Place an avatar next to a name and role to create a user card row. Use for comment headers, contact lists, profile sections, or anywhere you need to identify a person at a glance.

id:          AvatarGroupShowcase
name:        AvatarGroup
description: Overlapping avatar rows with a sliced visible set and a server-side overflow count. Shows team members in a compact facepile layout.

id:          AvatarGroupInteractive
name:        AvatarGroup - Interactive
description: A facepile whose avatars link to profiles, with an overflow indicator that opens the full member list. The whole group is one Tab stop; arrow keys move between the avatars and the overflow button.

id:          AvatarGroupOverflowShowcase
name:        AvatarGroupOverflow
description: Overflow indicators for hidden avatars, including the default +N label and custom count text.

id:          AvatarGroupOverflowCustomText
name:        AvatarGroupOverflow - Custom Text
description: Provide short custom children such as 12+ when the overflow count needs compact product-specific formatting.

id:          AvatarGroupOverflowDefault
name:        AvatarGroupOverflow - Default Count
description: Use AvatarGroupOverflow without children to render the standard +N overflow count.

id:          AvatarStatusDotShowcase
name:        AvatarStatusDot
description: AvatarStatusDot renders a presence indicator on an Avatar, with variants for positive, neutral, and negative states. The dot size automatically coordinates with the Avatar size.

id:          AvatarStatusDotVariants
name:        AvatarStatusDot - Variants
description: Presence dots on Avatars using the success, neutral, and error variants. Pass an AvatarStatusDot to the Avatar status prop; the dot sizes itself to match the Avatar.

id:          BadgeCategoryTags
name:        Badge - Colors
description: Tag items with color-coded categories like teams, priorities, or topics. Use the 9 non-semantic color variants when you need to distinguish groups visually.

id:          BadgeCountBadges
name:        Badge - Counts
description: Show a number inside a badge for notification counts, unread messages, or task totals. Use next to icons, nav items, or list labels.

id:          BadgeStatusLabels
name:        Badge - Status
description: Show the state of an item like Active, Pending, or Failed. Use in table rows, list items, or detail pages where users need to see status at a glance.

id:          BadgeShowcase
name:        Badge - Variants
description: All semantic and color badge variants in a single view. Use semantic variants for status and color variants for categories.

id:          BannerWithActionButton
name:        Banner - Action
description: Add a button to a banner so the user can act on the message. Use for trial expirations, payment failures, or anything that needs a response.

id:          BannerCollapsibleContent
name:        Banner - Collapsible
description: Combine an action button, dismiss control, and a collapsible detail area in one banner. Children sit behind the toggle by default; `collapsible={{defaultIsOpen: true}}` starts it open, and `collapsible={false}` drops the toggle entirely. Use for complex notifications like config changes or deployment summaries.

id:          BannerDismissable
name:        Banner - Dismiss
description: Let the user close a banner after reading it. Use for maintenance notices, feature tips, or any non-critical message the user can acknowledge.

id:          BannerFloating
name:        Banner - Floating
description: A floating banner raised with `elevation="med"`. Banners are inline by default; raise one when it should read as an overlay above content.

id:          BannerSectionVariant
name:        Banner - Full Width
description: A full-width banner with no border radius for page-level notifications. Use at the top of a page for site-wide announcements or maintenance alerts.

id:          BannerShowcase
name:        Banner - Statuses
description: All four status banners stacked: info, success, warning, and error. A quick visual reference for choosing the right status.

id:          BannerStatuses
name:        Banner - Statuses
description: All 4 banner statuses: info, success, warning, and error. Use to show persistent messages like updates, confirmations, cautions, or problems at the top of a page or section.

id:          BaseTypeaheadShowcase
name:        BaseTypeahead
description: A custom result renderer that adds supporting metadata while BaseTypeahead retains option semantics and keyboard behavior.

id:          BaseTypeaheadCustomSearch
name:        BaseTypeahead - Custom Search Bar
description: BaseTypeahead embedded inside a custom-styled wrapper. The wrapper provides its own border and icon chrome; anchorRef positions the dropdown relative to it. Use this pattern when Typeahead's built-in field layout does not fit your composition.

id:          BaseTypeaheadMenu
name:        BaseTypeahead - Menu
description: A filter field built on BaseTypeahead's `menu`. The listbox role puts a heading and a key hint around the result list, and keeps every action a result. Picking a field switches the same menu to a dialog role that edits the value; `handleRef.open()` reopens it from a filter button, and Escape returns focus to that button.

id:          DrawerShowcase
name:        Basic
description: Open a modal drawer from a single trigger. The scrim dims the page; Escape, a scrim click, or the header close button closes it, and focus returns to the trigger.

id:          BlockquoteShowcase
name:        Blockquote - Showcase
description: Blockquote with and without citation. A quick visual reference for the blockquote component.

id:          BlockquoteTestimonials
name:        Blockquote - Testimonials
description: Multiple quotes arranged in a card grid for a testimonials section. Combine with Card and Grid to create social-proof layouts.

id:          BlockquoteWithCite
name:        Blockquote - With Attribution
description: A plain quote and a quote with a cite attribution. Use cite to credit the original author or source.

id:          BottomSheetShowcase
name:        Bottom Sheet
description: A mobile filter surface that rises from the bottom edge.

id:          BottomSheetHeights
name:        Bottom Sheet - Height variants
description: Compares hug, capped, and tall starting heights for different amounts of content.

id:          BottomSheetMobileKeyboard
name:        Bottom Sheet - Mobile keyboard
description: Uses a tall, scrollable form that keeps focused controls visible above the mobile keyboard.

id:          BottomSheetSwitcherShowcase
name:        Bottom Sheet - Multi-step flow
description: A three-step flow of standalone sheets of different heights, driven by one state value: moving on replaces the open step in place. This is the replacement for the deprecated BottomSheetSwitcher.

id:          BottomSheetNoScrim
name:        Bottom Sheet - No scrim
description: Keeps the page visible and interactive behind a non-modal bottom sheet.

id:          BottomSheetSwitcherReviewFlow
name:        Bottom Sheet - Review flow
description: A two-step form flow of two standalone sheets driven by one state value: Continue replaces the review step with the confirmation in place, and Back returns.

id:          BottomSheetSnapPoints
name:        Bottom Sheet - Snap points
description: Drag-to-resize stops: a half-height working surface, and a peek that slides away and thins the scrim.

id:          BreadcrumbItemShowcase
name:        BreadcrumbItem
description: BreadcrumbItem represents a single step in a breadcrumb trail, supporting links, icons, current-page markers, and custom link components.

id:          BreadcrumbItemBasic
name:        BreadcrumbItem - Basic
description: Breadcrumb links inside a Breadcrumbs trail. Ancestor pages get an href; mark the last item with isCurrent to render it as plain text for the current page.

id:          BreadcrumbsShowcase
name:        Breadcrumbs
description: A breadcrumb trail showing page hierarchy with linked ancestors and a current page.

id:          BreadcrumbsDeepHierarchy
name:        Breadcrumbs - Deep Path
description: A 5-level breadcrumb trail for deeply nested content. Use in e-commerce, file browsers, or any UI with several levels of hierarchy.

id:          BreadcrumbsWithIcons
name:        Breadcrumbs - Icons
description: Add icons before breadcrumb labels for quick recognition. Use a home icon on the root item and contextual icons on key sections.

id:          BreadcrumbsMenuItem
name:        Breadcrumbs - Menu item
description: Give a mid-trail crumb a `menu` prop to turn it into a menu trigger for switching between sibling destinations. It reuses the same item API as DropdownMenu, so an existing option array (or composed item children) drops in verbatim.

id:          BreadcrumbsCustomSeparator
name:        Breadcrumbs - Separators
description: Swap the default "/" for a different character like chevrons, arrows, or dots. Use when the visual style of the page calls for a different separator.

id:          BreadcrumbsSupportingVariant
name:        Breadcrumbs - Variants
description: Compare the default and supporting variants side by side. Use the supporting variant in dense UIs like admin panels where the breadcrumb should be subtle.

id:          ButtonWithEndSlot
name:        Button - End Slot
description: Buttons with a trailing badge showing a count or status. Use for notification counts, unread messages, or any button that needs a visual indicator.

id:          ButtonFloating
name:        Button - Floating
description: A floating action button raised with `elevation="med"`. Use elevation for buttons that hover above content, like a FAB.

id:          ButtonWithIcon
name:        Button - Icon
description: Buttons with a leading icon that reinforces the label. Use when the icon helps the user identify the action faster, like a plus for "New" or a trash can for "Delete".

id:          ButtonSizeVariants
name:        Button - Sizes
description: Small, medium, and large buttons side by side. Use small in dense UIs like toolbars, medium for most cases, and large for prominent CTAs.

id:          ButtonShowcase
name:        Button - Variants
description: All four button variants side by side: primary, secondary, ghost, and destructive. A quick visual reference for choosing the right variant.

id:          ButtonVariants
name:        Button - Variants
description: All 4 button variants in default, disabled, and loading states. Use primary for the main action, secondary for most others, ghost for low-emphasis, and destructive for dangerous actions.

id:   ButtonGroupShowcase
name: ButtonGroup

id:          ButtonGroupBasic
name:        ButtonGroup - Basic
description: Three related actions joined into a single connected control. Provide a group label for accessibility and keep all buttons the same variant so they read as one unit.

id:          ButtonGroupFloating
name:        ButtonGroup - Floating
description: A grouped action bar raised with `elevation="med"`. The connected buttons share one surface, so the shadow lifts them as a unit.

id:          CalendarShowcase
name:        Calendar
description: An interactive single-date calendar with a selected date. Click any day to change the selection.

id:          CalendarConstraints
name:        Calendar - Constraints
description: Limit which dates can be selected using min/max bounds and custom rules like weekdays only. Use for scheduling UIs where certain dates are unavailable.

id:          CalendarRangeWithValue
name:        Calendar - Range
description: Pick a start and end date with the range highlighted between them. Use for booking dates, time-off requests, or report filters.

id:          CalendarSingle
name:        Calendar - Single
description: Pick one date from a month grid. Use for appointment dates, due dates, or any field that needs a single date.

id:          CalendarTwoMonths
name:        Calendar - Two Months
description: Two months side by side for selecting ranges that span a month boundary. Use in booking or travel UIs where check-in and check-out often fall in different months.

id:          CardShowcase
name:        Card
description: A card with a heading and body text showing the default container style.

id:          CardCallout
name:        Card - Callout
description: Muted-variant cards for tips, notes, or supplementary information. Use when content should be visually distinct but not prominent. The muted variant uses a wash background instead of the elevated default, making it feel recessed rather than raised. Works well in sidebars, help panels, or inline callouts.

id:          CardElevations
name:        Card - Elevations
description: The four elevation levels side by side. Cards are flat by default; raise a card with `elevation` only when it needs to float above surrounding content.

id:          CardWithInnerLayout
name:        Card - Layout
description: A card with a structured header, content area, and footer with action buttons. Use for forms, dialogs, or settings panels that need clear sections. Pair Card with Layout to get automatic dividers between header, content, and footer. The footer aligns actions to the right by default.

id:          CardWithSimpleContent
name:        Card - Simple
description: A card with a heading and body text. Use for summaries, descriptions, or any grouped content that needs visual separation from the page. The card handles its own border, background, and padding; just pass your content as children. Set a width to constrain it, or leave it to fill the parent.

id:          CardVariants
name:        Card - Variants
description: Default, muted, and color variants side by side. Use color variants to categorize cards visually, like team colors, project tags, or content types. Each color uses the corresponding background token from the theme, so they adapt to light and dark mode automatically.

id:          CarouselShowcase
name:        Carousel
description: A horizontal carousel of cards with scroll-snap and navigation buttons. Scroll or click the arrows to browse.

id:          CarouselCards
name:        Carousel - Cards
description: A horizontally scrollable row of cards with snap scrolling enabled. Use for feature grids, product lists, or any set of cards that overflows the available width. The carousel adds fade edges and navigation buttons automatically.

id:          CarouselSnap
name:        Carousel - Snap
description: Scroll-snap carousel with navigation buttons and team member cards. Each card snaps to the start edge on scroll. Use when items should be viewed one at a time rather than as a continuous strip.

id:          CenterShowcase
name:        Center
description: Content centered horizontally and vertically inside a fixed-height container.

id:          CenterHorizontal
name:        Center - Horizontal Center
description: A formatting control group centered with axis="horizontal" in the default horizontal writing mode. In other writing modes, Center currently follows the flex main axis rather than guaranteeing physical horizontal centering.

id:          CenterInsideACard
name:        Center - Vertical & Horizontal Center
description: An empty state with an icon, heading, and description centered both vertically and horizontally inside a card. This is the most common use of Center: placing content in the middle of a fixed-height area like a panel, card, or content region. The height prop defines the centering space.

id:   ChatComposerShowcase
name: ChatComposer

id:          ChatComposerAttachments
name:        ChatComposer - Attachments
description: Chat composer with removable file tokens in a collapsible drawer. Use when users can attach files or context to their message.

id:          ChatComposerFlat
name:        ChatComposer - Flat
description: The composer is raised by default (`elevation="low"`). Set `elevation="none"` to flatten it; it then draws a border with the same rest / hover / focus treatment as a text input.

id:          ChatComposerFooterActions
name:        ChatComposer - Footer Actions
description: Chat composer with dropdown menus for a model selector and settings in the footer, and a mic button in the send actions slot.

id:          ChatComposerFullFeatured
name:        ChatComposer - Full Featured
description: Chat composer with all slots populated: collapsible attachment drawer, header actions, context progress bar, footer dropdown menus, and mic button. Shows the maximum composer configuration.

id:          ChatComposerSimple
name:        ChatComposer - Simple
description: Minimal chat composer with a placeholder and submit handler. The simplest way to drop a message input into a page.

id:          ChatComposerStreaming
name:        ChatComposer - Streaming
description: Chat composer with streaming state and a stop button. Use when the assistant is generating a response and the user can cancel.

id:          ChatComposerValidation
name:        ChatComposer - Validation
description: Chat composer with error and warning status messages. Status can appear above or below the composer to surface validation or system feedback.

id:          ChatComposerDrawerShowcase
name:        ChatComposerDrawer
description: Composer drawer with file tokens, a collapsible toggle, and header actions. Use as a starting point for any chat composer with attachments.

id:          ChatComposerDrawerAttachments
name:        ChatComposerDrawer - Attachments
description: Drawer with two rows: a scrollable carousel of image thumbnails and a row of removable file tokens. Omit count to keep the drawer always expanded.

id:          ChatComposerDrawerCollapsible
name:        ChatComposerDrawer - Collapsible
description: Drawer with many items and a collapse toggle. Pass count to enable the toggle; collapsed state shows a badge with the total count and a label.

id:          ChatComposerDrawerFeedback
name:        ChatComposerDrawer - Feedback
description: Chat composer drawer with a feedback prompt and selectable lettered options. Use for user confirmation workflows that require explicit action before proceeding.

id:          ChatComposerDrawerWithProgress
name:        ChatComposerDrawer - With Progress
description: Drawer paired with a context progress bar in the header. Show context window usage when attachments consume part of the available token budget.

id:   ChatComposerInputShowcase
name: ChatComposerInput

id:          ChatComposerInputControlledInput
name:        ChatComposerInput - Controlled
description: Controlled chat input with live value display. Use controlled mode when you need to read or transform the input value outside the composer.

id:          ChatComposerInputDisabled
name:        ChatComposerInput - Disabled
description: Composer in a disabled state. Use when the input should be visible but not interactive, such as during streaming or when a prerequisite is unmet.

id:          ChatComposerInputMentionTrigger
name:        ChatComposerInput - Mentions
description: Chat input with an @ trigger that opens a typeahead menu for mentioning users. Selected names appear as inline tokens.

id:          ChatComposerInputMultipleTriggers
name:        ChatComposerInput - Multiple Triggers
description: Chat input with both @ mentions and / commands. Each trigger type renders tokens in a distinct color so users can tell them apart at a glance.

id:          ChatComposerInputSlashCommands
name:        ChatComposerInput - Slash Commands
description: Chat input with a / trigger for command selection. Use for AI assistants or bots that support structured commands.

id:          ChatDictationButtonShowcase
name:        ChatDictationButton
description: Interactive dictation button connected to the SpeechRecognition API via useChatDictation. Click the mic to dictate into the composer.

id:          ChatDictationButtonBasic
name:        ChatDictationButton - Basic
description: A dictation button wired to useChatDictation and placed in the sendActions slot of a ChatComposer. Click the microphone to transcribe speech into the input.

id:          ChatDictationDictationInComposer
name:        ChatDictationButton - In Composer
description: Dictation button placed in the sendActions slot of a chat composer. Shows the recommended integration point for voice input alongside the send button.

id:          ChatDictationSizes
name:        ChatDictationButton - Sizes
description: Small and medium dictation buttons side by side. Use small in compact composer densities and medium for standard layouts.

id:          ChatDictationDictationStates
name:        ChatDictationButton - States
description: Dictation button in idle, listening, and speaking states side by side. Shows the three visual phases of a voice input interaction.

id:   ChatLayoutShowcase
name: ChatLayout

id:          ChatLayoutPanelChat
name:        ChatLayout - Panel View
description: Narrow sidebar chat in a constrained container that triggers compact density. Use for side panels, drawers, or embedded chat widgets where horizontal space is limited.

id:          ChatLayoutScrollButtonStates
name:        ChatLayoutScrollButton
description: Scroll button in hidden, visible, and expanded (with label) states. The button fades in when the user scrolls up and expands when new messages arrive.

id:          ChatLayoutScrollButtonLabels
name:        ChatLayoutScrollButton - Labels
description: Scroll button with different labels for context-specific notifications like new messages, unread replies, or a generic scroll prompt.

id:          ChatMessageShowcase
name:        ChatMessage
description: A user multi-bubble group with delivery status and an assistant ghost response with avatar, name, timestamp, and model info.

id:          ChatMessageAvatarName
name:        ChatMessage - Avatar & Name
description: Messages with avatars and sender names. Place the name on the bubble when using bubbles, or on the message wrapper for raw content.

id:          ChatMessageGhost
name:        ChatMessage - Ghost
description: Ghost variant for messages without visible bubble boundaries. Keeps padding for alignment but renders a transparent background, useful for AI-style responses.

id:          ChatMessageMultiBubble
name:        ChatMessage - Multi-Bubble
description: Grouped bubbles using the group prop for corner radius reduction. Use first, middle, and last to visually connect related bubbles from the same sender.

id:          ChatMessageBubbleShowcase
name:        ChatMessageBubble
description: Grouped user bubbles with filled styling and a ghost-variant agent response, with timestamps and delivery status.

id:          ChatMessageBubbleCustomContent
name:        ChatMessageBubble - Custom Content
description: Custom in-message content aligned to the bubble text column. An artifact card is wrapped in a ghost bubble with width="100%", so its left edge matches the bubble text and it spans the full message column instead of the default bubble width cap; the timestamp rides the bubble metadata slot.

id:          ChatMessageBubbleDensity
name:        ChatMessageBubble - Density
description: Compact, balanced, and spacious density modes side by side. Density controls bubble padding, corner radius, and spacing between grouped bubbles.

id:          ChatMessageBubbleGrouping
name:        ChatMessageBubble - Grouping
description: Multi-bubble messages using first, middle, and last group positions. Grouped bubbles tighten corner radius on the sender side for a continuous visual flow.

id:          ChatMessageBubbleMetadata
name:        ChatMessageBubble - Metadata
description: Bubbles with name and metadata slots aligned to bubble padding. Put name on the first bubble and metadata on the last bubble in a message.

id:          ChatMessageBubbleVariants
name:        ChatMessageBubble - Variants
description: Filled and ghost bubble variants for both user and assistant senders. Use filled for standard messages and ghost when content needs alignment without a visual boundary.

id:          ChatMessageListShowcase
name:        ChatMessageList
description: Basic AI chat conversation with user and assistant messages. The simplest way to render a message list with alternating sender bubbles, metadata, and a date divider.

id:          ChatMessageListDensity
name:        ChatMessageList - Density
description: Side-by-side comparison of compact, balanced, and spacious densities. Use compact in sidebars or panels, balanced for most full-page chat, and spacious for long-form reading. Use gap when row spacing needs to differ from density.

id:          ChatMessageListFullFeatured
name:        ChatMessageList - Full Featured
description: Conversation showcasing system messages, multi-bubble grouping, markdown, code blocks, and metadata. Combines date dividers, ghost bubbles, grouped messages, and rich content in a single example.

id:          ChatMessageMetadataShowcase
name:        ChatMessageMetadata
description: Three-message conversation showcasing error status with retry, delivery status, and full footer actions with model label.

id:          ChatMessageMetadataFooter
name:        ChatMessageMetadata - Footer Actions
description: Assistant message with footer actions: copy, retry, thumbs up/down, and model label. Use for AI responses that need feedback or utility controls.

id:          ChatMessageMetadataStatus
name:        ChatMessageMetadata - Status
description: All 5 delivery statuses (sending, sent, delivered, read, and error), each with a timestamp. Use to show message delivery progress or surface failures.

id:          ChatMessageMetadataTimestamp
name:        ChatMessageMetadata - Timestamps
description: Timestamp-only metadata on user and assistant messages. Supports absolute time and relative formats via Timestamp.

id:          ChatSendButtonShowcase
name:        ChatSendButton
description: Ready, custom icon, and streaming states of the send button.

id:          ChatSendButtonCustomIcon
name:        ChatSendButton - Custom Icon
description: Send buttons with custom icons via sendIcon and stopIcon props. Use to match the personality of the chat experience: a paper airplane for messaging, sparkles for AI generation, or a check mark for confirmation flows.

id:          ChatSendButtonInComposer
name:        ChatSendButton - In Composer
description: Send button inside ChatComposer, where it reads state from context automatically. No wiring needed; the button enables when the input has content.

id:          ChatSendButtonStates
name:        ChatSendButton - States
description: Disabled, ready, and streaming states at both sizes. The button automatically toggles between send (primary) and stop (secondary) based on streaming state.

id:          ChatSystemMessageShowcase
name:        ChatSystemMessage
description: System messages for date dividers, status updates, and informational notices. Shows both default and divider variants in a realistic conversation flow.

id:          ChatSystemMessageWithIcon
name:        ChatSystemMessage - Icon
description: System messages with a leading icon that reinforces the message type. Use icons to help users scan and identify message categories at a glance.

id:          ChatSystemMessageStatusUpdates
name:        ChatSystemMessage - Status Updates
description: Realistic status messages in a conversation flow showing membership changes, timestamps, and resolution notices.

id:          ChatSystemMessageVariants
name:        ChatSystemMessage - Variants
description: Default and divider variants side by side. Use default for inline status updates and divider for date separators or section breaks.

id:   ChatTokenizedTextShowcase
name: ChatTokenizedText

id:          ChatTokenizedTextBasic
name:        ChatTokenizedText - Basic
description: A message with @mention tokens. Each matching pattern is replaced with its display name badge.

id:          ChatTokenizedTextColors
name:        ChatTokenizedText - Colors
description: Tokens with different color variants to distinguish mentions, bugs, and features. Use variant colors to create a visual taxonomy: blue for people, red for bugs, green for features.

id:   ChatToolCallsShowcase
name: ChatToolCalls

id:          ChatToolCallsInteractiveToolCalls
name:        ChatToolCalls - Expandable
description: Tool calls with expandable result details showing diffs and command output in code blocks. Click a row to reveal its result.

id:          ChatToolCallsToolCallsWithNodes
name:        ChatToolCalls - Simple
description: A single inline tool call above a collapsible multi-call group with diff stats. Shows both layouts side by side.

id:          ChatToolCallsStatuses
name:        ChatToolCalls - Statuses
description: All four status states (pending, running, complete, and error) shown together in a single group.

id:          CheckboxInputShowcase
name:        CheckboxInput
description: Interactive checkboxes showing checked, unchecked, and indeterminate states with descriptions.

id:          CheckboxInputIndeterminateState
name:        CheckboxInput - Indeterminate
description: A "select all" checkbox that controls a group of options. When only some options are checked, it shows a dash instead of a checkmark. Clicking it checks or unchecks everything.

id:          CheckboxInputBasic
name:        CheckboxInput - States
description: Checkboxes with labels and descriptions in checked, unchecked, and disabled states. Each checkbox controls a single on/off setting. Add a description to explain what the setting does.

id:          CheckboxInputStatusVariations
name:        CheckboxInput - Status
description: Checkboxes with error, warning, and success validation messages. Use the status prop to show feedback after form validation: errors block submission, warnings inform, and success confirms.

id:   CheckboxListShowcase
name: CheckboxList

id:          CheckboxListSelectAllPattern
name:        CheckboxList - Select All With Indeterminate
description: A "select all" toggle at the top of a checkbox list that switches to an indeterminate dash when only some items are checked, useful for bulk actions like exporting documents or assigning permissions where users often want everything at once.

id:          CheckboxListWithEndContent
name:        CheckboxList - With End Content
description: Badges in the trailing slot show contextual info, like a price or status, next to each option without cluttering the label, so users can compare choices at a glance.

id:          CheckboxListItemShowcase
name:        CheckboxListItem
description: Checkbox list items with labels, descriptions, and different states including disabled.

id:          CheckboxListItemBasic
name:        CheckboxListItem - Basic
description: Checkbox items with labels and descriptions inside a controlled CheckboxList. Use for multi-select option groups like notification preferences.

id:          CitationInlineText
name:        Citation - Inline Text
description: Citations embedded within a paragraph of text, showing how they flow inline with surrounding content.

id:          CitationShowcase
name:        Citation - Showcase
description: All citation variants at a glance: label chips and numbered badges, with and without icons and links.

id:          CitationSourceList
name:        Citation - Source List
description: A list of citation sources with icons, as you might show at the end of an AI-generated response or article footer.

id:          ClickableCardShowcase
name:        ClickableCard
description: A clickable card that navigates on click. Nested interactive elements work independently.

id:          ClickableCardElevated
name:        ClickableCard - Elevated
description: A clickable card raised with `elevation="med"` so the shadow signals the whole surface is interactive.

id:          ClickableCardWithNestedButton
name:        ClickableCardWithNestedButton
description: A product card that navigates on click but has an independent "Add to cart" button inside.

id:          CodeShowcase
name:        Code
description: Inline code snippets inside a sentence showing how Code renders alongside body text.

id:          CodeBlockJSONConfig
name:        Code - Config
description: A JSON configuration file with a title bar and line numbers. The title prop adds a filename label in the header so readers know which file the code belongs to.

id:          CodeVariousContent
name:        Code - Content Types
description: Inline code used for variables, terminal commands, CSS properties, file paths, and keyboard shortcuts. Shows how Code adapts to different kinds of technical content.

id:          CodeBlockHighlightedLines
name:        Code - Highlighted
description: TypeScript code with specific lines highlighted to draw attention to a key section. Use highlightLines to call out new or important code in tutorials and changelogs.

id:          CodeInlineInParagraph
name:        Code - Inline
description: Inline code references mixed within a paragraph of body text. Use Code to mark up function names, hooks, or API terms so they stand out from surrounding prose.

id:          CodeBlockScrollableBlock
name:        Code - Scrollable
description: A long code block with a max height that enables vertical scrolling. Use maxHeight to keep the block from dominating the page when displaying large files.

id:          CodeBlockBashCommand
name:        Code - Snippet
description: Short terminal commands with no header: the copy button sits in its own column beside the code, so a one-line command reads as a single row and a long line ends before the button instead of running under it. Use for install instructions or one-liner commands that readers will paste directly.

id:          CodeBlockTerminal
name:        Code - Terminal
description: A dark terminal-style command block: a bash CodeBlock wrapped in SyntaxTheme with the GitHub Dark preset, copy button on, and no line numbers. Use for shell sessions or CLI output that should read as a terminal even on light pages. Reach for a dark syntax preset instead of hand-rolling a dark box with custom CSS.

id:          CodeAcrossTextSizes
name:        Code - Text Sizes
description: Inline code rendered inside heading, body, supporting, and label text. Code automatically matches the font size of its parent text element.

id:          CodeBlockShowcase
name:        CodeBlock
description: A syntax-highlighted TypeScript code block with line numbers, a title bar, and a copy button.

id:          CollapsibleShowcase
name:        Collapsible
description: An accordion group with three collapsible sections in single mode: opening one closes the others.

id:          CollapsibleControlledAccordion
name:        Collapsible - Controlled
description: Manage the open section from parent state, so something other than a click can move it: a URL parameter, a form jumping to the step that failed validation, or the Previous/Next controls shown here. onChange hands back the whole open value.

id:          CollapsibleDividedAccordion
name:        Collapsible - FAQ
description: FAQ built with hasDividers: row hairlines and density padding with no custom CSS. Questions set their own type - body at semibold, not the trigger's default 17px large - so a list of questions reads as rows rather than a stack of headings, and question and answer separate on weight and color instead of size.

id:          CollapsibleMultipleAccordion
name:        Collapsible - Multiple Mode
description: Several sections open at once, for comparing across them - feature lists, pricing tiers. One Collapsible per Card, so each trigger keeps its own large type: it is the heading of its surface, not a row in a list.

id:          CollapsibleSingleAccordion
name:        Collapsible - Single Mode
description: Only one section open at a time, so a single body of content competes for attention. Use defaultValue to pre-expand whichever section a first-time reader needs. Each Collapsible owns a Section, so its trigger is that section heading.

id:          CollapsibleWithoutCard
name:        Collapsible - With Dividers
description: A flat list on the page background with hand-placed Dividers, for detail panels and sidebars where cards would add too much weight. Rows, so the triggers step down to body-semibold and a supporting metadata line sits under each answer.

id:          CollapsibleGroupShowcase
name:        CollapsibleGroup
description: CollapsibleGroup coordinates its Collapsible children: with type="single", opening one closes the others. No state or handlers in the example - the group owns which value is open and each child only declares its own. One Collapsible per Card, so each trigger keeps its default large type as the heading of its own surface.

id:          CollapsibleGroupAccordion
name:        CollapsibleGroup - Density
description: density sets the block padding on every row in the group, so a list of sections can be tuned to the surface it sits on without touching the rows. compact for dense surfaces like sidebars and inspectors, balanced (the default) for page content, spacious for a short list that is the main thing on the page. It follows Table's scale and pairs with hasDividers, which turns it on at balanced.

id:          CommandPaletteShowcase
name:        CommandPalette
description: Basic command palette with static items and keyboard navigation.

id:          CommandPaletteAsyncSearch
name:        CommandPalette - Async Search
description: Server-side search with loading spinner and custom empty states.

id:          CommandPaletteCustomFooter
name:        CommandPalette - Custom Footer
description: Command palette with a custom footer tip message.

id:          CommandPaletteAutoGrouped
name:        CommandPalette - Grouped
description: Command palette with items grouped via auxiliaryData.group.

id:          CommandPalettePickerMode
name:        CommandPalette - Picker Mode
description: Single-value picker with persistent selection and check indicator.

id:          CommandPaletteRichItems
name:        CommandPalette - Rich Items
description: Custom item rendering with icons, keyboard shortcuts, and keyword search.

id:          CommandPaletteEmptyShowcase
name:        CommandPaletteEmpty
description: Command palette empty state shown when no commands are available.

id:          CommandPaletteEmptyBasic
name:        CommandPaletteEmpty - Basic
description: A command palette with no results, showing a custom empty message via emptyBootstrapText. Use to explain why the palette is empty and what the user can do next.

id:          CommandPaletteFooterShowcase
name:        CommandPaletteFooter
description: Command palette footer with custom tip content.

id:          CommandPaletteFooterBasic
name:        CommandPaletteFooter - Basic
description: A command palette footer with no children, rendering the built-in keyboard navigation hints. Use CommandPaletteFooter without content to get the default arrow-key, Enter, and Esc hints below the results list.

id:          CommandPaletteGroupShowcase
name:        CommandPaletteGroup
description: Command palette groups in both data-driven (auxiliaryData.group) and composed (CommandPaletteGroup + CommandPaletteItem) forms.

id:          CommandPaletteGroupBasic
name:        CommandPaletteGroup - Basic
description: Command palette items organized under group headings using the composed CommandPaletteGroup form. Use to separate related commands into labeled sections.

id:          CommandPaletteInputShowcase
name:        CommandPaletteInput
description: Command palette search input with a custom placeholder and a keyboard shortcut hint in the endContent slot.

id:          CommandPaletteInputBasic
name:        CommandPaletteInput - With End Content
description: Custom placeholder and a keyboard shortcut badge in the trailing slot via endContent.

id:          CommandPaletteItemShowcase
name:        CommandPaletteItem
description: An inline command palette whose items pair each command label with its keyboard shortcut through renderItem.

id:          CommandPaletteItemBasic
name:        CommandPaletteItem - Basic
description: Selectable command palette items inside a CommandPaletteList, including highlighted and disabled states. Use when composing a palette manually instead of a search source.

id:          CommandPaletteListShowcase
name:        CommandPaletteList
description: Scrollable command palette list with grouped items, including a highlighted item, composed without a full CommandPalette.

id:          CommandPaletteListBasic
name:        CommandPaletteList - Item States
description: Flat list showing the highlighted, selected, and disabled item states. Use CommandPaletteGroup to add section headings.

id:          ComplexSelectorShowcase
name:        ComplexSelector
description: A two-axis picker: choose a fruit and a ripeness level from one control. ComplexSelector owns the trigger, popover, and focus restore while the custom grid owns its keyboard semantics.

id:          ComplexSelectorDeadlinePicker
name:        ComplexSelector - Deadline Picker
description: A multi-step deadline field: pick a preset like Today or Next week, or switch to a custom date and time before applying. The popup stays open until the user commits, so the content owns the Apply action.

id:          ComplexSelectorTreeSearch
name:        ComplexSelector - Tree Search
description: A destination picker that combines a search field with a TreeList hierarchy. TreeList owns tree keyboard navigation; ComplexSelector owns the trigger, popover, and focus restore. Selecting a folder closes the popup.

id:          ContextMenuShowcase
name:        ContextMenu
description: An adaptive context area that supports long-press on compact touch screens and right-click elsewhere.

id:          ContextMenuBasic
name:        ContextMenu - Basic
description: An adaptive context area: long-press opens a BottomSheet on compact touch screens, while right-click opens a cursor-positioned menu elsewhere.

id:          ContextMenuBottomSheet
name:        ContextMenu - Bottom Sheet
description: A ContextMenu using the explicit BottomSheet presentation. Long-press the target on touch devices or right-click it with a pointer. Keep a visible menu trigger for important mobile actions.

id:          ContextMenuItemShowcase
name:        ContextMenuItem
description: Context menu with custom-rendered items using ContextMenuItem for icons and descriptions.

id:          ContextMenuItemBasic
name:        ContextMenuItem - Basic
description: Context menu items with labels and secondary descriptions. Use ContextMenuItem to render custom menu entries with consistent styling.

id:          AnimatorPlayingCardsVanilla
name:        createAnimator - Playing cards in plain JavaScript
description: The playing card from the useAnimator example, built in plain JavaScript with createAnimator and pointer events: it follows a drag, springs back on a gentle release, flies off with momentum on a quick flick, and a button discards it from the keyboard. React only mounts it.

id:          DragToSnapPointsCardVanilla
name:        createDragToSnapPoints - Playing card in plain JavaScript
description: The three-place playing card from the useDragToSnapPoints example, built in plain JavaScript with createDragToSnapPoints: a sideways drag settles it on the nearest place or the next after a flick, buttons settle it from the keyboard, and a live region announces the place. React only mounts it.

id:          DateInputShowcase
name:        DateInput
description: A date input field with a calendar popover. Type a date or click the calendar icon to pick one.

id:          DateInputClearable
name:        DateInput - Clearable
description: Date input with a clear button that resets the value. Use when the date field is optional and the user may need to undo their selection.

id:          DateInputWithDescription
name:        DateInput - Description
description: Date input with helper text below the label explaining what the field expects. Use when the purpose of the date is not obvious from the label alone.

id:          DateInputFormats
name:        DateInput - Formats
description: The format prop reuses Timestamp's format vocabulary to control how the committed value is displayed: date, date_long (default), date_weekday, and system_date, or a function for a fully custom string. Formatting applies only to the committed value, never to text the user is actively typing.

id:          DateInputDateRange
name:        DateInput - Min/Max Constraints
description: Date input constrained to a min/max window. Use when only certain dates are valid, like booking availability or a fiscal quarter.

id:          DateInputWithValidation
name:        DateInput - Validation
description: Date input in all three status states: error, warning, and success. Use to surface validation issues, caution the user, or confirm a valid selection.

id:          DateRangeInputShowcase
name:        DateRangeInput
description: A date range picker with a button trigger and dual-month calendar popover with preset ranges.

id:          DateRangeInputWithValidation
name:        DateRangeInput - Validation
description: Date range input in all three status states: error, warning, and success. Use to surface booking conflicts, flag high-demand periods, or confirm an available range.

id:          DateRangeInputWithPresets
name:        DateRangeInput - With Presets
description: Date range picker with quick-select presets for common periods. Use for analytics dashboards, report filters, or any context where users frequently select standard time windows.

id:          DateTimeInputShowcase
name:        DateTimeInput
description: A combined date and time picker. Desktop opens a calendar popover with a time input; touch devices open a Date/Time bottom sheet.

id:          DateTimeInputWithValidation
name:        DateTimeInput - Validation
description: DateTimeInput in all three status states: error, warning, and success. Use to surface scheduling conflicts, caution the user about edge cases, or confirm a valid datetime.

id:          DialogShowcase
name:        Dialog
description: Modal dialog with a header, body content, and close button.

id:          DialogAdaptivePresentation
name:        Dialog - Adaptive presentation
description: Opt-in recipe for an AdaptiveDialog wrapper: Dialog remains the default everywhere, while touchPresentation="bottom-sheet" switches only at lg and below when pointer is coarse and hover is unavailable. Includes a deterministic presentation override for tests/unusual environments and notes that BottomSheet purpose controls swipe and scrim dismissal. Usage examples: touchPresentation="dialog" keeps Dialog, "fullscreen" chooses fullscreen Dialog, and "bottom-sheet" chooses BottomSheet only for the touch-oriented range. Keep presentation as the deterministic override. Do not use this by default for AlertDialog or destructive confirmations.

id:          DialogConfirmationDialog
name:        Dialog - Confirmation
description: Asks the user to confirm a destructive action before it happens. Use before deleting projects, removing team members, revoking API keys, or any irreversible operation.

id:          DialogFormDialog
name:        Dialog - Form
description: Collects user input without navigating away from the page. Uses purpose="form" so clicking the backdrop won't close it. Use for editing profiles, creating items, or updating settings inline.

id:          DialogFullscreenDialog
name:        Dialog - Fullscreen
description: Takes over the entire viewport for content that needs maximum space. Use for documentation viewers, rich text editors, multi-step wizards, or media previews where the standard dialog width is too narrow.

id:          DialogWithSubtitle
name:        Dialog - Required
description: Cannot be dismissed by Escape or backdrop click; the user must explicitly choose an action. Uses purpose="required". Use for ownership transfers, legal acknowledgements, or critical decisions where skipping is not an option.

id:          DialogScrollingContent
name:        Dialog - Scrollable
description: Constrains the dialog height and scrolls the body when content overflows. Use for terms and conditions, license agreements, changelogs, or any long-form content the user needs to review before accepting.

id:          DialogHeaderShowcase
name:        DialogHeader
description: DialogHeader provides a structured header for dialogs with slots for title, subtitle, close button, and optional start or end content.

id:          DialogHeaderBasic
name:        DialogHeader - Basic
description: A DialogHeader with a title, subtitle, and close button, placed in the header slot of a Dialog Layout. Pass onOpenChange to render the close button.

id:          DividerFullBleed
name:        Divider - Full Bleed
description: Divider that extends past container padding to span the full width. Use inside cards or panels when you want a clean edge-to-edge separation, like between an order summary and total.

id:          DividerShowcase
name:        Divider - Variants
description: Horizontal dividers in subtle and strong variants, plus a labeled divider. A quick visual reference for separator styles.

id:          DividerVariants
name:        Divider - Variants
description: Subtle, labeled, and strong dividers in a single card. Use subtle between related sections, labeled for alternatives like "or", and strong for high-contrast boundaries.

id:          DividerVertical
name:        Divider - Vertical
description: Vertical dividers separating side-by-side metrics. Use between stat cards, toolbar groups, or any horizontal layout where you need a visual boundary between sections.

id:          DrawerHeaderShowcase
name:        DrawerHeader
description: DrawerHeader provides a structured header for drawers with slots for title, subtitle, close button, and optional start or end content.

id:          DropdownMenuShowcase
name:        DropdownMenu
description: A button that opens a dropdown menu with action items. The menu starts open for preview.

id:          DropdownMenuActions
name:        DropdownMenu - Actions
description: Action menu with dividers separating safe and destructive operations. Use for row-level actions on items like documents, projects, or records.

id:          DropdownMenuBottomSheet
name:        DropdownMenu - Adaptive presentation
description: Chooses a bottom sheet for compact touch surfaces and an anchored popover otherwise. The media query is product policy, while DropdownMenu owns both presentations.

id:          DropdownMenuWithDisabledItems
name:        DropdownMenu - Disabled
description: Menu with selectively disabled items based on permissions. Use when some actions require higher privileges, like admin-only operations.

id:          DropdownMenuNoChevron
name:        DropdownMenu - Icon Trigger
description: Overflow menu triggered by an icon-only button with no chevron or label text. Use for row-level actions in tables, cards, or lists where a text button would take too much space.

id:          DropdownMenuWithSections
name:        DropdownMenu - Sections
description: Menu items organized into titled sections for easy scanning. Use when you have 6+ actions that fall into distinct categories, like Create vs Manage.

id:          DropdownMenuWithSubmenu
name:        DropdownMenu - Submenu
description: Action menu with a nested submenu. Hover or Right arrow opens the flyout; Left arrow / Escape closes it. Use to group related destinations or secondary actions without crowding the top level.

id:          DropdownMenuGroupShowcase
name:        DropdownMenuGroup
description: A compound-mode menu whose rows are titled in groups. Each DropdownMenuGroup renders a role="group" named by its heading; arrow keys and typeahead skip the heading.

id:          DropdownMenuGroupWithSelectable
name:        DropdownMenuGroup - Selectable rows
description: Titled groups around a radio group and checkbox rows - the rows the data API cannot express, which is why the heading lives in compound mode.

id:          DropdownMenuItemShowcase
name:        DropdownMenuItem
description: Dropdown menu with custom-rendered items using DropdownMenuItem for icons and descriptions.

id:          DropdownMenuItemBasic
name:        DropdownMenuItem - Basic
description: Dropdown menu items with labels and secondary descriptions. Use DropdownMenuItem to render custom menu entries with consistent styling.

id:          DrawerForm
name:        Edit form with footer actions
description: Compose a Layout with DrawerHeader, the fields in LayoutContent, and Cancel and Save in a pinned LayoutFooter. purpose="form" keeps Escape but ignores scrim clicks, so a stray click outside does not discard edits.

id:          EmptyStateShowcase
name:        EmptyState
description: A no-results empty state with an icon, descriptive message, and a call-to-action button.

id:          EmptyStateActions
name:        EmptyState - Actions
description: Full empty state with icon, message, and action buttons. Use when a search returns no results, a filter clears all items, or a list has been emptied. The buttons give the user a way forward: go back, clear filters, or try a different query.

id:          EmptyStateCompact
name:        EmptyState - Compact
description: Smaller empty state with reduced spacing for constrained areas. Use inside sidebar panels, card widgets, or notification drawers where a full-size empty state would overwhelm the layout.

id:          EmptyStateContainer
name:        EmptyState - Container
description: Empty state wrapped in a Card for first-time setup or onboarding. Use when the user has not created any items yet, like a project list, team roster, or dashboard widget that will fill with data once they take action.

id:          FieldShowcase
name:        Field
description: A form field wrapping a text input with a label, description, and validation status.

id:          FieldWithDescription
name:        Field - Description
description: Fields with helper text below the label. Use descriptions to explain format requirements, constraints, or what happens with the data, like "At least 8 characters" or "We will send a confirmation link".

id:          FieldRequired
name:        Field - Required & Optional
description: Required and optional field indicators side by side. Use isRequired on fields the user must fill in, and isOptional to clarify which fields can be skipped.

id:          FieldStatusVariants
name:        Field - Validation States
description: All three validation states: error, warning, and success. Use error for invalid input, warning for potential issues like reserved names, and success to confirm valid entries like API keys.

id:          FieldLabelShowcase
name:        FieldLabel
description: Standalone field labels demonstrating required, optional, tooltip, and icon variations.

id:          FieldLabelBasic
name:        FieldLabel - Basic
description: Standalone labels with required and optional indicators and a helper description. Use when labeling a custom control that does not render its own label.

id:          FieldStatusShowcase
name:        FieldStatus
description: Field status messages in error, warning, and success states with attached and detached variants.

id:          FieldStatusBasic
name:        FieldStatus - Basic
description: Detached error and success messages for validation feedback. Use below checkboxes, switches, or custom controls where an attached status would overlap.

id:   FileInputShowcase
name: FileInput

id:          FileInputBasic
name:        FileInput - Basic
description: A controlled single-file upload with accepted types, a size limit, and helper text. Use for standard document upload fields in forms.

id:          FormLayoutShowcase
name:        FormLayout
description: A vertical form layout with text input fields.

id:          FormLayoutHorizontal
name:        FormLayout - Horizontal
description: Two fields side by side for naturally paired inputs like first and last name

id:          FormLayoutMixedControls
name:        FormLayout - Mixed Controls
description: Form with different control types: text input, selector, and checkboxes

id:          FormLayoutNested
name:        FormLayout - Nested Address Form
description: Address form mixing vertical and horizontal layouts for grouped fields

id:          FormLayoutHorizontalLabels
name:        FormLayout - Settings Form
description: Settings form with labels placed beside their inputs

id:   GridShowcase
name: Grid

id:          GridGalleryExample
name:        Grid - Card Gallery
description: Card gallery with responsive columns that maintain consistent widths

id:          GridWithGridSpan
name:        Grid - Column Spanning
description: Grid with featured items spanning multiple columns and rows

id:          GridDashboardLayout
name:        Grid - Dashboard Layout
description: Dashboard layout with mixed-size widgets and a full-width summary row

id:          GridResponsiveAutoFit
name:        Grid - Responsive Auto-Fit
description: Responsive grid where cards stretch to fill remaining space

id:          GridSpanShowcase
name:        GridSpan
description: GridSpan lets a grid item span multiple columns or rows within an Grid, enabling masonry-style and asymmetric layouts.

id:          GridSpanColumns
name:        GridSpan - Columns
description: Grid items spanning two of three columns. Wrap a grid child in GridSpan to make it occupy multiple columns for asymmetric layouts.

id:   HeadingShowcase
name: Heading

id:          HeadingCardGrid
name:        Heading - Card Grid
description: Responsive card grid with truncated headings and descriptions for uniform layout

id:          HeadingPageLayout
name:        Heading - Page Hierarchy
description: Real-world page layout demonstrating heading levels h1 through h3 with supporting text

id:          HeadingTruncation
name:        Heading - Truncation
description: Single-line and multi-line heading truncation with ellipsis for constrained layouts

id:          HoverCardShowcase
name:        HoverCard
description: A hover card that shows a user profile preview when hovering over a trigger button. Starts open for preview.

id:          HoverCardInlineTextHoverCard
name:        HoverCard - Definition
description: Shows a term definition on hover within a paragraph. Use for technical terms, jargon, or concepts that some readers may not know, like a glossary built into the text.

id:          HoverCardInteractiveContent
name:        HoverCard - Link Preview
description: Shows a page summary when hovering a link: title, description, and URL. Use for documentation links, article references, or any URL where a preview helps the user decide whether to click.

id:          HoverCardProfileHoverCard
name:        HoverCard - Profile Preview
description: Shows a user profile summary on hover with name, role, and bio. Use on usernames, avatars, or mentions to let users preview a profile without navigating away.

id:          HStackShowcase
name:        HStack
description: Demonstrates HStack arranging items horizontally with different gaps and alignments.

id:          HStackBasic
name:        HStack - Basic
description: Items arranged in a horizontal row with a consistent gap and centered vertical alignment. Use HStack whenever siblings should sit side by side.

id:   IconShowcase
name: Icon

id:          IconNonSemanticColors
name:        Icon - Non-Semantic Colors
description: Non-semantic color palette for icons.

id:          IconSemanticColors
name:        Icon - Semantic Colors
description: All semantic icon color variants with labels.

id:          IconSizes
name:        Icon - Size Variants
description: All icon sizes from extra-small to large.

id:          IconStatusIcons
name:        Icon - Status Indicators
description: Status list using semantic icons for success, warning, error, and info.

id:          IconButtonShowcase
name:        IconButton
description: An icon button with a wrench icon.

id:          IconButtonActionBar
name:        IconButton - Action Bar
description: Row of ghost icon buttons for a compact action toolbar

id:          IconButtonFloating
name:        IconButton - Floating
description: A floating action button (FAB). The most common floating-button shape is icon-only. Raised here with `elevation="high"`.

id:          IconButtonLoadingToggle
name:        IconButton - Loading State
description: Icon buttons that show a loading spinner on click for async feedback

id:          IconButtonTooltipIconButton
name:        IconButton - With Tooltips
description: Icon buttons with tooltips that explain each action on hover

id:   InfoTipShowcase
name: InfoTip

id:          InfoTipMetricDefinitions
name:        InfoTip - Metric Definitions
description: A row of metrics, each label followed by an InfoTip that defines how the value is counted.

id:          InfoTipPermissionNotes
name:        InfoTip - Permission Notes
description: Read-only settings whose labels carry an InfoTip that says who can change each value.

id:   InputGroupShowcase
name: InputGroup

id:          InputGroupBasic
name:        InputGroup - Basic
description: A currency field with static prefix and suffix addons around a TextInput. Use InputGroupText to clarify units or input format.

id:          InternationalizationProvider04Calendar
name:        InternationalizationProvider - Calendar
description: Set the `calendar` prop and the `Calendar` and `DateInput` inside the provider show that calendar system. The value stays a Gregorian ISO date. Japanese and Buddhist dates work in every browser; calendars such as Persian or Hebrew also need `Temporal` or a polyfill.

id:          InternationalizationProvider02Overrides
name:        InternationalizationProvider - Overrides
description: Override a small number of Astryx strings without providing a full locale catalog.

id:          InternationalizationProvider03RtlDirection
name:        InternationalizationProvider - RTL Direction
description: Toggle text direction with the `dir` prop and watch Astryx components mirror. Pagination flips its prev/next chevrons under RTL. The `dir` prop is passed to both `InternationalizationProvider` (so Astryx components pick it up) and the `VStack` (so the DOM subtree mirrors); both channels stay in sync with no extra wrapper.

id:          InternationalizationProvider01ShippedLocale
name:        InternationalizationProvider - Shipped Locale
description: Load a locale catalog shipped by Astryx and re-render InternationalizationProvider with a new locale to update Astryx strings live.

id:   ItemShowcase
name: Item

id:          ItemBasicItem
name:        Item - Basic
description: A basic item with a label, supporting description, and end-aligned timestamp. Use this for simple rows that need consistent text alignment and spacing.

id:          ItemDocumentTabs
name:        Item - Document Tabs
description: Single-row, horizontally scrollable document switcher with compact selected rows, leading file icons, instant reveal-on-hover close actions with reserved geometry, stable separators, and an add control outside the scroll area. Use for editor tabs, workspace tabs, open documents, files, canvases, or panels.

id:          ItemWithMetadata
name:        Item - Metadata
description: Status rows with an icon, a title, a short description, and end-aligned metadata such as a timestamp or a status badge, here build, memory, and sync events. Use the endContent slot for counts, status, timestamps, and other secondary row information.

id:          ItemWithMedia
name:        Item - Start Content
description: Items with leading avatars and icons in the startContent slot. Keep start content small so the row stays compact and easy to scan.

id:   KbdShowcase
name: Kbd

id:          KbdInlineInstructions
name:        Kbd - Inline Instructions
description: Keyboard shortcuts rendered inline within instructional text

id:          KbdMenuShortcuts
name:        Kbd - Menu Shortcuts
description: Menu-style list pairing action labels with their keyboard shortcuts

id:          KbdModifierCombos
name:        Kbd - Modifier Combinations
description: Modifier combinations and special keys rendered as shortcut badges

id:   LayoutShowcase
name: Layout

id:          LayoutBasicCardLayout
name:        Layout - Basic Card
description: A card layout with header, scrollable content area, and footer with action buttons.

id:          LayoutContentOnlyLayout
name:        Layout - Content Only
description: A minimal layout with just a content area inside a card, without header or footer.

id:          LayoutContentWidth
name:        Layout - Content Width
description: A layout using contentWidth to constrain and center content while keeping dividers full-bleed.

id:          LayoutDualPanelLayout
name:        Layout - Dual Panel
description: A file browser style layout with start panel for folders, main content for files, and end panel for details.

id:          LayoutFullBleedContent
name:        Layout - Full Bleed Content
description: A layout where content extends edge-to-edge with zero padding, ideal for tables or images.

id:          LayoutSidebarLayout
name:        Layout - Sidebar Navigation
description: A settings page layout with a navigation sidebar panel, content area, header, and footer.

id:          LayoutContentShowcase
name:        LayoutContent
description: LayoutContent is the scrollable main content area within a Layout, providing automatic padding and scroll containment between the header and footer.

id:          LayoutContentBasic
name:        LayoutContent - Basic
description: A scrollable main content area below a fixed header. Use LayoutContent inside Layout to get automatic padding and scroll containment for the primary content.

id:          LayoutFooterShowcase
name:        LayoutFooter
description: LayoutFooter is a fixed footer slot within a Layout, pinned to the bottom for persistent actions like form buttons or navigation.

id:          LayoutFooterActions
name:        LayoutFooter - Actions
description: A fixed footer with end-aligned action buttons below scrollable content. Use LayoutFooter inside Layout for persistent actions like Save and Cancel.

id:          LayoutHeaderShowcase
name:        LayoutHeader
description: LayoutHeader is a fixed header slot within a Layout, pinned to the top for titles, navigation, and action buttons.

id:          LayoutHeaderWithActions
name:        LayoutHeader - With Actions
description: A fixed page header with a title and a primary action, above scrollable content. Use LayoutHeader inside Layout for persistent page-level headers.

id:          LayoutPanelShowcase
name:        LayoutPanel
description: LayoutPanel is a sidebar slot within a Layout, used for navigation, detail views, or secondary content alongside the main content area.

id:          LayoutPanelNavigation
name:        LayoutPanel - Navigation
description: A fixed-width side panel holding a navigation list next to the main content. Use LayoutPanel in the start or end slot of Layout for sidebars.

id:          LightboxShowcase
name:        Lightbox
description: A fullscreen image viewer with caption.

id:          LightboxGallery
name:        Lightbox - Gallery
description: A thumbnail grid that opens a fullscreen gallery. Clicking any thumbnail opens the lightbox at that index. Prev/next navigation lets users browse all images without closing.

id:          LightboxVideo
name:        Lightbox - Video
description: Opens a video in the lightbox. Native browser controls are available. Zoom and pan are disabled for video items.

id:          LightboxZoom
name:        Lightbox - Zoom
description: A lightbox with zoom and pan enabled. Double-click the image to zoom in; drag to pan around. Double-click again or use the close button to exit.

id:          LinkShowcase
name:        Link
description: A standalone link.

id:          LinkExternalLinks
name:        Link - External Links
description: A vertical list of external links that open in a new tab with an indicator icon.

id:          LinkInlineLink
name:        Link - Inline Text
description: A link embedded within a paragraph of body text.

id:          LinksWithTooltips
name:        Link - With Tooltips
description: Horizontal row of standalone links with descriptive hover tooltips.

id:          LinkProviderCustomLink
name:        Link Provider - Custom Link Component
description: Routes every Astryx link through a custom component that intercepts the click, the hook frameworks like Next.js use for client-side navigation. Click the link to see the custom handler fire instead of a full-page load.

id:   ListShowcase
name: List

id:          ListBasicList
name:        List - Basic
description: Simple list with labels and descriptions for settings-style layouts.

id:          ListBulletedFeatures
name:        List - Bulleted Features
description: Bulleted list of feature highlights using disc markers.

id:          ListMessageList
name:        List - Message List
description: Chat-style message list with avatars, preview text, and unread badges.

id:          ListOrderedSteps
name:        List - Ordered Steps
description: Numbered step-by-step instructions using decimal list markers.

id:          ListItemBasicItem
name:        List Item - Basic
description: Basic list items with labels and descriptions. Use this structure for settings, navigation summaries, and other simple collections.

id:          ListItemWithMedia
name:        List Item - Media
description: List items with leading avatars and icons. Use startContent for compact visual identifiers that help users scan the collection.

id:          ListItemWithMetadata
name:        List Item - Metadata
description: List items with end-aligned metadata. Use endContent for badges, counts, timestamps, and compact status details.

id:          ListItemShowcase
name:        ListItem
description: List items with icons, descriptions, and end content slots demonstrating the full ListItem API.

id:          MarkdownShowcase
name:        Markdown
description: Rich markdown content with headings, lists, and formatting.

id:          MarkdownCitedContent
name:        Markdown - Cited Content
description: Markdown with citation chips linked to external sources

id:          MarkdownCompactAIResponse
name:        Markdown - Compact AI Response
description: Compact markdown styled for AI responses with shifted heading levels

id:          MarkdownDataTable
name:        Markdown - Data Table
description: Comparison table rendered from a markdown string

id:          MarkdownRichContent
name:        Markdown - Rich Content
description: Markdown with headings, lists, code blocks, tables, blockquotes, and task lists

id:          MediaThemeImageOverlay
name:        MediaTheme - Image Overlay
description: A common image card pattern: place text and actions over a dark gradient and wrap the overlay content in MediaTheme mode="dark".

id:          MediaThemeLightScrim
name:        MediaTheme - Light Scrim
description: A light scrim over an image. Use MediaTheme mode="light" so text and ghost buttons use dark-on-light tokens.

id:          MediaThemeShowcase
name:        MediaTheme - Media Overlay
description: A compact media overlay showing MediaTheme adapting text, icons, badges, and button variants over an image-backed dark surface.

id:   MetadataListShowcase
name: MetadataList

id:          MetadataListBasicMetadata
name:        MetadataList - Basic
description: Single-column key-value metadata list.

id:          MetadataListCollapsibleMetadata
name:        MetadataList - Collapsible
description: Metadata list with a show-more toggle after a set number of items.

id:          MetadataListHorizontalMetadata
name:        MetadataList - Horizontal
description: Horizontal metadata items for compact inline display.

id:          MetadataListMultiColumnMetadata
name:        MetadataList - Multi-Column
description: Multi-column metadata grid with token tags.

id:          MetadataListItemShowcase
name:        MetadataListItem
description: Metadata list items displaying labeled values in various formats including text, badges, and links.

id:          MetadataListItemBasic
name:        MetadataListItem - Basic
description: A titled section of label and value rows for one record, here a deployment's environment, health status badge, version, and last deploy date. Values take plain text or a component such as a Badge.

id:   MobileNavShowcase
name: MobileNav

id:          MobileNavBasicMobileNav
name:        MobileNav - Basic Drawer
description: Mobile navigation drawer with sectioned nav items triggered by a menu button

id:          MobileNavEndSideMobileNav
name:        MobileNav - End Side Drawer
description: Navigation drawer that slides in from the right side of the screen

id:          MobileNavWithoutTitleMobileNav
name:        MobileNav - Without Title
description: Mobile navigation drawer without a title header

id:          MobileNavToggleShowcase
name:        MobileNavToggle
description: Demonstrates MobileNavToggle as a standalone hamburger button for opening the mobile navigation drawer.

id:          MobileNavToggleBasic
name:        MobileNavToggle - Basic
description: A nav toggle with a custom icon and accessible label instead of the default hamburger. It opens a MobileNav drawer via the AppShell mobile context, which AppShell provides automatically.

id:          DrawerScrim
name:        Modal or non-modal (hasScrim)
description: The default modal drawer dims the page, traps focus, and closes on a scrim click. With hasScrim={false}, the drawer has no scrim or focus trap and leaves the page interactive.

id:          MoreMenuShowcase
name:        MoreMenu
description: A basic three-dot menu with simple action items.

id:          MoreMenuBottomSheet
name:        MoreMenu - Bottom Sheet
description: A visible overflow trigger that opens actions in a BottomSheet. Use this presentation for short action sets on compact touch surfaces.

id:          MoreMenuDefaultMoreMenu
name:        MoreMenu - Default
description: Basic three-dot overflow menu with simple text-only action items.

id:          MoreMenuWithDividers
name:        MoreMenu - With Dividers
description: A three-dot menu with a divider separating destructive actions from safe ones.

id:          MoreMenuWithSections
name:        MoreMenu - With Sections
description: A three-dot menu with actions organized into labeled groups.

id:   MultiSelectorShowcase
name: MultiSelector

id:          MultiSelectorBottomSheet
name:        MultiSelector - Bottom Sheet
description: Keeps a multi-selection list open in a bottom sheet while choices are toggled.

id:          MultiSelectorColumnVisibilitySelector
name:        MultiSelector - Column Visibility
description: Column visibility toggle with hidden label, search, select-all, and selection count.

id:          MultiSelectorForm
name:        MultiSelector - Form Composition
description: Two multi-selectors in a form with required/optional states.

id:          MultiSelectorGhostToolbar
name:        MultiSelector - Ghost Toolbar
description: Borderless MultiSelector variant composed with ghost buttons in a toolbar.

id:          MultiSelectorSearchableMultiSelector
name:        MultiSelector - Searchable
description: Multi-select with search filtering and select-all.

id:          MultiSelectorSectionedMultiSelector
name:        MultiSelector - Sectioned Permissions
description: Multi-select with options grouped into labeled sections.

id:          NavHeadingMenuShowcase
name:        NavHeadingMenu
description: NavHeadingMenu passed as the menu prop of SideNavHeading, letting the heading act as a product switcher popover trigger.

id:          NavIconShowcase
name:        NavIcon
description: Circular icon containers for navigation headers with accent backgrounds.

id:          NavIconBasic
name:        NavIcon - Basic
description: Circular icon containers wrapping semantic icons. Use as logos or accent icons in navigation headers such as TopNavHeading.

id:          NumberInputShowcase
name:        NumberInput
description: A number input for quantity entry.

id:          NumberInputClearableNumberInput
name:        NumberInput - Clearable
description: Number input with a clear button, unit suffix, and min/max constraint

id:          NumberInputRangeNumberInput
name:        NumberInput - Range Constrained
description: Number input with min/max boundaries and a helper description

id:          NumberInputStatuses
name:        NumberInput - Status Variants
description: Number inputs showing error, warning, and success validation states

id:          NumberInputWithUnits
name:        NumberInput - With Units
description: Number input with a percentage unit suffix and valid range

id:          OutlineShowcase
name:        Outline
description: A document outline with the active section highlighted by the sliding indicator track.

id:          OutlineControlled
name:        Outline - Controlled
description: Drive the active section yourself with activeId and onActiveIdChange. Providing activeId disables the built-in scroll-spy so your own logic owns the highlight.

id:          OutlineDeepNesting
name:        Outline - Deep Nesting
description: Heading levels 1 through 4 map to progressively deeper indentation, so a long document with sub-sections stays scannable.

id:          OutlineDensity
name:        Outline - Density
description: Two density variants control item padding. Use compact for dense sidebars and default for standard documentation layouts. The sliding indicator automatically matches each item height.

id:          OverflowListShowcase
name:        OverflowList
description: A list of buttons that collapses overflowing items into a +N indicator.

id:          OverflowListOverflowBadges
name:        OverflowList - Badge Tags
description: Resizable row of badges that collapses into a count badge on overflow

id:          OverflowListCappedToolbar
name:        OverflowList - Capped Toolbar
description: maxVisibleItems caps the row at three actions even when more would fit; the rest move to a dropdown

id:          OverflowListCollapseFromStartList
name:        OverflowList - Collapse From Start
description: Overflow list that hides items from the start, keeping the latest visible

id:          OverflowListOverflowDropdownActions
name:        OverflowList - Dropdown Actions
description: Action toolbar that collapses overflow buttons into a dropdown menu

id:          OverflowListMultiRowTags
name:        OverflowList - Multi-row Tags
description: Tags wrap onto up to two rows with maxRows, then collapse the rest into a count badge

id:          OverlayShowcase
name:        Overlay
description: A media card with an always-visible scrim and centered action content.

id:          OverlayBottomStrip
name:        Overlay - Bottom Strip
description: Places compact supporting content in a bottom scrim strip without covering the entire image.

id:          OverlayHoverReveal
name:        Overlay - Hover Reveal
description: Reveals an overlay action on hover or keyboard focus. Use when actions should stay visually quiet until the media receives attention.

id:          PaginationDotsCarousel
name:        Pagination - Dots Carousel
description: A review carousel using dot pagination to step through testimonial cards. Use the dots variant for carousels, galleries, and any paged content where the total is small and visible position matters more than a page number.

id:          PaginationPageSize
name:        Pagination - Page Size Selector
description: A transactions table with pagination and a page size dropdown at the bottom. Shows how pagination works as a footer below real content, with adjustable rows per page.

id:          PaginationVariants
name:        Pagination - Variants
description: All four display variants stacked: dots, compact, count, and pages. A quick visual reference for choosing the right variant.

id:          PaginationWithTable
name:        Pagination - With Table
description: Pagination below a data table with client-side page slicing. Use the count variant with small size for dense data views where users need to see item ranges.

id:   PopoverShowcase
name: Popover

id:          PopoverBottomSheetAlternative
name:        Popover - Bottom Sheet Alternative
description: Opt-in BottomSheet alternative for compact touch surfaces where actions should use a modal presentation anchored to the bottom edge.

id:          PopoverConfirmAction
name:        Popover - Confirm Action
description: Inline confirmation popover for destructive actions with delete and cancel buttons.

id:          PopoverFilterPanel
name:        Popover - Filter Panel
description: Popover with checkbox filters and apply/reset actions.

id:          PopoverKeyboardShortcuts
name:        Popover - Keyboard Shortcuts
description: Popover displaying a list of keyboard shortcuts with key and description pairs.

id:          PopoverSettingsPanel
name:        Popover - Settings Panel
description: Popover with toggle switches for managing user preferences like notifications, dark mode, and sounds.

id:          PowerSearchShowcase
name:        PowerSearch
description: Token-based filter bar with enum and text fields, pre-populated with sample filters.

id:          PowerSearchContentSearch
name:        PowerSearch - Content Search
description: Power search with contentSearchFieldKey so free-text input maps to a title field automatically.

id:          PowerSearchFullFeatured
name:        PowerSearch - Full Featured
description: Power search with multiple field types: enum, multi-select, entity, and text filters.

id:          PowerSearchPresetFilters
name:        PowerSearch - Preset Filters
description: Power search initialized with pre-set filter tokens for status and priority.

id:          PowerSearchSearchWithTable
name:        PowerSearch - Search with Table
description: Composition of PowerSearch with Table using usePowerSearchConfig to auto-generate config and filter data.

id:          ProgressBarShowcase
name:        ProgressBar
description: A progress bar filled to 60%.

id:          ProgressBarCustomFormat
name:        ProgressBar - Custom Format
description: Progress bar with a custom value label showing disk usage in GB.

id:          ProgressBarIndeterminate
name:        ProgressBar - Indeterminate
description: Indeterminate progress bar for operations with unknown duration.

id:          ProgressBarSemanticVariants
name:        ProgressBar - Semantic Variants
description: All semantic color variants stacked vertically.

id:          ProgressBarWithValueLabel
name:        ProgressBar - With Value Label
description: Progress bar with its current percentage displayed.

id:   RadioListShowcase
name: RadioList

id:          RadioListHorizontalLayout
name:        RadioList - Horizontal Layout
description: Radio list with horizontal orientation for compact selections.

id:          RadioListPricingTier
name:        RadioList - Pricing Tier
description: Radio list with pricing info in end content for plan selection.

id:          RadioListWithDescriptions
name:        RadioList - With Descriptions
description: Radio list with descriptions on the group and each item.

id:          RadioListWithValidation
name:        RadioList - With Validation
description: Required radio list with an error message when nothing is selected.

id:          RadioListItemShowcase
name:        RadioListItem
description: Radio list items with labels, descriptions, and different states including disabled.

id:          RadioListItemBasic
name:        RadioListItem - Basic
description: Radio items with labels and descriptions inside a controlled RadioList. Use for single-choice option groups like shipping methods.

id:          ResizableShowcase
name:        Resizable
description: Horizontal resizable split with a draggable handle between two panels.

id:          ResizableSidebar
name:        Resizable - Collapsible with snap points
description: A collapsible sidebar with snap points, driven by useResizable. Dragging snaps to preset widths, dragging past the minimum collapses the panel, and the expand method restores it programmatically.

id:          ScrollableAreaShowcase
name:        ScrollableArea
description: A fixed-height file panel that scrolls on the block axis; the heading sits inside the viewport, so it scrolls away with the content.

id:          ScrollableAreaInlineRail
name:        ScrollableArea - Inline Rail
description: axis="inline" scrolls the same cards sideways; isFullBleed lets the rail run to the panel edges while the content padding keeps the first card aligned with the heading.

id:          ScrollableAreaOverscrollChaining
name:        ScrollableArea - Overscroll
description: The same section, two edge policies: the default overscroll="allow" hands a gesture that reaches the end to the panel behind it, while overscroll="contain" stops it at the section edge.

id:          ScrollableAreaStickyPassthrough
name:        ScrollableArea - Sticky Passthrough
description: A section whose content fits clips instead of scrolling, so its sticky label passes outward and pins to the panel edge. The next section sets stickyContainment="always" and keeps its label in its own box.

id:          ScrollableAreaStickyGroupHeaders
name:        ScrollableArea - Sticky Section Labels
description: A scrollable viewport is the containing block for position: sticky, so section labels pin to the top edge of the list instead of the page.

id:          ScrollableAreaTwoAxisBoard
name:        ScrollableArea - Two-Axis Board
description: axis="both" gives the content box max-content inline sizing, so a board wider and taller than its panel scrolls on both axes from one viewport.

id:          SectionWashHighlight
name:        Section - Default with Wash
description: A default section stacked with a full-width muted section. Shows how muted draws attention to a specific region like an upgrade prompt or banner.

id:          SectionVariants
name:        Section - Variants
description: All three background variants stacked: section (default surface), muted, and transparent. A quick visual reference for choosing the right variant.

id:          SectionWithDividers
name:        Section - With Dividers
description: Adjacent sections separated by bottom dividers, like a settings page. Use dividers when stacking same-variant sections that need visual separation without a background change.

id:   SegmentedControlShowcase
name: SegmentedControl

id:          SegmentedControlDisabledItem
name:        SegmentedControl - Disabled Item
description: Segmented control with an individually disabled option for unavailable choices.

id:          SegmentedControlFillLayout
name:        SegmentedControl - Fill Layout
description: Segmented control that stretches segments equally to fill the available width, useful for fixed-width containers.

id:          SegmentedControlIconOnly
name:        SegmentedControl - Icon Only
description: Compact segmented control with hidden labels, showing only icons for space-constrained layouts.

id:          SegmentedControlWithIcons
name:        SegmentedControl - With Icons
description: Segmented control with icon and label pairs for a view mode switcher.

id:          SegmentedControlItemShowcase
name:        SegmentedControlItem
description: Segmented control items with text labels and icons, including a disabled item.

id:          SegmentedControlItemBasic
name:        SegmentedControlItem - Basic
description: A row of label-only options that switches between a few views, here Board, List, and Timeline. Each item declares a value; the parent control holds the selected value and change handler.

id:          SelectableCardShowcase
name:        SelectableCard
description: A plan picker with single-select radio behavior. Cards show an accent border when selected.

id:          SelectableCardElevated
name:        SelectableCard - Elevated
description: Raised selectable cards with `elevation="low"`. The inset selection ring composes on top of the shadow, so a selected card keeps its elevation.

id:          SelectableCardMulti
name:        SelectableCardMulti
description: Multi-select tag picker using color variant selectable cards with color-matched selection borders.

id:   SelectorShowcase
name: Selector

id:          SelectorBottomSheet
name:        Selector - Bottom Sheet
description: Presents a single-selection list in a bottom sheet for compact touch interfaces.

id:          SelectorClearable
name:        Selector - Clearable
description: Selector with a clear button to reset the selected value.

id:          SelectorGhostToolbar
name:        Selector - Ghost Toolbar
description: Borderless Selector variant composed with ghost buttons in a toolbar.

id:          SelectorWithSections
name:        Selector - Grouped Sections
description: Selector with options grouped into labeled sections.

id:          SelectorOptionDescriptions
name:        Selector - Option descriptions
description: Options carry a description, so the dropdown draws a two-line row. The closed trigger is sized by padding, so it is the size token for a one-line value and exactly one line taller for a two-line one; both on the 4px rhythm. An InputGroup pins the row, so the value folds back onto one line there.

id:          SelectorWithStatus
name:        Selector - Validation States
description: Selector showing error, warning, and success validation states.

id:          SelectorOptionShowcase
name:        SelectorOption
description: Selector with custom-rendered options using SelectorOption for icons and descriptions.

id:          SelectorOptionBasic
name:        SelectorOption - Basic
description: A selector whose options are rendered with SelectorOption, adding a secondary description below each label. Use inside renderOption for consistent custom option styling.

id:   SideNavShowcase
name: SideNav

id:          SideNavEndContent
name:        SideNav - End Content
description: Side navigation items with badges, counts, and context menus as trailing content.

id:          SideNavWithHeaderMenu
name:        SideNav - Header with Menu
description: Side navigation with an account switcher dropdown in the header for multi-account apps.

id:          SideNavNestedItems
name:        SideNav - Nested Items
description: Side navigation with collapsible nested items for settings or hierarchical menus.

id:          SideNavCollapseButtonShowcase
name:        SideNavCollapseButton
description: Demonstrates SideNavCollapseButton inside a collapsible SideNav.

id:          SideNavCollapseButtonBasic
name:        SideNavCollapseButton - Basic
description: Place a collapse button in the SideNav footer to let users toggle the rail between expanded and collapsed states. Disable the built-in button via collapsible={{hasButton: false}} when positioning it yourself.

id:          SideNavHeadingShowcase
name:        SideNavHeading
description: Demonstrates SideNavHeading with an app name, logo icon, superheading, and subheading.

id:          SideNavHeadingBasic
name:        SideNavHeading - Basic
description: A SideNav header with an app icon and a linked title. Pass it to the SideNav header prop to identify the product or workspace at the top of the navigation rail.

id:          SideNavItemShowcase
name:        SideNavItem
description: Demonstrates SideNavItem with selected, icon, disabled, and nested states.

id:          SideNavItemBasic
name:        SideNavItem - Basic
description: Navigation links inside a SideNav, each with a label, an icon, and an href. Mark the item for the current page with isSelected.

id:          SideNavSectionShowcase
name:        SideNavSection
description: Demonstrates SideNavSection with titled groups of navigation items.

id:          SideNavSectionBasic
name:        SideNavSection - Basic
description: Group related SideNavItems under titled sections. Use sections to organize longer navigation lists into scannable clusters like Overview and Account.

id:          SkeletonShowcase
name:        Skeleton
description: A skeleton loading placeholder.

id:          SkeletonCardSkeleton
name:        Skeleton - Card Loading
description: Card skeleton with avatar, name, and content lines.

id:          SkeletonStaggeredList
name:        Skeleton - Staggered List
description: Staggered skeleton lines with varying widths.

id:          SkeletonTableRowSkeleton
name:        Skeleton - Table Rows
description: Table skeleton with staggered column widths.

id:          DrawerStart
name:        Slide in from the start edge
description: Set side="start" to open from the inline start edge: left in LTR and right in RTL. The default end edge follows the inspector convention.

id:          SliderShowcase
name:        Slider
description: A slider control set to 50%.

id:          SliderFormattedValue
name:        Slider - Formatted Value
description: Slider with custom formatting showing temperature in Fahrenheit.

id:          SliderRangeSlider
name:        Slider - Range
description: Range slider for selecting a value range like price bounds.

id:          SliderWithStatus
name:        Slider - Validation States
description: Sliders with error, warning, and success validation states.

id:          SliderWithMarks
name:        Slider - With Marks
description: Slider with labeled tick marks at fixed intervals.

id:          SpinnerShowcase
name:        Spinner
description: A large spinner indicator.

id:          SpinnerOnMedia
name:        Spinner - On Media Shade
description: Default and onMedia shade spinners for light and dark backgrounds.

id:          SpinnerSizes
name:        Spinner - Sizes
description: All spinner sizes displayed side by side.

id:          SpinnerWithLabel
name:        Spinner - With Label
description: Spinners with text and rich multi-line labels.

id:          StackAlignment
name:        Stack - Alignment
description: Buttons positioned at the start, center, and end of a row.

id:          StackDirections
name:        Stack - Directions
description: Badges arranged horizontally and vertically in side-by-side cards.

id:          StackFillItem
name:        Stack - Fill Item
description: An avatar, text, and button in a row; the text stretches to fill the available space.

id:          StackItemShowcase
name:        StackItem
description: StackItem can be used within HStack or VStack for more granular control over individual item sizing and alignment, but is optional; stack children work without it.

id:          StackItemFill
name:        StackItem - Fill
description: A static-width item next to one that fills the remaining space. Wrap stack children in StackItem when an item needs explicit sizing control.

id:          StatusDotShowcase
name:        StatusDot
description: A positive status dot indicator.

id:          StatusDotPulsing
name:        StatusDot - Pulsing
description: Animated pulsing dots for live, processing, and error states.

id:          StatusDotStatusIndicators
name:        StatusDot - Status Indicators
description: Labeled status dot list for presence indicators like online, away, and offline.

id:          StatusDotVariants
name:        StatusDot - Variants
description: All five semantic color variants displayed in a row.

id:          StepShowcase
name:        Step
description: A single Step, with every part it can render: the indicator, the label with its optional marker and trailing endContent, and the description beneath. A Step never sets its own completed/current state. It declares its index and derives the rest from the parent Stepper, so one Step in one Stepper is a complete example.

id:          StepContent
name:        Step - Content Slot
description: Children passed to a Step render below its description, indented to line up with the label rather than the indicator, and stay outside the clickable label area so buttons inside remain their own targets. In a full flow you gate the slot on the step being active. That is what turns a vertical stepper into an expanding one.

id:          StepIndicator
name:        Step - Indicator
description: Everything the indicator prop accepts: the auto default, an always-number badge, a custom ReactNode, and none, each on its own completed Step so the prop is the only difference between them. Every variant occupies the same 16px box, so a step swapping its number for a check as it completes never shifts the label beside it. The last cell shows that a custom node can be live rather than static: a Spinner on a step that is in progress, shaded `inherit` so it picks up the step's own tint like any other glyph.

id:          StepStates
name:        Step - States
description: Every state a single Step can land in, each shown as one Step in its own Stepper. Completed, current, and upcoming are derived by comparing the step index against the parent activeStep, so they are never set directly; isDisabled and status are the two a step declares itself. Status is a separate axis from progress, which is why a completed step can still carry a warning.

id:          StepperShowcase
name:        Stepper - Checkout Progress
description: The default stepper: a horizontal track where every step owns an equal segment of the progress bar above its label. The default auto indicator resolves itself per step: a check once the step is done, a ring on the current step, a number for the ones still ahead. Click any step to jump.

id:          StepperCustomContent
name:        Stepper - Custom Content
description: A vertical stepper where each step owns a slice of the page. The content slot takes any node (form fields, a summary panel, a banner), so a stepper is not limited to multi-step forms. Rendering the slot only for the active step is what makes the flow expand one step at a time.

id:          StepperWidthResponsiveCollapse
name:        Stepper - Horizontal Narrow Collapsed
description: A narrow horizontal stepper using horizontalOptions. At 320px wide, four steps fall below the 112px minimumStepWidth and collapse into a current-step summary with Previous and Next controls.

id:          StepperIndicatorModes
name:        Stepper - Indicator Modes
description: The indicator prop side by side: none (the bar and label carry the progress on their own), auto (check when done, ring when current, number ahead), always-number, and a custom icon per step.

id:          StepperOnTrackHorizontal
name:        Stepper - On-Track Horizontal
description: The on-track layout in horizontal orientation: instead of sitting beside the label, each indicator is slotted into the connector itself, so the numbered nodes read as beads on one continuous line. Labels center under their node.

id:          StepperOnTrackVertical
name:        Stepper - On-Track Vertical
description: The on-track layout in vertical orientation: indicators sit inline on a continuous connector rail, with each label and description beside its node. Compare with the separated layout, where the indicator sits alongside its own bar segment instead of on a shared rail.

id:          StepperStatus
name:        Stepper - Validation Status
description: Semantic status per step in a verification flow: success shows a green check, error a red glyph, accent the in-progress step. Status sets the indicator color and glyph only, never the connector, and is announced to assistive tech as text.

id:          SwitchShowcase
name:        Switch
description: A toggle switch for enabling notifications.

id:          SwitchDisabled
name:        Switch - Disabled
description: Disabled switch with label and description for gated features.

id:          SwitchSettingsPanel
name:        Switch - Settings Panel
description: Settings panel with spread-spaced switches in a card.

id:          SwitchWithDescription
name:        Switch - With Description
description: Toggle with a label and supporting description text.

id:          SwitchWithStatus
name:        Switch - With Status
description: Switches with error, warning, and success validation states.

id:          SyntaxThemeShowcase
name:        SyntaxTheme - Compact Preset
description: A concise code block rendered with the One Dark Pro syntax preset to show how SyntaxTheme changes highlighting colors without making the page long.

id:          SyntaxThemeDarkPreset
name:        SyntaxTheme - Dark Preset
description: Wrap a code block in SyntaxTheme to apply a dark syntax preset such as Dracula.

id:          SyntaxThemeLightPreset
name:        SyntaxTheme - Light Preset
description: Use a light syntax preset for code examples that need to sit on light documentation surfaces.

id:          TabShowcase
name:        Tab
description: Tab is an individual tab item within a TabList, supporting labels, icons, selected icons, and end content slots.

id:          TabWithSelectedIcon
name:        Tab - Selected Icon
description: A tab that changes its icon when selected.

id:          TableShowcase
name:        Table
description: Data-driven table with proportional and pixel column widths and hover highlighting.

id:          TableColumnSettingsTable
name:        Table - Column Settings
description: Table with a column visibility picker in the toolbar. Toggle columns on and off.

id:          TableGridDividersTable
name:        Table - Grid Dividers
description: Compact table with grid dividers showing both row and column borders, suited for dense numeric data.

id:          TableInCard
name:        Table - In Card
description: Table composed inside a card with a heading, demonstrating container bleed alignment.

id:          TableInlineFilterTable
name:        Table - Inline Filters
description: Table with inline filter controls rendered directly below each column header.

id:          TablePaginatedTable
name:        Table - Paginated Data
description: Paginated data table navigating through a larger dataset page by page.

id:          TableFilterableTable
name:        Table - Popover Filters
description: Table with popover filter controls triggered by icons in column headers.

id:          TableResizableTable
name:        Table - Resizable Columns
description: Table with draggable column resize handles. Drag the right edge of any header to resize.

id:          TableRichCellTable
name:        Table - Rich Cell Content
description: Table with rich cell content using Link for emails and Badge for role labels.

id:          TableSelectableTable
name:        Table - Row Selection
description: Table with row selection checkboxes and a select-all header checkbox.

id:          TableLeadingMarkSelection
name:        Table - Selection in the Leading Mark
description: Selection without a checkbox column: each item shows its avatar, and the checkbox takes the avatar slot while a mouse is over it, on keyboard focus, and everywhere once anything is selected; on touch screens it always shows. The state comes from useTableSelectionState, and the checkboxes render in the name column instead of the useTableSelection column, so checked items get no aria-selected or highlight; add them if needed.

id:          TableSortableTable
name:        Table - Sortable Columns
description: Table with sortable columns, click headers to sort ascending or descending.

id:          TableStripedTable
name:        Table - Striped Rows
description: Table with alternating row colors and hover highlighting for easy scanning.

id:          TableBulkActionsTable
name:        Table: Bulk Actions
description: Controlled row selection with the reusable TableSelectionToolbar rendered in flow above the table. Product actions occupy the logical start; synchronized selection count and complete clear action occupy the logical end.

id:          TableFloatingBulkActionsTable
name:        Table: Floating Bulk Actions
description: The reusable TableSelectionToolbar inside a capped, self-contained scroll region for a long non-sticky table below metric cards. The caller-owned sticky placement keeps actions 16px from the example scrollport without moving the table when selection changes.

id:   TabListShowcase
name: TabList

id:          TabListTabsFillLayout
name:        TabList - Fill Layout
description: Tabs that stretch to fill the available width with a bottom divider.

id:          TabListTabsWithActions
name:        TabList - With Actions
description: Page header pattern with tabs on the left and action buttons pushed to the right. When hasDivider is true, match the Button size to the TabList size so the tabs and actions align to a shared baseline above the divider.

id:          TabListTabsWithBadge
name:        TabList - With Badge
description: Tabs with notification badge counts rendered via endContent. Uses error variant for urgent counts and neutral for informational ones.

id:          TabListTabsWithIcons
name:        TabList - With Icons
description: Tabs with leading icons alongside text labels.

id:          TabListTabsWithMenu
name:        TabList - With Overflow Menu
description: Tab list with a dropdown menu for additional items that do not fit inline.

id:          TabListTabsWithStatusDot
name:        TabList - With Status Dot
description: Tabs with status dot indicators rendered via endContent to show live environment health at a glance.

id:          TabMenuShowcase
name:        TabMenu
description: TabMenu is an overflow menu within a TabList that groups additional tab options into a dropdown, showing the selected option's label as the trigger text.

id:          TabMenuBasic
name:        TabMenu - Basic
description: An overflow menu at the end of a TabList that collects secondary tabs behind a dropdown. Use it when there are more tabs than fit comfortably inline.

id:   TextShowcase
name: Text

id:          TextColors
name:        Text - Colors
description: All text color options (primary, secondary, disabled, placeholder, active) applied to body text to show their intended use.

id:          TextHeadingLevels
name:        Text - Heading Levels
description: All 6 heading levels (h1 through h6) rendered with Heading to show the full type scale.

id:          TextInline
name:        Text - Inline
description: Mixing body and code text inline within a single line using the default inline display mode.

id:          TextTruncation
name:        Text - Truncation
description: Single-line and multi-line text truncation with ellipsis using maxLines in a width-constrained container.

id:          TextTypes
name:        Text - Types
description: All 5 semantic text types (body, large, label, supporting, code) with their default styling from the theme.

id:          TextWeight
name:        Text - Weight
description: The 4 font weight variants (normal, medium, semibold, bold) applied to body text.

id:          TextWordBreak
name:        Text - Word Break
description: Compares break-word and break-all word break modes on a long unbreakable string.

id:          TextWrap
name:        Text - Wrap
description: The 4 text-wrap modes (wrap, nowrap, balance, pretty) shown in width-constrained containers.

id:          TextAreaShowcase
name:        TextArea
description: A text area with placeholder text.

id:          TextAreaCharacterCount
name:        TextArea - Character Count
description: Textareas with maxLength and a live character counter. The counter turns red when the limit is exceeded.

id:          TextAreaWithIcon
name:        TextArea - Icon
description: Textareas with a leading icon that hints at the expected content, like a chat bubble for messages or a pencil for notes.

id:          TextAreaStates
name:        TextArea - States
description: Required, disabled, and loading textareas side by side. Shows the interactive states the component supports.

id:          TextAreaValidation
name:        TextArea - Validation
description: All three status variants (error, warning, and success) with status messages, plus error without a message. Use to show inline validation feedback as the user types.

id:   TextInputShowcase
name: TextInput

id:          TextInputIcon
name:        TextInput - Icon
description: Inputs with a leading icon that hints at the expected content. Use when the icon helps users identify the field faster, like a lock for passwords or an envelope for email.

id:          TextInputSearch
name:        TextInput - Search
description: Search input with a hidden label, start icon, and clear button. Use for toolbar and header search bars where the icon provides sufficient context.

id:          TextInputSizes
name:        TextInput - Sizes
description: Small, medium, and large inputs side by side. Use small in dense UIs like table filters, medium for most forms, and large for prominent single-field pages.

id:          TextInputStates
name:        TextInput - States
description: Error, warning, and success validation states with status messages. Use to show users what went wrong and how to fix it.

id:          TextInputStatusVariant
name:        TextInput - Status variant
description: The statusVariant prop controls whether the status message is attached to the bordered input (default, overlapping directly below) or detached from it (floating below as a separate element with spacing).

id:          TextInputTypes
name:        TextInput - Types
description: Text, password, and email types plus field-level features: tooltip, required, optional, description, disabled, and loading.

id:          ThemeApply
name:        Theme - Apply Theme
description: Wrap a subtree in Theme to apply a theme to every child component in that region.

id:          ThemeShowcase
name:        Theme - Distinct Themes
description: Two visually distinct theme providers wrapping identical content to show how Theme changes the visual treatment of child components.

id:          ThemeNested
name:        Theme - Nested Theme
description: Nested Theme providers let a local region use a different theme without affecting the rest of the page.

id:          ThemeSwitcher
name:        Theme - Switch Themes
description: Use state to switch the theme object passed to Theme and preview a different visual treatment.

id:          ThumbnailShowcase
name:        Thumbnail
description: A thumbnail with an image and label.

id:          ThumbnailDisabled
name:        Thumbnail - Disabled
description: Thumbnails in the disabled state with reduced opacity. The open and remove buttons stay focusable and announced as disabled, and call nothing.

id:          ThumbnailGallery
name:        Thumbnail - Gallery
description: A row of clickable thumbnails with labels that open a detail view. Use for image attachment lists where users need to preview and manage uploads.

id:          ThumbnailRemovable
name:        Thumbnail - Removable
description: Thumbnails with a remove button overlay. The close button uses APCA luminance detection to stay visible on both dark and light images.

id:          ThumbnailStates
name:        Thumbnail - States
description: All visual states side by side: image loaded, placeholder, skeleton loading, and upload overlay. Demonstrates the full lifecycle of a thumbnail from empty to loaded.

id:          TimeInputShowcase
name:        TimeInput
description: A time input that uses the browser/OS picker on touch by default and Astryx typed entry on fine pointers.

id:          TimeInputConstrained
name:        TimeInput - Constrained
description: Time inputs with min/max constraints limiting selection to specific windows. Use to prevent out-of-bounds selections for appointments, reservations, or shift scheduling.

id:          TimeInputFormats
name:        TimeInput - Formats
description: 12-hour, 24-hour, and seconds formats side by side. Use 12h for US-centric UIs, 24h for international or technical contexts, and seconds for precise timing.

id:          TimeInputIncrement
name:        TimeInput - Increment
description: Time input with a custom step increment. Arrow keys jump by the specified interval (e.g. 15 minutes) for quick slot-based scheduling.

id:          TimeInputStates
name:        TimeInput - States
description: Default, disabled, error, warning, and success states. Use status messages to give users clear feedback about their time selection.

id:   TimerShowcase
name: Timer

id:          TimerFormats
name:        Timer - Formats
description: Elapsed compact units and stopwatch clock notation shown from the same start time.

id:          TimerInline
name:        Timer - Inline
description: A Timer composed into status copy while inheriting the surrounding typography.

id:          TimerTypography
name:        Timer - Typography
description: Timer using its Timestamp-matched default typography and an emphasized override.

id:   TimestampShowcase
name: Timestamp

id:          TimestampAutoFormat
name:        Timestamp - Auto
description: Auto format that shows relative time for recent dates and switches to the full date for older ones. The default choice for most use cases.

id:          TimestampColors
name:        Timestamp - Colors
description: Timestamp rendered in each available color variant: primary, secondary, disabled, and active.

id:          TimestampFormats
name:        Timestamp - Formats
description: All display formats side by side: date, date_time, time, and their system equivalents. Use date and date_time for user-facing UI, system variants for logs and dev tools.

id:          TimestampRelativeFormat
name:        Timestamp - Relative
description: Relative time labels from seconds to months ago, with hover tooltips showing the full date. Use in feeds, comment threads, and activity logs.

id:          TimestampTimezone
name:        Timestamp - Timezone
description: Timestamps with the timezone abbreviation appended. Enable isTimezoneShown for audiences across time zones, like audit logs or team calendars.

id:          TimestampTooltipTimezones
name:        Timestamp - Tooltip time zones
description: Hover tooltips that show one instant across several time zones or formats. Use tooltipEntries when readers must compare zones, like an incident log carrying both the reader's time and the event's origin zone.

id:          ToastShowcase
name:        Toast
description: Imperative toast notifications triggered with useToast and rendered in the toast viewport.

id:          ToastAction
name:        Toast - Action
description: Persistent toasts with a trailing button or link so the user can act on the notification, like undoing a delete or viewing a report.

id:          ToastDeduplication
name:        Toast - Deduplication
description: Prevent duplicate toasts with uniqueID. Use ignore to keep the first toast, or overwrite to replace it with updated content like a progress percentage.

id:          ToastDismiss
name:        Toast - Dismiss
description: Show a persistent toast and dismiss it programmatically using the function returned by useToast. Use for long-running operations that need manual cleanup.

id:          ToastStacking
name:        Toast - Stacking
description: Multiple toasts stacking vertically with smooth enter and exit animations. Click repeatedly to see how toasts queue and dismiss.

id:          ToastTypes
name:        Toast - Types
description: Info and error toast variants side by side. Info toasts auto-dismiss after 5 seconds, error toasts persist until the user dismisses them.

id:   ToggleButtonShowcase
name: ToggleButton

id:          ToggleButtonColor
name:        ToggleButton - Color
description: Toggle buttons with colored icons in the pressed state. Shows accent-colored toolbar formatting and semantic reaction colors (yellow star, red heart, blue bookmark).

id:          ToggleButtonGroup
name:        ToggleButton - Group
description: Toggle button groups in single-select and multi-select modes. Single selection acts as a view mode switcher; multiple selection forms a formatting toolbar.

id:          ToggleButtonIconSwap
name:        ToggleButton - Icon Swap
description: Icon-only toggle buttons that swap between outline and solid icons when pressed. Use for actions like favorite, bookmark, or mute where the icon itself communicates the state.

id:          ToggleButtonLabel
name:        ToggleButton - Label
description: Toggle buttons with visible text labels that show a font weight shift on press. Use when the icon alone is not enough to communicate the action.

id:          ToggleButtonStates
name:        ToggleButton - States
description: Default, pressed, disabled, and loading states of a standalone toggle button. Shows how visual treatment changes across states.

id:          ToggleButtonGroupShowcase
name:        ToggleButtonGroup
description: ToggleButtonGroup manages a set of ToggleButtons with single-select or multi-select behavior for options like view modes or filters.

id:          ToggleButtonGroupVertical
name:        ToggleButtonGroup - Vertical
description: A vertically stacked ToggleButtonGroup using the vertical orientation, shown with both single-select and multi-select behavior, ideal for sidebar-style option lists and vertical toolbars.

id:   TokenShowcase
name: Token

id:          TokenClickable
name:        Token - Clickable
description: Interactive tokens that respond to clicks. Use for toggleable filters or tokens that open a detail view when selected.

id:          TokenColors
name:        Token - Colors
description: All 11 color variants in default and disabled states. Use color to categorize entities or convey status at a glance.

id:          TokenEndContent
name:        Token - End Content
description: Tokens with trailing content like a count badge or status indicator after the label. Use for notification counts, item quantities, or compact status info.

id:          TokenIcon
name:        Token - Icon
description: Tokens with a leading icon that identifies the entity type. Use when the icon helps users recognize the token category faster, like a user icon for people or a tag icon for labels.

id:          TokenRemovable
name:        Token - Removable
description: Tokens with a dismiss button for selections the user can undo. Use in multi-select fields, active filters, or any list of user-chosen items.

id:          TokenizerShowcase
name:        Tokenizer
description: A tokenizer with preset tags and search source.

id:          TokenizerClear
name:        Tokenizer - Clear
description: Tokenizer with a built-in clear-all button for bulk removal of all selected tokens. On touch screens, clear through the sheet's Clear all.

id:          TokenizerCreatable
name:        Tokenizer - Creatable
description: Free-text tokenizer for creating custom tags and a combined create-or-search pattern. Use when users need to enter values that may not exist in a predefined list.

id:          TokenizerEndContent
name:        Tokenizer - End Content
description: Tokenizer with an action button in the end slot. Use for inline actions like applying selections alongside the input.

id:          TokenizerIcon
name:        Tokenizer - Icon
description: Tokenizer with a leading search icon to visually reinforce the search behavior.

id:          TokenizerMaxEntries
name:        Tokenizer - Max Entries
description: Tokenizer with a maximum selection limit. The input hides automatically when the limit is reached, preventing further additions.

id:          TokenizerOverflow
name:        Tokenizer - Overflow
description: Tokenizer with overflow truncation when unfocused. Inline mode pushes content down on expand; layer mode overlays without shifting layout. Overflow modes apply to the inline field.

id:          TokenizerStates
name:        Tokenizer - States
description: Tokenizer in disabled, error, warning, and success states. Use to communicate validation feedback or lock a selection from editing.

id:          ToolbarBulkActions
name:        Toolbar - Bulk Actions
description: A compact toolbar with the muted variant for showing bulk selection actions. Use when the user selects multiple items in a list or table and needs quick access to batch operations.

id:          ToolbarCardHeader
name:        Toolbar - Card Header
description: A toolbar as a card header with a left-aligned title and icon actions on the right. Use Toolbar instead of LayoutHeader when your card header has interactive actions; Toolbar adds start/end slot layout, keyboard navigation, and automatic size cascading. If the header is just a title with no actions, a LayoutHeader or Section is enough.

id:          ToolbarSizes
name:        Toolbar - Sizes
description: Small, medium, and large toolbars side by side. The size prop cascades to child buttons and inputs automatically. Use small in dense UIs like cards, medium for most cases, and large for spacious layouts.

id:          ToolbarWithTabs
name:        Toolbar - Tab Navigation
description: A toolbar with tabs in the start slot and an action button at the end. Use as a card or section header when content is split into tabs with a primary action alongside.

id:          ToolbarTableFilter
name:        Toolbar - Table Filter
description: Filter bar above a table: a search box leads the row, each field beside it is a closed trigger that doubles as its own filter chip - the bare field name unset, the whole clause once set - and the clauses fold from the end into a count as the row narrows, followed by a live result count, a clear all, and a column picker. Use to search, filter, and narrow flat rows of records such as jobs, orders, tickets, or users.

id:          ToolbarThreeSlot
name:        Toolbar - Three Slot
description: A toolbar with start, center, and end content using the three-column grid layout. Use when you need a centered title or heading with navigation and actions on either side.

id:   TooltipShowcase
name: Tooltip

id:          TooltipActionBarTooltips
name:        Tooltip - Action Bar
description: Tooltips on an action button bar with contextual descriptions.

id:          TooltipHookUsage
name:        Tooltip - Hook Usage
description: Tooltip using the useTooltip hook for programmatic control.

id:          TooltipInlineTextTooltips
name:        Tooltip - Inline Text
description: Tooltips on inline text terms for definitions.

id:   TopNavShowcase
name: TopNav

id:          TopNavCenteredNavigation
name:        TopNav - Centered Navigation
description: Navigation layout with center-aligned nav items flanked by a logo heading and end actions.

id:          TopNavEnterpriseDashboard
name:        TopNav - Enterprise Dashboard
description: Full-featured navigation bar with icon-labeled nav items, search, notifications, and a primary CTA.

id:          TopNavHoverMenu
name:        TopNav - Hover Menu
description: Navigation bar with a hover-triggered dropdown menu showing product items with icons and descriptions.

id:          TopNavMegaMenu
name:        TopNav - Mega Menu
description: Marketing-style navigation with a full-width mega menu featuring product items and a promotional featured card.

id:          TopNavMultipleDropdowns
name:        TopNav - Multiple Dropdowns
description: Navigation bar with multiple hover-triggered dropdown menus that auto-close when switching between them.

id:          TopNavWithLogo
name:        TopNav - With Logo
description: Navigation bar with a branded logo icon, heading link, nav items, and a profile action.

id:          TopNavHeadingShowcase
name:        TopNavHeading
description: Demonstrates TopNavHeading with a logo and text, both as a plain display and as a clickable link.

id:          TopNavHeadingBasic
name:        TopNavHeading - Basic
description: A product heading with a logo inside a TopNav, linked to the home page. Use as the leading brand element of a top navigation bar.

id:          TopNavItemShowcase
name:        TopNavItem
description: Demonstrates TopNavItem with selected, icon, disabled, and default states.

id:          TopNavItemBasic
name:        TopNavItem - Basic
description: Navigation links inside a TopNav with one item marked as selected. Use for top-level pages of an application.

id:          TopNavMegaMenuShowcase
name:        TopNavMegaMenu
description: Demonstrates TopNavMegaMenu with items and a featured card in the mega menu panel.

id:          TopNavMegaMenuBasic
name:        TopNavMegaMenu - Basic
description: A mega menu trigger inside a TopNav that opens a panel of rich link items. Use when a navigation section has multiple destinations worth describing.

id:          TopNavMegaMenuFeaturedCardShowcase
name:        TopNavMegaMenuFeaturedCard
description: Demonstrates TopNavMegaMenuFeaturedCard with a title, description, and CTA link inside a mega menu.

id:          TopNavMegaMenuFeaturedCardBasic
name:        TopNavMegaMenuFeaturedCard - Basic
description: A promotional card with a title, description, and call-to-action link. Pass it to the featured slot of a TopNavMegaMenu to highlight announcements.

id:          TopNavMegaMenuItemShowcase
name:        TopNavMegaMenuItem
description: Demonstrates TopNavMegaMenuItem with icons, titles, and descriptions inside a mega menu.

id:          TopNavMegaMenuItemBasic
name:        TopNavMegaMenuItem - Basic
description: Rich link items with an icon, title, and description. Use inside the items slot of a TopNavMegaMenu to describe each destination.

id:          TopNavMenuShowcase
name:        TopNavMenu
description: Demonstrates TopNavMenu with a hover-triggered dropdown containing items with icons and descriptions.

id:          TopNavMenuBasic
name:        TopNavMenu - Basic
description: A dropdown menu inside a TopNav built from an items array with icons and descriptions. Use to group related destinations under a single trigger.

id:          TreeListVariants
name:        Tree List - Variants
description: The `variant` prop controls whether hierarchy guide lines are shown: `lineGuides` (default) draws connector lines between parent and child rows, while `noGuides` relies on indentation alone. It is orthogonal to `density`, which controls spacing.

id:   TreeListShowcase
name: TreeList

id:          TreeListFileTreeWithIcons
name:        TreeList - File Tree With Icons
description: File browser tree with folder and document icons distinguishing directories from files.

id:          TreeListInteractiveSettings
name:        TreeList - Interactive Settings
description: Settings tree with clickable items and a documentation link.

id:          TreeListMailboxTree
name:        TreeList - Mailbox Tree
description: Email folder tree with unread badge counts.

id:          TreeListNavigationTree
name:        TreeList - Navigation Tree
description: Navigation tree with a selected item for the current page.

id:   TypeaheadShowcase
name: Typeahead

id:          TypeaheadLimitedResults
name:        Typeahead - Limited Results
description: Typeahead with a capped dropdown showing at most three results.

id:          TypeaheadSearchField
name:        Typeahead - Search Field
description: Search input with icon and suggestions on focus.

id:          TypeaheadWithHelperText
name:        Typeahead - With Helper Text
description: Typeahead with a description below the label.

id:          TypeaheadWithValidation
name:        Typeahead - With Validation
description: Typeahead with an error validation message.

id:          TypeaheadItemShowcase
name:        TypeaheadItem
description: Typeahead with custom item rendering using TypeaheadItem for avatars and descriptions.

id:          TypeaheadItemBasic
name:        TypeaheadItem - Basic
description: A typeahead whose results are rendered with TypeaheadItem, adding a secondary description below each label. Use inside renderItem to keep custom results visually consistent.

id:          AnimatorPlayingCards
name:        useAnimator - Playing cards
description: A playing card that follows a drag: a gentle release springs it back on its release velocity, and a quick flick throws it away with momentum before the next card is dealt. A Discard button moves it off from the keyboard, fading it in place under Reduce Motion, and the discard is announced. Built only on the public useAnimator hook.

id:          useAnnounceHookUsage
name:        useAnnounce - Filter Result Count
description: A product filter that announces its result count with useAnnounce: once typing pauses for 500 ms, a screen reader hears "3 results" or "No results". The count has its own hasReplace instance, as the hook's docs advise for a changing value.

id:          AppShellMobileHookUsage
name:        useAppShellMobile - Custom Mobile Trigger
description: Custom mobile navigation trigger built with useAppShellMobile. The trigger consumes the surrounding AppShell context instead of rendering its own shell.

id:          useCalendarConstraintsHookUsage
name:        useCalendarConstraints - Hotel Booking Range
description: A hotel booking range picker enforcing season min/max dates, a 7-night maximum stay once check-in is picked, and a custom rule disabling closed Mondays.

id:          useCalendarDaysHookUsage
name:        useCalendarDays - Month Grid
description: A compact custom month view: a seven-column table built from the weeks and dayNames that useCalendarDays returns, with only as many rows as the month needs. Days from the previous and next months are dimmed, and a Week starts on control (Sunday or Monday) reorders both the header and the grid.

id:          useCalendarNavigationHookUsage
name:        useCalendarNavigation - Month Pager
description: A calendar month pager with previous/next navigation buttons, localized month-year label, and cross-month arrow key navigation using pendingFocus.

id:          useClickableContainerHookUsage
name:        useClickableContainer - Clickable Project Card
description: A project card that useClickableContainer makes clickable anywhere: a click on the card follows its title link, while the Star button, the owner link and a text selection keep their own behavior, and Ctrl/Cmd+click or middle-click opens the project in a new tab.

id:          useClipboardHookUsage
name:        useClipboard - Share Link
description: A share card that copies its invite link with useClipboard: the Copy button reads "Copied" while isCopied is true, a screen reader hears "Link copied", and a second press restarts the reset timer.

id:          CollapsibleHookUsage
name:        useCollapsible - Custom Disclosure
description: Custom disclosure UI built directly with useCollapsible for headless open/close state.

id:          useCollatorHookUsage
name:        useCollator - Locale-aware Name Sort
description: A list of names sorted with the compare function from useCollator: accented and lowercase names land where a reader expects, and switching the provider locale to Swedish moves Å and Ö after Z.

id:          useComboboxHookUsage
name:        useCombobox - Assign To Field
description: An "Assign to" TextInput and a list of Item rows, with the field, listbox and option props from useCombobox spread onto them: typing filters a list of teammates, ArrowUp and ArrowDown move the active option while focus stays in the input, Enter picks it and Escape closes the list.

id:          useContainerRevealHookUsage
name:        useContainerReveal - Reveal-on-hover Row Actions
description: File rows keep their edit/delete actions hidden at rest and reveal them on hover or keyboard focus via useContainerReveal; the actions stay mounted and in the tab order.

id:          useDirectionHookUsage
name:        useDirection - Hook Usage
description: Demonstrates reading ambient text direction during render to draw a direction-aware canvas sparkline whose time axis runs from the logical inline start edge.

id:          DragToSnapPointsCard
name:        useDragToSnapPoints - Playing card on three places
description: A playing card that a sideways drag moves between three places: a slow release settles on the nearest, a quick flick carries to the next, and a release moving back returns where it started. Buttons settle it from the keyboard, and the new place is announced. Built only on the public useDragToSnapPoints hook.

id:          useFocusTrapHookUsage
name:        useFocusTrap - Quick Edit Panel
description: A custom quick-edit panel, not built on Dialog, that traps focus with useFocusTrap: focusFirst moves focus to its field on open, Tab and Shift+Tab stay inside it, Escape closes it through onEscape, and closing returns focus to the Quick edit button.

id:          useGridFocusHookUsage
name:        useGridFocus - Color Swatch Grid
description: A color swatch picker in rows of eight with one Tab stop. useGridFocus moves focus with the arrow keys, Home and End, and Ctrl+Home and Ctrl+End. Each swatch is a button, so Enter or a click picks it.

id:          useHotkeysHookUsage
name:        useHotkeys - Search and Help Shortcuts
description: Page shortcuts registered with useHotkeys: "/" focuses the search field and "?" opens the shortcut help, while typing either character in the field just types it. A switch turns the single-key shortcuts off through isDisabled.

id:          HoverCardHookUsage
name:        useHoverCard - Profile Preview
description: Custom profile preview using useHoverCard with direct trigger and render control.

id:          useIconHookUsage
name:        useIcon - Status Row
description: A custom status row that draws the semantic success, warning and error icons with useIcon. The same row renders under the current theme and under a Theme whose icons override those three, and its icons change with no change to the component.

id:          useImageModeHookUsage
name:        useImageMode - Photo Caption
description: A photo banner with a caption over the sky. useImageMode samples only the strip under the caption and MediaTheme switches the caption between light and dark text from the result. A Beach photo switch swaps a night photo for a bright beach photo, and while the new photo loads the caption keeps the dark fallback.

id:          useInputContainerHookUsage
name:        useInputContainer - Search Field Wrapper
description: A custom search field wrapper with a leading search icon, padding and a trailing Clear button. useInputContainer puts focus in the input when the icon or the padding is clicked, while a click on Clear empties the field without the wrapper taking it over.

id:          useInputStatusIconHookUsage
name:        useInputStatusIcon - Coupon Code Status
description: A custom bordered coupon-code input whose status affordance comes from useInputStatusIcon. A wrong code shows the error status and SAVE20 shows success. Switching the variant moves between a plain glyph with a message below (attached), no icon on the field (detached), and a focusable button whose tooltip keyboard and screen-reader users can reach, with its aria-describedby id returned by the hook (tooltip).

id:          useInteractiveRoleHookUsage
name:        useInteractiveRole - One Tile, Four Roles
description: A polymorphic Tile used four ways: with an href it renders as a link, with an onClick as a button, with neither as plain content, and placed as a Popover trigger it becomes the trigger button through context - the resolution order in one place.

id:          useKeyboardHintHookUsage
name:        useKeyboardHint - Arrow-key Hint
description: A custom five-star rating with one Tab stop calls useKeyboardHint directly: tabbing into it shows a "<- -> to navigate" hint, the first arrow press dismisses it, and tabbing back in does not show it again.

id:          LayerHookUsage
name:        useLayer - Anchored Layer
description: Low-level anchored overlay rendered with useLayer and a custom surface.

id:          LightboxHookUsage
name:        useLightbox - Gallery Grid
description: Photo gallery thumbnail grid using useLightbox for trigger props, keyboard navigation, and open state.

id:          useLinkComponentHookUsage
name:        useLinkComponent - Article Cards
description: A custom Article card renders its title link with the component useLinkComponent resolves: the as prop first, then the nearest LinkProvider, then a native anchor. Inside a LinkProvider wired to a client-side router, the title navigates without a page load and updates the router location. With as="a" the title is a native anchor even inside the provider, and outside the provider it falls back to the next provider up or a native anchor.

id:          useLinkifyHookUsage
name:        useLinkify - Links in a Comment Thread
description: Plain-text comments where useLinkify turns the URL and the email address into Links, and a custom pattern turns issue references like #123 into tracker links - the patterns option in action. The comment without matches stays plain text.

id:          useListFocusHookUsage
name:        useListFocus - Recent Files
description: A "Recent files" list of buttons with keyboard navigation from useListFocus: ArrowUp and ArrowDown move between rows, Home and End jump to the first and last row, focus wraps at the ends, and only one row is in the tab order.

id:          useLocaleHookUsage
name:        useLocale - Invoice Summary
description: An invoice summary that formats its date and amount with Intl using the locale from useLocale, so switching the provider from English to German changes "Nov 2, 2026" and "$1,234.50" to "2. Nov. 2026" and "1.234,50 $" with no second locale source.

id:          useMergedRefsHookUsage
name:        useMergedRefs - AutoGrowTextArea
description: An AutoGrowTextArea that forwards the caller's ref and also keeps its own ref to measure scrollHeight. The merged ref attaches both to the same textarea: it resizes itself while a parent button focuses it through the forwarded ref.

id:          useMultiComboboxHookUsage
name:        useMultiCombobox - Issue Labels
description: A Labels field built on useMultiCombobox: typing filters the labels, the arrow keys move the active option while focus stays in the field, Enter or a click toggles a label and the list stays open, and selected labels show as removable tokens above the field.

id:          useOutlineFromMarkdownHookUsage
name:        useOutlineFromMarkdown - Docs Article
description: A docs-style article with an Outline next to it, built from the same Markdown string through useOutlineFromMarkdown. "Add section" appends a heading to the string, and a new entry that links to it appears in the outline.

id:          useOverflowHookUsage
name:        useOverflow - Editor Toolbar
description: Resize the card: useOverflow moves the toolbar actions that do not fit into a More menu, and shows them again when the card gets wider.

id:          useOverlayHookUsage
name:        useOverlay - Product Quick View
description: A product card that is its own overlay container: useOverlay returns the ref and props to spread on the Card and a bottom strip to render once over the image. Hovering the card, or moving keyboard focus into it, slides in a Quick view button along the bottom of the image, and leaving hides it again. The image is a link that the strip leaves clickable above it, and Tab lands on it first so the next Tab reaches Quick view.

id:          PanDraggableBox
name:        usePanGesture - A draggable box
description: The smallest pan example, in two forms side by side: the usePanGesture hook and the createPanGesture factory. The factory takes any element, React or not. Each card names its API, follows a drag from a finger, a mouse or a pen, and springs back, with the same StyleX styles. A starting point for a draggable tile, a swipe or any drag-and-release gesture.

id:          PanPlayingCard
name:        usePanGesture - A playing card (advanced)
description: An advanced usePanGesture example: a playing card follows a drag, settles back on a gentle release and flies off on a quick flick, while a Discard button deals the next card from the keyboard and announces it. Drag, settle and throw are StyleX styles driven by React state. A pattern for swipe-to-dismiss, card decks and flick gestures.

id:          PopoverHookUsage
name:        usePopover - Quick Actions
description: Custom quick-actions popover using usePopover for trigger refs, ARIA attributes, and focus trapping.

id:          usePowerSearchConfigHookUsage
name:        usePowerSearchConfig - Filtered Directory Table
description: A people directory with a PowerSearch bar over a Table: typed field definitions feed usePowerSearchConfig, returning the search config and an applyFilters helper that updates Table rows.

id:          usePressFeedbackHookUsage
name:        usePressFeedback - Pressable Card
description: A Card made pressable with usePressFeedback: its marker and the interactionOverlayStyles backgroundImage overlay go straight on the Card, so a press darkens the card the way every Astryx pressable does; focusOutlineStyles.focusVisible gives it the shared Astryx focus ring for keyboard focus; and a click, Enter or Space flips it.

id:          useScrollableAreaHookUsage
name:        useScrollableArea - Activity Log Panel
description: A fixed-height Activity log panel whose entries scroll up and down. useScrollableArea makes the panel a keyboard tab stop only when its entries overflow, reports which edges have more entries so a top or bottom shadow shows only there, and keeps a scroll that reaches the end from scrolling the page. Add entry flips the panel from not scrollable to scrollable.

id:          useScrollLockHookUsage
name:        useScrollLock - Full-screen Mobile Menu
description: A custom full-screen menu opened from a Menu button. useScrollLock pins the page behind it while it is open, so the page does not scroll or shift sideways, and closing the menu returns the reader to the same scroll position.

id:          useScrollOverflowHookUsage
name:        useScrollOverflow - Filter Strip Edge Fades
description: A row of active filters that scrolls sideways. useScrollOverflow reports which edge has hidden filters, and the strip fades only that edge: none while every filter fits, the end at the start, both mid-scroll and the start at the end. Adding or removing a filter updates the fades, and in a right-to-left layout the start edge is on the right.

id:          CarouselSnapPaging
name:        useSnapPaging - Onboarding Pages
description: Onboarding cards in a Carousel with hasSnap={useSnapPaging()}: under a finger or a trackpad swipe, each flick moves one view and rests on a card's start edge. A switch picks one view or one card per flick through the hook's pages option.

id:          useStreamingTextHookUsage
name:        useStreamingText - Streaming Response
description: A chat-style reply card: while the response streams in bursts, useStreamingText reveals it steadily character by character; when streaming ends the full text snaps into place. Regenerate replays the stream.

id:          ColumnResizeHookUsage
name:        useTableColumnResize - Draggable Columns
description: A Table using useTableColumnResize. Drag the right edge of any column header to resize; widths are committed on release. The last proportional column flexes to fill remaining space.

id:          useTableColumnSettingsStateHookUsage
name:        useTableColumnSettingsState - Column Visibility Picker
description: A Table toolbar with a Columns menu of checkboxes: toggling Email updates active columns, Reset restores defaults, and the config is passed directly to useTableColumnSettings.

id:          TableGroupedRowsTable
name:        useTableGroupedRows - Collapsible Groups
description: A table grouped into collapsible sections with useTableGroupedRows. Each group gets a full-width header with a chevron, label, and member count; click to collapse/expand.

id:          TableRowExpansionTable
name:        useTableRowExpansion - Tree Table
description: A tree table using useTableRowExpansion with inherited columns. Child rows use the same columns as parents, indented by depth. Click the chevron or right-click to expand/collapse.

id:          TableRowIndexTable
name:        useTableRowIndex - Numbered Rows
description: A table with a prepended row-number column via useTableRowIndex. Numbering is monospaced, right-aligned, and follows the rows the table renders.

id:          TableRowStatusTable
name:        useTableRowStatus - Semantic and Custom Markers
description: A job table using both row-status paths: status resolves themed semantic glyphs and tones, while color stays a custom paint choice with an optional caller-selected icon or the stable dot.

id:          RowsVirtualizationHookUsage
name:        useTableRowsVirtualization - Fixed Height Rows
description: A Table with 1,000 product rows inside a 320px-tall parent, which bounds its scroll area. Give the Table's parent a height, fixed or relative, or a flex child, so windowing can bound the rows; with no height every row renders. Scroll vertically to mount the visible rows. The caller keeps all data and columns; this hook does not virtualize columns.

id:          useTableSortableStateHookUsage
name:        useTableSortableState - Multi-Sort Orders
description: Orders with no sort code of their own: useTableSortableState owns the sort state, returns the sorted orders, and hands useTableSortable a ready config. Click Customer, then Shift-click Total, to sort by customer and then by total within each customer. A line above the orders reads the current sort state from the hook.

id:          StickyColumnsHookUsage
name:        useTableStickyColumns - Pinned Columns
description: A Table using useTableStickyColumns to pin the Name column to the start edge and Status to the end edge. Scroll horizontally; pinned columns stay in view with a soft shadow over the scrolling content.

id:          TableTreeTable
name:        useTableTreeData: Tree Table
description: A file-tree table built from nested data. useTableTreeState flattens the tree into the visible rows and owns the expanded set; useTableTreeData draws the per-level indent and the expand/collapse chevron in the tree column. The two hooks are designed to work together, so this one example covers both. hasExpandAllControl adds the expand-all/collapse-all toggle to the tree column header. Collapsed branches are unmounted, not hidden.

id:          useThemeHookUsage
name:        useTheme - Token Values
description: Read resolved theme token values with useTheme for non-CSS consumers like SVG charts.

id:          useToastHookUsage
name:        useToast - Settings Saved
description: Shows a toast from the function useToast returns: a "Settings saved" confirmation with an Undo action, a uniqueID so pressing the button again replaces the toast instead of stacking another, and an error toast when the request fails.

id:          useTranslatorHookUsage
name:        useTranslator - Load More Footer
description: A "Load more" footer under a list that gets its button label and its "Showing 3 of 9" count from the function useTranslator returns, with app message keys supplied per locale through InternationalizationProvider, so switching the provider to French changes both strings.

id:          useTreeFocusHookUsage
name:        useTreeFocus - Keyboard File Tree
description: A custom file tree built from plain rows with tree roles. useTreeFocus gives it the WAI-ARIA tree keyboard model: ArrowUp and ArrowDown move over the visible rows, ArrowRight opens a folder or moves into it, ArrowLeft closes it or moves to its parent, Home and End jump to the ends, a typed letter jumps to a matching name, Enter opens a file, and only one row is in the tab order.

id:          useTypeaheadHookUsage
name:        useTypeahead - Type to Focus a Country
description: A country list of buttons with useListFocus arrow keys and useTypeahead type-to-focus. Typing "can" focuses Canada, pressing "b" again and again cycles through Belgium, Brazil and Bulgaria, and "e" finds Éire with the accent ignored. The hook only reports the match through onMatch, and useListFocus moves focus.

id:   VisuallyHiddenShowcase
name: VisuallyHidden

id:          VisuallyHiddenLiveRegion
name:        VisuallyHidden - Live Region
description: A polite aria-live region announces visual-only state changes to assistive technology.

id:          VisuallyHiddenStructuralHeading
name:        VisuallyHidden - Structural Heading
description: Give a visually implicit section an accessible name so screen-reader users can navigate to it.

id:          VisuallyHiddenSupplementaryContext
name:        VisuallyHidden - Supplementary Context
description: Stat cards whose trend arrows get screen-reader-only text, so a change like +12% is read as an increase from last month. Use to make terse visual data accessible.

id:          VStackShowcase
name:        VStack
description: Demonstrates VStack arranging items vertically with different gaps.

id:          VStackBasic
name:        VStack - Basic
description: A heading and paragraphs stacked vertically with a consistent gap. Use VStack whenever siblings should flow top to bottom with even spacing.

id:          DrawerWidths
name:        Width budget: pixels or any CSS length
description: Compare a numeric pixel width with rem and percentage lengths. The width budget also caps the drawer on mobile.

id:          DrawerHeaderWithCloseButton
name:        With close button
description: Pass onOpenChange to render a close button that calls it with false. Drawer renders no close button of its own, so this is the usual visible way to close.

id:          DrawerHeaderSubtitleEndContent
name:        With subtitle and end content
description: Add a subtitle under the title and put a status, such as a Badge, in endContent. The close button stays at the end of the row.

Usage

npx astryx template <id> [target-path]     Scaffold page or block
npx astryx template <id> --skeleton        Layout reference
npx astryx template --list --type block    List only blocks
npx astryx template --list --package <pkg> List from one package
npx astryx template --cdn                 CDN starter page, no build step


