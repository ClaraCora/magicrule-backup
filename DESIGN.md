---
name: MagicRule Backup
description: A calm, searchable archive for Egern, Mihomo, and Loon rule backups.
colors:
  forest: "#173d34"
  forest-deep: "#123127"
  ink: "#203c32"
  muted: "#5e7065"
  paper: "#f7f8f2"
  surface: "#ffffff"
  line: "#dce3d8"
  mint: "#e6eed0"
  accent: "#b64c30"
  accent-wash: "#f8e9e0"
  success: "#286647"
  warning: "#92561c"
typography:
  display:
    fontFamily: "'Inter Variable','Segoe UI','Microsoft YaHei',sans-serif"
    fontSize: "40px"
    fontWeight: 680
    lineHeight: 1.25
    letterSpacing: "-.035em"
  headline:
    fontFamily: "'Inter Variable','Segoe UI','Microsoft YaHei',sans-serif"
    fontSize: "21px"
    fontWeight: 650
    lineHeight: 1.45
    letterSpacing: "-.02em"
  title:
    fontFamily: "'Inter Variable','Segoe UI','Microsoft YaHei',sans-serif"
    fontSize: "14px"
    fontWeight: 600
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
  badge: "4px"
  selection: "5px"
  control: "6px"
  base: "8px"
  panel: "12px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
components:
  button-primary:
    backgroundColor: "{colors.forest}"
    textColor: "#f6f8ef"
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
  search-input:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    height: "44px"
  navigation-current:
    backgroundColor: "{colors.mint}"
    textColor: "{colors.forest}"
    rounded: "{rounded.control}"
    padding: "12px 15px"
  filter-selected:
    backgroundColor: "{colors.mint}"
    textColor: "{colors.forest}"
    rounded: "{rounded.selection}"
    padding: "9px 13px"
  client-badge-mihomo:
    backgroundColor: "#e7f0e9"
    textColor: "#38634c"
    rounded: "{rounded.badge}"
    padding: "0 6px"
  catalog-surface:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
  rule-row:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    padding: "12px 24px"
  artifact-row:
    textColor: "{colors.ink}"
    padding: "20px 0"
---

# Design System: MagicRule Backup

## Overview

**Creative North Star: "The Forest Archive"**

A quiet forest-colored frame holds a cream workspace and white working surfaces. Mint marks the current location and selected filters; terracotta supplies a small point of emphasis and a clear keyboard focus signal. The character is practical, steady, and compact.

The catalog and detail pages use an Operate mode: search, dates, client identity, and copy/download actions stay easy to scan. Documentation uses a Read mode with a narrower text measure and more leading. Both modes share the same shell, type family, authored SVG icons, and restrained native transitions.

**Key Characteristics:**

- Forest navigation, cream workspace, white catalog surfaces.
- Compact rows and metadata with a visible search and date hierarchy.
- Mint selections and sparse terracotta punctuation.
- Authored line SVG icons, explicit copy/download labels, and visible keyboard focus.
- A desktop table that becomes a stacked mobile list.

The frontmatter is the normative token layer. It is extracted from `src/styles/global.css`; layout and icon behavior also follow `src/layouts/Layout.astro`, `src/components/Icon.astro`, and the implemented catalog, detail, and documentation pages. The sidecar extends these tokens with behavior and renderable examples.

## Colors

The palette combines deep botanical greens, pale warm neutrals, and restrained terracotta.

### Primary

- **Forest** (`forest`) anchors the sidebar and primary actions; **Deep Forest** (`forest-deep`) is the primary-action hover state.
- **Mint** (`mint`) marks current navigation, selected filters, recommendations, text selection, and the synchronization summary.

### Secondary

- **Terracotta** (`accent`) supplies the heading dot, prose links, caret, link hover emphasis, and keyboard focus. **Terracotta Wash** (`accent-wash`) remains an available declared token; do not infer an additional component from it.
- **Success Green** (`success`) marks healthy synchronization and complete availability. **Warning Ochre** (`warning`) identifies overdue synchronization and retained, delisted variants.

### Neutral

- **Cream Paper** (`paper`) is the workspace and quiet hover surface. **White Surface** (`surface`) holds the catalog and detail panels.
- **Forest Ink** (`ink`) carries primary reading text. **Muted Sage** (`muted`) carries supporting metadata.
- **Sage Line** (`line`) separates sections, rows, and controls without heavy contrast.

**The Selection Rule.** Use mint for current navigation, chosen filters, recommendations, and summary emphasis. Keep terracotta for punctuation, links in prose, and interaction focus.

Client dots and badges retain their source-specific Egern, Mihomo, and Loon tints. They always accompany client names; they do not introduce a second selection language.

## Typography

**Display and Body Font:** Inter Variable, followed by Segoe UI, Microsoft YaHei, and sans-serif. The locally bundled variable face provides the intermediate weights used in headings.

**Label/Mono Font:** Interface labels use the same sans-serif family. Addresses and SHA-256 values use the system monospace stack.

**Character:** Compact, clear, and bilingual. Weight and spacing establish hierarchy without switching to a decorative display face.

### Hierarchy

- **Display:** Page titles use the frontmatter display role. The main page title reduces to (35px) at the intermediate breakpoint and (31px) on mobile; detail titles use (36px), then (28px) on mobile.
- **Headline:** Section titles use the headline role; client section headings use a nearby (22px) size.
- **Title:** Catalog names use the title role; file titles use (16px) with a semibold weight.
- **Body:** General interface text follows the body role. Catalog metadata uses the smaller metadata role without weakening primary rule names.
- **Read body:** Documentation uses the body-read role within (76ch); it becomes (14px) on mobile.
- **Label and metadata:** Buttons use the label role. Dates and supporting facts use metadata; compact badges retain their implemented smaller type.
- **Mono:** Hashes and raw addresses wrap inside the available width instead of forcing page overflow.

