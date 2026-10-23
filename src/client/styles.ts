/**
 * Button + menu styles. Theme variables keep the picker in the app's light /
 * dark palettes; every selector is scoped to this plugin's own ids and classes.
 */
const css = [
	"#dsh-wide-toggle{position:fixed;right:10px;bottom:216px;z-index:999;display:flex;align-items:center;justify-content:center;width:36px;height:36px;padding:0;border:1px solid var(--dsw-alias-border-l2);border-radius:50%;overflow:hidden;background:var(--dsw-alias-button-floating-fill);color:var(--dsw-alias-label-secondary);box-shadow:0 2px 8px rgba(0,0,0,.18);cursor:pointer;opacity:.72;transition:opacity .2s ease,width .2s ease,border-radius .2s ease,background .2s ease,color .2s ease}",
	"#dsh-wide-toggle::after{content:'';position:fixed;right:10px;bottom:216px;width:36px;height:36px;pointer-events:auto}",
	"#dsh-wide-toggle:hover{opacity:1}",
	"#dsh-wide-toggle:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:2px;width:36px;border-radius:50%}",
	"#dsh-wide-toggle:not(:hover):not(:focus-visible){width:10px;border-radius:6px}",
	"#dsh-wide-toggle:not(:hover):not(:focus-visible) svg rect{width:6px;x:5px}",
	"#dsh-wide-toggle.active{background:var(--dsw-alias-state-business-primary);border-color:transparent;color:var(--dsw-static-neutral-00);opacity:1}",
	"#dsh-wide-toggle.pulse{animation:dsh-wide-pulse .65s ease-out}",
	"@media (prefers-reduced-motion:reduce){#dsh-wide-toggle{transition:none}#dsh-wide-toggle.pulse{animation:none}}",
	"@keyframes dsh-wide-pulse{0%{box-shadow:0 0 0 0 color-mix(in srgb,var(--dsw-alias-state-business-primary) 60%,transparent)}100%{box-shadow:0 0 0 14px transparent}}",
	"#dsh-width-menu{position:fixed;right:20px;bottom:264px;z-index:1000;min-width:196px;padding:6px;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-specific-menu);box-shadow:0 8px 28px rgba(0,0,0,.24);display:flex;flex-direction:column;gap:2px}",
	"#dsh-width-menu[hidden]{display:none}",
	"#dsh-width-menu button{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 12px;border:none;border-radius:8px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;line-height:18px;text-align:left;cursor:pointer}",
	"#dsh-width-menu button:hover{background:var(--dsw-alias-interactive-bg-hover)}",
	"#dsh-width-menu button:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:-2px}",
	"#dsh-width-menu button.selected{background:var(--dsw-alias-interactive-bg-hover-solid);color:var(--dsw-alias-state-business-primary)}",
	"#dsh-width-menu .dshwm-value{color:var(--dsw-alias-label-tertiary);font-size:12px}",
	"#dsh-width-menu button.selected .dshwm-value{color:var(--dsw-alias-state-business-primary)}",
	"#dsh-width-guide{position:fixed;z-index:1001;display:flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-specific-menu);color:var(--dsw-alias-label-primary);font-size:12px;line-height:16px;box-shadow:0 8px 28px rgba(0,0,0,.24);pointer-events:none;white-space:nowrap;transform:translateY(-50%)}",
	"#dsh-width-guide[hidden]{display:none}",
	"#dsh-width-guide svg{flex:none;color:var(--dsw-alias-state-business-primary)}",
	"#dsh-width-guide[data-mode=live]{font-size:13px;font-weight:600;font-variant-numeric:tabular-nums}",
	"body[data-dsh-width-guide] [data-width-handle]{background:linear-gradient(to bottom,transparent calc(50% - 64px),color-mix(in srgb,var(--dsw-alias-state-business-primary) 18%,transparent) calc(50% - 64px),color-mix(in srgb,var(--dsw-alias-state-business-primary) 18%,transparent) calc(50% + 64px),transparent calc(50% + 64px));border-radius:3px}",
	"body[data-dsh-width-guide] [data-width-handle]::after{opacity:1}",
].join("");

/**
 * Install the plugin stylesheet and return its removal disposer.
 * @returns removes the owned style element from the document head.
 */
export function installStyles(): () => void {
	const styleTag = document.createElement("style");
	styleTag.dataset.plugin = "dsh-width-tiers";
	styleTag.textContent = css;
	document.head.appendChild(styleTag);
	return () => {
		if (styleTag.parentNode) styleTag.parentNode.removeChild(styleTag);
	};
}
