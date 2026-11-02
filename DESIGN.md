---
name: MagicRule Backup
description: 清透工具台 — a compact directory for finding rules and copying explicit backup subscription URLs.
colors:
  forest: "#285dd8"
  forest-deep: "#204cad"
  ink: "#1d2b43"
  muted: "#607089"
  paper: "#f6f8fc"
  surface: "#fff"
  line: "#dfe5ee"
  mint: "#eaf0ff"
  accent: "#285dd8"
  accent-wash: "#eaf0ff"
  success: "#2c7254"
  warning: "#92561c"
typography:
  display:
    fontFamily: "'Inter Variable','Segoe UI','Microsoft YaHei',sans-serif"
    fontSize: "30px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-.025em"
  headline:
    fontFamily: "'Inter Variable','Segoe UI','Microsoft YaHei',sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.45
    letterSpacing: "-.02em"
  title:
    fontFamily: "'Inter Variable','Segoe UI','Microsoft YaHei',sans-serif"
    fontSize: "14px"
    fontWeight: 650
    lineHeight: 1.5
  body:
    fontFamily: "'Inter Variable','Segoe UI','Microsoft YaHei',sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.6
  body-read:
    fontFamily: "'Inter Variable','Segoe UI','Microsoft YaHei',sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.95
  label:
    fontFamily: "'Inter Variable','Segoe UI','Microsoft YaHei',sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.6
  metadata:
    fontFamily: "'Inter Variable','Segoe UI','Microsoft YaHei',sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.6
  mono:
    fontFamily: "ui-monospace,Consolas,monospace"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.6
rounded:
  tag: "3px"
  badge: "4px"
  select: "5px"
  control: "6px"
  base: "8px"
  search: "10px"
  panel: "12px"
spacing:
  sm: "8px"
  control: "12px"
  md: "16px"
  gutter: "20px"
  lg: "24px"
  panel: "28px"
components:
  button-primary:
    backgroundColor: "{colors.forest}"
    textColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "9px 16px"
  button-primary-hover:
    backgroundColor: "{colors.forest-deep}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "9px 16px"
  button-secondary-hover:
    backgroundColor: "{colors.paper}"
  button-copy:
    backgroundColor: "{colors.mint}"
    textColor: "{colors.accent}"
    rounded: "{rounded.control}"
    padding: "8px 11px"
  search-input:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    height: "42px"
  navigation-current:
    textColor: "{colors.accent}"
    padding: "1px 2px 0"
  filter-selected:
    backgroundColor: "{colors.mint}"
    textColor: "{colors.accent}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
  catalog-surface:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
  rule-row:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    padding: "14px 24px"
  artifact-row:
    textColor: "{colors.ink}"
    padding: "20px 0"
---

# Design System: MagicRule Backup

## Overview

**Creative North Star: "清透工具台"**

A clear, compact workspace puts rule identity, usable filenames, dates, and actions in a calm reading order. White surfaces sit on cool blue paper; navy text carries the information, while restrained cobalt marks the current location, selections, focus, and primary actions. The character is practical, crisp, and quiet.

The shared shell uses a horizontal top navigation and a slim synchronization strip. Repeated rows keep comparison efficient; detail panels and narrower reading pages use the same family, palette, and line icons. The catalog-specific search/copy strategy is recorded in `.impeccable/surfaces/catalog.md`.

**Key Characteristics:**

- White working surfaces, cool blue paper, navy text, and cobalt emphasis.
- Compact bilingual typography, fine separators, and tabular dates and counts.
- Explicit client/format identity beside quick-copy actions.
- Flat panels, small control corners, and visible keyboard focus.
- A desktop table that becomes a stacked mobile list.

The frontmatter is the normative token layer, extracted from `src/styles/global.css`. Layout and behavior also follow `src/layouts/Layout.astro`, `src/pages/index.astro`, `src/pages/rules/[id].astro`, `src/pages/about.astro`, `src/scripts/catalog.ts`, and `src/scripts/common.ts`. `.impeccable/design.json` extends these tokens with source-backed states and self-contained visual examples.

## Colors

The palette pairs cool white and blue neutrals with one cobalt interaction accent.

### Primary

- **Cobalt Action** (`forest`) supplies primary buttons and history nodes; **Cobalt Deep** (`forest-deep`) supplies primary-button hover.
- **Cobalt Accent** (`accent`) supplies active navigation, links on hover, search icon/caret, and keyboard focus. It deliberately has the same value as `forest`.
- **Blue Selection Wash** (`mint`) supplies selected client filters, quick-copy buttons, recommendations, text selection, and synchronization summaries. The declared `accent-wash` aliases the same value; it has no separate component treatment.

