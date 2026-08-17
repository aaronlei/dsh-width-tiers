/*
 * Minimal DOM stub smoke test for the dsh-width-tiers client bundle.
 * Loads lib/client.js through a fake __ModuleLoader__, calls apply(ctx) with
 * a fake layout service, and validates: tier restore + migration, content
 * width override on the runtime-detected root, sidebar handling via
 * ctx.layout (full collapses, standard restores only when we collapsed it,
 * medium/wide/ultra never touch it), details close + self-heal, menu
 * behavior, and the effect disposer.
 * Run: node test.js
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const log = [];
let sidebarCollapsed = false; // false = sidebar expanded (frame lacks the attr)
let detailsClosed = true; // fresh load: details panel closed

/* ---- tiny DOM stubs ---- */
const frameEl = { hasAttribute: () => true };

const storage = { "dsh.widthTier": "wide", "dsh.wide": "1" }; // stale old key present
const fakeBody = {
  attrs: new Map(),
  children: [],
  style: {},
  hasAttribute(name) { return this.attrs.has(name); },
  setAttribute(name, value) { this.attrs.set(name, String(value)); },
  removeAttribute(name) { this.attrs.delete(name); },
  getAttribute(name) { return this.attrs.has(name) ? this.attrs.get(name) : null; },
  appendChild(el) { el.parentNode = this; this.children.push(el); },
  removeChild(el) {
    const i = this.children.indexOf(el);
    if (i !== -1) this.children.splice(i, 1);
    el.parentNode = null;
  },
};

class HTMLElement {}
global.HTMLElement = HTMLElement;

function makeEl(tag) {
  const el = {
    tagName: tag,
    attrs: new Map(),
    children: [],
    handlers: {},
    dataset: {},
    style: {
      setProperty(n, v) { this[n] = String(v); },
      removeProperty(n) { delete this[n]; },
    },
    classList: {
      set: new Set(),
      toggle(c, on) { on ? this.set.add(c) : this.set.delete(c); },
      contains(c) { return this.set.has(c); },
      add(c) { this.set.add(c); },
      remove(c) { this.set.delete(c); },
    },
    setAttribute(name, value) { this.attrs.set(name, String(value)); },
    getAttribute(name) { return this.attrs.has(name) ? this.attrs.get(name) : null; },
    set innerHTML(html) {
      this.children = [];
      const re = /<span class="([^"]+)">([^<]*)<\/span>/g;
      let m;
      while ((m = re.exec(html))) {
        const span = makeEl("span");
        span.classList.set.add(m[1]);
        span.textContent = m[2];
        this.children.push(span);
      }
    },
    addEventListener(ev, fn) { (this.handlers[ev] ||= []).push(fn); },
    appendChild(el2) { el2.parentNode = this; this.children.push(el2); return el2; },
    removeChild(el2) {
      const i = this.children.indexOf(el2);
      if (i !== -1) this.children.splice(i, 1);
      el2.parentNode = null;
    },
    contains(el2) { return el2 === this || this.children.includes(el2); },
    querySelectorAll(sel) {
      const m = /^([a-z]+)\[([a-z-]+)\]$/.exec(sel);
      if (!m) return [];
      const [tag, attr] = [m[1], m[2]];
      return this.children.filter((c) => c.tagName === tag && c.getAttribute(attr) !== null);
    },
    querySelector(sel) {
      const m = /^\.([a-zA-Z0-9_-]+)$/.exec(sel);
      if (!m) return null;
      return this.children.find((c) => c.classList.set.has(m[1])) || null;
    },
    click() {
      const ev = { target: this, stopPropagation() {} };
      (this.handlers.click || []).forEach((fn) => fn(ev));
    },
  };
  Object.setPrototypeOf(el, HTMLElement.prototype);
  return el;
}

/* the element that defines --dsh-chat-content-width (runtime detection target).
 * Nested under two shells so the path-walk re-location (the no-scan, no-flash
 * path) can be exercised: the app remounts the chat tree on conversation
 * switch by swapping the root at the same position. */
const shellA = makeEl("div");
const shellB = makeEl("div");
shellA.appendChild(shellB);
const fakeRoot = makeEl("div");
fakeRoot.__vars = { "--dsh-chat-content-width": "748px" };
shellB.appendChild(fakeRoot);
fakeBody.appendChild(shellA);
let currentRoots = [fakeRoot];

/* fake layout service: the app's real panel actions */
const layoutService = {
  toggleSidebar() {
    log.push("layout.toggleSidebar");
    sidebarCollapsed = !sidebarCollapsed;
  },
  closeDetails() {
    log.push("layout.closeDetails");
    detailsClosed = true;
  },
};

/* ---- fake locale service: mirrors the app's LocaleRuntime contract ---- */
const localeListeners = new Set();
let activeLocale = "zh";
/* Smoke-test mirrors of the bundle's dictionaries (keep in sync with
 * lib/client.js — the bundle keeps its own copies). */
