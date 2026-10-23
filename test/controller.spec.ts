// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	createWidthTiers,
	type WidthTiersController,
} from "../src/client/controller.ts";
import {
	APP_PREF_KEY,
	CUSTOM_KEY,
	GUIDE_ATTR,
	KEY,
	TIER_ATTR,
} from "../src/client/constants.ts";
import { en, zh, type CopyKey } from "../src/client/locales.ts";

let controller: WidthTiersController | undefined;
let root: HTMLElement;
let column: HTMLElement;
let frame: HTMLElement;
let handle: HTMLElement;
let sidebarCollapsed = false;
let resizeCallback: ResizeObserverCallback | null = null;
let localeListeners: Set<() => void>;
let activeLocale: "zh" | "en" = "zh";

/** Translate from the active test locale. */
function t(key: CopyKey, values?: Record<string, string>): string {
	let text: string = (activeLocale === "en" ? en : zh)[key] ?? key;
	if (values) {
		text = text.replace(/\{(\w+)\}/g, (match, name: string) =>
			name in values ? String(values[name]) : match,
		);
	}
	return text;
}

/** Create the controller against the current test DOM. */
function makeController(): WidthTiersController {
	controller = createWidthTiers({
		layout: {
			toggleSidebar(): void {
				sidebarCollapsed = !sidebarCollapsed;
				if (sidebarCollapsed) frame.setAttribute("data-sidebar-collapsed", "");
				else frame.removeAttribute("data-sidebar-collapsed");
			},
		},
		locale: {
			subscribe(listener: () => void): () => void {
				localeListeners.add(listener);
				return () => {
					localeListeners.delete(listener);
				};
			},
		},
		t,
	});
	return controller;
}

beforeEach(() => {
	localStorage.clear();
	document.head.innerHTML = "";
	document.body.innerHTML = "";
	activeLocale = "zh";
	sidebarCollapsed = false;
	resizeCallback = null;
	localeListeners = new Set();

	const overlay = document.createElement("div");
	overlay.setAttribute("data-shell-overlay", "");
	document.body.appendChild(overlay);

	frame = document.createElement("div");
	document.body.appendChild(frame);

	column = document.createElement("div");
	root = document.createElement("div");
	root.setAttribute("data-conversation-content", "");
	Object.defineProperty(root, "offsetWidth", { configurable: true, value: 2000 });
	column.appendChild(root);
	document.body.appendChild(column);

	handle = document.createElement("div");
	handle.setAttribute("data-width-handle", "right");
	handle.getBoundingClientRect = () => ({
		x: 800,
		y: 100,
		width: 8,
		height: 300,
		top: 100,
		right: 808,
		bottom: 400,
		left: 800,
		toJSON: () => ({}),
	}) as DOMRect;
	document.body.appendChild(handle);

	const original = window.getComputedStyle.bind(window);
	vi.spyOn(window, "getComputedStyle").mockImplementation((element: Element) => {
		if (element === root) {
			return {
				getPropertyValue: (name: string) =>
					name === "--dsh-chat-content-width" ? "748px" : "",
			} as unknown as CSSStyleDeclaration;
		}
		return original(element);
	});

	class ResizeObserverStub {
		constructor(callback: ResizeObserverCallback) {
			resizeCallback = callback;
		}
		observe(): void {}
		disconnect(): void {
			resizeCallback = null;
		}
	}
	vi.stubGlobal("ResizeObserver", ResizeObserverStub as unknown as typeof ResizeObserver);
});

afterEach(() => {
	controller?.dispose();
	controller = undefined;
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	document.body.innerHTML = "";
	document.head.innerHTML = "";
	localStorage.clear();
});

