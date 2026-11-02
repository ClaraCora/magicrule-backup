# Catalog and shared site shell

User selected option A on 2026-11-02 after reviewing three desktop/mobile previews. Primary outcome: faster search and subscription URL copying.

## Direction contract

THESIS: A compact directory for finding a rule and copying an explicitly identified client/format without opening a detail page.

OWN-WORLD: White and cool blue surfaces, ink navy text, restrained cobalt selection and primary actions, Inter Variable and the established Chinese system stack. Flat 12px catalog panel, 6px controls, thin separators.

STORY: Choose a client, search by name or provenance, check the real filename and source date, select a format when necessary, copy its exact backed-up URL. Details retain provenance, downloads and all three timestamp definitions.

FIRST VIEWPORT: 76px top navigation, slim successful-sync strip, 30px directory heading, full-width search, client/type/file-format filters, then a dense five-column list with visible copy actions. On phones the navigation wraps and each rule becomes an identity/date row above filename/format/copy controls. No horizontal page scroll.

FORM: Approved A top-navigation table, structural candidate 3 from seed a3ed22f6. Code-led reference: `.impeccable/mocks/ui-options-20261102/a-desktop.png` and `a-mobile.png`. Preserve truthful date sorting rather than the preview's illustrative common-name ordering.

FINISH: The implementation received a `ship` verdict on 2026-11-02 after the reviewer scored all three accessibility/copy-feedback fixes resolved. The approved world is recorded in DESIGN.md and its sidecar. No generated raster assets ship.

## Behavior and constraints

- Preserve query parameters, back/forward navigation, client/type/archive filters, keyboard search, empty/error/retry and pagination. Add a shareable file extension filter scoped to the same client variant.
- The row's filename, format, count, source date and copy URL refer to the same selected variant/artifact. All-client results explicitly identify the chosen client; prefer active Mihomo classical for the initial quick-copy option, then active full-rule artifacts.
- Existing data branch paths, daily sync and original bytes are outside this UI change. JSON additions are additive. No public conversion service or invented popularity data.

## Verification evidence

- Desktop 1440×1000 and mobile 390×900 catalog/detail captures: `.impeccable/review/option-a/`. No horizontal overflow at 320px or 390px.
- Browser checks: Egern YAML, Mihomo classical YAML/domain MRS and Loon LIST copy targets; format filter, empty/reset, pagination/back, keyboard search, mobile accessible names, repeated-copy feedback restoration, detail download filename, shared history/about routes, and no console errors.
- Astro check: zero diagnostics. Six tests pass, including same-variant format matching. Build emits 1,189 pages. Detector reported only incumbent-document palette/type/radius advisories before the approved documentation replacement.
