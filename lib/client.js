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
		 * The app hard-codes a readable content width
		 * (`--dsh-chat-content-width: 748px` on the conversation root), which
		 * caps the message column — and every table inside it — at 748px no
		 * matter how wide the panels are. This plugin overrides that variable
		 * per tier and adds a floating picker button:
		 *
		 *   标准 standard  748px  (app default, no override)
		 *   中等 medium    960px  (sidebar untouched)
		 *   宽   wide      1280px (sidebar untouched)
		 *   超宽 ultra     1400px (sidebar untouched)
		 *   全宽 full      100%   (sidebar collapsed to the icon rail)
		 *
		 * Design notes:
		 *  - The element that defines `--dsh-chat-content-width` is located at
		 *    runtime (first element whose computed value is non-empty) and the
		 *    tier is applied as an INLINE override on it — no hashed class
		 *    names, survives bundle upgrades. Re-detected if it remounts.
		 *  - Panels are driven through the layout service (ctx.layout), never
		 *    by simulating clicks.
		 *  - The sidebar is only ever collapsed by the `full` tier, through the
		 *    app's own toggle — never force-hidden, never locked. Going back to
		 *    `standard` restores it only if this plugin collapsed it.
		 *  - Non-standard tiers close the details panel (self-heal while
		 *    active); `standard` leaves everything to the app.
		 *  - The chosen tier persists in localStorage and is restored on the
		 *    next visit.
		 *  - All copy is localized through the app's locale service: tier
		 *    labels and the button's aria/title follow Settings → Language
		 *    (zh / en, browser-derived fallback) and re-render on switch.
		 */
		const KEY = "dsh.widthTier";
		const OLD_KEY = "dsh.wide";
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
			{ id: "full", key: "tier.full", value: "100%" }
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

				/* The AppFrame sets data-sidebar-collapsed / data-details-collapsed
				 * on the frame element after each render — use them as truth. */
				function isSidebarCollapsed() {
					return document.querySelector("[data-sidebar-collapsed]") !== null;
				}

				function isDetailsOpen() {
					return document.querySelector("[data-details-collapsed]") === null;
				}

				function collapseSidebar() {
					if (!isSidebarCollapsed()) layout.toggleSidebar();
				}

				function expandSidebar() {
					if (isSidebarCollapsed()) layout.toggleSidebar();
				}

				function closeDetails() {
					if (isDetailsOpen()) layout.closeDetails();
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

				function tierWidth(tier) {
					switch (tier) {
						case "medium": return "960px";
						case "wide": return "1280px";
						case "ultra": return "1400px";
						case "full": return "100%";
						default: return null; /* standard: remove the override */
					}
				}

				function applyContentWidth(tier) {
					const root = findWidthRoot();
					if (root === null) return;
					const w = tierWidth(tier);
					if (w === null) root.style.removeProperty("--dsh-chat-content-width");
					else root.style.setProperty("--dsh-chat-content-width", w, "important");
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
					if (tier !== "standard") closeDetails();
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

				function syncButton() {
					const tier = currentTier();
					const def = tierOf(tier);
					const label = t(def.key);
					const summary = t("button.title.summary", { label, value: def.value });
					const hint = t("button.title.hint", {
						list: TIERS.map((tierDef) => `${t(tierDef.key)} ${tierDef.value}`).join(" / ")
					});
					btn.innerHTML = barIcon(tier);
					btn.classList.toggle("active", tier !== "standard");
					btn.setAttribute("aria-label", t("button.aria", { label, value: def.value }));
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
					item.innerHTML = `<span class="dshwm-label">${t(def.key)}</span><span class="dshwm-value">${def.value}</span>`;
					item.addEventListener("click", (e) => {
						if (e && e.stopPropagation) e.stopPropagation();
						applyTier(def.id);
						hideMenu();
					});
					menu.appendChild(item);
				}

				function syncMenu() {
					const tier = currentTier();
					const items = menu.querySelectorAll("button[data-tier]");
					for (let i = 0; i < items.length; i++) {
						const on = items[i].getAttribute("data-tier") === tier;
						items[i].classList.toggle("selected", on);
						items[i].setAttribute("aria-checked", String(on));
						const labelEl = items[i].querySelector(".dshwm-label");
						if (labelEl) labelEl.textContent = t(tierOf(items[i].getAttribute("data-tier")).key);
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

				function attach() {
					if (attached || !body()) return;
					if (document.querySelector("[data-sidebar-collapsed], [data-details-collapsed]") === null) return;
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

				/* ---- self-heal: keep the details panel closed for non-standard
				 * tiers. The sidebar is never managed here — the user may expand
				 * it any time. Driven by DOM mutations, scheduled on the next
				 * animation frame (before the browser paints) instead of a fixed
				 * hot loop: conversation switches remount the chat tree, and the
				 * width override must land on the fresh root before its first
				 * paint — otherwise the default width flashes for a frame.
				 * While the new root has not appeared yet (mid-remount), full
				 * scans are owned by a backoff retry; mutation-driven heals only
				 * try the cheap path walk so DOM churn cannot storm. ---- */
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
					closeDetails();
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
							attributeFilter: ["data-details-collapsed", "data-sidebar-collapsed"]
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
					if (btn.parentNode) btn.parentNode.removeChild(btn);
					if (menu.parentNode) menu.parentNode.removeChild(menu);
					if (styleTag.parentNode) styleTag.parentNode.removeChild(styleTag);
					if (widthRoot !== null) widthRoot.style.removeProperty("--dsh-chat-content-width");
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