describe("width tiers controller", () => {
	it("restores the saved tier and writes the app width axis", () => {
		localStorage.setItem(KEY, "wide");
		const c = makeController();
		const state = c.source.getSnapshot();

		expect(state.tier).toBe("wide");
		expect(state.menuOpen).toBe(false);
		expect(state.items.find((item) => item.id === "wide")?.selected).toBe(true);
		expect(column.style.getPropertyValue("--dsh-chat-user-width")).toBe("1280px");
		expect(localStorage.getItem(APP_PREF_KEY)).toBe("1280");
		expect(document.body.getAttribute(TIER_ATTR)).toBe("wide");
		expect(sidebarCollapsed).toBe(false);
	});

	it("applies a fixed tier and mirrors the unclamped target", () => {
		const c = makeController();
		c.actions.selectTier("medium");
		const state = c.source.getSnapshot();

		expect(state.tier).toBe("medium");
		expect(state.menuOpen).toBe(false);
		expect(state.pulse).toBeGreaterThan(0);
		expect(column.style.getPropertyValue("--dsh-chat-user-width")).toBe("1120px");
		expect(localStorage.getItem(APP_PREF_KEY)).toBe("1120");
		expect(localStorage.getItem(KEY)).toBe("medium");
	});

	it("collapses the sidebar for full and restores it for standard", () => {
		const c = makeController();

		c.actions.selectTier("full");
		expect(sidebarCollapsed).toBe(true);
		expect(column.style.getPropertyValue("--dsh-chat-user-width")).toBe("1824px");
		expect(localStorage.getItem(APP_PREF_KEY)).toBe("1824");

		c.actions.selectTier("standard");
		expect(sidebarCollapsed).toBe(false);
		expect(column.style.getPropertyValue("--dsh-chat-user-width")).toBe("");
		expect(localStorage.getItem(APP_PREF_KEY)).toBeNull();
		expect(c.source.getSnapshot().tier).toBe("standard");
	});

	it("opens the first-use custom guide and restores the previous tier on cancel", () => {
		const c = makeController();
		c.actions.selectTier("custom");

		let state = c.source.getSnapshot();
		expect(state.tier).toBe("custom");
		expect(state.guide.active).toBe(true);
		expect(state.guide.dragging).toBe(false);
		expect(state.guide.mode).toBe("hint");
		expect(state.guide.text).toBe(zh["guide.hint"]);
		expect(document.body.getAttribute(GUIDE_ATTR)).toBe("custom");

		c.actions.cancelGuide();
		state = c.source.getSnapshot();
		expect(state.guide.active).toBe(false);
		expect(state.tier).toBe("standard");
		expect(document.body.getAttribute(GUIDE_ATTR)).toBeNull();
	});

	it("records a native drag as the custom width", () => {
		const c = makeController();
		handle.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));

		let state = c.source.getSnapshot();
		expect(state.tier).toBe("custom");
		expect(state.guide.active).toBe(true);
		expect(state.guide.dragging).toBe(true);
		expect(localStorage.getItem(KEY)).toBe("custom");

		column.style.setProperty("--dsh-chat-user-width", "1100px");
		handle.dispatchEvent(new MouseEvent("pointerup", { bubbles: true }));

		state = c.source.getSnapshot();
		expect(state.guide.dragging).toBe(false);
		expect(state.guide.mode).toBe("live");
		expect(state.guide.text).toBe("1100px");
		expect(localStorage.getItem(CUSTOM_KEY)).toBe("1100");
		expect(state.items.find((item) => item.id === "custom")?.value).toBe("1100px");
	});

	it("ends the guide on pointercancel", () => {
		const c = makeController();
		handle.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
		handle.dispatchEvent(new MouseEvent("pointercancel", { bubbles: true }));

		const state = c.source.getSnapshot();
		expect(state.guide.active).toBe(false);
		expect(document.body.getAttribute(GUIDE_ATTR)).toBeNull();
		expect(state.tier).toBe("custom");
	});

	it("adopts a tier written by another tab", () => {
		const c = makeController();
		window.dispatchEvent(new StorageEvent("storage", { key: KEY, newValue: "ultra" }));

		expect(c.source.getSnapshot().tier).toBe("ultra");
		expect(column.style.getPropertyValue("--dsh-chat-user-width")).toBe("1400px");
		expect(localStorage.getItem(APP_PREF_KEY)).toBe("1400");
	});

	it("re-renders labels when the app language changes", () => {
		const c = makeController();
		activeLocale = "en";
		for (const listener of localeListeners) listener();

		const state = c.source.getSnapshot();
		expect(state.items[0]?.label).toBe("Standard");
		expect(state.button.ariaLabel).toContain("Chat width tier");
	});

	it("follows the column width while full is selected", () => {
		localStorage.setItem(KEY, "full");
		const c = makeController();
		expect(column.style.getPropertyValue("--dsh-chat-user-width")).toBe("1824px");

		Object.defineProperty(root, "offsetWidth", { configurable: true, value: 1600 });
		resizeCallback?.([], {} as ResizeObserver);
		expect(c.source.getSnapshot().tier).toBe("full");
		expect(column.style.getPropertyValue("--dsh-chat-user-width")).toBe("1424px");
	});

	it("does not pin a zero-layout root to the clamp floor", () => {
		Object.defineProperty(root, "offsetWidth", { configurable: true, value: 0 });
		localStorage.setItem(KEY, "full");
		const c = makeController();

		expect(c.source.getSnapshot().tier).toBe("full");
		expect(column.style.getPropertyValue("--dsh-chat-user-width")).toBe("");
		expect(localStorage.getItem(APP_PREF_KEY)).toBeNull();
	});

	it("opens and closes the menu through actions", () => {
		const c = makeController();
		c.actions.toggleMenu();
		expect(c.source.getSnapshot().menuOpen).toBe(true);
		c.actions.closeMenu();
		expect(c.source.getSnapshot().menuOpen).toBe(false);

		c.actions.toggleMenu();
		c.actions.selectTier("medium");
		expect(c.source.getSnapshot().menuOpen).toBe(false);
	});

	it("disposes every owned resource", () => {
		localStorage.setItem(KEY, "full");
		const c = makeController();
		expect(sidebarCollapsed).toBe(true);

		c.dispose();
		controller = undefined;
		expect(sidebarCollapsed).toBe(false);
		expect(column.style.getPropertyValue("--dsh-chat-user-width")).toBe("");
		expect(localStorage.getItem(APP_PREF_KEY)).toBeNull();
		expect(document.body.getAttribute(TIER_ATTR)).toBeNull();
		expect(document.querySelector('style[data-plugin="dsh-width-tiers"]')).toBeNull();
	});
});
