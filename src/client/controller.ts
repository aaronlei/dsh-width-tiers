import {
	APP_PREF_KEY,
	CUSTOM_KEY,
	FALLBACK_HEAL_MS,
	GUIDE_ATTR,
	KEY,
	NOMINAL_WIDTH_PX,
	OLD_KEY,
	READY_TIMEOUT_MS,
	ROOT_RETRY_MAX_MS,
	ROOT_RETRY_MIN_MS,
	TIER_ATTR,
} from "./constants.ts";
import {
	appliedTierPx,
	defaultWidthPx,
	fullWidthPx,
	getSavedTier as readSavedTier,
	readStoredNumber,
	TIERS,
	tierOf,
	tierTargetPx,
	type TierId,
} from "./model.ts";
import { installStyles } from "./styles.ts";
import {
	createWidthRootLocator,
	liveWidthPx,
	widthTarget,
} from "./width-root.ts";
import type { TFunction } from "./locales.ts";

/** Layout service slice used by the controller. */
export interface LayoutService {
	toggleSidebar(): void;
}

/** Locale service slice used by the controller (language-change wakeups). */
export interface LocaleSubscription {
	subscribe(listener: () => void): () => void;
}

/** Controller inputs, resolved by the plugin entry from the Cordis context. */
export interface WidthTiersOptions {
	/** Host element inside the frame-wide overlay layer. */
	mount: HTMLElement;
	layout: LayoutService;
	locale: LocaleSubscription;
	t: TFunction;
}

/** Resource handle returned to the plugin entry's effect. */
export interface WidthTiersController {
	dispose(): void;
}

/**
 * Own the width-tier picker: inject the stylesheet, build the floating button
 * and menu, drive the app's native width axis, and clean every resource up.
 * @param options - layout service, locale subscription and translate function.
 * @returns the disposer handle registered by the plugin entry.
 */
