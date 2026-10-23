import { useEffect, useLayoutEffect, useRef } from "react";

/** Mount/detach callback supplied by the plugin entry through the slot inject face. */
export interface OverlayHostInjected {
	/**
	 * Create the width-tier controller inside the overlay layer.
	 * @param container - the host element owned by this component.
	 * @returns a disposer that removes every node, listener and timer.
	 */
	mount(container: HTMLElement): () => void;
}

/** Props the renderer derives for this overlay entry. */
export interface OverlayHostProps {
	mount: OverlayHostInjected["mount"];
}

/**
 * Slot host for the imperative width-tier UI. The effect owns the controller
 * lifetime: mounting creates it inside the frame-wide `shell.overlay` layer,
 * and unmounting disposes every resource it acquired. The latest mount
 * callback is kept in a ref so an inject-factory identity change does not
 * remount the controller.
 * @param props - mount callback from the plugin entry's inject face.
 * @returns an empty host element; the controller appends its own fixed nodes.
 */
export function OverlayHost({ mount }: OverlayHostProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const mountRef = useRef(mount);
	useLayoutEffect(() => {
		mountRef.current = mount;
	}, [mount]);

	useEffect(() => {
		const container = containerRef.current;
		if (container === null) return;
		return mountRef.current(container);
	}, []);

	return <div ref={containerRef} data-dsh-width-tiers-host="" />;
}
