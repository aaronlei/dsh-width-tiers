# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-08-14

First public release — published to the npm registry as `dsh-width-tiers`.

### Added

- **Chat content width tiers** for the DSH Web GUI: 标准 / 中等 / 宽 / 超宽 /
  全宽 (standard / medium / wide / ultra / full), applied as an inline
  override of the app's hard-coded `--dsh-chat-content-width: 748px` cap:

  | Tier | Content width | Sidebar |
  |---|---|---|
  | standard | 748px (app default) | untouched |
  | medium | 960px | untouched |
  | wide | 1280px | untouched |
  | ultra | 1400px | untouched |
  | full | 100% (fills the window) | collapsed to the icon rail |

- **Floating picker button** (bottom-right, above the composer) with five
  level-bars showing the current tier at a glance; the active tier is
  highlighted in the menu.
- **Persistent choice** — the selected tier is stored in `localStorage` and
  restored on the next visit.
- **Runtime element discovery** — the element defining
  `--dsh-chat-content-width` is located at runtime (first element with a
  non-empty computed value), so the override survives app bundle upgrades
  without depending on hashed class names.
- **Layout-service integration** — panels are driven through the app's layout
  service (`ctx.layout`), never by simulating clicks.
- **Non-destructive sidebar handling** — only the `full` tier collapses the
  sidebar, via the app's own toggle (never force-hidden or locked); returning
  to `standard` restores it only when this plugin collapsed it.
- **Details-panel handling** — non-standard tiers close the details panel for
  maximum reading width; `standard` leaves everything to the app.

### Packaging

- Dual entry points via `exports`: `"."` (server-side cordis no-op loader) and
  `"./client"` (browser bundle), declared through the `dsh.client` manifest so
  the Web boot serves it at `/plugins/dsh-width-tiers/client.js`.
- Scoped tarball: `lib/`, `LICENSE`, `README.md`, `README.zh.md` (8.7 kB).
- Requires Node.js ≥ 18 and a DSH Web client plugin system (`dsh ≥ 0.1.0-rc.x`
  with a `web` profile).

### Known limitations

- Content width cannot exceed the window: on narrow windows, wider tiers are
  capped by the available column; `full` (which also collapses the sidebar)
  gives the maximum.

[1.0.0]: https://github.com/aaronlei/dsh-width-tiers/releases/tag/v1.0.0
