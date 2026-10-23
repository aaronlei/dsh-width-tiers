import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { TIERS, type TierId } from "./model.ts";
import type { PickerActions, PickerSnapshot } from "./picker-state.ts";

/** Props the slot renderer derives for the overlay entry. */
export interface WidthTierPickerProps {
	/** Renderer-bound hook over the controller's snapshot source. */
	usePicker: <T>(selector: (snapshot: PickerSnapshot) => T) => T;
	actions: PickerActions;
}

/** How long the selection ring stays on the button. */
const PULSE_MS = 700;

/** Six horizontal bars; one per tier, lit up to the selected index. */
function LevelIcon({ tier }: { tier: TierId }) {
	const index = TIERS.findIndex((candidate) => candidate.id === tier);
	const widths = [3.5, 5.3, 7.1, 8.9, 10.7, 12.5];
	return (
		<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
			{widths.map((width, bar) => (
				<rect
					key={bar}
					x={1.5}
					y={0.75 + bar * 2.55}
					width={width}
					height={1.6}
					rx={0.8}
					fill="currentColor"
					opacity={bar <= index ? 1 : 0.3}
				/>
			))}
		</svg>
	);
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
export function WidthTierPicker({ usePicker, actions }: WidthTierPickerProps) {
	const state = usePicker((snapshot) => snapshot);
	const buttonRef = useRef<HTMLButtonElement>(null);
	const menuRef = useRef<HTMLDivElement>(null);
	const wrapperRef = useRef<HTMLDivElement>(null);
	const guideRef = useRef<HTMLDivElement>(null);
	const stateRef = useRef(state);
	const [pulsing, setPulsing] = useState(false);

	useLayoutEffect(() => {
		stateRef.current = state;
	}, [state]);

	/* Replay the selection ring whenever the controller pulses. */
	useEffect(() => {
		if (state.pulse === 0) return;
		setPulsing(false);
		const frame = requestAnimationFrame(() => setPulsing(true));
		const timer = window.setTimeout(() => setPulsing(false), PULSE_MS);
		return () => {
			cancelAnimationFrame(frame);
			window.clearTimeout(timer);
		};
	}, [state.pulse]);

	/* Opening the menu moves focus to the active row, like a native menu. */
	useEffect(() => {
		if (!state.menuOpen || menuRef.current === null) return;
		const rows = Array.from(
			menuRef.current.querySelectorAll<HTMLButtonElement>("button[data-tier]"),
		);
		const selected = rows.find((row) => row.dataset.tier === state.tier) ?? rows[0];
		selected?.focus();
	}, [state.menuOpen, state.tier]);

	/* Report the real bubble width so the controller places it beside the
	 * handle instead of relying on an estimate. */
	useLayoutEffect(() => {
		if (!state.guide.active) return;
		const width = guideRef.current?.offsetWidth ?? 0;
		if (width > 0) actions.measureGuide(width);
	}, [state.guide.active, state.guide.text, state.guide.mode, actions]);

	/* Frame-level dismissal: click-away, Escape and the menu's key walk. */
	useEffect(() => {
		const onDocClick = (event: MouseEvent): void => {
			const target = event.target;
			if (!(target instanceof Node)) return;
			const current = stateRef.current;
			const inside = wrapperRef.current?.contains(target) ?? false;
			if (current.menuOpen && !inside) actions.closeMenu();
			if (
				current.guide.active &&
				!current.guide.dragging &&
				!inside &&
				!(target instanceof Element && target.closest("[data-width-handle]") !== null)
			) {
				actions.cancelGuide();
			}
		};
		const onDocKey = (event: KeyboardEvent): void => {
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
				/* Let Tab move on, but do not leave an orphaned menu. */
				actions.closeMenu();
				return;
			}
			const rows = Array.from(
				menuRef.current?.querySelectorAll<HTMLButtonElement>("button[data-tier]") ?? [],
			);
			if (rows.length === 0) return;
			const active = document.activeElement;
			const index = active === null ? -1 : rows.indexOf(active as HTMLButtonElement);
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

	const className = [
		state.button.active ? "active" : "",
		pulsing ? "pulse" : "",
	].filter(Boolean).join(" ");

	return (
		<div ref={wrapperRef} data-dsh-width-tiers-host="">
			<button
				ref={buttonRef}
				type="button"
				id="dsh-wide-toggle"
				aria-haspopup="menu"
				aria-expanded={state.menuOpen}
				aria-label={state.button.ariaLabel}
				title={state.button.title}
				className={className || undefined}
				onClick={() => actions.toggleMenu()}
			>
				<LevelIcon tier={state.tier} />
			</button>
			<div
				ref={menuRef}
				id="dsh-width-menu"
				role="menu"
				hidden={!state.menuOpen}
			>
				{state.items.map((item) => (
					<button
						key={item.id}
						type="button"
						role="menuitemradio"
						data-tier={item.id}
						tabIndex={-1}
						aria-checked={item.selected}
						className={item.selected ? "selected" : undefined}
						onClick={() => {
							actions.selectTier(item.id);
							buttonRef.current?.focus();
						}}
					>
						<span className="dshwm-label">{item.label}</span>
						<span className="dshwm-value">{item.value}</span>
					</button>
				))}
			</div>
			<div
				ref={guideRef}
				id="dsh-width-guide"
				aria-hidden="true"
				hidden={!state.guide.active}
				data-mode={state.guide.mode}
				style={state.guide.style}
			>
				<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
					<path
						d="M6 3 2 8l4 5M10 3l4 5-4 5"
						fill="none"
						stroke="currentColor"
						strokeWidth={1.5}
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				</svg>
				<span className="dshwg-text">{state.guide.text}</span>
			</div>
		</div>
	);
}