export function createWidthTiers(options: WidthTiersOptions): WidthTiersController {
	const { layout, mount, t } = options;
	const roots = createWidthRootLocator();
	const removeStyles = installStyles();

	/* ---- helpers ---- */
	const body = (): HTMLElement => document.body;

	function currentTier(): TierId {
		const value = body().getAttribute(TIER_ATTR);
		const found = value === null ? undefined : TIERS.find((tier) => tier.id === value);
		return found === undefined ? "standard" : found.id;
	}

	function getSavedTier(): TierId {
		try {
			return readSavedTier(window.localStorage);
		} catch {
			return "standard";
		}
	}

	function readNumber(key: string): number | null {
		try {
			return readStoredNumber(window.localStorage, key);
		} catch {
			return null;
		}
	}

	/* The AppFrame sets data-sidebar-collapsed on the frame element
	 * (conditionally, only while collapsed) after each render. */
	function isSidebarCollapsed(): boolean {
		return document.querySelector("[data-sidebar-collapsed]") !== null;
	}

	/* NOTE: the 1.0.x "close the right panel on non-standard tiers" self-heal
	 * is gone on purpose. On 0.1.7 the rightbar panel lives in its own seat:
	 * closeRightbar() only retracts the grid TRACK (rightbarTrack=false) while
	 * the seat stays expanded, so the panel keeps rendering as an OVERLAY
	 * pinned to the frame's right edge — hanging over and covering the
	 * conversation. The plugin must never touch the rightbar; the app's own
	 * width axis already yields space to the panel. */
	function collapseSidebar(): void {
		if (!isSidebarCollapsed()) layout.toggleSidebar();
	}

	function expandSidebar(): void {
		if (isSidebarCollapsed()) layout.toggleSidebar();
	}

	/* Whether this plugin wrote the app's width preference. Native drags also
	 * write it, so unload only removes a value this plugin owns. */
	let preferenceOwned = false;
	let preferenceWritten: string | null = null;
	let pulseTimer: number | null = null;

	function applyContentWidth(tier: TierId): void {
		const root = roots.find();
		if (root === null) return;
		const target = widthTarget(root);
		/* custom before the first drag has no width of its own — leave whatever
		 * the app last published in place. */
		if (tier === "custom" && readNumber(CUSTOM_KEY) === null) return;
		const targetPx = tierTargetPx(tier, root.offsetWidth, readNumber(CUSTOM_KEY));
		if (targetPx === null) {
			/* standard: hand the width back to the app default. The app's width
			 * preference is cleared as well; standard is deliberately the reset
			 * to the app's default width. */
			if (
				target.style.getPropertyValue("--dsh-chat-user-width") !== "" ||
				preferenceOwned
			) {
				target.style.removeProperty("--dsh-chat-user-width");
				try {
					window.localStorage.removeItem(APP_PREF_KEY);
				} catch {
					/* ignore */
				}
				preferenceOwned = false;
				preferenceWritten = null;
			}
			return;
		}
		const laidOut = root.offsetWidth > 0;
		/* `full` derives its target from the live column; without a layout box
		 * it would collapse to the 640px floor and pin a narrow width. Wait for
		 * the fallback/resize pass. */
		if (!laidOut && tier === "full") return;
		if (laidOut) {
			const px = appliedTierPx(tier, root.offsetWidth, readNumber(CUSTOM_KEY));
			if (px !== null) {
				const next = String(Math.round(px));
				if (target.style.getPropertyValue("--dsh-chat-user-width") !== next + "px") {
					target.style.setProperty("--dsh-chat-user-width", next + "px");
				}
			}
		}
		/* Persist the unclamped target even while the root is not laid out
		 * (fixed tiers / recorded custom width do not depend on the column). The
		 * app clamps it for display and restores it after a resize / remount. */
		const preference = String(Math.round(targetPx));
		try {
			if (window.localStorage.getItem(APP_PREF_KEY) !== preference) {
				window.localStorage.setItem(APP_PREF_KEY, preference);
				preferenceOwned = true;
				preferenceWritten = preference;
			}
		} catch {
			/* ignore */
		}
	}

	/* true while the CURRENT tier is the one that collapsed the sidebar */
	let collapsedByTier = false;

	/* `persist` is false when another tab already wrote the tier: adopting it
	 * must not write localStorage again. */
	function applyTier(tier: TierId, persist = true): void {
		body().setAttribute(TIER_ATTR, tier);
		if (persist) {
			try {
				window.localStorage.setItem(KEY, tier);
			} catch {
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
			/* the user (or another panel) expanded it — the plugin no longer
			 * owns the collapsed state */
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

	function barIcon(tier: TierId): string {
		let idx = 0;
		for (let i = 0; i < TIERS.length; i++) {
			if (TIERS[i].id === tier) idx = i;
		}
		/* One bar per tier so full (5 bars) and custom (6 bars, all lit)
		 * remain distinguishable. */
		const widths = [3.5, 5.3, 7.1, 8.9, 10.7, 12.5];
		let bars = "";
		for (let b = 0; b < TIERS.length; b++) {
			const y = 0.75 + b * 2.55;
			bars += `<rect x="1.5" y="${y}" width="${widths[b]}" height="1.6" rx="0.8" fill="currentColor" opacity="${b <= idx ? 1 : 0.3}"/>`;
		}
		return `<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">${bars}</svg>`;
	}

	/* Value shown in the picker. Fixed tiers advertise their nominal px;
	 * standard and full are inherently relative to the current column, so they
	 * show the px the app resolves right now (full is the column's maximum,
	 * not a word). */
	function tierValueText(tierId: string): string {
		switch (tierId) {
			case "standard": {
				const root = roots.find();
				if (root === null) return "—";
				return `${Math.round(defaultWidthPx(root.offsetWidth))}px`;
			}
			case "medium":
			case "wide":
			case "ultra":
				return `${NOMINAL_WIDTH_PX[tierId]}px`;
			case "full": {
				const root = roots.find();
				if (root === null) return "—";
				return `${Math.round(fullWidthPx(root.offsetWidth))}px`;
			}
			case "custom": {
				const dragged = readNumber(CUSTOM_KEY);
				return dragged === null ? t("value.custom.unset") : `${Math.round(dragged)}px`;
			}
			default:
				return "—";
		}
	}

	function syncButton(): void {
		const tier = currentTier();
		const def = tierOf(tier);
		const label = t(def.key);
		const value = tierValueText(tier);
		const summary = t("button.title.summary", { label, value });
		const hint = t("button.title.hint", {
			list: TIERS.map((tierDef) => `${t(tierDef.key)} ${tierValueText(tierDef.id)}`).join(" / "),
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
		/* Roving focus: the menu is opened by focusing one item, and
		 * ArrowUp/Down/Home/End move between items. */
		item.tabIndex = -1;
		item.innerHTML = `<span class="dshwm-label">${t(def.key)}</span><span class="dshwm-value">${tierValueText(def.id)}</span>`;
		item.addEventListener("click", (e) => {
			e.stopPropagation();
			/* Custom before the first drag has no width of its own: open the
			 * right-edge guide instead of applying a value. */
			if (def.id === "custom" && readNumber(CUSTOM_KEY) === null) {
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

	/* Write only on change: syncMenu also runs on window resizes, and untouched
	 * text should not churn the DOM (the plugin's own MutationObserver watches
	 * childList). */
	function setText(el: Element | null, text: string): void {
		if (el !== null && el.textContent !== text) el.textContent = text;
	}

	function syncMenu(): void {
		const tier = currentTier();
		const items = menu.querySelectorAll<HTMLButtonElement>("button[data-tier]");
		for (let i = 0; i < items.length; i++) {
			const item = items[i];
			const id = item.getAttribute("data-tier") ?? "";
			const on = id === tier;
			item.classList.toggle("selected", on);
			item.setAttribute("aria-checked", String(on));
			const labelEl = item.querySelector(".dshwm-label");
			setText(labelEl, t(tierOf(id).key));
			const valueEl = item.querySelector(".dshwm-value");
			setText(valueEl, tierValueText(id));
		}
	}

	function menuItems(): HTMLButtonElement[] {
		return Array.from(menu.querySelectorAll<HTMLButtonElement>("button[data-tier]"));
	}

	function showMenu(): void {
		menu.hidden = false;
		btn.setAttribute("aria-expanded", "true");
		syncMenu();
		const items = menuItems();
		const selected =
			items.find((item) => item.getAttribute("data-tier") === currentTier()) ?? items[0];
		if (selected && typeof selected.focus === "function") selected.focus();
	}

	/* restoreFocus is true for Escape / item selection, false for a click-away
	 * so the click target keeps focus. */
	function hideMenu(restoreFocus: boolean): void {
		const hadFocus = menu.contains(document.activeElement);
		menu.hidden = true;
		btn.setAttribute("aria-expanded", "false");
		if (restoreFocus && hadFocus && typeof btn.focus === "function") btn.focus();
	}

	btn.addEventListener("click", (e) => {
		e.stopPropagation();
		if (menu.hidden) showMenu();
		else hideMenu(true);
	});

	const onDocClick = (e: MouseEvent): void => {
		const target = e.target as Node | null;
		if (!menu.hidden && e.target !== btn && !menu.contains(target)) hideMenu(false);
		/* Clicking anywhere but the guide's handle cancels a pending custom
		 * guide and restores the previous tier. */
		if (
			guideActive &&
			!guideDragging &&
			e.target !== btn &&
			!menu.contains(target) &&
			!isHandleEvent(e)
		) {
			endGuide(true);
		}
	};
	const onDocKey = (e: KeyboardEvent): void => {
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
		const current = items.indexOf(document.activeElement as HTMLButtonElement);
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
	 * A first-time `custom` pick has no recorded width. Instead of silently
	 * keeping the current width, point at the app's right-edge width handle and
	 * show the live transcript width while the user drags. The guide never
	 * writes the width itself: the app's native drag does (and wins the
	 * cascade), and the plugin only records the settled value on release. */
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
	/* true while the bubble came from picking custom in the menu (its cancel
	 * path restores the previous tier). Direct handle drags open the same
	 * bubble but never "cancel" a tier. */
	let guideFromMenu = false;
	let guideHideTimer: number | null = null;
	let guideHandle: Element | null = null;
	let tierBeforeGuide: TierId = "standard";

	/* The px the app currently resolves for the transcript, after its own
	 * clamp — what the guide's live readout shows. */
	function guideValueText(): string {
		const root = roots.find();
		const px = root === null ? null : liveWidthPx(root);
		return px === null ? "—" : `${px}px`;
	}

	/* Keep the bubble beside the handle the user actually grabbed (it moves
	 * with the dragged edge); fall back to the right handle / frame edge when
	 * the handle is not mounted yet (menu-opened guide, hero or settling
	 * phase). */
	function positionGuide(): void {
		if (!guideActive) return;
		const handle =
			guideHandle !== null && document.contains(guideHandle)
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

	function setGuideText(mode: "hint" | "live", text: string): void {
		guide.dataset.mode = mode;
		setText(guideTextEl, text);
	}

	function startGuide(): void {
		guideFromMenu = true;
		guideActive = true;
		guideDragging = false;
		guideHandle = null;
		guide.hidden = false;
		body().setAttribute(GUIDE_ATTR, "custom");
		setGuideText("hint", t("guide.hint"));
		positionGuide();
	}

	/* Every handle press shows the live readout, not just the first guided
	 * drag — a repeat custom drag must keep the handle highlight and the width
	 * bubble. */
	function startLiveGuide(handle: Element | null): void {
		window.clearTimeout(guideHideTimer ?? undefined);
		guideActive = true;
		guideDragging = true;
		guideHandle = handle ?? null;
		guide.hidden = false;
		body().setAttribute(GUIDE_ATTR, "custom");
		setGuideText("live", guideValueText());
		positionGuide();
	}

	function beginCustomGuide(): void {
		/* Remember the tier to restore on cancel only on the first entry;
		 * re-picking custom while the guide is open must not make "custom" the
		 * restore target. */
		if (!guideActive) {
			tierBeforeGuide = currentTier();
			applyTier("custom");
		}
		startGuide();
	}

	/* Show the settled width briefly, then remove the guide. */
	function finishGuide(): void {
		if (!guideActive) return;
		guideDragging = false;
		setGuideText("live", guideValueText());
		window.clearTimeout(guideHideTimer ?? undefined);
		guideHideTimer = window.setTimeout(() => endGuide(false), 800);
	}

	/* `restoreTier` is for cancelling a menu-opened guide (click-away /
	 * Escape): if it never recorded a width, go back to the tier the user had
	 * before opening it. Drag-opened bubbles keep custom. */
	function endGuide(restoreTier: boolean): void {
		if (!guideActive) return;
		guideActive = false;
		guideDragging = false;
		window.clearTimeout(guideHideTimer ?? undefined);
		guide.hidden = true;
		guide.dataset.mode = "hint";
		guideHandle = null;
		body().removeAttribute(GUIDE_ATTR);
		const restore = restoreTier && guideFromMenu && readNumber(CUSTOM_KEY) === null;
		guideFromMenu = false;
		if (restore) applyTier(tierBeforeGuide);
	}

	const onGuidePointerMove = (): void => {
		if (!guideActive || !guideDragging) return;
		setGuideText("live", guideValueText());
		positionGuide();
	};
	document.addEventListener("pointermove", onGuidePointerMove, true);

	/* ---- hand the width over to the app's native drag handles ----
	 * Pressing a `[data-width-handle]` means the user is taking the width over:
	 * switch to the `custom` tier so healing stops enforcing a preset, and let
	 * the app's drag win the cascade (it rewrites the same inline property
	 * every frame). The settled width is recorded on release so it stays
	 * re-selectable from the menu. */
	const isHandleEvent = (e: Event): boolean =>
		e.target instanceof Element && e.target.closest("[data-width-handle]") !== null;

	const onHandlePointerDown = (e: PointerEvent): void => {
		if (!isHandleEvent(e)) return;
		const target = e.target as Element;
		startLiveGuide(target.closest("[data-width-handle]"));
		if (currentTier() === "custom") return;
		body().setAttribute(TIER_ATTR, "custom");
		try {
			window.localStorage.setItem(KEY, "custom");
		} catch {
			/* ignore */
		}
		syncButton();
		syncMenu();
	};

	const onHandlePointerUp = (e: PointerEvent): void => {
		if (!isHandleEvent(e)) return;
		const root = roots.find();
		if (root !== null) {
			const px = Number.parseFloat(
				widthTarget(root).style.getPropertyValue("--dsh-chat-user-width"),
			);
			if (Number.isFinite(px) && px > 0) {
				try {
					window.localStorage.setItem(CUSTOM_KEY, String(Math.round(px)));
				} catch {
					/* ignore */
				}
			}
		}
		if (guideActive) finishGuide();
		syncButton();
		syncMenu();
	};

	/* A cancelled drag (touch gesture, window switch) ends without pointerup;
	 * without this handler the bubble would stay stuck in dragging mode and
	 * click-away would no longer dismiss it. */
	const onHandlePointerCancel = (): void => {
		/* The cancel target can be the capture element or the document; while a
		 * drag is active, end it regardless. */
		if (!guideActive || !guideDragging) return;
		endGuide(false);
		syncButton();
		syncMenu();
	};
	document.addEventListener("pointerdown", onHandlePointerDown, true);
	document.addEventListener("pointerup", onHandlePointerUp, true);
	document.addEventListener("pointercancel", onHandlePointerCancel, true);

	/* ---- feedback ring so every selection is visibly answered ---- */
	function pulse(): void {
		btn.classList.remove("pulse");
		void btn.offsetWidth;
		btn.classList.add("pulse");
		window.clearTimeout(pulseTimer ?? undefined);
		pulseTimer = window.setTimeout(() => {
			btn.classList.remove("pulse");
			pulseTimer = null;
		}, 700);
	}

	/* ---- re-render localized copy when the app language changes ---- */
	const renderTexts = (): void => {
		syncButton();
		syncMenu();
		if (guideActive && !guideDragging && guide.dataset.mode === "hint") {
			setText(guideTextEl, t("guide.hint"));
		}
	};
	const unsubscribeLocale = options.locale.subscribe(renderTexts);

	/* ---- attach once the app shell has mounted ---- */
	let attached = false;
	let readyTimer: number | null = null;
	let slowTimer: number | null = null;
	let readyTimeout: number | null = null;

	function stopWaiting(): void {
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
	 * [data-details-collapsed]. 0.1.5-rc.2 renders collapsed markers
	 * conditionally (`sidebarCollapsed || void 0`) and removed
	 * data-details-collapsed, so with the sidebar expanded nothing ever
	 * matched and the button never mounted. Wait for the AppFrame overlay layer
	 * instead — `data-shell-overlay` is rendered unconditionally once the
	 * shell exists. */
	function attach(): void {
		if (attached || !body()) return;
		if (document.querySelector("[data-shell-overlay]") === null) return;
		attached = true;
		stopWaiting();
		try {
			window.localStorage.removeItem(OLD_KEY);
		} catch {
			/* ignore */
		}
		mount.appendChild(btn);
		mount.appendChild(menu);
		mount.appendChild(guide);
		syncButton();
		const saved = getSavedTier();
		if (saved !== "standard") applyTier(saved);
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
		/* A very slow boot should not leave the picker permanently unmounted:
		 * keep a low-frequency retry instead of giving up. */
		slowTimer = setInterval(attach, 2000);
	}, READY_TIMEOUT_MS);
	window.addEventListener("load", attach);

	/* Tier changes from another tab: adopt the stored tier without writing
	 * localStorage again (that would loop). */
	const onStorage = (e: StorageEvent): void => {
		if (!e || e.key !== KEY) return;
		/* No storageArea identity check: spec does not require the event object
		 * to be the same Storage instance as window.localStorage, and dropping
		 * the event would break cross-tab sync. */
		const next = e.newValue;
		if (typeof next !== "string") return;
		const found = TIERS.find((tier) => tier.id === next);
		if (found === undefined) return;
		if (currentTier() === found.id) return;
		applyTier(found.id, false);
	};
	window.addEventListener("storage", onStorage);

	/* ---- self-heal: re-apply the width when the chat tree remounts
	 * (conversation switch). Panels are never managed here — the user may
	 * expand/collapse either side any time; forcing the rightbar closed only
	 * retracts the grid track while the seat keeps rendering as an overlay that
	 * covers the conversation. Driven by DOM mutations, scheduled on the next
	 * animation frame (before the browser paints) instead of a fixed hot loop:
	 * the width must land on the fresh root before its first paint — otherwise
	 * the default width flashes for a frame. While the new root has not
	 * appeared yet (mid-remount), full scans are owned by a backoff retry;
	 * mutation-driven heals only try the cheap path walk so DOM churn cannot
	 * storm. ---- */
	let rootMissing = false;
	let rootRetryDelay = ROOT_RETRY_MIN_MS;
	let rootRetryTimer: number | null = null;
	let healFrame: number | null = null;
	let resizeFrame: number | null = null;
	let observer: MutationObserver | null = null;
	let fallbackTimer: number | null = null;
	let widthObserver: ResizeObserver | null = null;
	let observedTarget: HTMLElement | null = null;

	/* Return the frame id so heal and resize can be debounced and cancelled
	 * independently. The old helper always wrote the heal slot, so resizeFrame
	 * never became non-null and every resize event scheduled another frame. */
	function scheduleFrame(cb: () => void): number {
		return typeof requestAnimationFrame === "function"
			? requestAnimationFrame(cb)
			: window.setTimeout(cb, 0);
	}
	function cancelFrame(id: number): void {
		if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(id);
		else window.clearTimeout(id);
	}

	/* Watch the column that sizes the transcript. Sidebar/rightbar changes and
	 * frame resizes alter it; `full` (and a clamped fixed/custom width) must
	 * follow without polling every mutation. Guarded for browsers/tests without
	 * ResizeObserver. */
	function observeWidthTarget(root: HTMLElement): void {
		if (typeof ResizeObserver === "undefined") return;
		const target = widthTarget(root);
		if (target === observedTarget && widthObserver !== null) return;
		if (widthObserver !== null) {
			widthObserver.disconnect();
			widthObserver = null;
		}
		observedTarget = target;
		widthObserver = new ResizeObserver(() => {
			/* Never fight the app's native drag: it owns the width while the
			 * user is moving a handle. */
			if (guideActive && guideDragging) return;
			const tier = currentTier();
			if (tier === "standard") return;
			applyContentWidth(tier);
			syncButton();
			syncMenu();
		});
		widthObserver.observe(target);
	}

	function scheduleRootRetry(): void {
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

	function heal(fromObserver: boolean): void {
		/* The right handle only mounts in the active phase; keep the guide
		 * pinned to it once the chat tree settles. */
		if (guideActive) positionGuide();
		/* The app's native drag owns the inline width until release; a heal
		 * must not restore the previous custom value on top. */
		if (guideActive && guideDragging) return;
		const tier = currentTier();
		if (tier === "standard") return;
		const prev = roots.cached();
		let root: HTMLElement | null;
		if (rootMissing || fromObserver) {
			/* Mid-remount / mutation churn: walk the recorded path only
			 * (O(depth)); the backoff retry owns full scans until the new root
			 * exists. */
			root = roots.find(false);
		} else {
			root = roots.find();
		}
		if (root === null) {
			if (!rootMissing) {
				rootMissing = true;
				rootRetryDelay = ROOT_RETRY_MIN_MS;
			}
			/* Idempotent: keep a backoff retry alive even if the previous one
			 * ended while this tier was standard. */
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
			/* Fallback tick: retry an apply that was skipped while the root had
			 * no layout box. */
			applyContentWidth(tier);
		}
	}

	function startHealing(): void {
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
				attributeFilter: ["data-sidebar-collapsed"],
			});
		}
		/* Low-frequency fallback so self-heal still runs if the observer misses
		 * something — cheap: no full scan while the cached root is alive. */
		fallbackTimer = setInterval(() => heal(false), FALLBACK_HEAL_MS);
	}

	/* ---- keep the picker and the guide aligned with the live column.
	 * Standard/full re-resolve on resize, and the guide must stay beside the
	 * handle when the frame resizes. ---- */
	const onWindowResize = (): void => {
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

	/* All healing/observer state is initialized by now; try an immediate mount
	 * instead of waiting for the first interval. */
	attach();

	/* ---- disposer ---- */
	return {
		dispose(): void {
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
			if (pulseTimer !== null) {
				window.clearTimeout(pulseTimer);
				pulseTimer = null;
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
			document.removeEventListener("click", onDocClick);
			document.removeEventListener("keydown", onDocKey);
			document.removeEventListener("pointerdown", onHandlePointerDown, true);
			document.removeEventListener("pointerup", onHandlePointerUp, true);
			document.removeEventListener("pointercancel", onHandlePointerCancel, true);
			document.removeEventListener("pointermove", onGuidePointerMove, true);
			if (btn.parentNode) btn.parentNode.removeChild(btn);
			if (menu.parentNode) menu.parentNode.removeChild(menu);
			if (guide.parentNode) guide.parentNode.removeChild(guide);
			removeStyles();
			/* Hand the width back to the app default. Only a value this plugin
			 * wrote is removed, so a native drag preference that predates the
			 * plugin survives unload. */
			const root = roots.cached();
			if (root !== null) {
				widthTarget(root).style.removeProperty("--dsh-chat-user-width");
			}
			if (preferenceOwned) {
				try {
					/* Only remove the exact value this plugin wrote; a native drag
					 * since then owns the preference. */
					if (
						preferenceWritten !== null &&
						window.localStorage.getItem(APP_PREF_KEY) === preferenceWritten
					) {
						window.localStorage.removeItem(APP_PREF_KEY);
					}
				} catch {
					/* ignore */
				}
				preferenceOwned = false;
				preferenceWritten = null;
			}
			/* Undo a collapse this plugin owned; a manual collapse is left
			 * alone. */
			if (collapsedByTier) {
				try {
					if (isSidebarCollapsed()) layout.toggleSidebar();
				} catch {
					/* ignore */
				}
				collapsedByTier = false;
			}
			guideHandle = null;
			body().removeAttribute(TIER_ATTR);
			body().removeAttribute(GUIDE_ATTR);
		},
	};
}
