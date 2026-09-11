# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.5] - 2026-09-11

### Fixed

- **Picker button missing on DSH 0.1.5-rc.2** — after upgrading DSH, the
  floating width picker no longer appeared at the bottom-right corner. The
  0.1.5-rc.2 layout overhaul replaced the details panel with the rightbar:
  `data-details-collapsed` was removed entirely, and `data-sidebar-collapsed`
  became conditionally rendered (`sidebarCollapsed || void 0`), so with the
  sidebar expanded the button's mount gate never matched and the button was
  never attached.

### Changed

- **Mount gate no longer depends on collapsed markers** — the button now
  waits for the AppFrame overlay layer (`[data-shell-overlay]`), which is
  rendered unconditionally once the shell exists, instead of the removed
  `data-details-collapsed` / conditional `data-sidebar-collapsed` attributes.
- **Right panel handling via the new layout API** — non-standard tiers now
  close the right panel through `layout.closeRightbar()` (idempotent), since
  `layout.closeDetails` no longer exists; the MutationObserver attribute
  filter was updated to the new `data-rightbar-collapsed` marker.

## [1.0.4] - 2026-09-04

### Changed

- **Self-contained bundle patch** — the plugin now ships a `cordis.patch.yml`
  that registers its own loader entry, so installing it (via `dsh plugin add`)
  requires no manual `cordis.patch.yml` edits in the profile.

## [1.0.3] - 2026-08-23

### Changed

- **Floating picker no longer floats over content** — it now **collapses to a
  slim blue vertical bar docked at the window's right edge** (10px from the
  border) and expands back to the full round button on hover / keyboard focus,
  so it no longer blocks the message area or the send button.
- **Collapsed bar shows the current tier** — the bar holds equal-length white
  bars whose lit ones mirror the active tier (same as the round button's
  varying-length bars).
- **Stable hover, no flicker** — a fixed transparent 36×36 hit area carries
  the hover state, so the shape no longer flips between bar and circle at the
  bottom-right corner.

### Fixed

- **Button no longer covers the message send button** — it is raised above the
  composer so the two never overlap.

## [1.0.2] - 2026-08-18

### Fixed

- **Width tier no longer lost on conversation switch** — the tier now
  re-applies automatically when the chat tree remounts; previously it fell
  back to the default width until the page was refreshed.

### Changed

- **Smoother conversation switches** — the target width is applied as the
  new view appears, without a visible flash of the default width; self-heal
  no longer polls, so remounts do not cause jank.

## [1.0.1] - 2026-08-14

### Added

- **i18n (zh / en)** — all picker copy (tier labels, button `aria-label` and
  title) now follows the app's **Settings → Language** via the app's locale
  service (`ctx.locale.register` / `bind` + change subscription). Switching
  the language re-renders the button and menu immediately; the app's own
  fallback (browser language → zh) applies.

### Changed

- `dsh.client.inject` now also requires `@deepseek-ai/dsh-client-locale`
  alongside `@deepseek-ai/dsh-client-ui-layout`.

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