**The Date Clarity Rule.** Keep source rule updates, backup file changes, and successful synchronization visually labeled as distinct facts. Use tabular numerals for dates and counts.

## Layout

The desktop shell has a fixed forest sidebar (232px) and an offset main workspace. The workspace is capped at (1536px), with primary desktop padding of (48px 44px 56px). A thin status strip precedes the page heading, then the white search/catalog surface. Interior catalog groups use fine separators and compact padding; repeated spacing primitives are recorded in the frontmatter.

At a maximum width of (1190px), the sidebar narrows to (205px); at (1000px), it narrows to (180px) and the rule-count column disappears. At (760px), the sidebar becomes a full-width top navigation, the table header disappears, and each rule becomes a two-column list item: identity and client labels on the left, labeled date and detail action on the right. Page margins reduce to (20px). At (370px), page margins reduce to (14px) and secondary chrome is further reduced. At a minimum width of (1600px), top spacing increases.

Detail pages preserve one white panel per client, with labeled facts, artifact rows, and adjacent copy/download actions. Mobile facts become paired label/value rows and artifact actions wrap below file identity. Read mode keeps prose narrow rather than stretching it across the full workspace.

## Elevation & Depth

The interface is flat at rest. Cream, white, pale mint, and hairline borders establish the surface hierarchy. The only implemented box shadow belongs to the transient status notice; focus remains a visible terracotta outline, not an elevation effect.

### Shadow Vocabulary

- **Status notice:** The sidecar records the exact `0 6px 22px #12312725` shadow. It supports brief copy/download feedback above the page.

**The Quiet Surface Rule.** Separate working regions with tone and fine borders. Reserve the implemented shadow for transient status feedback.

## Shapes

Working surfaces have gently rounded panel corners; controls use tighter corners, badges tighter still. The frontmatter records the observed reusable radius steps. Monograms are small rounded squares, while client/status dots are circular. Catalog panels clip their interior separators to the outer contour. Borders are thin and quiet; selected navigation and filters use a filled mint surface.

## Components

### Buttons

Compact, explicit actions. Primary buttons use forest with pale text; secondary copy and pagination buttons use white, ink, and a sage border. The normal minimum height is (42px), with (44px) search actions and the documented mobile/compact variants. Primary hover deepens the forest; secondary hover moves to paper and strengthens the border. Disabled controls use (0.42) opacity. A shared terracotta outline (3px), offset by (4px), identifies keyboard focus.

### Inputs / Fields

The search field sits directly in a white search row with an authored search icon, a desktop slash-key hint, and a labeled primary search button. It has no independent filled box or border. Selects use white surfaces, sage strokes, compact corners, and readable labels. Search placeholder text uses muted sage. On mobile the shortcut hint disappears and the controls compact without hiding search.

### Navigation

The desktop sidebar uses a vertical icon-and-label list. Current navigation is a mint rounded rectangle with forest text; ordinary links use pale sage text, with a darker green hover surface. Mobile navigation becomes a horizontal set of tabs attached to the cream workspace. Current state remains explicit through `aria-current`.

### Chips / Client Badges

Client filters are action chips with `aria-pressed`; selected chips use mint and semibold forest text. Passive client badges use distinct pale client tints and short names. Archived badges also use a strike-through, while availability states retain readable wording. Recommendation tags are small, quiet mint labels rather than calls to action.

### Cards / Containers

The white catalog and per-client detail panels share sage borders and the panel radius. The catalog has contiguous search, filter, result, row, and pagination bands. Detail panels use (28px) desktop padding, then (22px) and (19px 16px) at smaller widths. They remain flat at rest.

### Rule List Row

The signature row combines a two-letter monogram, rule identity, client badges, rule count, source-update date, and a detail link. The desktop row has a minimum height of (84px), quiet separators, and a pale paper-green hover. On mobile it becomes a minimum-height (110px) stacked item with an explicit date note. Long mobile rule names truncate, while their full detail page can wrap the name.

### Artifact Row

File identity and format sit opposite separate “复制地址” and “下载” actions, with authored line icons. File URL and SHA-256 details are disclosed on demand. The format block, recommendation tag, and subdued byte/type metadata support scanning. Copy feedback uses an accessible status notice.

### Motion and Icons

Buttons, links, and selects transition only color, background color, and border color over (180ms) using the shared easing. Rule-row background hover uses its implemented (180ms) transition. Reduced-motion preference disables animation/transitions and smooth scrolling. Icons are inline SVG with a (24 × 24) view box, rounded line endings, and a normal stroke width of (1.7); sizes adapt to context. Icon-only meaning is supplemented with visible text or an accessible label.

## Do's and Don'ts

### Do:

- **Do** keep search and synchronization status visible near the start of the page.
- **Do** preserve clear labels beside copy, download, and navigation icons.
- **Do** use mint to communicate selection and forest to anchor primary actions.
- **Do** retain visible keyboard focus, semantic labels, and reduced-motion behavior.
- **Do** keep mobile dates and actions readable when the table becomes a list.

### Don't:

- **Don't** use shadows to lift every row or panel.
- **Don't** rely on a client dot or a status color without readable text.
- **Don't** style a synchronization check as a newly updated rule.
- **Don't** add decorative imagery where the implemented system uses text, monograms, and authored SVG icons.
- **Don't** animate layout or add continuous motion to routine catalog work.
