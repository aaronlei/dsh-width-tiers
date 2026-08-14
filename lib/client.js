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
		 */
		const KEY = "dsh.widthTier";
		const OLD_KEY = "dsh.wide";
		const SELF_HEAL_MS = 1000;
		const READY_TIMEOUT_MS = 30000;

		const TIERS = [
			{ id: "standard", label: "标准", value: "748px", note: "默认阅读宽度" },
			{ id: "medium", label: "中等", value: "960px" },
			{ id: "wide", label: "宽", value: "1280px" },
			{ id: "ultra", label: "超宽", value: "1400px" },
			{ id: "full", label: "全宽", value: "100%", note: "占满窗口" }
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
			"#dsh-wide-toggle{position:fixed;right:20px;bottom:76px;z-index:999;display:flex;align-items:center;justify-content:center;width:36px;height:36px;padding:0;border:1px solid var(--dsw-alias-border-l2);border-radius:50%;background:var(--dsw-alias-button-floating-fill);color:var(--dsw-alias-label-secondary);box-shadow:0 2px 8px rgba(0,0,0,.18);cursor:pointer;opacity:.72;transition:opacity .2s ease,transform .2s ease,background .2s ease,color .2s ease}",
			"#dsh-wide-toggle:hover{opacity:1;transform:scale(1.08)}",
			"#dsh-wide-toggle:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:2px}",
			"#dsh-wide-toggle.active{background:var(--dsw-alias-state-business-primary);border-color:transparent;color:var(--dsw-static-neutral-00);opacity:1}",
			"#dsh-wide-toggle.pulse{animation:dsh-wide-pulse .65s ease-out}",
			"@keyframes dsh-wide-pulse{0%{box-shadow:0 0 0 0 color-mix(in srgb,var(--dsw-alias-state-business-primary) 60%,transparent)}100%{box-shadow:0 0 0 14px transparent}}",
			"#dsh-width-menu{position:fixed;right:20px;bottom:124px;z-index:1000;min-width:196px;padding:6px;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-specific-menu);box-shadow:0 8px 28px rgba(0,0,0,.24);display:flex;flex-direction:column;gap:2px}",
			"#dsh-width-menu[hidden]{display:none}",
			"#dsh-width-menu button{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 12px;border:none;border-radius:8px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;line-height:18px;text-align:left;cursor:pointer}",
			"#dsh-width-menu button:hover{background:var(--dsw-alias-interactive-bg-hover)}",
			"#dsh-width-menu button.selected{background:var(--dsw-alias-interactive-bg-hover-solid);color:var(--dsw-alias-state-business-primary)}",
			"#dsh-width-menu .dshwm-value{color:var(--dsw-alias-label-tertiary);font-size:12px}",
			"#dsh-width-menu button.selected .dshwm-value{color:var(--dsw-alias-state-business-primary)}"
		].join("");
		//#endregion

		/** Services required by the browser bundle. */
		const inject = ["layout"];

		/**
		 * Client plugin body: inject the styles, build the picker button and
		 * menu, and drive the width tiers through the layout service.
		 * @param ctx - client root context (layout injected).
		 */
		function apply(ctx) {
			ctx.effect(() => {
				if (typeof document === "undefined") return;

				const styleTag = document.createElement("style");
				styleTag.dataset.plugin = "dsh-width-tiers";
				styleTag.textContent = css;
				document.head.appendChild(styleTag);

				const layout = ctx.layout;

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
				 * Cached; re-scanned whenever the cached node is gone. */
				let widthRoot = null;

				function findWidthRoot() {
					if (widthRoot !== null && document.contains(widthRoot)) return widthRoot;
					widthRoot = null;
					const all = document.querySelectorAll("[class]");
					for (let i = 0; i < all.length; i++) {
						const v = getComputedStyle(all[i])
							.getPropertyValue("--dsh-chat-content-width")
							.trim();
						if (v) {
							widthRoot = all[i];
							return widthRoot;
						}
					}
					return null;
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
					const t = tierOf(tier);
					btn.innerHTML = barIcon(tier);
					btn.classList.toggle("active", tier !== "standard");
					btn.setAttribute("aria-label", `对话区宽度档位：${t.label}（${t.value}），点击选择档位`);
					btn.title =
						`对话区宽度档位：${t.label}（${t.value}）\n` +
						"点击选择：标准 748px / 中等 960px / 宽 1280px / 超宽 1400px / 全宽 100%";
				}

				/* ---- tier menu ---- */
				const menu = document.createElement("div");
				menu.id = "dsh-width-menu";
				menu.setAttribute("role", "menu");
				menu.hidden = true;

				for (const t of TIERS) {
					const item = document.createElement("button");
					item.type = "button";
					item.setAttribute("role", "menuitemradio");
					item.setAttribute("data-tier", t.id);
					item.innerHTML = `<span class="dshwm-label">${t.label}</span><span class="dshwm-value">${t.value}</span>`;
					item.addEventListener("click", (e) => {
						if (e && e.stopPropagation) e.stopPropagation();
						applyTier(t.id);
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
				}

				const readyTimer = setInterval(attach, 300);
				window.addEventListener("load", attach);
				const timeout = window.setTimeout(() => {
					clearInterval(readyTimer);
					attach();
				}, READY_TIMEOUT_MS);

				/* ---- self-heal: keep the details panel closed for non-standard
				 * tiers. The sidebar is never managed here — the user may expand
				 * it any time. ---- */
				const healTimer = setInterval(() => {
					const tier = currentTier();
					if (tier === "standard") return;
					closeDetails();
					if (widthRoot !== null && !document.contains(widthRoot)) findWidthRoot();
				}, SELF_HEAL_MS);

				/* ---- disposer ---- */
				return () => {
					clearInterval(readyTimer);
					clearInterval(healTimer);
					clearTimeout(timeout);
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
