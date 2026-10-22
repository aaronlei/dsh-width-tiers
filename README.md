<h1 align="center">dsh-width-tiers</h1>

<p align="center">Chat content-width tiers for the DeepSeek Harness Web GUI.</p>

<p align="center">
  <a href="https://www.npmjs.com/package/dsh-width-tiers"><img alt="npm" src="https://img.shields.io/npm/v/dsh-width-tiers?style=flat-square"></a>
  <a href="https://github.com/aaronlei/dsh-width-tiers"><img alt="GitHub stars" src="https://img.shields.io/github/stars/aaronlei/dsh-width-tiers?style=flat-square"></a>
  <a href="LICENSE"><img alt="MIT" src="https://img.shields.io/badge/license-MIT-yellow?style=flat-square"></a>
  <a href="#compatibility"><img alt="DSH 0.1.7+" src="https://img.shields.io/badge/DSH-0.1.7%2B-blue?style=flat-square"></a>
</p>

## Tiers

| Tier | Content width | Sidebar |
| --- | --- | --- |
| Standard 标准 | App default: `max(680px, min(column × 0.64, 920px))` | unchanged |
| Medium 中等 | 1120px | unchanged |
| Wide 宽 | 1280px | unchanged |
| Ultra 超宽 | 1400px | unchanged |
| Full 全宽 | `max(640px, column − 176px)` | collapsed to icon rail |
| Custom 自定义 | width recorded from a native drag | unchanged |

Fixed and custom widths are clamped by the app to
`max(640px, column − 176px)`; the standard tier follows the app default
(680–920px). On a narrow window a wider fixed tier therefore behaves like
`full`.

## Features

- Uses the app's native width axis (`--dsh-chat-user-width` and
  `dsh.conversation.contentWidth`), so the built-in drag handles keep working.
- Persists the selected tier and restores it on the next visit.
- Follows **Settings → Language** (中文 / English).
- Menu supports ArrowUp/Down, Home/End, Escape and Tab, with focus restoration.
- Tier changes sync across tabs.
- Respects `prefers-reduced-motion`.
- Never touches the right panel. Only `full` collapses the left sidebar, and
  you can expand it again at any time.

## Install

```bash
dsh plugin --profile web add dsh-width-tiers
```

Restart `dsh web`, then hard-refresh the page. A six-bar picker appears at the
bottom-right.

For a local checkout:

```bash
dsh plugin --profile web add link:/path/to/dsh-width-tiers
```

## Usage

- Click the picker and choose a tier.
- Picking `Custom` before the first drag opens a guide at the right edge; drag
  a native handle to record a width.
- Dragging any native handle switches to `Custom`; the plugin steps aside while
  you drag.
- `Standard` clears the width preference and returns to the app default.
- `Full` collapses the left sidebar; the icon rail stays available.

## How it works

- Locates the conversation body that declares `--dsh-chat-content-width`
  (prefers `[data-conversation-content]`, skips the right sidebar's embedded
  conversation), then writes `--dsh-chat-user-width` on its parent.
- Stores the configured target in the app preference; only the inline width is
  clamped to `max(640px, column − 176px)`.
- Watches the column with `ResizeObserver` so `full` follows sidebar, rightbar
  and window changes.
- Drives panels through `ctx.layout` and registers copy through `ctx.locale`.

## Compatibility

- DSH Web 0.1.7+ with a `web` profile.
- Width axis checked against DSH 0.2.1-rc.2: 640px floor, 176px handle budget,
  `--dsh-chat-*` variables, `data-width-handle`, layout/locale services.

## Development

```bash
npm test
```

The test loads the shipped `lib/client.js` bundle through a DOM stub; no live
DSH instance is required. The package ships prebuilt `lib/` and does not
include a `src/` tree.

## Notes

- Wider fixed tiers are clamped on narrow windows.
- A custom width dragged on a narrow window is clamped by the app before it is
  recorded.

## License

MIT — see [LICENSE](LICENSE). Copyright (c) 2026 aaronlei.
