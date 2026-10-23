import { defaultWidthPx } from "./model.ts";

/** Whether an element resolves a non-empty `--dsh-chat-content-width`. */
export function hasWidthVar(el: Element): boolean {
	return getComputedStyle(el).getPropertyValue("--dsh-chat-content-width").trim() !== "";
}

/* Sidebar chat tabs render an embedded Conversation whose
 * `--dsh-chat-content-width` is a local min() and never reads
 * `--dsh-chat-user-width`. Writing there would be a no-op on the visible
 * column and could starve the real transcript. */
export function isSidebarConversation(el: Element): boolean {
	return typeof el.closest === "function" && el.closest("[data-sidebar-chat]") !== null;
}

/**
 * The element the app's ConversationWidthControls publishes
 * `--dsh-conversation-column-width` / `--dsh-chat-user-width` on.
 * @param root - element that declares `--dsh-chat-content-width`.
 * @returns the parent element, or the root itself when detached.
 */
export function widthTarget(root: HTMLElement): HTMLElement {
	return root.parentElement ?? root;
}

/** Locate the element that declares `--dsh-chat-content-width` at runtime. */
export interface WidthRootLocator {
	/**
	 * Find the width root, preferring the cached element and its recorded
	 * child-index path before scanning the document.
	 * @param allowScan - false limits the lookup to the cheap path walk.
	 * @returns the width root, or null while it is not mounted.
	 */
	find(allowScan?: boolean): HTMLElement | null;
	/** The last located root, without touching the DOM. */
	cached(): HTMLElement | null;
	/** Forget the cached root and path. */
	reset(): void;
}

/**
 * Create the runtime locator. Cached; the app remounts the chat tree on
 * conversation switch, so re-location first walks the recorded child-index
 * path from <body> (React keeps the tree shape — O(depth), one style read)
 * and only falls back to a full scan.
 * @returns locator bound to this page's document.
 */
export function createWidthRootLocator(): WidthRootLocator {
	let widthRoot: HTMLElement | null = null;
	let widthPath: number[] | null = null;

	function recordWidthPath(el: HTMLElement): void {
		const path: number[] = [];
		let node: Element | null = el;
		while (node && node !== document.body) {
			const parent = node.parentNode;
			if (!parent || !(parent as ParentNode).children) break;
			path.unshift(Array.prototype.indexOf.call((parent as ParentNode).children, node));
			node = parent as Element;
		}
		widthPath = path.length > 0 ? path : null;
	}

	function firstWidthRoot(list: ArrayLike<Element>): HTMLElement | null {
		for (let i = 0; i < list.length; i++) {
			const el = list[i];
			if (el === undefined || isSidebarConversation(el)) continue;
			if (hasWidthVar(el)) return el as HTMLElement;
		}
		return null;
	}

	function scanWidthRoot(): HTMLElement | null {
		/* Prefer the stable Conversation data attribute (one or two elements)
		 * over every classed node in the document. The [class] walk remains the
		 * compatibility fallback for older clients that do not publish
		 * data-conversation-content. */
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

	function find(allowScan = true): HTMLElement | null {
		if (
			widthRoot !== null &&
			document.contains(widthRoot) &&
			!isSidebarConversation(widthRoot)
		) {
			return widthRoot;
		}
		if (widthPath !== null) {
			let el: Element | null = document.body;
			for (let i = 0; i < widthPath.length; i++) {
				if (el === null) break;
				const next: Element | undefined = el.children[widthPath[i]];
				if (!next) {
					el = null;
					break;
				}
				el = next;
			}
			if (
				el !== null &&
				el !== widthRoot &&
				document.contains(el) &&
				!isSidebarConversation(el) &&
				hasWidthVar(el)
			) {
				widthRoot = el as HTMLElement;
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
		},
	};
}

/* The transcript width the app currently resolves for the live column (after
 * its own clamp), used by the custom-drag guide. During a drag the app writes
 * the clamped px to the target's inline `--dsh-chat-user-width`, so reading
 * that is exact and avoids relying on how a browser serializes a computed
 * custom property (which may stay as a var()/clamp() token stream). */
export function liveWidthPx(root: HTMLElement): number {
	const target = widthTarget(root);
	const inline = Number.parseFloat(target.style.getPropertyValue("--dsh-chat-user-width"));
	if (Number.isFinite(inline) && inline > 0) return Math.round(inline);
	const raw = getComputedStyle(root).getPropertyValue("--dsh-chat-content-width");
	const computed = Number.parseFloat(raw);
	if (Number.isFinite(computed) && computed > 0) return Math.round(computed);
	return Math.round(defaultWidthPx(root.offsetWidth));
}