const localeDicts = {
  zh: {
    "tier.standard": "标准",
    "tier.medium": "中等",
    "tier.wide": "宽",
    "tier.ultra": "超宽",
    "tier.full": "全宽",
    "button.aria": "对话区宽度档位：{label}（{value}），点击选择档位",
    "button.title.summary": "对话区宽度档位：{label}（{value}）",
    "button.title.hint": "点击选择：{list}",
  },
  en: {
    "tier.standard": "Standard",
    "tier.medium": "Medium",
    "tier.wide": "Wide",
    "tier.ultra": "Ultra",
    "tier.full": "Full",
    "button.aria": "Chat width tier: {label} ({value}). Click to choose a tier.",
    "button.title.summary": "Chat width tier: {label} ({value})",
    "button.title.hint": "Click to choose: {list}",
  },
};
const localeService = {
  register() {
    return () => {};
  },
  bind() {
    return (key, params) => {
      let s = localeDicts[activeLocale]?.[key] ?? localeDicts.zh[key] ?? key;
      if (params) s = s.replace(/\{(\w+)\}/g, (m, n) => (n in params ? String(params[n]) : m));
      return s;
    };
  },
  subscribe(fn) {
    localeListeners.add(fn);
    return () => localeListeners.delete(fn);
  },
  getLocale() {
    return { active: activeLocale };
  },
  setLocale(id) {
    activeLocale = id;
    for (const fn of [...localeListeners]) fn();
  },
};

global.getComputedStyle = (el) => ({
  getPropertyValue: (n) => (el.__vars ? el.__vars[n] || "" : ""),
});

/* fake MutationObserver: tests fire the callback manually to simulate app DOM
 * churn (conversation switch / details toggle) */
let mutationCb = null;
class MutationObserverStub {
  constructor(cb) {
    mutationCb = cb;
  }
  observe() {}
  disconnect() {
    mutationCb = null;
  }
}
global.MutationObserver = MutationObserverStub;

/* fake animation frames: heal runs on the next macrotask, well within the
 * test waits */
global.requestAnimationFrame = (cb) => setTimeout(() => cb(), 0);
global.cancelAnimationFrame = (id) => clearTimeout(id);

const docListeners = {};
global.document = {
  body: fakeBody,
  head: { appendChild() {} },
  createElement: makeEl,
  contains: (el) => currentRoots.includes(el),
  querySelector(sel) {
    if (sel === "[data-sidebar-collapsed]") return sidebarCollapsed ? frameEl : null;
    if (sel === "[data-details-collapsed]") return detailsClosed ? frameEl : null;
    if (sel === "[data-sidebar-collapsed], [data-details-collapsed]") {
      return sidebarCollapsed || detailsClosed ? frameEl : null;
    }
    return null;
  },
  querySelectorAll(sel) {
    if (sel === "[class]") return currentRoots;
    return [];
  },
  addEventListener(ev, fn) { (docListeners[ev] ||= []).push(fn); },
  removeEventListener(ev, fn) {
    const l = docListeners[ev];
    if (l) {
      const i = l.indexOf(fn);
      if (i !== -1) l.splice(i, 1);
    }
  },
};

global.window = {
  addEventListener() {},
  setTimeout: global.setTimeout,
  clearTimeout: global.clearTimeout,
  localStorage: {
    getItem(k) { return Object.prototype.hasOwnProperty.call(storage, k) ? storage[k] : null; },
    setItem(k, v) { storage[k] = String(v); },
    removeItem(k) { delete storage[k]; },
  },
};

/* ---- load the client bundle through the fake module loader ---- */
let loaded = null;
global.window.__ModuleLoader__ = {
  load(entry) {
    loaded = entry;
  },
};
const src = fs.readFileSync(path.join(__dirname, "lib", "client.js"), "utf8");
eval(src); // eslint-disable-line no-eval
const mod = loaded.factory(() => ({})); // no requires in this bundle

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
  console.log("ok  :", msg);
}

/* ---- drive the plugin ---- */
let dispose = null;
const ctx = {
  layout: layoutService,
  locale: localeService,
  effect(fn) {
    const d = fn();
    dispose = d;
    return d;
  },
};
mod.apply(ctx);
assert(
  JSON.stringify(mod.inject) === JSON.stringify(["layout", "locale"]),
  "bundle injects the layout + locale services",
);

const toggleCalls = () => log.filter((x) => x === "layout.toggleSidebar").length;
const closeCalls = () => log.filter((x) => x === "layout.closeDetails").length;
const btn = () => fakeBody.children.find((c) => c.id === "dsh-wide-toggle");
const menu = () => fakeBody.children.find((c) => c.id === "dsh-width-menu");
const menuItem = (tier) => menu().children.find((b) => b.getAttribute("data-tier") === tier);

