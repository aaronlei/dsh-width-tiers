/**
 * Contract smoke test for the built artifacts.
 *
 * The bundle is loaded through a fake `window.__ModuleLoader__` with no DOM
 * globals, so this checks the handoff shape the shell relies on:
 *
 * - module id equals the package name (the shell resolves factories by it);
 * - the factory registers `apply` / `inject` and executes without touching
 *   the document (all DOM work belongs to `apply` / effects);
 * - the host entry still exports the Cordis loader contract;
 * - the package manifest advertises the bundle and its patch.
 *
 * Run: `pnpm verify:client` after `pnpm build`.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const outDir = process.env.DSH_WIDTH_TIERS_OUT_DIR ?? "lib";
const manifest = JSON.parse(readFileSync(new URL("package.json", root), "utf8"));
const clientSource = readFileSync(new URL(`${outDir}/client.js`, root), "utf8");

let captured = null;
globalThis.window = {
	__ModuleLoader__: {
		load(entry) {
			captured = entry;
		},
	},
};

// Top level must only register the factory; the document does not exist here.
new Function(clientSource)();

assert.notEqual(captured, null, "client bundle did not call __ModuleLoader__.load");
assert.equal(captured.id, manifest.name, "client module id must equal the package name");
assert.equal(typeof captured.factory, "function", "client factory must be a function");

const requested = new Set();
const reactStub = {
	useEffect() {},
	useLayoutEffect() {},
	useRef() {
		return { current: null };
	},
};
const jsxRuntimeStub = {
	jsx() {
		return null;
	},
	jsxs() {
		return null;
	},
};
const exports = captured.factory((specifier) => {
	requested.add(specifier);
	if (specifier === "react") return reactStub;
	if (specifier === "react/jsx-runtime") return jsxRuntimeStub;
	throw new Error(`unexpected require("${specifier}")`);
});
assert.deepEqual(
	[...requested].sort(),
	["react", "react/jsx-runtime"],
	"client bundle must externalize exactly the React baseline modules",
);
assert.equal(typeof exports.apply, "function", "client bundle must export apply");
assert.deepEqual(
	exports.inject,
	["slots", "layout", "locale"],
	"client bundle inject list changed",
);
assert.equal(typeof globalThis.document, "undefined", "loading must not require a document");

const host = await import(new URL(`${outDir}/index.js`, root).href);
assert.equal(host.name, manifest.name, "host plugin name must equal the package name");
assert.equal(typeof host.apply, "function", "host entry must export apply");
assert.ok(Array.isArray(host.inject), "host entry must export an inject list");

assert.equal(manifest.exports["./client"], "./lib/client.js", "missing client export");
assert.equal(manifest.dsh.client.platform, "web", "dsh.client.platform must be web");
assert.equal(manifest.dsh.bundle.patch, "./cordis.patch.yml", "missing bundle patch");

console.log(`client bundle ok: id=${captured.id}, inject=${exports.inject.join(",")}`);
console.log(`host entry ok: name=${host.name}`);
console.log("manifest ok: client export, platform and bundle patch");
