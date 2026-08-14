# dsh-width-tiers（对话区宽度档位）

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

DeepSeek Harness Web GUI 的客户端插件：给对话区加**内容宽度档位选择器**
（右下角圆形按钮，输入框上方），共 5 档：
标准 / 中等 / 宽 / 超宽 / 全宽。

## 为什么需要它

DSH Web 在会话根元素上硬编码了一个阅读宽度
（`--dsh-chat-content-width: 748px`），消息列——包括里面的所有表格——最大
只有 **748px**，不管窗口和面板多宽都不变，宽表格只能横向滚动。

本插件按档位覆盖这个变量：

| 档位 | 内容宽度 | 侧边栏 |
|---|---|---|
| 标准 | 748px（应用默认） | 不动 |
| 中等 | 960px | 不动 |
| 宽 | 1280px | 不动 |
| 超宽 | 1400px | 不动 |
| 全宽 | 100%（占满窗口） | 收起为图标轨道 |

选择会记住（localStorage），下次打开自动恢复；菜单里当前档位高亮，按钮上
的五条横条图标也直观显示当前档位。

## 安装

```bash
dsh plugin --profile web add dsh-width-tiers
```

然后在 `~/.dsh/profiles/web/cordis.patch.yml` 里注册为加载项：

```yaml
- insert:
    - id: dsh-width-tiers
      name: dsh-width-tiers
```

**重启 `dsh web`**（插件在启动时加载），再硬刷新页面（Ctrl+Shift+R）。
右下角会出现五条横条的圆形按钮。

> 本地目录安装：`dsh plugin --profile web add file:/path/to/dsh-width-tiers`。

## 使用

- 点圆形按钮 → 选择档位，当前档位高亮。
- 「全宽」通过应用自己的收起按钮把侧边栏收成图标轨道——**不会被锁死**：
  随时点轨道图标展开，展开后保持展开。
- 非标准档会关闭详情面板（被重新打开会自动再关）；标准档完全交给应用。

## 原理

- 运行时**自动定位**定义 `--dsh-chat-content-width` 的元素（第一个计算值
  非空的元素），以行内样式覆盖——**不依赖哈希类名**，dsh 升级后依旧有效。
- 面板操作走 **layout 服务**（`ctx.layout`），从不模拟点击。
- 侧边栏只被「全宽」档收起；回到「标准」时，只有本插件自己收起的侧边栏
  才会被恢复展开（你手动收的不动）。

## 已知限制

- 内容宽度不可能超过窗口：窗口窄时，高档位会被可用列宽截断；想要最大
  空间请用「全宽」（同时收起侧边栏）。
- 依赖 DSH Web 客户端插件体系（带 web profile 的 dsh ≥ 0.1.0-rc.x）。

## 卸载

```bash
dsh plugin --profile web remove dsh-width-tiers
```

删除 `~/.dsh/profiles/web/cordis.patch.yml` 里的 `dsh-width-tiers` 行，
然后重启 `dsh web`。

## 许可证

MIT —— 见 [LICENSE](LICENSE)。Copyright (c) 2026 aaronlei。