The token keys `forest`, `forest-deep`, and `mint` preserve the actual CSS names `--color-forest`, `--color-forest-deep`, and `--color-mint`. They describe cobalt and pale blue in this approved system; they do not imply botanical colors.

### Neutral

- **Navy Ink** (`ink`) carries primary text. **Slate Metadata** (`muted`) carries descriptions, dates, and supporting labels.
- **Cool Paper** (`paper`) is the page and row-hover surface. **White Surface** (`surface`) holds the topbar, search, list, and client panels.
- **Blue-Gray Line** (`line`) divides rows, panels, and controls. The status strip and type tags use the implemented supplemental wash `#edf2fa`; table headings use `#f1f5fb`.

Success green and warning ochre are semantic status colors. Client dots use the existing Egern (`#8a804e`), Mihomo (`#4674c5`), and Loon (`#a9744a`) tints beside readable client names. These hues identify clients or status rather than another interaction hierarchy.

**The Explicit State Rule.** Pair color with an underline, readable label, selected control state, or status wording. Keep client identity and selected state distinguishable.

## Typography

**Display and Body Font:** Inter Variable, followed by Segoe UI, Microsoft YaHei, and sans-serif. The variable face is bundled locally through `@fontsource-variable/inter`.

**Label/Mono Font:** Interface labels retain the same sans-serif family. SHA-256 values use `ui-monospace,Consolas,monospace`.

**Character:** Clear and compact, with intermediate weights for rule names and filenames. Hierarchy comes from scale, weight, and spacing within one bilingual family. The root uses tabular numerals.

### Hierarchy

- **Display:** Main page headings use (30px/1.25, 700, −.025em), reducing to (27px) at (760px). Detail titles use (36px), reducing to (28px).
- **Headline:** Client section headings use (22px/1.45, bold), reducing to (19px) on mobile. Generic `h2` is (21px); documentation `h2` is (23px), then (21px) on mobile.
- **Title:** Rule names use (14px/1.5, 650). Filenames in the list use (12px, 550); detail artifact titles use (16px), then (14px) on mobile.
- **Body:** The root is (16px/1.6). Search input is (15px), then (13px) on mobile. Dense interface content uses its implemented smaller sizes.
- **Read body:** Documentation uses (15px/1.95) within (76ch), reducing to (14px) on mobile.
- **Label and metadata:** Standard buttons use (13px, 500); quick-copy uses (12px). Dates and supporting facts use (12px); filenames' client/format selectors and table headers use (11px). Small tags use (10px).
- **Mono:** File hashes use (11px). Addresses and hashes wrap within the detail panel.

**The Date Clarity Rule.** Preserve the distinct labels for source rule updates, backup file changes, and successful synchronization. A successful check must not look like a changed rule.

## Layout

The desktop shell begins with a (76px) white topbar and a slim status strip with a minimum height of (47px). Topbar/status gutters use `max(5%, calc((100vw - 1296px)/2))`. The main workspace is centered at a maximum width of (1440px), with (34px 5% 24px) padding. The footer is (90%) wide, capped at (1296px).

The heading leads into a separate full-width search field, client/type/format controls, a results toolbar, and a bordered list panel. At wide sizes, rows use five columns: identity, actual subscription file/format, count, source-update date, and actions. The grid is `minmax(190px,1.7fr) minmax(165px,1.2fr) minmax(70px,.65fr) minmax(110px,.95fr) 144px`, with (20px) gaps and (14px 24px) padding. Minimum row height is (78px).

At a maximum width of (1100px), the count column disappears and horizontal row padding becomes (18px). At (900px), spacing and grid columns tighten; detail facts use two columns and client panels use (24px) padding. At (760px), the topbar wraps to a minimum height of (112px), with navigation on its own (42px) row. Main gutters become (20px); the search hint and secondary status links disappear. Client filters occupy their own row and type/format selects share the next.

On mobile, the table header is hidden. A minimum-height (131px) rule item uses two columns: identity/date above filename-and-format/copy-and-detail. Its grid is `minmax(0,1fr) 108px`, with (12px 8px) gaps and (17px 14px) padding; filenames align to the row's left edge. Source dates gain a visible explanatory label. At (370px), main/status gutters become (14px), the action column becomes (100px), and file icons disappear.

Detail pages use one flat panel per client with (28px) desktop padding, then (19px 16px) on mobile. Facts become paired label/value rows; artifact actions wrap below file identity. Long rule titles, filenames, addresses, and hashes can wrap. Reading pages retain their (76ch) measure.

## Elevation & Depth

White and pale blue tones, thin borders, and spacing establish depth. Search, list, and detail panels remain flat; the only implemented box shadow belongs to the transient status notice. Keyboard focus uses a cobalt outline rather than a shadow.

