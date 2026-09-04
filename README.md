# dsh-width-tiers

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A client plugin for the **DeepSeek Harness Web GUI** that adds **chat content
width tiers** with a floating picker button (bottom-right, above the
composer): 标准 / 中等 / 宽 / 超宽 / 全宽 (standard / medium / wide / ultra /
full).

## Why

The DSH Web app hard-codes a readable content width on the conversation root
(`--dsh-chat-content-width: 748px`). That caps the message column — and every
table inside it — at **748px** no matter how wide your window or panels are,
so wide tables always need horizontal scrolling.

This plugin overrides that variable per tier:

| Tier | Content width | Sidebar |
|---|---|---|
| standard 标准 | 748px (app default) | untouched |
| medium 中等 | 960px | untouched |
| wide 宽 | 1280px | untouched |
| ultra 超宽 | 1400px | untouched |
| full 全宽 | 100% (fills the window) | collapsed to the icon rail |

The choice persists in `localStorage` and is restored on the next visit; the
menu highlights the current tier, and the button's five level-bars show it at
a glance.

## Install

```bash
dsh plugin --profile web add dsh-width-tiers
```

The bundle patch then inserts the `dsh-width-tiers` loader entry itself — no
manual `cordis.patch.yml` edits needed.

Restart `dsh web` (the plugin loads at boot) and hard-refresh the page
(Ctrl+Shift+R). A round button with five bars appears at the bottom-right.

> Installing from a local checkout: `dsh plugin --profile web add file:/path/to/dsh-width-tiers`.
> Local-development gotcha: `file:` dependencies are **copied** into the
> profile's `node_modules` (pnpm does not symlink them). After editing the
> plugin source, re-sync the copy (e.g. `rsync -a --delete --exclude .git
> /path/to/dsh-width-tiers/ ~/.dsh/profiles/web/node_modules/dsh-width-tiers/`)
> or re-install after removing it, then restart `dsh web` and hard-refresh.

## Usage

- Click the round button → pick a tier; the current one is highlighted.
- `full` collapses the sidebar to the icon rail through the app's own toggle
  — it is never force-hidden or locked: click a rail icon any time to expand
  it, and it stays expanded.
- Non-standard tiers also close the details panel (re-closed automatically if
  reopened); `standard` leaves everything to the app.

## Language

All picker copy (tier labels, button `aria-label` and title) follows the
app's **Settings → Language** (中文 / English), through the app's own locale
service. Switching the language re-renders the button and menu immediately;
when no explicit language is chosen the app falls back to the browser's
language, and Chinese is the last resort. No plugin-side setting needed.

## How it works

- The element that defines `--dsh-chat-content-width` is **located at
  runtime** (the first element whose computed value is non-empty) and the
  tier is applied as an inline override — no hashed class names, so it
  survives bundle upgrades.
- Panels are driven through the **layout service** (`ctx.layout`), never by
  simulating clicks.
- The sidebar is only ever collapsed by the `full` tier; returning to
  `standard` restores it only if this plugin collapsed it.
- Dictionaries are registered with the app's **locale service**
  (`ctx.locale.register` / `bind`) and re-rendered through its change
  subscription, so the copy always matches the app's active language.

## Limitations

- Content width cannot exceed the window: on a narrow window, wider tiers are
  capped by the available column. Use `full` (which also collapses the
  sidebar) for the maximum.
- Requires the DSH Web client plugin system (dsh ≥ 0.1.0-rc.x with a `web`
  profile).

## Uninstall

```bash
dsh plugin --profile web remove dsh-width-tiers
```

then restart `dsh web`.

## License

MIT — see [LICENSE](LICENSE). Copyright (c) 2026 aaronlei.
