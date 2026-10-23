/** LocalStorage key holding the selected tier. */
export const KEY = "dsh.widthTier";

/** Legacy key from the pre-tier releases; removed on attach. */
export const OLD_KEY = "dsh.wide";

/** Last user-dragged width (px), backing the `custom` tier. */
export const CUSTOM_KEY = "dsh.widthTierCustom";

/** The app's own transcript width preference (ConversationWidthControls). */
export const APP_PREF_KEY = "dsh.conversation.contentWidth";

/* Mirrors ConversationWidthControls: clamp floor and the horizontal budget
 * the width handles plus safe edges reserve. */
export const CONTENT_MIN_PX = 640;
export const CONTENT_EDGE_BUDGET_PX = 176;

/** Nominal content widths of the fixed tiers (px). */
export const NOMINAL_WIDTH_PX = {
	medium: 1120,
	wide: 1280,
	ultra: 1400,
} as const;

/* The app's no-preference formula: clamp(680px, column × 0.64, 920px).
 * Used as the last-resort live readout before the first drag. */
export const DEFAULT_MIN_PX = 680;
export const DEFAULT_MAX_PX = 920;
export const DEFAULT_COLUMN_RATIO = 0.64;

/** How long attach waits before falling back to a slow retry. */
export const READY_TIMEOUT_MS = 30000;

/* Self-heal cadence: DOM-driven (MutationObserver scheduling on the next
 * animation frame — before paint, so the width never flashes default) with a
 * low-frequency fallback and backoff retries while the width root is missing
 * (conversation-switch remount). */
export const ROOT_RETRY_MIN_MS = 200;
export const ROOT_RETRY_MAX_MS = 2000;
export const FALLBACK_HEAL_MS = 2000;

/** Attribute the plugin sets on <body> while a tier is active. */
export const TIER_ATTR = "data-dsh-width";

/** Attribute the plugin sets on <body> while the custom-drag guide is open. */
export const GUIDE_ATTR = "data-dsh-width-guide";
