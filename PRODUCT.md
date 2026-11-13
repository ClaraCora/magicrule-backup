# MagicRule Backup

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Delegated by the user and confirmed in the implementation plan: Astro + TypeScript, Node.js sync scripts, GitHub Actions, and GitHub Pages. No database or application server.

## Users

Chinese-speaking Egern, Mihomo, Loon, and Surge users finding rules by name, checking freshness, and copying usable backup download URLs.

## Product Purpose

Back up all public pre-generated artifacts for the four selected clients daily. Keep usable copies independent of the source website, with searchable names, descriptions, sources, client and type filters, details, downloads, and history.

## Operating Context

Public repository: https://github.com/ClaraCora/magicrule-backup. Code lives on main; backup data lives on data. GitHub Pages serves the catalog, while raw GitHub URLs serve backed-up files. Daily schedule: 04:17 Asia/Shanghai. Manual sync and recovery are required.

## Capabilities and Constraints

- Preserve original bytes, provenance, attribution, and licenses. Check SHA-256 and publish only a complete valid snapshot. Retain delisted rules.
- Distinguish upstream rule update, backed-up file modification, and successful sync. Dates use Asia/Shanghai; success older than 36 hours is overdue.
- Search names, descriptions, and sources. Group matching IDs across clients. No domain/IP content search or online conversion in v1.
- Responsive table/list, keyboard access, shareable filters, static detail routes, and stable download paths.

## Evidence on Hand

Public source https://magicrule.pages.dev/data/meta/clients.json and per-client indexes. Inspection found 1,185 records each for Egern, Mihomo, Loon. Artifacts include YAML, LIST, MRS, MODULE, and PLUGIN; manifests also reference rule-26r.pages.dev. Text SHA-256 and binary downloads were sampled successfully.

## Product Principles

- Make search and dates visible immediately.
- A sync must never silently replace a valid backup with partial or corrupt data.
- Keep the page and downloads usable without the upstream site.
- Describe timestamps precisely; a daily check is not a rule update.

## Accessibility & Inclusion

Chinese UI, 16px base text, visible keyboard focus, labeled inputs, screen-reader status, mobile layouts without horizontal page scrolling, and reduced-motion support.
