<h1 align="center">dsh-width-tiers</h1>

<p align="center">DeepSeek Harness Web GUI 的对话区内容宽度档位插件。</p>

<p align="center">
  <a href="README.md">English</a> | <a href="README.zh.md">中文</a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/dsh-width-tiers"><img alt="npm" src="https://img.shields.io/npm/v/dsh-width-tiers?style=flat-square"></a>
  <a href="https://github.com/aaronlei/dsh-width-tiers"><img alt="GitHub stars" src="https://img.shields.io/github/stars/aaronlei/dsh-width-tiers?style=flat-square"></a>
  <a href="LICENSE"><img alt="MIT" src="https://img.shields.io/badge/license-MIT-yellow?style=flat-square"></a>
  <a href="https://www.npmjs.com/package/dsh-width-tiers"><img alt="Node version" src="https://img.shields.io/node/v/dsh-width-tiers?style=flat-square"></a>
  <a href="#兼容性"><img alt="DSH 0.2.x" src="https://img.shields.io/badge/DSH-0.2.x-blue?style=flat-square"></a>
</p>

## 档位

| 档位 | 内容宽度 | 侧边栏 |
| --- | --- | --- |
| 标准 | 应用默认：`max(680px, min(列宽 × 0.64, 920px))` | 不动 |
| 中等 | 1120px | 不动 |
| 宽 | 1280px | 不动 |
| 超宽 | 1400px | 不动 |
| 全宽 | `max(640px, 列宽 − 176px)` | 收起为图标轨道 |
| 自定义 | 原生拖拽记录的宽度 | 不动 |

固定档和自定义宽度会被应用钳制到 `max(640px, 列宽 − 176px)`；标准档
使用应用默认的 680–920px。窄窗口下较宽的固定档等同「全宽」。

## 特性

- 走应用原生宽度通道（`--dsh-chat-user-width` 与
  `dsh.conversation.contentWidth`），自带拖拽手柄始终可用。
- 记住当前档位，下次打开自动恢复。
- 跟随 **设置 → 语言**（中文 / English）。
- 菜单支持方向键、Home/End、Esc、Tab，并恢复焦点。
- 档位选择跨标签页同步。
- 支持 `prefers-reduced-motion`。
- 不碰右侧面板；只有「全宽」会收起左侧栏，随时可以再展开。

## 安装

```bash
dsh plugin --profile web add dsh-width-tiers
```

重启 `dsh web` 并硬刷新页面。右下角会出现六条横条的圆形按钮。

本地目录：

```bash
dsh plugin --profile web add link:/path/to/dsh-width-tiers
```

## 使用

- 点击圆形按钮选择档位。
- 首次选择「自定义」会在右侧边缘显示引导；拖动原生手柄记录宽度。
- 拖动任意原生手柄都会切换到「自定义」；拖拽期间插件让位于应用。
- 「标准」清除宽度偏好，回到应用默认宽度。
- 「全宽」收起左侧栏，图标轨道仍可随时展开。

## 原理

- 挂载到 frame 级 `shell.overlay` 插槽，由插件 fiber 持有 controller 生命周期；
  插件卸载后不残留监听器或定时器。
- controller 发布不可变快照（档位、菜单、引导），React picker 只负责渲染并
  派发动作；视图重挂载不需要重建观察者。
- 定位声明 `--dsh-chat-content-width` 的对话 body（优先
  `[data-conversation-content]`，跳过右侧栏的 embedded 对话），在它的
  父级写入 `--dsh-chat-user-width`。
- 应用偏好保存设定值，只有行内宽度按 `max(640px, 列宽 − 176px)` 钳制。
- 用 `ResizeObserver` 观察列宽，让「全宽」跟随左右栏与窗口变化。
- 面板操作走 `ctx.layout`，文案注册走 `ctx.locale`。

## 兼容性

- DSH Web 0.2.x，带 `web` profile（`shell.overlay` 插槽与 `slots` 服务）。
- 宽度轴已按 DSH 0.2.1-rc.2 对照：640px 下限、176px 手柄预留、
  `--dsh-chat-*` 变量、`data-width-handle`、layout/locale 服务。

## 开发

```bash
pnpm install
pnpm build        # src/ -> lib/（宿主入口 + loader 包装的客户端 bundle）
pnpm typecheck
pnpm test         # vitest：controller（jsdom）+ picker 组件测试
pnpm verify:client
```

源码在 `src/`（`src/index.ts` 是无副作用的宿主入口，功能在
`src/client/`），`lib/` 是构建后的发布内容。vitest 直接测试源码：
controller 跑在 jsdom 下，picker 用 Testing Library 渲染，不需要启动真实
DSH。`verify:client` 校验构建产物的 loader 契约。开发需要 Node 22+ 与 pnpm。

## 注意

- 窄窗口下较宽的固定档位会被应用钳制。
- 窄窗口下拖出的自定义宽度会先被应用钳制，再被记录。

## 许可证

MIT — 见 [LICENSE](LICENSE)。Copyright (c) 2026 aaronlei。
