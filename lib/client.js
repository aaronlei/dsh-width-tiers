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
		 * `--dsh-chat-content-width`, which 0.1.7-alpha.1 resolves as
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
		 *   中等 medium    960px  (sidebar untouched)
		 *   宽   wide      1280px (sidebar untouched)
		 *   超宽 ultra     1400px (sidebar untouched)
		 *   全宽 full      column max (sidebar collapsed to the icon rail)
		 *   自定义 custom  user-dragged width (plugin hands width over to
		 *                  the app's native handles; the dragged value stays
		 *                  re-selectable from the menu)
		 *
		 *  - Panels are driven through the layout service (ctx.layout), never
		 *    by simulating clicks.
		 *  - The sidebar is only ever collapsed by the `full` tier, through the
		 *    app's own toggle — never force-hidden, never locked. Going back to
		 *    `standard` restores it only if this plugin collapsed it.
		 *  - Non-standard tiers close the right panel (rightbar, self-heal
		 *    while active); `standard` leaves everything to the app.
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
			"button.aria": "Chat width tier: {label} ({value}). Click to choose a tier.",
			"button.title.summary": "Chat width tier: {label} ({value})",
			"button.title.hint": "Click to choose: {list}"
		};
		//#endregion

		const TIERS = [
			{ id: "standard", key: "tier.standard", value: "748px" },
			{ id: "medium", key: "tier.medium", value: "960px" },
			{ id: "wide", key: "tier.wide", value: "1280px" },
			{ id: "ultra", key: "tier.ultra", value: "1400px" },
			{ id: "full", key: "tier.full", value: "100%" },
			/* Reached only by dragging a native width handle; the displayed
			 * value is the dragged width, resolved at render time. */
			{ id: "custom", key: "tier.custom", value: null }
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
			"@keyframes dsh-wide-pulse{0%{box-shadow:0 0 0 0 color-mix(in srgb,var(--dsw-alias-state-business-primary) 60%,transparent)}100%{box-shadow:0 0 0 14px transparent}}",
			"#dsh-width-menu{position:fixed;right:20px;bottom:264px;z-index:1000;min-width:196px;padding:6px;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-specific-menu);box-shadow:0 8px 28px rgba(0,0,0,.24);display:flex;flex-direction:column;gap:2px}",
			"#dsh-width-menu[hidden]{display:none}",
			"#dsh-width-menu button{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 12px;border:none;border-radius:8px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;line-height:18px;text-align:left;cursor:pointer}",
			"#dsh-width-menu button:hover{background:var(--dsw-alias-interactive-bg-hover)}",
			"#dsh-width-menu button.disabled{opacity:.45;cursor:default;pointer-events:none}",
			"#dsh-width-menu button.selected{background:var(--dsw-alias-interactive-bg-hover-solid);color:var(--dsw-alias-state-business-primary)}",
			"#dsh-width-menu .dshwm-value{color:var(--dsw-alias-label-tertiary);font-size:12px}",
			"#dsh-width-menu button.selected .dshwm-value{color:var(--dsw-alias-state-business-primary)}"
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

				function scanWidthRoot() {
					const all = document.querySelectorAll("[class]");
					for (let i = 0; i < all.length; i++) {
						if (hasWidthVar(all[i])) {
							widthRoot = all[i];
							recordWidthPath(widthRoot);
							return widthRoot;
						}
					}
					widthRoot = null;
					widthPath = null;
					return null;
				}

				function findWidthRoot(allowScan) {
					if (widthRoot !== null && document.contains(widthRoot)) return widthRoot;
					if (widthPath !== null) {
						let el = document.body;
						for (let i = 0; i < widthPath.length; i++) {
							el = el.children[widthPath[i]];
							if (!el) break;
						}
						if (el && el !== widthRoot && document.contains(el) && hasWidthVar(el)) {
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

				/* Resolve a tier to the px the app would clamp it to
				 * (resolveContentWidth: max = column - handle budget), or
				 * null when the tier leaves the width to the app. */
				function tierPx(tier, root) {
					const cap = Math.max(CONTENT_MIN_PX, root.offsetWidth - CONTENT_EDGE_BUDGET_PX);
					switch (tier) {
						case "medium": return Math.min(960, cap);
						case "wide": return Math.min(1280, cap);
						case "ultra": return Math.min(1400, cap);
						case "full": return cap;
						case "custom": {
							const dragged = readStoredNumber(CUSTOM_KEY);
							return dragged === null ? null : Math.min(dragged, cap);
						}
						default: return null; /* standard: app default */
					}
				}

				function applyContentWidth(tier) {
					const root = findWidthRoot();
					if (root === null) return;
					const target = widthTarget(root);
					/* custom before the first drag has no width of its own —
					 * leave whatever the app last published in place. */
					if (tier === "custom" && readStoredNumber(CUSTOM_KEY) === null) return;
					const px = tierPx(tier, root);
					if (px === null) {
						if (target.style.getPropertyValue("--dsh-chat-user-width") !== "") {
							target.style.removeProperty("--dsh-chat-user-width");
							try {
								window.localStorage.removeItem(APP_PREF_KEY);
							} catch (e) {
								/* ignore */
							}
						}
						return;
					}
					/* Mirror into the app's preference so window resizes and
					 * conversation remounts re-clamp through the app's own
					 * publish cycle instead of relying on plugin healing. */
					const next = String(Math.round(px));
					if (target.style.getPropertyValue("--dsh-chat-user-width") !== next + "px") {
						target.style.setProperty("--dsh-chat-user-width", next + "px");
					}
					try {
						if (window.localStorage.getItem(APP_PREF_KEY) !== next) {
							window.localStorage.setItem(APP_PREF_KEY, next);
						}
					} catch (e) {
						/* ignore */
					}
				}

				/* true while the CURRENT tier is the one that collapsed the sidebar */
				let collapsedByTier = false;

				function applyTier(tier) {
					body().setAttribute("data-dsh-width", tier);
					try {
						window.localStorage.setItem(KEY, tier);
					} catch (e) {
						/* storage unavailable — state still applies this session */
					}
					applyContentWidth(tier);
					if (tier === "full") {
						if (!isSidebarCollapsed()) {
							collapseSidebar();
							collapsedByTier = true;
						} else {
							collapsedByTier = false;
						}
					} else if (tier === "standard") {
						if (collapsedByTier && isSidebarCollapsed()) expandSidebar();
						collapsedByTier = false;
					} else {
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
					const widths = [3.5, 5.5, 7.5, 10, 13];
					let bars = "";
					for (let b = 0; b < 5; b++) {
						const y = 0.5 + b * 3;
						bars += `<rect x="1.5" y="${y}" width="${widths[b]}" height="2" rx="1" fill="currentColor" opacity="${b <= idx ? 1 : 0.3}"/>`;
					}
					return `<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">${bars}</svg>`;
				}

				/* Display value for a tier; `custom` shows the dragged width. */
				function tierValueText(tierId) {
					const def = tierOf(tierId);
					if (def.value !== null) return def.value;
					const px = readStoredNumber(CUSTOM_KEY);
					return px === null ? "—" : `${Math.round(px)}px`;
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
				menu.setAttribute("role", "menu");
				menu.hidden = true;

				for (const def of TIERS) {
					const item = document.createElement("button");
					item.type = "button";
					item.setAttribute("role", "menuitemradio");
					item.setAttribute("data-tier", def.id);
					item.innerHTML = `<span class="dshwm-label">${t(def.key)}</span><span class="dshwm-value">${tierValueText(def.id)}</span>`;
					item.addEventListener("click", (e) => {
						if (e && e.stopPropagation) e.stopPropagation();
						if (item.classList.contains("disabled")) return;
						applyTier(def.id);
						hideMenu();
					});
					menu.appendChild(item);
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
						if (labelEl) labelEl.textContent = t(tierOf(id).key);
						const valueEl = items[i].querySelector(".dshwm-value");
						if (valueEl) valueEl.textContent = tierValueText(id);
						/* custom is inert until the user has dragged once */
						const disabled = id === "custom" && readStoredNumber(CUSTOM_KEY) === null;
						items[i].classList.toggle("disabled", disabled);
						items[i].setAttribute("aria-disabled", String(disabled));
					}
				}

				function showMenu() {
					menu.hidden = false;
					btn.setAttribute("aria-expanded", "true");
					syncMenu();
				}

				function hideMenu() {
					menu.hidden = true;
					btn.setAttribute("aria-expanded", "false");
				}

				btn.addEventListener("click", (e) => {
					if (e && e.stopPropagation) e.stopPropagation();
					if (menu.hidden) showMenu();
					else hideMenu();
				});

				const onDocClick = (e) => {
					if (menu.hidden) return;
					if (e.target !== btn && !menu.contains(e.target)) hideMenu();
				};
				const onDocKey = (e) => {
					if (e.key === "Escape" && !menu.hidden) hideMenu();
				};
				document.addEventListener("click", onDocClick);
				document.addEventListener("keydown", onDocKey);

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
					if (!isHandleEvent(e) || currentTier() === "custom") return;
					body().setAttribute("data-dsh-width", "custom");
					try {
						window.localStorage.setItem(KEY, "custom");
					} catch (err) {
						/* ignore */
					}
					collapsedByTier = false;
					syncButton();
					syncMenu();
				};

				const onHandlePointerUp = (e) => {
					if (!isHandleEvent(e)) return;
					const root = findWidthRoot();
					if (root === null) return;
					const px = Number.parseFloat(
						widthTarget(root).style.getPropertyValue("--dsh-chat-user-width")
					);
					if (!Number.isFinite(px) || px <= 0) return;
					try {
						window.localStorage.setItem(CUSTOM_KEY, String(Math.round(px)));
					} catch (err) {
						/* ignore */
					}
					syncButton();
					syncMenu();
				};
				document.addEventListener("pointerdown", onHandlePointerDown, true);
				document.addEventListener("pointerup", onHandlePointerUp, true);

				/* ---- feedback ring so every selection is visibly answered ---- */
				function pulse() {
					btn.classList.remove("pulse");
					void btn.offsetWidth;
					btn.classList.add("pulse");
					window.setTimeout(() => btn.classList.remove("pulse"), 700);
				}

				/* ---- re-render localized copy when the app language changes ---- */
				const renderTexts = () => {
					syncButton();
					syncMenu();
				};
				const unsubscribeLocale = ctx.locale.subscribe(renderTexts);

				/* ---- attach once the app shell has mounted ---- */
				let attached = false;

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
					try {
						window.localStorage.removeItem(OLD_KEY);
					} catch (e) {
						/* ignore */
					}
					body().appendChild(btn);
					body().appendChild(menu);
					syncButton();
					const saved = getSavedTier();
					if (saved !== "standard") applyTier(saved);
					startHealing();
				}

				const readyTimer = setInterval(attach, 300);
				window.addEventListener("load", attach);
				const timeout = window.setTimeout(() => {
					clearInterval(readyTimer);
					attach();
				}, READY_TIMEOUT_MS);

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
				let observer = null;
				let fallbackTimer = null;

				const scheduleFrame = typeof requestAnimationFrame === "function"
					? (cb) => { healFrame = requestAnimationFrame(cb); }
					: (cb) => { healFrame = window.setTimeout(cb, 0); };
				const cancelFrame = typeof cancelAnimationFrame === "function"
					? (id) => cancelAnimationFrame(id)
					: (id) => window.clearTimeout(id);

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
							if (root !== prev) applyContentWidth(tier);
						}
					}, rootRetryDelay);
				}

				function heal(fromObserver) {
					const tier = currentTier();
					if (tier === "standard") return;
					const prev = widthRoot;
					let root;
					if (rootMissing) {
						/* Mid-remount: a mutation-driven heal only walks the
						 * recorded path (O(depth)) — the backoff retry owns
						 * full scans until the new root exists. */
						root = fromObserver ? findWidthRoot(false) : findWidthRoot();
					} else {
						root = findWidthRoot();
					}
					if (root === null) {
						if (!rootMissing) {
							rootMissing = true;
							rootRetryDelay = ROOT_RETRY_MIN_MS;
							scheduleRootRetry();
						}
						return;
					}
					if (rootMissing) {
						rootMissing = false;
						rootRetryDelay = ROOT_RETRY_MIN_MS;
					}
					if (root !== prev) applyContentWidth(tier);
					/* full tracks the live column: after the sidebar collapse
					 * animation settles the column widens, and the width must
					 * follow (applyContentWidth is diff-checked, so steady
					 * state writes nothing). */
					if (tier === "full") applyContentWidth("full");
				}

				function startHealing() {
					if (typeof MutationObserver !== "undefined") {
						observer = new MutationObserver(() => {
							if (healFrame !== null) return;
							scheduleFrame(() => {
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
					 * observer misses something — cheap: no scan while the
					 * cached root is alive. */
					fallbackTimer = setInterval(() => heal(false), FALLBACK_HEAL_MS);
				}

				/* ---- disposer ---- */
				return () => {
					unsubscribeLocale();
					clearInterval(readyTimer);
					clearInterval(fallbackTimer);
					clearTimeout(timeout);
					clearTimeout(rootRetryTimer);
					if (healFrame !== null) cancelFrame(healFrame);
					if (observer !== null) observer.disconnect();
					document.removeEventListener("click", onDocClick);
					document.removeEventListener("keydown", onDocKey);
					document.removeEventListener("pointerdown", onHandlePointerDown, true);
					document.removeEventListener("pointerup", onHandlePointerUp, true);
					if (btn.parentNode) btn.parentNode.removeChild(btn);
					if (menu.parentNode) menu.parentNode.removeChild(menu);
					if (styleTag.parentNode) styleTag.parentNode.removeChild(styleTag);
					/* Hand the width back to the app default; the app's own
					 * preference (which this plugin mirrors) stays so the last
					 * width survives a plugin reload — matching native-drag
					 * semantics. */
					if (widthRoot !== null) {
						widthTarget(widthRoot).style.removeProperty("--dsh-chat-user-width");
					}
					body().removeAttribute("data-dsh-width");
				};
			}, "dsh-width-tiers: ui");
		}
		//#endregion

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
