// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useMemo, useState } from "react";
import { WidthTierPicker } from "../src/client/WidthTierPicker.tsx";
import { zh } from "../src/client/locales.ts";
import type { PickerActions, PickerSnapshot } from "../src/client/picker-state.ts";

/** Build a complete snapshot for one tier. */
function snapshot(overrides: Partial<PickerSnapshot> = {}): PickerSnapshot {
	const base: PickerSnapshot = {
		tier: "wide",
		menuOpen: false,
		pulse: 0,
		button: {
			active: true,
			label: zh["tier.wide"],
			value: "1280px",
			ariaLabel: "对话区宽度档位：宽（1280px），点击选择档位",
			title: "对话区宽度档位：宽（1280px）\n点击选择：…",
		},
		items: [
			{ id: "standard", label: zh["tier.standard"], value: "748px", selected: false },
			{ id: "medium", label: zh["tier.medium"], value: "1120px", selected: false },
			{ id: "wide", label: zh["tier.wide"], value: "1280px", selected: true },
			{ id: "ultra", label: zh["tier.ultra"], value: "1400px", selected: false },
			{ id: "full", label: zh["tier.full"], value: "1824px", selected: false },
			{ id: "custom", label: zh["tier.custom"], value: zh["value.custom.unset"], selected: false },
		],
		guide: {
			active: false,
			dragging: false,
			mode: "hint",
			text: "",
			style: { left: "auto", right: "24px", top: "50%" },
			announcement: "",
		},
	};
	return { ...base, ...overrides };
}

/** Interactive wrapper that stands in for the slot renderer's hook binding. */
function Harness({ initial }: { initial: PickerSnapshot }) {
	const [state, setState] = useState(initial);
	const actions = useMemo<PickerActions>(() => ({
		toggleMenu: () => setState((current) => ({ ...current, menuOpen: !current.menuOpen })),
		closeMenu: () => setState((current) => ({ ...current, menuOpen: false })),
		selectTier: (tier) => setState((current) => ({ ...current, menuOpen: false, tier })),
		cancelGuide: () =>
			setState((current) => ({
				...current,
				guide: { ...current.guide, active: false, dragging: false },
			})),
		measureGuide: () => {},
	}), []);
	return <WidthTierPicker usePicker={(selector) => selector(state)} actions={actions} />;
}

