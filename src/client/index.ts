import { createWidthTiers } from "./controller.ts";
import { en, NS, zh, type TFunction } from "./locales.ts";
import { OverlayHost, type OverlayHostInjected } from "./OverlayHost.tsx";

/** Locale service slice the plugin entry needs. */
interface LocaleService {
	register(
		namespace: string,
		dictionaries: { zh: Record<string, string>; en: Record<string, string> },
	): () => void;
	bind(namespace: string): (key: string, values?: Record<string, string>) => string;
	subscribe(listener: () => void): () => void;
}

/** Layout service slice the plugin entry needs. */
interface LayoutService {
	toggleSidebar(): void;
}

/** One `shell.overlay` registration; the renderer turns the inject face into props. */
interface OverlayRegistration {
	name: string;
	id: string;
	order?: number;
	locale?: string;
	inject?: () => OverlayHostInjected;
}

/** Slot service slice the plugin entry needs. */
interface SlotsService {
	inject(name: string, callback: () => unknown): void;
	register(options: OverlayRegistration, component: typeof OverlayHost): () => void;
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
 * Client plugin body: register the dictionaries, then contribute the picker
 * to the frame-wide overlay layer. The controller lives as long as the slot
 * entry: the host component's effect calls `mount` on render and disposes it
 * on unmount, so no nodes, listeners or timers outlive the registration.
 * @param ctx - client root context (slots + layout + locale injected).
 */
export function apply(ctx: ClientContext): void {
	ctx.effect(
		() => ctx.locale.register(NS, { zh, en }),
		"dsh-width-tiers: dictionaries",
	);
	const t = ctx.locale.bind(NS) as TFunction;

	ctx.slots.inject("shell.overlay", () =>
		ctx.slots.register(
			{
				name: "shell.overlay",
				id: "width-tiers",
				order: 100,
				locale: NS,
				inject: (): OverlayHostInjected => ({
					mount(container: HTMLElement): () => void {
						const controller = createWidthTiers({
							mount: container,
							layout: ctx.layout,
							locale: ctx.locale,
							t,
						});
						return () => controller.dispose();
					},
				}),
			},
			OverlayHost,
		),
	);
}
