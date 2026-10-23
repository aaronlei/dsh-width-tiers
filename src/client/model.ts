import {
	CONTENT_EDGE_BUDGET_PX,
	CONTENT_MIN_PX,
	DEFAULT_COLUMN_RATIO,
	DEFAULT_MAX_PX,
	DEFAULT_MIN_PX,
	KEY,
	NOMINAL_WIDTH_PX,
} from "./constants.ts";

/** Minimal storage surface; the browser passes `window.localStorage`. */
export interface StorageLike {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
	removeItem(key: string): void;
}

/* Tier ids and label keys only — the picker resolves displayed values in
 * `tierValueText` (fixed px for medium/wide/ultra, live px for
 * standard/full, recorded px for custom). */
export const TIERS = [
	{ id: "standard", key: "tier.standard" },
	{ id: "medium", key: "tier.medium" },
	{ id: "wide", key: "tier.wide" },
	{ id: "ultra", key: "tier.ultra" },
	{ id: "full", key: "tier.full" },
	/* Reached by dragging a native width handle, or by picking it in the menu
	 * and following the right-edge drag guide. */
	{ id: "custom", key: "tier.custom" },
] as const;

/** One selectable width tier. */
export type Tier = (typeof TIERS)[number];

/** Stable tier id. */
export type TierId = Tier["id"];

/**
 * Resolve a tier definition by id, falling back to `standard`.
 * @param id - stored or attributed tier id.
 * @returns the matching definition, or `standard`.
 */
export function tierOf(id: string): Tier {
	for (const tier of TIERS) {
		if (tier.id === id) return tier;
	}
	return TIERS[0];
}

/**
 * Read a positive persisted number, or null when absent or corrupt.
 * @param storage - backing storage.
 * @param key - storage key.
 * @returns the parsed positive number, or null.
 */
export function readStoredNumber(storage: StorageLike, key: string): number | null {
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
export function getSavedTier(storage: StorageLike): TierId {
	try {
		const value = storage.getItem(KEY);
		const found = TIERS.find((tier) => tier.id === value);
		return found === undefined ? "standard" : found.id;
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
export function tierTargetPx(
	tier: TierId,
	columnWidth: number,
	customPx: number | null,
): number | null {
	switch (tier) {
		case "medium":
		case "wide":
		case "ultra":
			return NOMINAL_WIDTH_PX[tier];
		case "full":
			return fullWidthPx(columnWidth);
		case "custom":
			return customPx;
		default:
			return null;
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
export function appliedTierPx(
	tier: TierId,
	columnWidth: number,
	customPx: number | null,
): number | null {
	const target = tierTargetPx(tier, columnWidth, customPx);
	if (target === null) return null;
	const cap = fullWidthPx(columnWidth);
	return Math.min(Math.max(target, CONTENT_MIN_PX), cap);
}

/**
 * Resolve the app's default transcript width for a column.
 * @param columnWidth - live width of the app's width column (px).
 * @returns `max(680, min(column × 0.64, 920))`.
 */
export function defaultWidthPx(columnWidth: number): number {
	return Math.max(
		DEFAULT_MIN_PX,
		Math.min(columnWidth * DEFAULT_COLUMN_RATIO, DEFAULT_MAX_PX),
	);
}

/**
 * Resolve the widest transcript the column can hold (app clamp maximum).
 * @param columnWidth - live width of the app's width column (px).
 * @returns `max(640, column − 176)`.
 */
export function fullWidthPx(columnWidth: number): number {
	return Math.max(CONTENT_MIN_PX, columnWidth - CONTENT_EDGE_BUDGET_PX);
}
