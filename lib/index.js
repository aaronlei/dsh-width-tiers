/**
 * @module dsh-width-tiers
 *
 * Server-side entry of the dsh-width-tiers plugin: a minimal no-op cordis
 * plugin. Its only job is to exist as a loader entry so the client-modules
 * scanner discovers the browser bundle declared in package.json
 * (`dsh.client` + `exports["./client"]`) and serves it at
 * `/plugins/dsh-width-tiers/client.js` in the Web boot manifest.
 *
 * All functionality lives in the browser bundle (lib/client.js).
 */

/** Stable cordis plugin name. */
export const name = "dsh-width-tiers";

/** Services required before this plugin mounts (none server-side). */
export const inject = [];

/** No-op host-side apply. */
export function apply() {}
