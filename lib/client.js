window.__ModuleLoader__.load({
	id: "dsh-width-tiers",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		//#region lib/types/client/index.js
		/**
		 * dsh-width-tiers — chat content width tiers for the DSH Web GUI.
		 *
		 * The app derives the transcript width from
		 * `--dsh-chat-content-width`, which 0.1.7 and 0.2.0 resolve as
		 * `var(--dsh-chat-user-width, clamp(680px, column * .64, 920px))` on
		 * the conversation body. 0.1.7 also added native drag handles
		 * (ConversationWidthControls) that publish
		 * `--dsh-conversation-column-width` / `--dsh-chat-user-width` on the
		 * body's PARENT and clamp every value to the column minus a 176px
		 * handle budget. Forcing `--dsh-chat-content-width` with `!important`
		 * (the 1.0.5 approach) muted those handles and let over-wide
		 * transcripts overflow under the sidebar/rightbar columns, so this
		 * version drives the app's own width axis instead — see
		 * `applyContentWidth`. Other invariants:
		 *
		 *   标准 standard  app default (no override)
		 *   中等 medium    1120px (sidebar untouched)
		 *   宽   wide      1280px (sidebar untouched)
		 *   超宽 ultra     1400px (sidebar untouched)
		 *   全宽 full      column max (sidebar collapsed to the icon rail)
		 *   自定义 custom  user-dragged width (plugin hands width over to
		 *                  the app's native handles; the dragged value stays
		 *                  re-selectable from the menu). Before the first
		 *                  drag, picking it opens a guide at the right edge
		 *                  and the live column width is shown while dragging.
		 *
		 * The menu and title show fixed px for medium/wide/ultra
		 * (1120/1280/1400), the live app default px for standard, the live
		 * maximum (column − 176) for full, and the recorded drag width or
		 * "未设置" for custom. The app still clamps every applied px to
		 * column − 176. Every handle press (not just the first custom one)
		 * opens the live width readout, so repeat drags keep the highlight
		 * and the px bubble.
		 *
		 * The app preference stores the tier's configured target (nominal px,
		 * the recorded custom width, or the live cap for full); only the
		 * inline value is clamped. This lets the app restore the target when
		 * the window widens instead of staying pinned to a narrow clamp.
		 * The picker icon has one bar per tier (full lights five, custom all
		 * six), tier changes sync across tabs, the menu supports
		 * ArrowUp/Down/Home/End/Escape, and the sidebar's embedded
		 * Conversation is excluded from the width-root lookup.
		 *
		 *  - Panels are driven through the layout service (ctx.layout), never
		 *    by simulating clicks.
		 *  - The sidebar is only ever collapsed by the `full` tier, through the
		 *    app's own toggle — never force-hidden, never locked. Going back to
		 *    `standard` restores it only if this plugin collapsed it.
		 *  - The rightbar is never touched: on 0.1.7+ its panel lives in its
		 *    own seat, so closing the track would leave it overlaying the
		 *    conversation; the app's width axis yields space on its own.
		 *  - The chosen tier persists in localStorage and is restored on the
		 *    next visit.
		 *  - All copy is localized through the app's locale service: tier
		 *    labels and the button's aria/title follow Settings → Language
		 *    (zh / en, browser-derived fallback) and re-render on switch.
		 */
		const KEY = "dsh.widthTier";
		const OLD_KEY = "dsh.wide";
		/** Last user-dragged width (px), backing the `custom` tier. */
		const CUSTOM_KEY = "dsh.widthTierCustom";
		/** The app's own transcript width preference (ConversationWidthControls). */
		const APP_PREF_KEY = "dsh.conversation.contentWidth";
		/* Mirrors ConversationWidthControls in 0.1.7-alpha.1: clamp floor and
		 * the horizontal budget both width handles + safe edges reserve. */
		const CONTENT_MIN_PX = 640;
		const CONTENT_EDGE_BUDGET_PX = 176;
		/* Nominal content widths of the fixed tiers (px). */
		const NOMINAL_WIDTH_PX = { medium: 1120, wide: 1280, ultra: 1400 };
		/* The app's no-preference formula: clamp(680px, column × 0.64, 920px).
		 * Used as the last-resort live readout before the first drag. */
		const DEFAULT_MIN_PX = 680;
		const DEFAULT_MAX_PX = 920;
		const DEFAULT_COLUMN_RATIO = 0.64;
		const READY_TIMEOUT_MS = 30000;
		/* Self-heal cadence: DOM-driven (MutationObserver scheduling on the
		 * next animation frame — before paint, so the width never flashes
		 * default) with a low-frequency fallback and backoff retries while
		 * the width root is missing (conversation-switch remount). */
		const ROOT_RETRY_MIN_MS = 200;
		const ROOT_RETRY_MAX_MS = 2000;
		const FALLBACK_HEAL_MS = 2000;

		/** Dictionary namespace owned by this plugin. */
		const NS = "width-tiers";

		//#region lib/types/client/locales.js
		/** `width-tiers` namespace dictionaries (tier labels and picker copy). */
		/** Simplified Chinese dictionary (the key-set source of truth). */
		const zh = {
			"tier.standard": "标准",
			"tier.medium": "中等",
			"tier.wide": "宽",
			"tier.ultra": "超宽",
			"tier.full": "全宽",
			"tier.custom": "自定义",
			"value.custom.unset": "未设置",
			"guide.hint": "拖拽右侧边缘调整对话宽度",
			"button.aria": "对话区宽度档位：{label}（{value}），点击选择档位",
			"button.title.summary": "对话区宽度档位：{label}（{value}）",
			"button.title.hint": "点击选择：{list}"
		};
		/** English dictionary, checked complete against the zh key set. */
		const en = {
			"tier.standard": "Standard",
			"tier.medium": "Medium",
			"tier.wide": "Wide",
			"tier.ultra": "Ultra",
			"tier.full": "Full",
			"tier.custom": "Custom",
			"value.custom.unset": "Not set",
			"guide.hint": "Drag the right edge to resize",
			"button.aria": "Chat width tier: {label} ({value}). Click to choose a tier.",
			"button.title.summary": "Chat width tier: {label} ({value})",
			"button.title.hint": "Click to choose: {list}"
		};
		//#endregion

		/* Tier ids and label keys only — the picker resolves displayed values
		 * in tierValueText (fixed px for medium/wide/ultra, live px for
		 * standard/full, recorded px for custom). */
		const TIERS = [
			{ id: "standard", key: "tier.standard" },
			{ id: "medium", key: "tier.medium" },
			{ id: "wide", key: "tier.wide" },
			{ id: "ultra", key: "tier.ultra" },
			{ id: "full", key: "tier.full" },
			/* Reached by dragging a native width handle, or by picking it in
			 * the menu and following the right-edge drag guide. */
			{ id: "custom", key: "tier.custom" }
		];

		function tierOf(id) {
			for (let i = 0; i < TIERS.length; i++) {
				if (TIERS[i].id === id) return TIERS[i];
			}
			return TIERS[0];
		}

		//#region lib/types/client/styles.js
		/** Button + menu styles (theme variables, light/dark aware). */
		const css = [
			"#dsh-wide-toggle{position:fixed;right:10px;bottom:216px;z-index:999;display:flex;align-items:center;justify-content:center;width:36px;height:36px;padding:0;border:1px solid var(--dsw-alias-border-l2);border-radius:50%;overflow:hidden;background:var(--dsw-alias-button-floating-fill);color:var(--dsw-alias-label-secondary);box-shadow:0 2px 8px rgba(0,0,0,.18);cursor:pointer;opacity:.72;transition:opacity .2s ease,width .2s ease,border-radius .2s ease,background .2s ease,color .2s ease}",
			"#dsh-wide-toggle::after{content:'';position:fixed;right:10px;bottom:216px;width:36px;height:36px;pointer-events:auto}",
			"#dsh-wide-toggle:hover{opacity:1}",
			"#dsh-wide-toggle:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:2px;width:36px;border-radius:50%}",
			"#dsh-wide-toggle:not(:hover):not(:focus-visible){width:10px;border-radius:6px}",
			"#dsh-wide-toggle:not(:hover):not(:focus-visible) svg rect{width:6px;x:5px}",
			"#dsh-wide-toggle.active{background:var(--dsw-alias-state-business-primary);border-color:transparent;color:var(--dsw-static-neutral-00);opacity:1}",
			"#dsh-wide-toggle.pulse{animation:dsh-wide-pulse .65s ease-out}",
			"@media (prefers-reduced-motion:reduce){#dsh-wide-toggle{transition:none}#dsh-wide-toggle.pulse{animation:none}}",
			"@keyframes dsh-wide-pulse{0%{box-shadow:0 0 0 0 color-mix(in srgb,var(--dsw-alias-state-business-primary) 60%,transparent)}100%{box-shadow:0 0 0 14px transparent}}",
			"#dsh-width-menu{position:fixed;right:20px;bottom:264px;z-index:1000;min-width:196px;padding:6px;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-specific-menu);box-shadow:0 8px 28px rgba(0,0,0,.24);display:flex;flex-direction:column;gap:2px}",
			"#dsh-width-menu[hidden]{display:none}",
			"#dsh-width-menu button{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 12px;border:none;border-radius:8px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;line-height:18px;text-align:left;cursor:pointer}",
			"#dsh-width-menu button:hover{background:var(--dsw-alias-interactive-bg-hover)}",
			"#dsh-width-menu button:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:-2px}",
			"#dsh-width-menu button.selected{background:var(--dsw-alias-interactive-bg-hover-solid);color:var(--dsw-alias-state-business-primary)}",
			"#dsh-width-menu .dshwm-value{color:var(--dsw-alias-label-tertiary);font-size:12px}",
			"#dsh-width-menu button.selected .dshwm-value{color:var(--dsw-alias-state-business-primary)}",
			"#dsh-width-guide{position:fixed;z-index:1001;display:flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-specific-menu);color:var(--dsw-alias-label-primary);font-size:12px;line-height:16px;box-shadow:0 8px 28px rgba(0,0,0,.24);pointer-events:none;white-space:nowrap;transform:translateY(-50%)}",
			"#dsh-width-guide[hidden]{display:none}",
			"#dsh-width-guide svg{flex:none;color:var(--dsw-alias-state-business-primary)}",
			"#dsh-width-guide[data-mode=live]{font-size:13px;font-weight:600;font-variant-numeric:tabular-nums}",
			"body[data-dsh-width-guide] [data-width-handle]{background:linear-gradient(to bottom,transparent calc(50% - 64px),color-mix(in srgb,var(--dsw-alias-state-business-primary) 18%,transparent) calc(50% - 64px),color-mix(in srgb,var(--dsw-alias-state-business-primary) 18%,transparent) calc(50% + 64px),transparent calc(50% + 64px));border-radius:3px}",
			"body[data-dsh-width-guide] [data-width-handle]::after{opacity:1}"
		].join("");
		//#endregion

		/** Services required by the browser bundle. */
		const inject = ["layout", "locale"];

		/**
		 * Client plugin body: inject the styles, build the picker button and
		 * menu, and drive the width tiers through the layout service.
		 * @param ctx - client root context (layout + locale injected).
		 */
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "dsh-width-tiers: dictionaries");
			ctx.effect(() => {
				if (typeof document === "undefined") return;

				const styleTag = document.createElement("style");
				styleTag.dataset.plugin = "dsh-width-tiers";
				styleTag.textContent = css;
				document.head.appendChild(styleTag);

				const layout = ctx.layout;
				const t = ctx.locale.bind(NS);

				/* ---- helpers ---- */
				const body = () => document.body;

				function currentTier() {
					return body().getAttribute("data-dsh-width") || "standard";
				}

				function getSavedTier() {
					try {
						const v = window.localStorage.getItem(KEY);
						for (const t of TIERS) {
							if (t.id === v) return v;
						}
					} catch (e) {
						/* ignore */
					}
					return "standard";
				}

				/* The AppFrame sets data-sidebar-collapsed on the frame element
				 * (conditionally, only while collapsed) after each render. */
				function isSidebarCollapsed() {
					return document.querySelector("[data-sidebar-collapsed]") !== null;
				}

				/* NOTE: the 1.0.x "close the right panel on non-standard tiers"
				 * self-heal is gone on purpose. On 0.1.7 the rightbar panel
				 * lives in its own seat: closeRightbar() only retracts the
				 * grid TRACK (rightbarTrack=false) while the seat stays
				 * expanded, so the panel keeps rendering as an OVERLAY pinned
				 * to the frame's right edge — hanging over and covering the
				 * conversation (对话窗口被边侧栏覆盖). The plugin must never
				 * touch the rightbar; the app's own width axis already yields
				 * space to the panel. */

				function collapseSidebar() {
					if (!isSidebarCollapsed()) layout.toggleSidebar();
				}

				function expandSidebar() {
					if (isSidebarCollapsed()) layout.toggleSidebar();
				}

				/* Locate the element that defines --dsh-chat-content-width at
				 * runtime (first match wins; only one element declares it).
				 * Cached; the app remounts the chat tree on conversation switch,
				 * so re-location first walks the recorded child-index path from
				 * <body> (React keeps the tree shape — O(depth), one style
				 * read) and only falls back to a full scan. */
				let widthRoot = null;
				let widthPath = null;

				/* Whether this plugin wrote the app's width preference. Native
				 * drags also write it, so unload only removes a value this
				 * plugin owns. */
				let preferenceOwned = false;
				let preferenceWritten = null;
				let pulseTimer = null;

				function hasWidthVar(el) {
					return getComputedStyle(el)
						.getPropertyValue("--dsh-chat-content-width")
						.trim() !== "";
				}

				function recordWidthPath(el) {
					const path = [];
					let node = el;
					while (node && node !== document.body) {
						const parent = node.parentNode;
						if (!parent || !parent.children) break;
						path.unshift(Array.prototype.indexOf.call(parent.children, node));
						node = parent;
					}
					widthPath = path.length > 0 ? path : null;
				}

				/* Sidebar chat tabs render an embedded Conversation whose
				 * `--dsh-chat-content-width` is a local min() and never reads
				 * `--dsh-chat-user-width`. Writing there would be a no-op on
				 * the visible column and could starve the real transcript. */
				function isSidebarConversation(el) {
					return typeof el.closest === "function"
						&& el.closest("[data-sidebar-chat]") !== null;
				}

				function firstWidthRoot(list) {
					for (let i = 0; i < list.length; i++) {
						const el = list[i];
						if (isSidebarConversation(el)) continue;
						if (hasWidthVar(el)) return el;
					}
					return null;
				}

				function scanWidthRoot() {
					/* Prefer the stable Conversation data attribute (one or two
					 * elements) over every classed node in the document. The
					 * [class] walk remains the compatibility fallback for older
					 * clients that do not publish data-conversation-content. */
					let found = firstWidthRoot(document.querySelectorAll("[data-conversation-content]"));
					if (found === null) found = firstWidthRoot(document.querySelectorAll("[class]"));
					if (found !== null) {
						widthRoot = found;
						recordWidthPath(widthRoot);
						return widthRoot;
					}
					widthRoot = null;
					widthPath = null;
					return null;
				}

				function findWidthRoot(allowScan) {
					if (widthRoot !== null && document.contains(widthRoot)
						&& !isSidebarConversation(widthRoot)) return widthRoot;
					if (widthPath !== null) {
						let el = document.body;
						for (let i = 0; i < widthPath.length; i++) {
							el = el.children[widthPath[i]];
							if (!el) break;
						}
						if (el && el !== widthRoot && document.contains(el)
							&& !isSidebarConversation(el) && hasWidthVar(el)) {
							widthRoot = el;
							return widthRoot;
						}
					}
					if (allowScan === false) return null;
					return scanWidthRoot();
				}

				/* ---- 0.1.7 native width axis ----
				 * The conversation body's parent is the element the app's
				 * ConversationWidthControls publishes
				 * `--dsh-conversation-column-width` / `--dsh-chat-user-width`
				 * on. Writing there (never with `!important`) keeps native
				 * drag handles in charge: during a drag the app rewrites the
				 * same inline property every frame and wins the cascade. */
				function widthTarget(root) {
					return (root && root.parentElement) || root;
				}

				function readStoredNumber(key) {
					try {
						const v = Number(window.localStorage.getItem(key));
						return Number.isFinite(v) && v > 0 ? v : null;
					} catch (e) {
						return null;
					}
				}

				/* The tier's configured target, before the app's column clamp.
				 * This is the value persisted to the app preference: on a
				 * narrow column the app clamps it for display, and when the
				 * window widens it restores the configured target instead of
				 * staying pinned to the old clamp. `full` is inherently the
				 * live maximum. */
				function tierTargetPx(tier, root) {
					switch (tier) {
						case "medium":
						case "wide":
						case "ultra":
							return NOMINAL_WIDTH_PX[tier];
						case "full":
							return Math.max(CONTENT_MIN_PX, root.offsetWidth - CONTENT_EDGE_BUDGET_PX);
						case "custom": return readStoredNumber(CUSTOM_KEY);
						default: return null; /* standard: app default */
					}
				}

				/* The px actually applied to the column (same floor/max as the
				 * app's resolveContentWidth). */
				function appliedTierPx(tier, root) {
					const target = tierTargetPx(tier, root);
					if (target === null) return null;
					const cap = Math.max(CONTENT_MIN_PX, root.offsetWidth - CONTENT_EDGE_BUDGET_PX);
					return Math.min(Math.max(target, CONTENT_MIN_PX), cap);
				}

				/* The transcript width the app currently resolves for the live
				 * column (after its own clamp), used by the custom-drag guide.
				 * During a drag the app writes the clamped px to the target's
				 * inline `--dsh-chat-user-width`, so reading that is exact and
				 * avoids relying on how a browser serializes a computed custom
				 * property (which may stay as a var()/clamp() token stream). */
				function liveWidthPx(root) {
					const target = widthTarget(root);
					const inline = Number.parseFloat(target.style.getPropertyValue("--dsh-chat-user-width"));
					if (Number.isFinite(inline) && inline > 0) return Math.round(inline);
					const raw = getComputedStyle(root).getPropertyValue("--dsh-chat-content-width");
					const computed = Number.parseFloat(raw);
					if (Number.isFinite(computed) && computed > 0) return Math.round(computed);
					return Math.round(Math.max(
						DEFAULT_MIN_PX,
						Math.min(root.offsetWidth * DEFAULT_COLUMN_RATIO, DEFAULT_MAX_PX)
					));
				}

				function applyContentWidth(tier) {
					const root = findWidthRoot();
					if (root === null) return;
					const target = widthTarget(root);
					/* custom before the first drag has no width of its own —
					 * leave whatever the app last published in place. */
					if (tier === "custom" && readStoredNumber(CUSTOM_KEY) === null) return;
					const targetPx = tierTargetPx(tier, root);
					if (targetPx === null) {
						/* standard: hand the width back to the app default. The
						 * app's width preference is cleared as well; standard is
						 * deliberately the reset to the app's default width. */
						if (target.style.getPropertyValue("--dsh-chat-user-width") !== "" || preferenceOwned) {
							target.style.removeProperty("--dsh-chat-user-width");
							try {
								window.localStorage.removeItem(APP_PREF_KEY);
							} catch (e) {
								/* ignore */
							}
							preferenceOwned = false;
							preferenceWritten = null;
						}
						return;
					}
					const laidOut = root.offsetWidth > 0;
					/* `full` derives its target from the live column; without a
					 * layout box it would collapse to the 640px floor and pin a
					 * narrow width. Wait for the fallback/resize pass. */
					if (!laidOut && tier === "full") return;
					if (laidOut) {
						const px = appliedTierPx(tier, root);
						if (px !== null) {
							const next = String(Math.round(px));
							if (target.style.getPropertyValue("--dsh-chat-user-width") !== next + "px") {
								target.style.setProperty("--dsh-chat-user-width", next + "px");
							}
						}
					}
					/* Persist the unclamped target even while the root is not
					 * laid out (fixed tiers / recorded custom width do not
					 * depend on the column). The app clamps it for display and
					 * restores it after a resize / remount. */
					const preference = String(Math.round(targetPx));
					try {
						if (window.localStorage.getItem(APP_PREF_KEY) !== preference) {
							window.localStorage.setItem(APP_PREF_KEY, preference);
							preferenceOwned = true;
							preferenceWritten = preference;
						}
					} catch (e) {
						/* ignore */
					}
				}

				/* true while the CURRENT tier is the one that collapsed the sidebar */
				let collapsedByTier = false;

				/* `persist` is false when another tab already wrote the tier:
				 * adopting it must not write localStorage again. */
				function applyTier(tier, persist = true) {
					body().setAttribute("data-dsh-width", tier);
					if (persist) {
						try {
							window.localStorage.setItem(KEY, tier);
						} catch (e) {
							/* storage unavailable — state still applies this session */
						}
					}
					applyContentWidth(tier);
					if (tier === "full") {
						if (!isSidebarCollapsed()) {
							collapseSidebar();
							collapsedByTier = true;
						}
						/* already collapsed: don't claim ownership we may not have */
					} else if (tier === "standard") {
						if (collapsedByTier && isSidebarCollapsed()) expandSidebar();
						collapsedByTier = false;
					} else if (!isSidebarCollapsed()) {
						/* the user (or another panel) expanded it — the plugin no
						 * longer owns the collapsed state */
						collapsedByTier = false;
					}
					syncButton();
					syncMenu();
					pulse();
				}

				/* ---- floating button with level-bar icon ---- */
				const btn = document.createElement("button");
				btn.type = "button";
				btn.id = "dsh-wide-toggle";
				btn.setAttribute("aria-haspopup", "menu");
				btn.setAttribute("aria-expanded", "false");

				function barIcon(tier) {
					let idx = 0;
					for (let i = 0; i < TIERS.length; i++) {
						if (TIERS[i].id === tier) idx = i;
					}
					/* One bar per tier so full (5 bars) and custom (6 bars,
					 * all lit) remain distinguishable. */
					const widths = [3.5, 5.3, 7.1, 8.9, 10.7, 12.5];
					let bars = "";
					for (let b = 0; b < TIERS.length; b++) {
						const y = 0.75 + b * 2.55;
						bars += `<rect x="1.5" y="${y}" width="${widths[b]}" height="1.6" rx="0.8" fill="currentColor" opacity="${b <= idx ? 1 : 0.3}"/>`;
					}
					return `<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">${bars}</svg>`;
				}

				/* Value shown in the picker. Fixed tiers advertise their
				 * nominal px; standard and full are inherently relative to the
				 * current column, so they show the px the app resolves right
				 * now (full is the column's maximum, not a word). */
				function tierValueText(tierId) {
					switch (tierId) {
						case "standard": {
							const root = findWidthRoot();
							if (root === null) return "—";
							return `${Math.round(Math.max(
								DEFAULT_MIN_PX,
								Math.min(root.offsetWidth * DEFAULT_COLUMN_RATIO, DEFAULT_MAX_PX)
							))}px`;
						}
						case "medium":
						case "wide":
						case "ultra":
							return `${NOMINAL_WIDTH_PX[tierId]}px`;
						case "full": {
							const root = findWidthRoot();
							if (root === null) return "—";
							return `${Math.round(Math.max(
								CONTENT_MIN_PX,
								root.offsetWidth - CONTENT_EDGE_BUDGET_PX
							))}px`;
						}
						case "custom": {
							const dragged = readStoredNumber(CUSTOM_KEY);
							return dragged === null ? t("value.custom.unset") : `${Math.round(dragged)}px`;
						}
						default: return "—";
					}
				}

				function syncButton() {
					const tier = currentTier();
					const def = tierOf(tier);
					const label = t(def.key);
					const value = tierValueText(tier);
					const summary = t("button.title.summary", { label, value });
					const hint = t("button.title.hint", {
						list: TIERS.map((tierDef) => `${t(tierDef.key)} ${tierValueText(tierDef.id)}`).join(" / ")
					});
					btn.innerHTML = barIcon(tier);
					btn.classList.toggle("active", tier !== "standard");
					btn.setAttribute("aria-label", t("button.aria", { label, value }));
					btn.title = `${summary}\n${hint}`;
				}

				/* ---- tier menu ---- */
				const menu = document.createElement("div");
				menu.id = "dsh-width-menu";
				/* role="menu" is applied only while the menu is open: DSH's
				 * shortcut service treats any `[role="menu"]` in the document as an
				 * open modal (it does not check visibility), so a permanent hidden
				 * menu would block every keyboard shortcut, including the double
				 * Escape that stops a response. */
				menu.hidden = true;

				for (const def of TIERS) {
					const item = document.createElement("button");
					item.type = "button";
					item.setAttribute("role", "menuitemradio");
					item.setAttribute("data-tier", def.id);
					/* Roving focus: the menu is opened by focusing one item, and
					 * ArrowUp/Down/Home/End move between items. */
					item.tabIndex = -1;
					item.innerHTML = `<span class="dshwm-label">${t(def.key)}</span><span class="dshwm-value">${tierValueText(def.id)}</span>`;
					item.addEventListener("click", (e) => {
						if (e && e.stopPropagation) e.stopPropagation();
						/* Custom before the first drag has no width of its own:
						 * open the right-edge guide instead of applying a value. */
						if (def.id === "custom" && readStoredNumber(CUSTOM_KEY) === null) {
							beginCustomGuide();
							hideMenu(true);
							return;
						}
						endGuide(false);
						applyTier(def.id);
						hideMenu(true);
					});
					menu.appendChild(item);
				}

				/* Write only on change: syncMenu also runs on window resizes,
				 * and untouched text should not churn the DOM (the plugin's own
				 * MutationObserver watches childList). */
				function setText(el, text) {
					if (el.textContent !== text) el.textContent = text;
				}

				function syncMenu() {
					const tier = currentTier();
					const items = menu.querySelectorAll("button[data-tier]");
					for (let i = 0; i < items.length; i++) {
						const id = items[i].getAttribute("data-tier");
						const on = id === tier;
						items[i].classList.toggle("selected", on);
						items[i].setAttribute("aria-checked", String(on));
						const labelEl = items[i].querySelector(".dshwm-label");
						if (labelEl) setText(labelEl, t(tierOf(id).key));
						const valueEl = items[i].querySelector(".dshwm-value");
						if (valueEl) setText(valueEl, tierValueText(id));
					}
				}

				function menuItems() {
					return Array.from(menu.querySelectorAll("button[data-tier]"));
				}

				function showMenu() {
					menu.setAttribute("role", "menu");
					menu.hidden = false;
					btn.setAttribute("aria-expanded", "true");
					syncMenu();
					const items = menuItems();
					const selected = items.find((item) => item.getAttribute("data-tier") === currentTier()) || items[0];
					if (selected && typeof selected.focus === "function") selected.focus();
				}

				/* restoreFocus is true for Escape / item selection, false for a
				 * click-away so the click target keeps focus. */
				function hideMenu(restoreFocus) {
					const hadFocus = menu.contains(document.activeElement);
					menu.hidden = true;
					menu.removeAttribute("role");
					btn.setAttribute("aria-expanded", "false");
					if (restoreFocus && hadFocus && typeof btn.focus === "function") btn.focus();
				}

				btn.addEventListener("click", (e) => {
					if (e && e.stopPropagation) e.stopPropagation();
					if (menu.hidden) showMenu();
					else hideMenu(true);
				});

				const onDocClick = (e) => {
					if (!menu.hidden && e.target !== btn && !menu.contains(e.target)) hideMenu(false);
					/* Clicking anywhere but the guide's handle cancels a
					 * pending custom guide and restores the previous tier. */
					if (guideActive && !guideDragging && e.target !== btn && !menu.contains(e.target) && !isHandleEvent(e)) {
						endGuide(true);
					}
				};
				const onDocKey = (e) => {
					if (e.key === "Escape") {
						if (!menu.hidden) hideMenu(true);
						if (guideActive) endGuide(true);
						return;
					}
					if (menu.hidden) return;
					if (e.key === "Tab") {
						/* Let Tab move on, but do not leave an orphaned menu. */
						hideMenu(false);
						return;
					}
					const items = menuItems();
					if (items.length === 0) return;
					const current = items.indexOf(document.activeElement);
					let next = -1;
					if (e.key === "ArrowDown") next = current < 0 ? 0 : (current + 1) % items.length;
					else if (e.key === "ArrowUp") next = current < 0 ? items.length - 1 : (current - 1 + items.length) % items.length;
					else if (e.key === "Home") next = 0;
					else if (e.key === "End") next = items.length - 1;
					if (next < 0) return;
					e.preventDefault();
					const item = items[next];
					if (typeof item.focus === "function") item.focus();
				};
				document.addEventListener("click", onDocClick);
				document.addEventListener("keydown", onDocKey);

				/* ---- custom-drag guide ----
				 * A first-time `custom` pick has no recorded width. Instead of
				 * silently keeping the current width, point at the app's
				 * right-edge width handle and show the live transcript width
				 * while the user drags. The guide never writes the width
				 * itself: the app's native drag does (and wins the cascade),
				 * and the plugin only records the settled value on release. */
				const guide = document.createElement("div");
				guide.id = "dsh-width-guide";
				guide.setAttribute("aria-hidden", "true");
				guide.hidden = true;
				guide.innerHTML =
					'<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">' +
					'<path d="M6 3 2 8l4 5M10 3l4 5-4 5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
					'<span class="dshwg-text"></span>';
				const guideTextEl = guide.querySelector(".dshwg-text");

				let guideActive = false;
				let guideDragging = false;
				/* true while the bubble came from picking custom in the menu (its
				 * cancel path restores the previous tier). Direct handle drags
				 * open the same bubble but never "cancel" a tier. */
				let guideFromMenu = false;
				let guideHideTimer = null;
				let guideHandle = null;
				let tierBeforeGuide = "standard";

				/* The px the app currently resolves for the transcript, after
				 * its own clamp — what the guide's live readout shows. */
				function guideValueText() {
					const root = findWidthRoot();
					const px = root === null ? null : liveWidthPx(root);
					return px === null ? "—" : `${px}px`;
				}

				/* Keep the bubble beside the handle the user actually grabbed
				 * (it moves with the dragged edge); fall back to the right
				 * handle / frame edge when the handle is not mounted yet
				 * (menu-opened guide, hero or settling phase). */
				function positionGuide() {
					if (!guideActive) return;
					const handle = guideHandle !== null && document.contains(guideHandle)
						? guideHandle
						: document.querySelector('[data-width-handle="right"]');
					const viewport = window.innerWidth || 0;
					if (handle === null || typeof handle.getBoundingClientRect !== "function" || viewport === 0) {
						guide.style.left = "auto";
						guide.style.right = "24px";
						guide.style.top = "50%";
						return;
					}
					const rect = handle.getBoundingClientRect();
					const gap = 10;
					const width = guide.offsetWidth || 180;
					guide.style.top = `${rect.top + rect.height / 2}px`;
					guide.style.right = "auto";
					if (viewport - rect.right >= width + gap) {
						guide.style.left = `${rect.right + gap}px`;
					} else {
						guide.style.left = `${Math.max(8, rect.left - gap - width)}px`;
					}
				}

				function setGuideText(mode, text) {
					guide.dataset.mode = mode;
					setText(guideTextEl, text);
				}

				function startGuide() {
					guideFromMenu = true;
					guideActive = true;
					guideDragging = false;
					guideHandle = null;
					guide.hidden = false;
					body().setAttribute("data-dsh-width-guide", "custom");
					setGuideText("hint", t("guide.hint"));
					positionGuide();
				}

				/* Every handle press shows the live readout, not just the first
				 * guided drag — a repeat custom drag must keep the handle
				 * highlight and the width bubble. */
				function startLiveGuide(handle) {
					window.clearTimeout(guideHideTimer);
					guideActive = true;
					guideDragging = true;
					guideHandle = handle || null;
					guide.hidden = false;
					body().setAttribute("data-dsh-width-guide", "custom");
					setGuideText("live", guideValueText());
					positionGuide();
				}

				function beginCustomGuide() {
					/* Remember the tier to restore on cancel only on the first
					 * entry; re-picking custom while the guide is open must not
					 * make "custom" the restore target. */
					if (!guideActive) {
						tierBeforeGuide = currentTier();
						applyTier("custom");
					}
					startGuide();
				}

				/* Show the settled width briefly, then remove the guide. */
				function finishGuide() {
					if (!guideActive) return;
					guideDragging = false;
					setGuideText("live", guideValueText());
					window.clearTimeout(guideHideTimer);
					guideHideTimer = window.setTimeout(() => endGuide(false), 800);
				}

				/* `restoreTier` is for cancelling a menu-opened guide (click-away /
				 * Escape): if it never recorded a width, go back to the tier the
				 * user had before opening it. Drag-opened bubbles keep custom. */
				function endGuide(restoreTier) {
					if (!guideActive) return;
					guideActive = false;
					guideDragging = false;
					window.clearTimeout(guideHideTimer);
					guide.hidden = true;
					guide.dataset.mode = "hint";
					guideHandle = null;
					body().removeAttribute("data-dsh-width-guide");
					const restore = restoreTier && guideFromMenu && readStoredNumber(CUSTOM_KEY) === null;
					guideFromMenu = false;
					if (restore) applyTier(tierBeforeGuide);
				}

				const onGuidePointerMove = () => {
					if (!guideActive || !guideDragging) return;
					setGuideText("live", guideValueText());
					positionGuide();
				};
				document.addEventListener("pointermove", onGuidePointerMove, true);

				/* ---- hand the width over to the app's native drag handles ----
				 * Pressing a `[data-width-handle]` means the user is taking the
				 * width over: switch to the `custom` tier so healing stops
				 * enforcing a preset, and let the app's drag win the cascade
				 * (it rewrites the same inline property every frame). The
				 * settled width is recorded on release so it stays
				 * re-selectable from the menu. */
				const isHandleEvent = (e) =>
					e.target instanceof Element && e.target.closest("[data-width-handle]") !== null;

				const onHandlePointerDown = (e) => {
					if (!isHandleEvent(e)) return;
					startLiveGuide(e.target.closest("[data-width-handle]"));
					if (currentTier() === "custom") return;
					body().setAttribute("data-dsh-width", "custom");
					try {
						window.localStorage.setItem(KEY, "custom");
					} catch (err) {
						/* ignore */
					}
					syncButton();
					syncMenu();
				};

				const onHandlePointerUp = (e) => {
					if (!isHandleEvent(e)) return;
					const root = findWidthRoot();
					if (root !== null) {
						const px = Number.parseFloat(
							widthTarget(root).style.getPropertyValue("--dsh-chat-user-width")
						);
						if (Number.isFinite(px) && px > 0) {
							try {
								window.localStorage.setItem(CUSTOM_KEY, String(Math.round(px)));
							} catch (err) {
								/* ignore */
							}
						}
					}
					if (guideActive) finishGuide();
					syncButton();
					syncMenu();
				};

				/* A cancelled drag (touch gesture, window switch) ends without
				 * pointerup; without this handler the bubble would stay stuck
				 * in dragging mode and click-away would no longer dismiss it. */
				const onHandlePointerCancel = () => {
					/* The cancel target can be the capture element or the
					 * document; while a drag is active, end it regardless. */
					if (!guideActive || !guideDragging) return;
					endGuide(false);
					syncButton();
					syncMenu();
				};
				document.addEventListener("pointerdown", onHandlePointerDown, true);
				document.addEventListener("pointerup", onHandlePointerUp, true);
				document.addEventListener("pointercancel", onHandlePointerCancel, true);

				/* ---- feedback ring so every selection is visibly answered ---- */
				function pulse() {
					btn.classList.remove("pulse");
					void btn.offsetWidth;
					btn.classList.add("pulse");
					window.clearTimeout(pulseTimer);
					pulseTimer = window.setTimeout(() => {
						btn.classList.remove("pulse");
						pulseTimer = null;
					}, 700);
				}

				/* ---- re-render localized copy when the app language changes ---- */
				const renderTexts = () => {
					syncButton();
					syncMenu();
					if (guideActive && !guideDragging && guide.dataset.mode === "hint") {
						setText(guideTextEl, t("guide.hint"));
					}
				};
				const unsubscribeLocale = ctx.locale.subscribe(renderTexts);

				/* ---- attach once the app shell has mounted ---- */
				let attached = false;
				let readyTimer = null;
				let slowTimer = null;
				let readyTimeout = null;

				function stopWaiting() {
					if (readyTimer !== null) {
						clearInterval(readyTimer);
						readyTimer = null;
					}
					if (slowTimer !== null) {
						clearInterval(slowTimer);
						slowTimer = null;
					}
					if (readyTimeout !== null) {
						window.clearTimeout(readyTimeout);
						readyTimeout = null;
					}
				}

				/* The old gate matched [data-sidebar-collapsed] /
				 * [data-details-collapsed]. 0.1.5-rc.2 renders collapsed
				 * markers conditionally (`sidebarCollapsed || void 0`) and
				 * removed data-details-collapsed, so with the sidebar expanded
				 * nothing ever matched and the button never mounted. Wait for
				 * the AppFrame overlay layer instead — `data-shell-overlay` is
				 * rendered unconditionally once the shell exists. */
				function attach() {
					if (attached || !body()) return;
					if (document.querySelector("[data-shell-overlay]") === null) return;
					attached = true;
					stopWaiting();
					try {
						window.localStorage.removeItem(OLD_KEY);
					} catch (e) {
						/* ignore */
					}
					body().appendChild(btn);
					body().appendChild(menu);
					body().appendChild(guide);
					syncButton();
					const saved = getSavedTier();
					if (saved !== "standard") applyTier(saved);
					startHealing();
					if (widthRoot !== null) observeWidthTarget(widthRoot);
				}

				readyTimer = setInterval(attach, 300);
				readyTimeout = window.setTimeout(() => {
					if (attached) return;
					clearInterval(readyTimer);
					readyTimer = null;
					/* A very slow boot should not leave the picker permanently
					 * unmounted: keep a low-frequency retry instead of giving up. */
					slowTimer = setInterval(attach, 2000);
				}, READY_TIMEOUT_MS);
				window.addEventListener("load", attach);

				/* Tier changes from another tab: adopt the stored tier without
				 * writing localStorage again (that would loop). */
				const onStorage = (e) => {
					if (!e || e.key !== KEY) return;
					/* No storageArea identity check: spec does not require the
					 * event object to be the same Storage instance as
					 * window.localStorage, and dropping the event would break
					 * cross-tab sync. */
					const next = e.newValue;
					if (typeof next !== "string" || !TIERS.some((tier) => tier.id === next)) return;
					if (currentTier() === next) return;
					applyTier(next, false);
				};
				window.addEventListener("storage", onStorage);

				/* ---- self-heal: re-apply the width when the chat tree
				 * remounts (conversation switch). Panels are never managed
				 * here — the user may expand/collapse either side any time;
				 * forcing the rightbar closed only retracts the grid track
				 * while the seat keeps rendering as an overlay that covers
				 * the conversation. Driven by DOM mutations, scheduled on the
				 * next animation frame (before the browser paints) instead of
				 * a fixed hot loop: the width must land on the fresh root
				 * before its first paint — otherwise the default width
				 * flashes for a frame. While the new root has not appeared
				 * yet (mid-remount), full scans are owned by a backoff retry;
				 * mutation-driven heals only try the cheap path walk so DOM
				 * churn cannot storm. ---- */
				let rootMissing = false;
				let rootRetryDelay = ROOT_RETRY_MIN_MS;
				let rootRetryTimer = null;
				let healFrame = null;
				let resizeFrame = null;
				let observer = null;
				let fallbackTimer = null;
				let widthObserver = null;
				let observedTarget = null;

				/* Return the frame id so heal and resize can be debounced and
				 * cancelled independently. The old helper always wrote the
				 * heal slot, so resizeFrame never became non-null and every
				 * resize event scheduled another frame. */
				function scheduleFrame(cb) {
					return typeof requestAnimationFrame === "function"
						? requestAnimationFrame(cb)
						: window.setTimeout(cb, 0);
				}
				function cancelFrame(id) {
					if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(id);
					else window.clearTimeout(id);
				}

				/* Watch the column that sizes the transcript. Sidebar/rightbar
				 * changes and frame resizes alter it; `full` (and a clamped
				 * fixed/custom width) must follow without polling every
				 * mutation. Guarded for browsers/tests without ResizeObserver. */
				function observeWidthTarget(root) {
					if (typeof ResizeObserver === "undefined") return;
					const target = widthTarget(root);
					if (target === observedTarget && widthObserver !== null) return;
					if (widthObserver !== null) {
						widthObserver.disconnect();
						widthObserver = null;
					}
					observedTarget = target;
					widthObserver = new ResizeObserver(() => {
						/* Never fight the app's native drag: it owns the width
						 * while the user is moving a handle. */
						if (guideActive && guideDragging) return;
						const tier = currentTier();
						if (tier === "standard") return;
						applyContentWidth(tier);
						syncButton();
						syncMenu();
					});
					widthObserver.observe(target);
				}

				function scheduleRootRetry() {
					if (rootRetryTimer !== null) return;
					rootRetryTimer = window.setTimeout(() => {
						rootRetryTimer = null;
						const tier = currentTier();
						if (tier === "standard") return;
						const prev = widthRoot;
						const root = findWidthRoot();
						if (root === null) {
							rootRetryDelay = Math.min(rootRetryDelay * 2, ROOT_RETRY_MAX_MS);
							scheduleRootRetry();
						} else {
							rootMissing = false;
							rootRetryDelay = ROOT_RETRY_MIN_MS;
							if (root !== prev) {
								applyContentWidth(tier);
								syncButton();
								syncMenu();
							}
							observeWidthTarget(root);
						}
					}, rootRetryDelay);
				}

				function heal(fromObserver) {
					/* The right handle only mounts in the active phase; keep the
					 * guide pinned to it once the chat tree settles. */
					if (guideActive) positionGuide();
					/* The app's native drag owns the inline width until release;
					 * a heal must not restore the previous custom value on top. */
					if (guideActive && guideDragging) return;
					const tier = currentTier();
					if (tier === "standard") return;
					const prev = widthRoot;
					let root;
					if (rootMissing || fromObserver) {
						/* Mid-remount / mutation churn: walk the recorded path
						 * only (O(depth)); the backoff retry owns full scans
						 * until the new root exists. */
						root = findWidthRoot(false);
					} else {
						root = findWidthRoot();
					}
					if (root === null) {
						if (!rootMissing) {
							rootMissing = true;
							rootRetryDelay = ROOT_RETRY_MIN_MS;
						}
						/* Idempotent: keep a backoff retry alive even if the
						 * previous one ended while this tier was standard. */
						scheduleRootRetry();
						return;
					}
					if (rootMissing) {
						rootMissing = false;
						rootRetryDelay = ROOT_RETRY_MIN_MS;
					}
					observeWidthTarget(root);
					if (root !== prev) {
						applyContentWidth(tier);
						syncButton();
						syncMenu();
					} else if (!fromObserver) {
						/* Fallback tick: retry an apply that was skipped while
						 * the root had no layout box. */
						applyContentWidth(tier);
					}
				}

				function startHealing() {
					if (typeof MutationObserver !== "undefined") {
						observer = new MutationObserver(() => {
							if (healFrame !== null) return;
							healFrame = scheduleFrame(() => {
								healFrame = null;
								heal(true);
							});
						});
						observer.observe(document.body, {
							subtree: true,
							childList: true,
							attributes: true,
							attributeFilter: ["data-sidebar-collapsed"]
						});
					}
					/* Low-frequency fallback so self-heal still runs if the
					 * observer misses something — cheap: no full scan while the
					 * cached root is alive. */
					fallbackTimer = setInterval(() => heal(false), FALLBACK_HEAL_MS);
				}

				/* ---- keep the picker and the guide aligned with the live
				 * column. Standard/full re-resolve on resize, and the guide
				 * must stay beside the handle when the frame resizes. ---- */
				const onWindowResize = () => {
					if (resizeFrame !== null) return;
					resizeFrame = scheduleFrame(() => {
						resizeFrame = null;
						if (!(guideActive && guideDragging)) {
							const tier = currentTier();
							if (tier !== "standard") applyContentWidth(tier);
						}
						syncButton();
						syncMenu();
						positionGuide();
					});
				};
				window.addEventListener("resize", onWindowResize);

				/* All healing/observer state is initialized by now; try an
				 * immediate mount instead of waiting for the first interval. */
				attach();

				/* ---- disposer ---- */
				return () => {
					unsubscribeLocale();
					stopWaiting();
					clearInterval(fallbackTimer);
					clearTimeout(rootRetryTimer);
					clearTimeout(guideHideTimer);
					clearTimeout(pulseTimer);
					if (healFrame !== null) cancelFrame(healFrame);
					if (resizeFrame !== null) cancelFrame(resizeFrame);
					if (widthObserver !== null) {
						widthObserver.disconnect();
						widthObserver = null;
						observedTarget = null;
					}
					window.removeEventListener("resize", onWindowResize);
					window.removeEventListener("load", attach);
					window.removeEventListener("storage", onStorage);
					if (observer !== null) observer.disconnect();
					document.removeEventListener("click", onDocClick);
					document.removeEventListener("keydown", onDocKey);
					document.removeEventListener("pointerdown", onHandlePointerDown, true);
					document.removeEventListener("pointerup", onHandlePointerUp, true);
					document.removeEventListener("pointercancel", onHandlePointerCancel, true);
					document.removeEventListener("pointermove", onGuidePointerMove, true);
					if (btn.parentNode) btn.parentNode.removeChild(btn);
					if (menu.parentNode) menu.parentNode.removeChild(menu);
					if (guide.parentNode) guide.parentNode.removeChild(guide);
					if (styleTag.parentNode) styleTag.parentNode.removeChild(styleTag);
					/* Hand the width back to the app default. Only a value this
					 * plugin wrote is removed, so a native drag preference that
					 * predates the plugin survives unload. */
					if (widthRoot !== null) {
						widthTarget(widthRoot).style.removeProperty("--dsh-chat-user-width");
					}
					if (preferenceOwned) {
						try {
							/* Only remove the exact value this plugin wrote; a
							 * native drag since then owns the preference. */
							if (preferenceWritten !== null
								&& window.localStorage.getItem(APP_PREF_KEY) === preferenceWritten) {
								window.localStorage.removeItem(APP_PREF_KEY);
							}
						} catch (e) {
							/* ignore */
						}
						preferenceOwned = false;
						preferenceWritten = null;
					}
					/* Undo a collapse this plugin owned; a manual collapse is
					 * left alone. */
					if (collapsedByTier) {
						try {
							if (isSidebarCollapsed()) layout.toggleSidebar();
						} catch (e) {
							/* ignore */
						}
						collapsedByTier = false;
					}
					guideHandle = null;
					body().removeAttribute("data-dsh-width");
					body().removeAttribute("data-dsh-width-guide");
				};
			}, "dsh-width-tiers: ui");
		}
		//#endregion

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