beforeEach(() => {
	if (typeof globalThis.requestAnimationFrame === "undefined") {
		vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
			window.setTimeout(() => callback(performance.now()), 0));
		vi.stubGlobal("cancelAnimationFrame", (id: number) => window.clearTimeout(id));
	}
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

describe("WidthTierPicker", () => {
	it("renders the picker button with six level bars and the menu closed", () => {
		const { container } = render(<Harness initial={snapshot()} />);
		const button = screen.getByRole("button", {
			name: "对话区宽度档位：宽（1280px），点击选择档位",
		});

		expect(button.getAttribute("aria-haspopup")).toBe("menu");
		expect(button.getAttribute("aria-expanded")).toBe("false");
		expect(button.hasAttribute("title")).toBe(true);
		expect(container.querySelectorAll("#dsh-wide-toggle svg rect")).toHaveLength(6);
		expect(container.querySelector("#dsh-width-menu")?.hasAttribute("hidden")).toBe(true);
		/* DSH treats any [role="menu"] as an open modal; a closed menu must not
		 * carry the role or every keyboard shortcut is blocked. */
		expect(container.querySelector("#dsh-width-menu")?.hasAttribute("role")).toBe(false);
	});

	it("opens the menu on click and focuses the selected row", () => {
		const { container } = render(<Harness initial={snapshot()} />);
		const button = screen.getByRole("button", { name: /点击选择档位/ });
		fireEvent.click(button);

		const menu = container.querySelector("#dsh-width-menu");
		expect(menu?.hasAttribute("hidden")).toBe(false);
		expect(menu?.getAttribute("role")).toBe("menu");
		expect(button.getAttribute("aria-expanded")).toBe("true");
		expect((document.activeElement as HTMLElement | null)?.getAttribute("data-tier")).toBe("wide");
	});

	it("selects a row, closes the menu and returns focus to the button", () => {
		const { container } = render(<Harness initial={snapshot()} />);
		const button = screen.getByRole("button", { name: /点击选择档位/ });
		fireEvent.click(button);
		fireEvent.click(screen.getByRole("menuitemradio", { name: /超宽/ }));

		expect(container.querySelector("#dsh-width-menu")?.hasAttribute("hidden")).toBe(true);
		expect(button.getAttribute("aria-expanded")).toBe("false");
		expect(document.activeElement).toBe(button);
	});

	it("closes the menu with Escape and restores button focus", () => {
		const { container } = render(<Harness initial={snapshot()} />);
		const button = screen.getByRole("button", { name: /点击选择档位/ });
		fireEvent.click(button);
		fireEvent.keyDown(document, { key: "Escape" });

		const menu = container.querySelector("#dsh-width-menu");
		expect(menu?.hasAttribute("hidden")).toBe(true);
		expect(menu?.hasAttribute("role")).toBe(false);
		expect(document.activeElement).toBe(button);
	});

	it("walks the menu rows with ArrowDown", () => {
		const { container } = render(<Harness initial={snapshot()} />);
		fireEvent.click(screen.getByRole("button", { name: /点击选择档位/ }));
		fireEvent.keyDown(document, { key: "ArrowDown" });

		const rows = Array.from(
			container.querySelectorAll<HTMLButtonElement>("#dsh-width-menu button[data-tier]"),
		);
		const selectedIndex = rows.findIndex((row) => row === document.activeElement);
		expect(selectedIndex).toBe(3);
	});

	it("renders the drag guide when the controller opens it", () => {
		const guide = {
			active: true,
			dragging: false,
			mode: "hint" as const,
			text: zh["guide.hint"],
			style: { left: "820px", right: "auto", top: "260px" },
			announcement: zh["guide.hint"],
		};
		const { container } = render(<Harness initial={snapshot({ guide })} />);
		const element = container.querySelector<HTMLElement>("#dsh-width-guide");

		expect(element?.hasAttribute("hidden")).toBe(false);
		expect(element?.dataset.mode).toBe("hint");
		expect(element?.style.left).toBe("820px");
		expect(element?.textContent).toContain(zh["guide.hint"]);
	});

	it("returns focus to the button when the menu closes from outside", () => {
		render(<Harness initial={snapshot({ menuOpen: true })} />);
		const rows = screen.getAllByRole("menuitemradio");
		rows[2]?.focus();
		expect(document.activeElement).toBe(rows[2]);

		fireEvent.click(screen.getByRole("button", { name: /点击选择档位/ }));

		expect(document.activeElement).toBe(
			screen.getByRole("button", { name: /点击选择档位/ }),
		);
	});

	it("renders the full tier's sidebar note", () => {
		const base = snapshot({ menuOpen: true });
		const items = base.items.map((item) =>
			item.id === "full" ? { ...item, note: zh["tier.full.note"] } : item,
		);
		const { container } = render(<Harness initial={{ ...base, items }} />);

		expect(container.querySelector(".dshwm-note")?.textContent).toContain(zh["tier.full.note"]);
	});

	it("publishes the guide announcement through a polite status region", () => {
		const guide = {
			active: true,
			dragging: false,
			mode: "live" as const,
			text: "1000px",
			style: { left: "820px", right: "auto", top: "260px" },
			announcement: "对话区宽度 1000px",
		};
		const { container } = render(<Harness initial={snapshot({ guide })} />);
		const status = container.querySelector('[role="status"]');

		expect(status?.textContent).toBe("对话区宽度 1000px");
		/* The decorative bubble must stay out of the accessibility tree. */
		expect(container.querySelector("#dsh-width-guide")?.getAttribute("aria-hidden")).toBe("true");
	});

	it("marks the selected row for assistive technology", () => {
		render(<Harness initial={snapshot({ menuOpen: true })} />);
		const rows = screen.getAllByRole("menuitemradio");
		const selected = rows.find((row) => row.getAttribute("aria-checked") === "true");

		expect(selected?.getAttribute("data-tier")).toBe("wide");
		expect(selected?.classList.contains("selected")).toBe(true);
	});
});
