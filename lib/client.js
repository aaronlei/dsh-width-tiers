window.__ModuleLoader__.load({
	id: "dsh-width-tiers",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		// src/client/constants.ts
		/** LocalStorage key holding the selected tier. */
		const KEY = "dsh.widthTier";
		/** Legacy key from the pre-tier releases; removed on attach. */
		const OLD_KEY = "dsh.wide";
		/** Last user-dragged width (px), backing the `custom` tier. */
		const CUSTOM_KEY = "dsh.widthTierCustom";
		/** The app's own transcript width preference (ConversationWidthControls). */
		const APP_PREF_KEY = "dsh.conversation.contentWidth";
		/** Nominal content widths of the fixed tiers (px). */
		const NOMINAL_WIDTH_PX = {
			medium: 1120,
			wide: 1280,
			ultra: 1400
		};
		const DEFAULT_COLUMN_RATIO = .64;
		/** How long attach waits before falling back to a slow retry. */
		const READY_TIMEOUT_MS = 3e4;
		const ROOT_RETRY_MAX_MS = 2e3;
		const FALLBACK_HEAL_MS = 2e3;
		/** Attribute the plugin sets on <body> while a tier is active. */
		const TIER_ATTR = "data-dsh-width";
		/** Attribute the plugin sets on <body> while the custom-drag guide is open. */
		const GUIDE_ATTR = "data-dsh-width-guide";
		// src/client/model.ts
		const TIERS = [
			{
				id: "standard",
				key: "tier.standard"
			},
			{
				id: "medium",
				key: "tier.medium"
			},
			{
				id: "wide",
				key: "tier.wide"
			},
			{
				id: "ultra",
				key: "tier.ultra"
			},
			{
				id: "full",
				key: "tier.full"
			},
			{
				id: "custom",
				key: "tier.custom"
			}
		];
		/**
		* Resolve a tier definition by id, falling back to `standard`.
		* @param id - stored or attributed tier id.
		* @returns the matching definition, or `standard`.
		*/
		function tierOf(id) {
			for (const tier of TIERS) if (tier.id === id) return tier;
			return TIERS[0];
		}
		/**
		* Read a positive persisted number, or null when absent or corrupt.
		* @param storage - backing storage.
		* @param key - storage key.
		* @returns the parsed positive number, or null.
		*/
		function readStoredNumber(storage, key) {
			try {
				const value = Number(storage.getItem(key));
				return Number.isFinite(value) && value > 0 ? value : null;
			} catch {
				return null;
			}
		}
		/**
		* Read the saved tier, defaulting to `standard` when absent or unknown.
		* @param storage - backing storage.
		* @returns a valid tier id.
		*/
		function getSavedTier(storage) {
			try {
				const value = storage.getItem(KEY);
				const found = TIERS.find((tier) => tier.id === value);
				return found === void 0 ? "standard" : found.id;
			} catch {
				return "standard";
			}
		}
		/**
		* The tier's configured target, before the app's column clamp. This is the
		* value persisted to the app preference: on a narrow column the app clamps it
		* for display, and when the window widens it restores the configured target
		* instead of staying pinned to the old clamp. `full` is inherently the live
		* maximum; `standard` has no target and delegates to the app default.
		* @param tier - selected tier.
		* @param columnWidth - live width of the app's width column (px).
		* @param customPx - recorded custom width, if any.
		* @returns the target width in px, or null for the app default.
		*/
		function tierTargetPx(tier, columnWidth, customPx) {
			switch (tier) {
				case "medium":
				case "wide":
				case "ultra": return NOMINAL_WIDTH_PX[tier];
				case "full": return fullWidthPx(columnWidth);
				case "custom": return customPx;
				default: return null;
			}
		}
		/**
		* The px actually applied to the column (same floor/max as the app's
		* `resolveContentWidth`).
		* @param tier - selected tier.
		* @param columnWidth - live width of the app's width column (px).
		* @param customPx - recorded custom width, if any.
		* @returns the clamped width in px, or null for the app default.
		*/
		function appliedTierPx(tier, columnWidth, customPx) {
			const target = tierTargetPx(tier, columnWidth, customPx);
			if (target === null) return null;
			const cap = fullWidthPx(columnWidth);
			return Math.min(Math.max(target, 640), cap);
		}
		/**
		* Resolve the app's default transcript width for a column.
		* @param columnWidth - live width of the app's width column (px).
		* @returns `max(680, min(column × 0.64, 920))`.
		*/
		function defaultWidthPx(columnWidth) {
			return Math.max(680, Math.min(columnWidth * DEFAULT_COLUMN_RATIO, 920));
		}
		/**
		* Resolve the widest transcript the column can hold (app clamp maximum).
		* @param columnWidth - live width of the app's width column (px).
		* @returns `max(640, column − 176)`.
		*/
		function fullWidthPx(columnWidth) {
			return Math.max(640, columnWidth - 176);
		}
		// src/client/styles.ts
		/**
		* Button + menu styles. Theme variables keep the picker in the app's light /
		* dark palettes; every selector is scoped to this plugin's own ids and classes.
		*/
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
		/**
		* Install the plugin stylesheet and return its removal disposer.
		* @returns removes the owned style element from the document head.
		*/
		function installStyles() {
			const styleTag = document.createElement("style");
			styleTag.dataset.plugin = "dsh-width-tiers";
			styleTag.textContent = css;
			document.head.appendChild(styleTag);
			return () => {
				if (styleTag.parentNode) styleTag.parentNode.removeChild(styleTag);
			};
		}
		// src/client/width-root.ts
		/** Whether an element resolves a non-empty `--dsh-chat-content-width`. */
		function hasWidthVar(el) {
			return getComputedStyle(el).getPropertyValue("--dsh-chat-content-width").trim() !== "";
		}
		function isSidebarConversation(el) {
			return typeof el.closest === "function" && el.closest("[data-sidebar-chat]") !== null;
		}
		/**
		* The element the app's ConversationWidthControls publishes
		* `--dsh-conversation-column-width` / `--dsh-chat-user-width` on.
		* @param root - element that declares `--dsh-chat-content-width`.
		* @returns the parent element, or the root itself when detached.
		*/
		function widthTarget(root) {
			return root.parentElement ?? root;
		}
		/**
		* Create the runtime locator. Cached; the app remounts the chat tree on
		* conversation switch, so re-location first walks the recorded child-index
		* path from <body> (React keeps the tree shape — O(depth), one style read)
		* and only falls back to a full scan.
		* @returns locator bound to this page's document.
		*/
		function createWidthRootLocator() {
			let widthRoot = null;
			let widthPath = null;
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
			function firstWidthRoot(list) {
				for (let i = 0; i < list.length; i++) {
					const el = list[i];
					if (el === void 0 || isSidebarConversation(el)) continue;
					if (hasWidthVar(el)) return el;
				}
				return null;
			}
			function scanWidthRoot() {
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
			function find(allowScan = true) {
				if (widthRoot !== null && document.contains(widthRoot) && !isSidebarConversation(widthRoot)) return widthRoot;
				if (widthPath !== null) {
					let el = document.body;
					for (let i = 0; i < widthPath.length; i++) {
						if (el === null) break;
						const next = el.children[widthPath[i]];
						if (!next) {
							el = null;
							break;
						}
						el = next;
					}
					if (el !== null && el !== widthRoot && document.contains(el) && !isSidebarConversation(el) && hasWidthVar(el)) {
						widthRoot = el;
						return widthRoot;
					}
				}
				if (!allowScan) return null;
				return scanWidthRoot();
			}
			return {
				find,
				cached: () => widthRoot,
				reset: () => {
					widthRoot = null;
					widthPath = null;
				}
			};
		}
		function liveWidthPx(root) {
			const target = widthTarget(root);
			const inline = Number.parseFloat(target.style.getPropertyValue("--dsh-chat-user-width"));
			if (Number.isFinite(inline) && inline > 0) return Math.round(inline);
			const raw = getComputedStyle(root).getPropertyValue("--dsh-chat-content-width");
			const computed = Number.parseFloat(raw);
			if (Number.isFinite(computed) && computed > 0) return Math.round(computed);
			return Math.round(defaultWidthPx(root.offsetWidth));
		}
		// src/client/controller.ts
		/** Estimated bubble width used when placing the guide beside a drag handle. */
		const GUIDE_WIDTH_PX = 180;
		/** How long the settled width stays visible after a drag. */
		const GUIDE_HIDE_MS = 800;
		/** Default guide placement (frame edge, vertical center). */
		const GUIDE_FALLBACK = {
			left: "auto",
			right: "24px",
			top: "50%"
		};
		/**
		* Own the width-tier model: the app's native width axis, the tier/guide state
		* machine and persistence. Rendering lives in the React picker, which reads
		* `source` and dispatches `actions`; this controller never touches the picker
		* DOM, so the UI can remount without rebuilding observers.
		* @param options - layout service, locale subscription and translate function.
		* @returns observable state, actions and the disposer.
		*/
		function createWidthTiers(options) {
			const { layout, t } = options;
			const roots = createWidthRootLocator();
			const removeStyles = installStyles();
			const body = () => document.body;
			const listeners = /* @__PURE__ */ new Set();
			let snapshot;
			let menuOpen = false;
			let pulseSeq = 0;
			let guideActive = false;
			let guideDragging = false;
			let guideFromMenu = false;
			let guideMode = "hint";
			let guideText = "";
			let guideStyle = GUIDE_FALLBACK;
			let guideHandle = null;
			let guideHideTimer = null;
			let guideWidth = GUIDE_WIDTH_PX;
			let tierBeforeGuide = "standard";
			let preferenceOwned = false;
			let preferenceWritten = null;
			let collapsedByTier = false;
			function currentTier() {
				const value = body().getAttribute(TIER_ATTR);
				const found = value === null ? void 0 : TIERS.find((tier) => tier.id === value);
				return found === void 0 ? "standard" : found.id;
			}
			function getSavedTier$1() {
				try {
					return getSavedTier(window.localStorage);
				} catch {
					return "standard";
				}
			}
			function readNumber(key) {
				try {
					return readStoredNumber(window.localStorage, key);
				} catch {
					return null;
				}
			}
			function isSidebarCollapsed() {
				return document.querySelector("[data-sidebar-collapsed]") !== null;
			}
			function collapseSidebar() {
				if (!isSidebarCollapsed()) layout.toggleSidebar();
			}
			function expandSidebar() {
				if (isSidebarCollapsed()) layout.toggleSidebar();
			}
			function tierValueText(tierId) {
				switch (tierId) {
					case "standard": {
						const root = roots.find();
						if (root === null) return "—";
						return `${Math.round(defaultWidthPx(root.offsetWidth))}px`;
					}
					case "medium":
					case "wide":
					case "ultra": return `${NOMINAL_WIDTH_PX[tierId]}px`;
					case "full": {
						const root = roots.find();
						if (root === null) return "—";
						return `${Math.round(fullWidthPx(root.offsetWidth))}px`;
					}
					case "custom": {
						const dragged = readNumber(CUSTOM_KEY);
						return dragged === null ? t("value.custom.unset") : `${Math.round(dragged)}px`;
					}
					default: return "—";
				}
			}
			function guideValueText() {
				const root = roots.find();
				const px = root === null ? null : liveWidthPx(root);
				return px === null ? "—" : `${px}px`;
			}
			function buildSnapshot() {
				const tier = currentTier();
				const def = tierOf(tier);
				const label = t(def.key);
				const value = tierValueText(tier);
				const summary = t("button.title.summary", {
					label,
					value
				});
				const hint = t("button.title.hint", { list: TIERS.map((tierDef) => `${t(tierDef.key)} ${tierValueText(tierDef.id)}`).join(" / ") });
				return {
					tier,
					menuOpen,
					pulse: pulseSeq,
					button: {
						active: tier !== "standard",
						label,
						value,
						ariaLabel: t("button.aria", {
							label,
							value
						}),
						title: `${summary}\n${hint}`
					},
					items: TIERS.map((tierDef) => ({
						id: tierDef.id,
						label: t(tierDef.key),
						value: tierValueText(tierDef.id),
						selected: tierDef.id === tier
					})),
					guide: {
						active: guideActive,
						dragging: guideDragging,
						mode: guideMode,
						text: guideText,
						style: guideStyle
					}
				};
			}
			function emit() {
				snapshot = buildSnapshot();
				for (const listener of listeners) listener();
			}
			function applyContentWidth(tier) {
				const root = roots.find();
				if (root === null) return;
				const target = widthTarget(root);
				if (tier === "custom" && readNumber("dsh.widthTierCustom") === null) return;
				const targetPx = tierTargetPx(tier, root.offsetWidth, readNumber(CUSTOM_KEY));
				if (targetPx === null) {
					if (target.style.getPropertyValue("--dsh-chat-user-width") !== "" || preferenceOwned) {
						target.style.removeProperty("--dsh-chat-user-width");
						try {
							window.localStorage.removeItem(APP_PREF_KEY);
						} catch {}
						preferenceOwned = false;
						preferenceWritten = null;
					}
					return;
				}
				const laidOut = root.offsetWidth > 0;
				if (!laidOut && tier === "full") return;
				if (laidOut) {
					const px = appliedTierPx(tier, root.offsetWidth, readNumber(CUSTOM_KEY));
					if (px !== null) {
						const next = String(Math.round(px));
						if (target.style.getPropertyValue("--dsh-chat-user-width") !== next + "px") target.style.setProperty("--dsh-chat-user-width", next + "px");
					}
				}
				const preference = String(Math.round(targetPx));
				try {
					if (window.localStorage.getItem("dsh.conversation.contentWidth") !== preference) {
						window.localStorage.setItem(APP_PREF_KEY, preference);
						preferenceOwned = true;
						preferenceWritten = preference;
					}
				} catch {}
			}
			function applyTier(tier, persist = true) {
				body().setAttribute(TIER_ATTR, tier);
				if (persist) try {
					window.localStorage.setItem(KEY, tier);
				} catch {}
				applyContentWidth(tier);
				if (tier === "full") {
					if (!isSidebarCollapsed()) {
						collapseSidebar();
						collapsedByTier = true;
					}
				} else if (tier === "standard") {
					if (collapsedByTier && isSidebarCollapsed()) expandSidebar();
					collapsedByTier = false;
				} else if (!isSidebarCollapsed()) collapsedByTier = false;
				pulseSeq += 1;
				emit();
			}
			function computeGuideStyle() {
				const handle = guideHandle !== null && document.contains(guideHandle) ? guideHandle : document.querySelector("[data-width-handle=\"right\"]");
				const viewport = window.innerWidth || 0;
				if (handle === null || typeof handle.getBoundingClientRect !== "function" || viewport === 0) return GUIDE_FALLBACK;
				const rect = handle.getBoundingClientRect();
				const gap = 10;
				const top = `${rect.top + rect.height / 2}px`;
				if (viewport - rect.right >= guideWidth + gap) return {
					left: `${rect.right + gap}px`,
					right: "auto",
					top
				};
				return {
					left: `${Math.max(8, rect.left - gap - guideWidth)}px`,
					right: "auto",
					top
				};
			}
			function updateGuideStyle() {
				if (!guideActive) return;
				const next = computeGuideStyle();
				if (next.left === guideStyle.left && next.right === guideStyle.right && next.top === guideStyle.top) return;
				guideStyle = next;
				emit();
			}
			function startGuide() {
				guideFromMenu = true;
				guideActive = true;
				guideDragging = false;
				guideHandle = null;
				body().setAttribute(GUIDE_ATTR, "custom");
				guideMode = "hint";
				guideText = t("guide.hint");
				guideStyle = computeGuideStyle();
				emit();
			}
			function startLiveGuide(handle) {
				if (guideHideTimer !== null) {
					window.clearTimeout(guideHideTimer);
					guideHideTimer = null;
				}
				guideActive = true;
				guideDragging = true;
				guideHandle = handle ?? null;
				body().setAttribute(GUIDE_ATTR, "custom");
				guideMode = "live";
				guideText = guideValueText();
				guideStyle = computeGuideStyle();
				emit();
			}
			function beginCustomGuide() {
				if (!guideActive) {
					tierBeforeGuide = currentTier();
					applyTier("custom");
				}
				startGuide();
			}
			function finishGuide() {
				if (!guideActive) return;
				guideDragging = false;
				guideMode = "live";
				guideText = guideValueText();
				if (guideHideTimer !== null) window.clearTimeout(guideHideTimer);
				guideHideTimer = window.setTimeout(() => endGuide(false), GUIDE_HIDE_MS);
				emit();
			}
			function endGuide(restoreTier) {
				if (!guideActive) return;
				guideActive = false;
				guideDragging = false;
				if (guideHideTimer !== null) {
					window.clearTimeout(guideHideTimer);
					guideHideTimer = null;
				}
				guideMode = "hint";
				guideHandle = null;
				guideWidth = GUIDE_WIDTH_PX;
				guideStyle = GUIDE_FALLBACK;
				body().removeAttribute(GUIDE_ATTR);
				const restore = restoreTier && guideFromMenu && readNumber("dsh.widthTierCustom") === null;
				guideFromMenu = false;
				if (restore) applyTier(tierBeforeGuide);
				else emit();
			}
			const onGuidePointerMove = () => {
				if (!guideActive || !guideDragging) return;
				guideText = guideValueText();
				guideStyle = computeGuideStyle();
				emit();
			};
			document.addEventListener("pointermove", onGuidePointerMove, true);
			const isHandleEvent = (e) => e.target instanceof Element && e.target.closest("[data-width-handle]") !== null;
			const onHandlePointerDown = (e) => {
				if (!isHandleEvent(e)) return;
				const target = e.target;
				startLiveGuide(target.closest("[data-width-handle]"));
				if (currentTier() === "custom") return;
				body().setAttribute(TIER_ATTR, "custom");
				try {
					window.localStorage.setItem(KEY, "custom");
				} catch {}
				emit();
			};
			const onHandlePointerUp = (e) => {
				if (!isHandleEvent(e)) return;
				const root = roots.find();
				if (root !== null) {
					const px = Number.parseFloat(widthTarget(root).style.getPropertyValue("--dsh-chat-user-width"));
					if (Number.isFinite(px) && px > 0) try {
						window.localStorage.setItem(CUSTOM_KEY, String(Math.round(px)));
					} catch {}
				}
				if (guideActive) finishGuide();
				else emit();
			};
			const onHandlePointerCancel = () => {
				if (!guideActive || !guideDragging) return;
				endGuide(false);
			};
			document.addEventListener("pointerdown", onHandlePointerDown, true);
			document.addEventListener("pointerup", onHandlePointerUp, true);
			document.addEventListener("pointercancel", onHandlePointerCancel, true);
			const actions = {
				toggleMenu() {
					menuOpen = !menuOpen;
					emit();
				},
				closeMenu() {
					if (!menuOpen) return;
					menuOpen = false;
					emit();
				},
				selectTier(tier) {
					menuOpen = false;
					if (tier === "custom" && readNumber("dsh.widthTierCustom") === null) {
						beginCustomGuide();
						return;
					}
					endGuide(false);
					applyTier(tier);
				},
				cancelGuide() {
					endGuide(true);
				},
				measureGuide(width) {
					const next = Math.round(width);
					if (next <= 0 || next === guideWidth) return;
					guideWidth = next;
					if (!guideActive) return;
					guideStyle = computeGuideStyle();
					emit();
				}
			};
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
			function attach() {
				if (attached || !body()) return;
				if (document.querySelector("[data-shell-overlay]") === null) return;
				attached = true;
				stopWaiting();
				try {
					window.localStorage.removeItem(OLD_KEY);
				} catch {}
				const saved = getSavedTier$1();
				if (saved !== "standard") applyTier(saved);
				else emit();
				startHealing();
				const cached = roots.cached();
				if (cached !== null) observeWidthTarget(cached);
			}
			readyTimer = setInterval(attach, 300);
			readyTimeout = window.setTimeout(() => {
				if (attached) return;
				if (readyTimer !== null) {
					clearInterval(readyTimer);
					readyTimer = null;
				}
				slowTimer = setInterval(attach, 2e3);
			}, READY_TIMEOUT_MS);
			window.addEventListener("load", attach);
			const onStorage = (e) => {
				if (!e || e.key !== "dsh.widthTier") return;
				const next = e.newValue;
				if (typeof next !== "string") return;
				const found = TIERS.find((tier) => tier.id === next);
				if (found === void 0) return;
				if (currentTier() === found.id) return;
				applyTier(found.id, false);
			};
			window.addEventListener("storage", onStorage);
			let rootMissing = false;
			let rootRetryDelay = 200;
			let rootRetryTimer = null;
			let healFrame = null;
			let resizeFrame = null;
			let observer = null;
			let fallbackTimer = null;
			let widthObserver = null;
			let observedTarget = null;
			function scheduleFrame(cb) {
				return typeof requestAnimationFrame === "function" ? requestAnimationFrame(cb) : window.setTimeout(cb, 0);
			}
			function cancelFrame(id) {
				if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(id);
				else window.clearTimeout(id);
			}
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
					if (guideActive && guideDragging) return;
					const tier = currentTier();
					if (tier === "standard") return;
					applyContentWidth(tier);
					emit();
				});
				widthObserver.observe(target);
			}
			function scheduleRootRetry() {
				if (rootRetryTimer !== null) return;
				rootRetryTimer = window.setTimeout(() => {
					rootRetryTimer = null;
					const tier = currentTier();
					if (tier === "standard") return;
					const prev = roots.cached();
					const root = roots.find();
					if (root === null) {
						rootRetryDelay = Math.min(rootRetryDelay * 2, ROOT_RETRY_MAX_MS);
						scheduleRootRetry();
					} else {
						rootMissing = false;
						rootRetryDelay = 200;
						if (root !== prev) {
							applyContentWidth(tier);
							emit();
						}
						observeWidthTarget(root);
					}
				}, rootRetryDelay);
			}
			function heal(fromObserver) {
				if (guideActive) updateGuideStyle();
				if (guideActive && guideDragging) return;
				const tier = currentTier();
				if (tier === "standard") return;
				const prev = roots.cached();
				let root;
				if (rootMissing || fromObserver) root = roots.find(false);
				else root = roots.find();
				if (root === null) {
					if (!rootMissing) {
						rootMissing = true;
						rootRetryDelay = 200;
					}
					scheduleRootRetry();
					return;
				}
				if (rootMissing) {
					rootMissing = false;
					rootRetryDelay = 200;
				}
				observeWidthTarget(root);
				if (root !== prev) {
					applyContentWidth(tier);
					emit();
				} else if (!fromObserver) {
					applyContentWidth(tier);
					emit();
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
				fallbackTimer = setInterval(() => heal(false), FALLBACK_HEAL_MS);
			}
			const onWindowResize = () => {
				if (resizeFrame !== null) return;
				resizeFrame = scheduleFrame(() => {
					resizeFrame = null;
					if (!(guideActive && guideDragging)) {
						const tier = currentTier();
						if (tier !== "standard") applyContentWidth(tier);
					}
					if (guideActive) guideStyle = computeGuideStyle();
					emit();
				});
			};
			window.addEventListener("resize", onWindowResize);
			snapshot = buildSnapshot();
			const unsubscribeLocale = options.locale.subscribe(() => {
				if (guideActive && !guideDragging && guideMode === "hint") guideText = t("guide.hint");
				emit();
			});
			attach();
			return {
				source: {
					getSnapshot: () => snapshot,
					subscribe(listener) {
						listeners.add(listener);
						return () => {
							listeners.delete(listener);
						};
					}
				},
				actions,
				dispose() {
					unsubscribeLocale();
					stopWaiting();
					if (fallbackTimer !== null) {
						clearInterval(fallbackTimer);
						fallbackTimer = null;
					}
					if (rootRetryTimer !== null) {
						window.clearTimeout(rootRetryTimer);
						rootRetryTimer = null;
					}
					if (guideHideTimer !== null) {
						window.clearTimeout(guideHideTimer);
						guideHideTimer = null;
					}
					if (healFrame !== null) {
						cancelFrame(healFrame);
						healFrame = null;
					}
					if (resizeFrame !== null) {
						cancelFrame(resizeFrame);
						resizeFrame = null;
					}
					if (widthObserver !== null) {
						widthObserver.disconnect();
						widthObserver = null;
						observedTarget = null;
					}
					window.removeEventListener("resize", onWindowResize);
					window.removeEventListener("load", attach);
					window.removeEventListener("storage", onStorage);
					if (observer !== null) observer.disconnect();
					document.removeEventListener("pointerdown", onHandlePointerDown, true);
					document.removeEventListener("pointerup", onHandlePointerUp, true);
					document.removeEventListener("pointercancel", onHandlePointerCancel, true);
					document.removeEventListener("pointermove", onGuidePointerMove, true);
					removeStyles();
					const root = roots.cached();
					if (root !== null) widthTarget(root).style.removeProperty("--dsh-chat-user-width");
					if (preferenceOwned) {
						try {
							if (preferenceWritten !== null && window.localStorage.getItem("dsh.conversation.contentWidth") === preferenceWritten) window.localStorage.removeItem(APP_PREF_KEY);
						} catch {}
						preferenceOwned = false;
						preferenceWritten = null;
					}
					if (collapsedByTier) {
						try {
							if (isSidebarCollapsed()) layout.toggleSidebar();
						} catch {}
						collapsedByTier = false;
					}
					guideHandle = null;
					body().removeAttribute(TIER_ATTR);
					body().removeAttribute(GUIDE_ATTR);
					listeners.clear();
				}
			};
		}
		// src/client/locales.ts
		/** Dictionary namespace owned by this plugin. */
		const NS = "width-tiers";
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
		// src/client/WidthTierPicker.tsx
		/** How long the selection ring stays on the button. */
		const PULSE_MS = 700;
		/** Six horizontal bars; one per tier, lit up to the selected index. */
		function LevelIcon({ tier }) {
			const index = TIERS.findIndex((candidate) => candidate.id === tier);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
				viewBox: "0 0 16 16",
				width: "16",
				height: "16",
				"aria-hidden": "true",
				focusable: "false",
				children: [
					3.5,
					5.3,
					7.1,
					8.9,
					10.7,
					12.5
				].map((width, bar) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
					x: 1.5,
					y: .75 + bar * 2.55,
					width,
					height: 1.6,
					rx: .8,
					fill: "currentColor",
					opacity: bar <= index ? 1 : .3
				}, bar))
			});
		}
		/**
		* Floating tier picker and drag guide, mounted in `shell.overlay`.
		*
		* All width state, persistence and native-handle interception live in the
		* controller; this component only renders the snapshot and dispatches
		* actions. Menu focus, Escape/Tab handling, click-away dismissal and the
		* selection ring are view concerns and stay local here.
		* @param props - snapshot hook and controller actions.
		* @returns the button, menu and guide inside one overlay host element.
		*/
		function WidthTierPicker({ usePicker, actions }) {
			const state = usePicker((snapshot) => snapshot);
			const buttonRef = (0, react.useRef)(null);
			const menuRef = (0, react.useRef)(null);
			const wrapperRef = (0, react.useRef)(null);
			const guideRef = (0, react.useRef)(null);
			const stateRef = (0, react.useRef)(state);
			const [pulsing, setPulsing] = (0, react.useState)(false);
			(0, react.useLayoutEffect)(() => {
				stateRef.current = state;
			}, [state]);
			(0, react.useEffect)(() => {
				if (state.pulse === 0) return;
				setPulsing(false);
				const frame = requestAnimationFrame(() => setPulsing(true));
				const timer = window.setTimeout(() => setPulsing(false), PULSE_MS);
				return () => {
					cancelAnimationFrame(frame);
					window.clearTimeout(timer);
				};
			}, [state.pulse]);
			(0, react.useEffect)(() => {
				if (!state.menuOpen || menuRef.current === null) return;
				const rows = Array.from(menuRef.current.querySelectorAll("button[data-tier]"));
				(rows.find((row) => row.dataset.tier === state.tier) ?? rows[0])?.focus();
			}, [state.menuOpen, state.tier]);
			(0, react.useLayoutEffect)(() => {
				if (!state.guide.active) return;
				const width = guideRef.current?.offsetWidth ?? 0;
				if (width > 0) actions.measureGuide(width);
			}, [
				state.guide.active,
				state.guide.text,
				state.guide.mode,
				actions
			]);
			(0, react.useEffect)(() => {
				const onDocClick = (event) => {
					const target = event.target;
					if (!(target instanceof Node)) return;
					const current = stateRef.current;
					const inside = wrapperRef.current?.contains(target) ?? false;
					if (current.menuOpen && !inside) actions.closeMenu();
					if (current.guide.active && !current.guide.dragging && !inside && !(target instanceof Element && target.closest("[data-width-handle]") !== null)) actions.cancelGuide();
				};
				const onDocKey = (event) => {
					const current = stateRef.current;
					if (event.key === "Escape") {
						if (current.menuOpen) {
							actions.closeMenu();
							buttonRef.current?.focus();
						}
						if (current.guide.active) actions.cancelGuide();
						return;
					}
					if (!current.menuOpen) return;
					if (event.key === "Tab") {
						actions.closeMenu();
						return;
					}
					const rows = Array.from(menuRef.current?.querySelectorAll("button[data-tier]") ?? []);
					if (rows.length === 0) return;
					const active = document.activeElement;
					const index = active === null ? -1 : rows.indexOf(active);
					let next = -1;
					if (event.key === "ArrowDown") next = index < 0 ? 0 : (index + 1) % rows.length;
					else if (event.key === "ArrowUp") next = index < 0 ? rows.length - 1 : (index - 1 + rows.length) % rows.length;
					else if (event.key === "Home") next = 0;
					else if (event.key === "End") next = rows.length - 1;
					if (next < 0) return;
					event.preventDefault();
					rows[next]?.focus();
				};
				document.addEventListener("click", onDocClick);
				document.addEventListener("keydown", onDocKey);
				return () => {
					document.removeEventListener("click", onDocClick);
					document.removeEventListener("keydown", onDocKey);
				};
			}, [actions]);
			const className = [state.button.active ? "active" : "", pulsing ? "pulse" : ""].filter(Boolean).join(" ");
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				ref: wrapperRef,
				"data-dsh-width-tiers-host": "",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						ref: buttonRef,
						type: "button",
						id: "dsh-wide-toggle",
						"aria-haspopup": "menu",
						"aria-expanded": state.menuOpen,
						"aria-label": state.button.ariaLabel,
						title: state.button.title,
						className: className || void 0,
						onClick: () => actions.toggleMenu(),
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(LevelIcon, { tier: state.tier })
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						ref: menuRef,
						id: "dsh-width-menu",
						role: "menu",
						hidden: !state.menuOpen,
						children: state.items.map((item) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
							type: "button",
							role: "menuitemradio",
							"data-tier": item.id,
							tabIndex: -1,
							"aria-checked": item.selected,
							className: item.selected ? "selected" : void 0,
							onClick: () => {
								actions.selectTier(item.id);
								buttonRef.current?.focus();
							},
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dshwm-label",
								children: item.label
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dshwm-value",
								children: item.value
							})]
						}, item.id))
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						ref: guideRef,
						id: "dsh-width-guide",
						"aria-hidden": "true",
						hidden: !state.guide.active,
						"data-mode": state.guide.mode,
						style: state.guide.style,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
							viewBox: "0 0 16 16",
							width: "14",
							height: "14",
							"aria-hidden": "true",
							focusable: "false",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
								d: "M6 3 2 8l4 5M10 3l4 5-4 5",
								fill: "none",
								stroke: "currentColor",
								strokeWidth: 1.5,
								strokeLinecap: "round",
								strokeLinejoin: "round"
							})
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dshwg-text",
							children: state.guide.text
						})]
					})
				]
			});
		}
		// src/client/index.ts
		/** Services required by the browser bundle. */
		const inject = [
			"slots",
			"layout",
			"locale"
		];
		/**
		* Client plugin body: register the dictionaries, start the width-tier
		* controller, then contribute the React picker to the frame-wide overlay
		* layer. The controller owns the width axis and persistence; the slot entry
		* owns only its own render lifetime.
		* @param ctx - client root context (slots + layout + locale injected).
		*/
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "dsh-width-tiers: dictionaries");
			const t = ctx.locale.bind(NS);
			const controller = createWidthTiers({
				layout: ctx.layout,
				locale: ctx.locale,
				t
			});
			ctx.effect(() => () => controller.dispose(), "dsh-width-tiers: controller");
			ctx.slots.inject("shell.overlay", () => ctx.slots.register({
				name: "shell.overlay",
				id: "width-tiers",
				order: 100,
				locale: NS,
				inject: () => ({
					hooks: { picker: controller.source },
					actions: controller.actions
				})
			}, WidthTierPicker));
		}
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
