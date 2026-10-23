/**
 * tsdown configuration: two artifacts.
 *
 * 1. **Host** (`src/index.ts` → `lib/index.js`): the Cordis plugin entry, ESM
 *    for Node. It is a no-op loader entry; the Web client bundle carries the
 *    feature.
 * 2. **Client** (`src/client/index.ts` → `lib/client.js`): the browser bundle.
 *    The host serves this built file at `/plugins/dsh-width-tiers/client.js`;
 *    the shell's `window.__ModuleLoader__` materializes the factory. The
 *    banner/footer wrap the CommonJS output in that loader handoff and stamp
 *    the package name as the module id, exactly like the shipped client
 *    plugins. React and the other baseline modules are absent: this half uses
 *    no platform module yet, and the P2 slot migration will add `react` as an
 *    external rather than bundling it.
 */
import { readFileSync } from "node:fs";
import { defineConfig } from "tsdown";

/** The published package name, used for the client loader handoff. */
const manifest = JSON.parse(
	readFileSync(new URL("./package.json", import.meta.url), "utf8"),
) as { name: string };

/** Output directory override for local verification before publishing to lib/. */
const outDir = process.env.DSH_WIDTH_TIERS_OUT_DIR ?? "lib";

export default defineConfig([
	// Host: Cordis plugin, ESM for Node.
	{
		entry: ["src/index.ts"],
		outDir,
		format: "esm",
		platform: "node",
		target: "node20",
		dts: false,
		clean: false,
		sourcemap: false,
		outputOptions: {
			entryFileNames: "index.js",
		},
	},
	// Client: browser bundle wrapped in the loader handoff.
	{
		entry: ["src/client/index.ts"],
		outDir,
		format: "cjs",
		platform: "browser",
		target: "es2022",
		deps: {
			neverBundle: ["react", "react/jsx-runtime"],
		},
		dts: false,
		clean: false,
		sourcemap: false,
		outputOptions: {
			entryFileNames: "client.js",
			strict: false,
			banner: [
				"window.__ModuleLoader__.load({",
				`\tid: ${JSON.stringify(manifest.name)},`,
				"\tfactory: (require) => {",
				"\t\tvar module = { exports: {} };",
				"\t\tvar exports = module.exports;",
			].join("\n"),
			footer: [
				"\t\treturn module.exports;",
				"\t}",
				"});",
			].join("\n"),
		},
	},
]);
