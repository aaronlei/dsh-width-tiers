import { createWidthTiers } from "./controller.ts";
import { dictionaries, NS, type TFunction } from "./locales.ts";
import type { PickerActions, PickerSource } from "./picker-state.ts";
import { WidthTierPicker } from "./WidthTierPicker.tsx";

/** Locale service slice the plugin entry needs. */
interface LocaleService {
	register(namespace: string, locale: string, dictionary: Record<string, string>): () => void;
	bind(namespace: string): (key: string, values?: Record<string, string>) => string;
	subscribe(listener: () => void): () => void;
}

/** Layout service slice the plugin entry needs. */
interface LayoutService {
	toggleSidebar(): void;
}

/** Values the renderer turns into the picker's props. */
interface OverlayInjected {
	hooks: { picker: PickerSource };
	actions: PickerActions;
}

/** One `shell.overlay` registration; the renderer derives component props. */
interface OverlayRegistration {
	name: string;
	id: string;
	order?: number;
	locale?: string;
	inject?: () => OverlayInjected;
}

/** Slot service slice the plugin entry needs. */
interface SlotsService {
	inject(name: string, callback: () => unknown): void;
	register(options: OverlayRegistration, component: typeof WidthTierPicker): () => void;
}

/** Cordis client context surface used by this plugin. */
interface ClientContext {
	layout: LayoutService;
	locale: LocaleService;
	slots: SlotsService;
	effect(effect: () => void | (() => void), label?: string): void;
}

/** Services required by the browser bundle. */
export const inject = ["slots", "layout", "locale"];

/**
 * Client plugin body: register the dictionaries, start the width-tier
 * controller, then contribute the React picker to the frame-wide overlay
 * layer. The controller owns the width axis and persistence; the slot entry
 * owns only its own render lifetime.
 * @param ctx - client root context (slots + layout + locale injected).
 */
export function apply(ctx: ClientContext): void {
	ctx.effect(() => {
		const disposers = Object.entries(dictionaries).map(([locale, dictionary]) =>
			ctx.locale.register(NS, locale, dictionary),
		);
		return () => {
			for (const dispose of disposers) dispose();
		};
	}, "dsh-width-tiers: dictionaries");
	const t = ctx.locale.bind(NS) as TFunction;
	const controller = createWidthTiers({
		layout: ctx.layout,
		locale: ctx.locale,
		t,
	});
	ctx.effect(
		() => () => controller.dispose(),
		"dsh-width-tiers: controller",
	);

	ctx.slots.inject("shell.overlay", () =>
		ctx.slots.register(
			{
				name: "shell.overlay",
				id: "width-tiers",
				order: 100,
				locale: NS,
				inject: (): OverlayInjected => ({
					hooks: { picker: controller.source },
					actions: controller.actions,
				}),
			},
			WidthTierPicker,
		),
	);
}