/* 1. saved tier restored once the app shell mounts (details closed by default) */
setTimeout(() => {
  assert(!!btn() && !!menu(), "button and menu appended after mount");
  assert(fakeBody.getAttribute("data-dsh-width") === "wide", "saved tier restored");
  assert(fakeRoot.style["--dsh-chat-content-width"] === "1280px", "content width overridden on detected root");
  assert(!("dsh.wide" in storage), "old dsh.wide key migrated away");
  assert(toggleCalls() === 0, "wide tier does NOT touch the sidebar");
  assert(btn().classList.contains("active") === true, "button active");
  assert(
    menuItem("standard").querySelector(".dshwm-label").textContent === "标准",
    "zh tier labels by default",
  );
  assert(btn().title.includes("点击选择"), "button title hint in zh");

  /* 2. menu: pick full → sidebar collapsed via layout service, width 100% */
  btn().click();
  assert(menu().hidden === false, "menu opens");
  menuItem("full").click();
  assert(fakeBody.getAttribute("data-dsh-width") === "full", "full selected");
  assert(sidebarCollapsed === true, "full collapses the sidebar");
  assert(toggleCalls() === 1, "layout.toggleSidebar called once");
  assert(fakeRoot.style["--dsh-chat-content-width"] === "100%", "full sets 100%");
  assert(storage["dsh.widthTier"] === "full", "tier persisted");

  /* 3. standard restores the sidebar (we collapsed it) + removes override */
  btn().click();
  menuItem("standard").click();
  assert(sidebarCollapsed === false, "standard restores the sidebar");
  assert(toggleCalls() === 2, "toggleSidebar called again");
  assert(!("--dsh-chat-content-width" in fakeRoot.style), "standard removes the width override");
  assert(btn().classList.contains("active") === false, "button inactive");

  /* 4. ultra (1400px) never touches the sidebar */
  btn().click();
  menuItem("ultra").click();
  assert(fakeRoot.style["--dsh-chat-content-width"] === "1400px", "ultra sets 1400px");
  assert(toggleCalls() === 2, "ultra does NOT touch the sidebar");

  /* 5. self-heal: details reopened while non-standard gets closed again.
   * The heal is DOM-driven now — fire the mutation callback to simulate the
   * app toggling the attribute. */
  detailsClosed = false; // user clicked a tool row
  mutationCb && mutationCb();
  setTimeout(() => {
    assert(detailsClosed === true, "self-heal re-closes details while ultra");
    assert(closeCalls() >= 1, "layout.closeDetails used for the self-heal");

    /* 5b. conversation switch remounts the chat tree: the width root is
     * replaced at the same position by a fresh element declaring the app
     * default. The mutation-driven heal must re-locate it (path walk, no
     * full scan) and re-apply the current tier before the next paint
     * (regression: previously only a full page refresh restored the width,
     * and the old debounce flashed the default width for ~150 ms). */
    const remounted = makeEl("div");
    remounted.__vars = { "--dsh-chat-content-width": "748px" };
    shellB.removeChild(fakeRoot);
    shellB.appendChild(remounted);
    currentRoots = [remounted];
    mutationCb && mutationCb();

    /* 6. after the debounced heal, the tier is re-applied to the remounted root */
    setTimeout(() => {
      assert(
        remounted.style["--dsh-chat-content-width"] === "1400px",
        "width re-applied to the remounted root after conversation switch",
      );
      assert(
        fakeBody.getAttribute("data-dsh-width") === "ultra",
        "tier survives the conversation switch",
      );

      /* 7. no self-heal while standard */
      btn().click();
      menuItem("standard").click();
      detailsClosed = false;
      const closesBefore = closeCalls();
      setTimeout(() => {
        assert(detailsClosed === false, "no self-heal while standard");
        assert(closeCalls() === closesBefore, "no closeDetails calls while standard");

        /* 8. locale switch re-renders the picker copy (follows Settings → Language) */
        localeService.setLocale("en");
        assert(
          menuItem("standard").querySelector(".dshwm-label").textContent === "Standard",
          "menu label re-renders in English",
        );
        assert(
          menuItem("full").querySelector(".dshwm-label").textContent === "Full",
          "full label re-renders in English",
        );
        assert(btn().getAttribute("aria-label").includes("Chat width tier"), "button aria-label follows the locale");
        assert(btn().title.includes("Click to choose"), "button title hint follows the locale");
        localeService.setLocale("zh");
        assert(
          menuItem("standard").querySelector(".dshwm-label").textContent === "标准",
          "back to Chinese re-renders",
        );

        /* 9. disposer cleans everything up */
        dispose();
        assert(mutationCb === null, "mutation observer disconnected on dispose");
        assert(!fakeBody.children.includes(btn()), "button removed on dispose");
        assert(!fakeBody.children.includes(menu()), "menu removed on dispose");
        assert(!fakeBody.attrs.has("data-dsh-width"), "body attribute removed");
        assert(!("--dsh-chat-content-width" in remounted.style), "width override removed");
        console.log("\nAll assertions passed.");
        process.exit(0);
      }, 400);
    }, 400);
  }, 400);
}, 500);
