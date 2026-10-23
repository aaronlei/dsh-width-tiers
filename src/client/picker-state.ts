import type { TierId } from "./model.ts";

/** Resolved button presentation for the current tier. */
export interface PickerButtonState {
	/** Whether the tier differs from the app default. */
	active: boolean;
	/** Localized tier label. */
	label: string;
	/** Live width text shown in the menu entry. */
	value: string;
	/** Localized accessible name. */
	ariaLabel: string;
	/** Native title text (summary + pick hint). */
	title: string;
}

/** One resolved menu row. */
export interface PickerMenuItemState {
	id: TierId;
	label: string;
	value: string;
	selected: boolean;
}

/** Fixed-position style of the drag guide bubble. */
export interface PickerGuideStyle {
	left: string;
	right: string;
	top: string;
}

/** Drag-guide presentation. */
export interface PickerGuideState {
	active: boolean;
	dragging: boolean;
	mode: "hint" | "live";
	text: string;
	style: PickerGuideStyle;
}

/** Immutable render snapshot published by the width-tier controller. */
export interface PickerSnapshot {
	tier: TierId;
	menuOpen: boolean;
	/** Increments on every tier selection so the button can replay its ring. */
	pulse: number;
	button: PickerButtonState;
	items: readonly PickerMenuItemState[];
	guide: PickerGuideState;
}

/** Observable source consumed by the slot renderer's `usePicker` hook. */
export interface PickerSource {
	getSnapshot(): PickerSnapshot;
	subscribe(listener: () => void): () => void;
}

/** User actions the React picker dispatches; all state lives in the controller. */
export interface PickerActions {
	toggleMenu(): void;
	closeMenu(): void;
	selectTier(tier: TierId): void;
	cancelGuide(): void;
	/** Report the rendered guide width so placement uses the real bubble size. */
	measureGuide(width: number): void;
}