### Shadow Vocabulary

- **Status notice:** `0 8px 25px #14233328`, supporting brief copy/download feedback above the page.

**The Quiet Surface Rule.** Use tone and fine borders to separate working regions. Reserve the implemented shadow for transient status feedback.

## Shapes

Panels use (12px) corners, the desktop search field uses (10px), and mobile search/notice surfaces use (8px). Buttons, client filters, file icons, and detail tabs use (6px); selects use (5px), type tags/key hints (4px), and recommendation tags (3px). Status/client dots are circular. The list panel clips row and header separators to its outer contour. The current top-navigation link is marked by a (2px) bottom border.

## Components

### Buttons

Explicit verbs in compact controls. Standard primary and secondary buttons use a minimum height of (42px), (9px 16px) padding, and (6px) corners. Primary is cobalt with white text; hover deepens the fill. Secondary is white with navy text and a line border; hover uses cool paper and `#9cafd0` border. Catalog copy is a distinct pale-blue action, (38px) minimum height with (8px 11px) padding, and `#dce6ff` hover; mobile minimum height is (40px). Disabled buttons use (0.4) opacity. Keyboard focus is a (3px) cobalt outline offset by (4px).

### Inputs / Fields

The bordered white search container has (10px) corners, a (62px) minimum height, a line icon, a borderless expanding input, a desktop slash-key hint, and a labeled search button. Mobile reduces the container to (54px) and (8px) corners. The search input uses a focus outline offset of (1px); other focusable controls use the shared (4px) offset. Native selects retain their recognizable disclosure affordance and accessible labels. Row-level file selectors are borderless, muted, and show both client and artifact key.

### Navigation

Horizontal icon-and-label links sit in the white topbar. Inactive links use slate; hover uses cobalt. Current navigation uses cobalt, (600) weight, a (2px) underline, and `aria-current="page"`. Mobile places these links on a separate full-width row. Detail client tabs are outlined (6px) controls that jump to the matching panel; a hash target receives the implemented `#89a7ec` border.

### Chips / Tags

Client filters are (6px) action chips with `aria-pressed`; selection uses pale blue, cobalt, and (650) weight. Desktop shows the selected client's count; mobile hides counts. Small client dots accompany names. Detail type tags use `#edf2fa`, slate text, and (4px) corners; recommendation tags use the selection wash and (3px) corners. Archived state always has readable wording.

### Cards / Containers

The white list panel uses a fine line border, (12px) corners, and a tinted table heading; search and filter controls sit above it. Per-client detail panels use the same border and radius. Empty, loading, and error states keep readable text and a clear reset/retry action inside the result region.

### Rule List Row

A line-book icon supports identity, followed by an actual filename, explicit client/format selection, count, source date, a visible “复制地址” action, and a labeled detail link. Hover uses cool paper. Changing the file choice updates the filename, count, source date, detail anchor, and copied URL together. With all clients selected, initial selection prefers active Mihomo `classical`, then active `rules`, then another active artifact. Archived filenames gain a warning-colored “已下架” label. Mobile retains date meaning and direct copy.

### Artifact Row

A format block and filename sit beside separate “复制地址” and “下载” controls. File URL, SHA-256, and artifact change date are disclosed through native details; source links have their own disclosure. Copy briefly changes the button to “已复制” and announces the selected filename/client/format for catalog copies through a polite status notice. Download shows a busy label while fetching and reports success or failure.

### Motion and Icons

Buttons, links, and selects transition color, background color, and border color over (180ms), using CSS's default `ease`. Row background hover also uses (180ms). Reduced-motion preference disables transitions, animations, and smooth scrolling. Inline SVG icons use a (24 × 24) view box, rounded line caps/joins, and a normal (1.7) stroke. Icon-only links have accessible labels; action meaning uses visible text.

## Do's and Don'ts

### Do:

- **Do** use the white/cool-blue palette and restrained cobalt for actions, current navigation, and selection.
- **Do** keep search, synchronization status, and precise timestamp labels easy to scan.
- **Do** show the client and format for the exact file a copy action will use.
- **Do** retain visible keyboard focus, accessible labels, polite feedback, and reduced-motion behavior.
- **Do** preserve mobile dates, filenames, and direct-copy actions when the table becomes a list.

### Don't:

- **Don't** interpret the legacy `forest` and `mint` token names as green colors or restore the previous sidebar shell.
- **Don't** lift every row or panel with a shadow.
- **Don't** rely on dots or color alone to identify a client, selected control, or availability state.
- **Don't** style successful synchronization as a newly updated rule.
- **Don't** introduce continuous motion or decorative imagery into routine catalog work.
