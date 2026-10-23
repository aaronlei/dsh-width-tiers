/*
 * DOM-stub regression test for the dsh-width-tiers client bundle.
 * Loads lib/client.js through a fake __ModuleLoader__, calls apply(ctx) with
 * fake layout/locale services, and validates: tier restore, the app width
 * preference semantics (nominal target vs clamped inline, native preference
 * preservation), zero-layout
 * handling, sidebar ownership, custom-guide lifecycle (including
 * pointercancel), locale dictionaries, keyboard menu navigation, storage
 * synchronization, resize-frame deduplication, and the effect disposer.
 * Run: node test.cjs
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
/* pointer events check `e.target instanceof Element` */
global.Element = HTMLElement;

function makeEl(tag) {
  const el = {
    tagName: tag,
    attrs: new Map(),
    children: [],
    handlers: {},
    dataset: {},
    /* 0.1.7 width axis: tierPx clamps through the column width */
    offsetWidth: 2000,
    style: {
      setProperty(n, v) { this[n] = String(v); },
      removeProperty(n) { delete this[n]; },
      getPropertyValue(n) { return this[n] == null ? "" : String(this[n]); },
    },
    closest(sel) {
      if (sel === "[data-width-handle]") return this.attrs.has("data-width-handle") ? this : null;
      return null;
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
    removeAttribute(name) { this.attrs.delete(name); },
    set innerHTML(html) {
      this._html = String(html);
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
    focus() {
      document.activeElement = this;
    },
    blur() {
      if (document.activeElement === this) document.activeElement = null;
    },
    /* fixed geometry for positionGuide; enough to exercise both sides */
    getBoundingClientRect() {
      return { top: 120, height: 320, left: 820, right: 828 };
    },
    addEventListener(ev, fn) { (this.handlers[ev] ||= []).push(fn); },
    appendChild(el2) { el2.parentNode = this; el2.parentElement = this; this.children.push(el2); return el2; },
    removeChild(el2) {
      const i = this.children.indexOf(el2);
      if (i !== -1) this.children.splice(i, 1);
      el2.parentNode = null;
      el2.parentElement = null;
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
  closeRightbar() {
    log.push("layout.closeRightbar");
    detailsClosed = true;
  },
  closeDetails() {
    log.push("layout.closeDetails");
    detailsClosed = true;
  },
};

/* ---- fake locale service: uses the dictionaries the plugin registers ---- */
const localeListeners = new Set();
const registeredLocales = new Map();
let activeLocale = "zh";
const localeService = {
  register(ns, dicts) {
    registeredLocales.set(ns, dicts);
    return () => {
      registeredLocales.delete(ns);
    };
  },
  bind(ns) {
    return (key, params) => {
      const dicts = registeredLocales.get(ns);
      let s = dicts?.[activeLocale]?.[key] ?? dicts?.zh?.[key] ?? key;
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

/* fake ResizeObserver: tests fire the callback manually to simulate a column
 * width change (sidebar/rightbar/window), which full width must follow. */
let resizeObserverCb = null;
let resizeObserverDisconnected = false;
class ResizeObserverStub {
  constructor(cb) {
    resizeObserverCb = cb;
    resizeObserverDisconnected = false;
  }
  observe() {}
  disconnect() {
    resizeObserverDisconnected = true;
  }
}
global.ResizeObserver = ResizeObserverStub;

/* fake animation frames: heal runs on the next macrotask, well within the
 * test waits */
let rafCalls = 0;
global.requestAnimationFrame = (cb) => {
  rafCalls++;
  return setTimeout(() => cb(), 0);
};
global.cancelAnimationFrame = (id) => clearTimeout(id);

const docListeners = {};
global.document = {
  body: fakeBody,
  head: { appendChild() {} },
  createElement: makeEl,
  activeElement: null,
  contains: (el) => currentRoots.includes(el),
  querySelector(sel) {
    if (sel === "[data-shell-overlay]") return frameEl; // mount gate
    if (sel === "[data-sidebar-collapsed]") return sidebarCollapsed ? frameEl : null;
    if (sel === "[data-details-collapsed]") return detailsClosed ? frameEl : null;
    if (sel === "[data-sidebar-collapsed], [data-details-collapsed]") {
      return sidebarCollapsed || detailsClosed ? frameEl : null;
    }
    return null;
  },
  querySelectorAll(sel) {
    if (sel === "[class]" || sel === "[data-conversation-content]") return currentRoots;
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

const winListeners = {};
global.window = {
  addEventListener(ev, fn) {
    (winListeners[ev] ||= []).push(fn);
  },
  removeEventListener(ev, fn) {
    const l = winListeners[ev];
    if (l) {
      const i = l.indexOf(fn);
      if (i !== -1) l.splice(i, 1);
    }
  },
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
const disposers = [];
const ctx = {
  layout: layoutService,
  locale: localeService,
  effect(fn) {
    const d = fn();
    if (typeof d === "function") disposers.push(d);
    return d;
  },
};
mod.apply(ctx);
const disposeAll = () => {
  while (disposers.length > 0) {
    const d = disposers.pop();
    if (typeof d === "function") d();
  }
};
assert(
  JSON.stringify(mod.inject) === JSON.stringify(["layout", "locale"]),
  "bundle injects the layout + locale services",
);
const pluginLocales = registeredLocales.get("width-tiers");
assert(
  !!pluginLocales
    && JSON.stringify(Object.keys(pluginLocales.zh).sort()) === JSON.stringify(Object.keys(pluginLocales.en).sort()),
  "zh/en dictionaries have the same key set",
);

const toggleCalls = () => log.filter((x) => x === "layout.toggleSidebar").length;
const closeCalls = () =>
  log.filter((x) => x === "layout.closeDetails" || x === "layout.closeRightbar").length;
const btn = () => fakeBody.children.find((c) => c.id === "dsh-wide-toggle");
const menu = () => fakeBody.children.find((c) => c.id === "dsh-width-menu");
const menuItem = (tier) => menu().children.find((b) => b.getAttribute("data-tier") === tier);

/* the width axis the 0.1.7 app publishes on: the PARENT of the element that
 * declares --dsh-chat-content-width (ConversationWidthControls contract) */
const widthTargetEl = () => shellB;
const userWidth = () => shellB.style["--dsh-chat-user-width"];

/* 1. saved tier restored once the app shell mounts (details closed by default) */
setTimeout(() => {
  assert(!!btn() && !!menu(), "button and menu appended after mount");
  /* DSH's shortcut service treats any [role="menu"] as an open modal, even
   * when hidden; a closed menu must not carry the role. */
  assert(menu().getAttribute("role") === null, "closed menu has no role (does not block DSH shortcuts)");
  assert(fakeBody.getAttribute("data-dsh-width") === "wide", "saved tier restored");
  assert(userWidth() === "1280px", "user-width set on the app's publish target");
  assert(storage["dsh.conversation.contentWidth"] === "1280", "app preference mirrored");
  assert(!("dsh.wide" in storage), "old dsh.wide key migrated away");
  assert(toggleCalls() === 0, "wide tier does NOT touch the sidebar");
  assert(btn().classList.contains("active") === true, "button active");
  assert(
    menuItem("standard").querySelector(".dshwm-label").textContent === "标准",
    "zh tier labels by default",
  );
  assert(
    menuItem("standard").querySelector(".dshwm-value").textContent === "920px",
    "standard advertises the app default px at the live column",
  );
  assert(
    menuItem("medium").querySelector(".dshwm-value").textContent === "1120px",
    "medium advertises its nominal 1120px",
  );
  assert(
    menuItem("full").querySelector(".dshwm-value").textContent === "1824px",
    "full advertises the live maximum (column − 176px)",
  );
  assert(
    menuItem("custom").querySelector(".dshwm-value").textContent === "未设置",
    "custom reads 未设置 before the first drag",
  );
  assert(btn().title.includes("点击选择"), "button title hint in zh");

  /* 2. menu: pick full → sidebar collapsed via layout service, column max */
  btn().click();
  assert(menu().hidden === false, "menu opens");
  assert(menu().getAttribute("role") === "menu", "open menu exposes role=menu");
  menuItem("full").click();
  assert(fakeBody.getAttribute("data-dsh-width") === "full", "full selected");
  assert(sidebarCollapsed === true, "full collapses the sidebar");
  assert(toggleCalls() === 1, "layout.toggleSidebar called once");
  assert(userWidth() === "1824px", "full sets column minus the handle budget");
  assert(storage["dsh.widthTier"] === "full", "tier persisted");

  /* 3. standard restores the sidebar (we collapsed it) + removes override */
  btn().click();
  menuItem("standard").click();
  assert(sidebarCollapsed === false, "standard restores the sidebar");
  assert(toggleCalls() === 2, "toggleSidebar called again");
  assert(userWidth() === undefined, "standard removes the width override");
  assert(!("dsh.conversation.contentWidth" in storage), "standard clears the app preference");
  assert(btn().classList.contains("active") === false, "button inactive");

  /* 4. ultra (1400px) never touches the sidebar */
  btn().click();
  menuItem("ultra").click();
  assert(userWidth() === "1400px", "ultra sets 1400px");
  assert(toggleCalls() === 2, "ultra does NOT touch the sidebar");

  /* 4b. dragging a native handle hands the width over to the app: the plugin
   * flips to the custom tier on pointerdown, records the settled width on
   * pointerup, and the dragged width becomes re-selectable from the menu. */
  const handle = makeEl("div");
  handle.setAttribute("data-width-handle", "");
  const firePointer = (ev) => (docListeners[ev] || []).forEach((fn) => fn({ target: handle }));
  firePointer("pointerdown");
  assert(fakeBody.getAttribute("data-dsh-width") === "custom", "drag switches to the custom tier");
  assert(storage["dsh.widthTier"] === "custom", "custom tier persisted");
  assert(menuItem("custom").classList.contains("selected") === true, "custom selected in the menu");
  const guideEl0 = fakeBody.children.find((c) => c.id === "dsh-width-guide");
  assert(guideEl0.hidden === false, "a direct handle drag opens the live readout");
  assert(
    guideEl0.querySelector(".dshwg-text").textContent === "1400px",
    "the live readout starts at the current width",
  );
  shellB.style.setProperty("--dsh-chat-user-width", "1100px"); // the app's drag writes
  firePointer("pointerup");
  assert(storage["dsh.widthTierCustom"] === "1100", "dragged width recorded");
  assert(
    menuItem("custom").querySelector(".dshwm-value").textContent === "1100px",
    "custom menu item shows the dragged width",
  );
  assert(
    guideEl0.querySelector(".dshwg-text").textContent === "1100px",
    "the live readout settles on the dragged width",
  );

  /* 4b2. a SECOND drag keeps the readout (regression: only the first guided
   * drag showed the handle highlight + width bubble). */
  shellB.style.removeProperty("--dsh-chat-user-width");
  fakeRoot.__vars["--dsh-chat-content-width"] = "748px";
  firePointer("pointerdown");
  assert(
    fakeBody.attrs.get("data-dsh-width-guide") === "custom",
    "repeat drag re-highlights the handle",
  );
  assert(guideEl0.hidden === false, "repeat drag re-opens the live readout");
  shellB.style.setProperty("--dsh-chat-user-width", "1000px");
  fakeRoot.__vars["--dsh-chat-content-width"] = "1000px";
  (docListeners.pointermove || []).forEach((fn) => fn({ target: handle }));
  assert(
    guideEl0.querySelector(".dshwg-text").textContent === "1000px",
    "repeat drag updates the live readout",
  );
  firePointer("pointerup");
  assert(storage["dsh.widthTierCustom"] === "1000", "repeat drag records the new width");

  /* 4c. custom is re-selectable: wide then back to the dragged width */
  btn().click();
  menuItem("wide").click();
  assert(userWidth() === "1280px", "wide re-applies after a drag");
  btn().click();
  menuItem("custom").click();
  assert(userWidth() === "1000px", "custom re-applies the dragged width");
  assert(
    fakeBody.attrs.has("data-dsh-width-guide") === false,
    "a recorded custom pick applies directly (no guide)",
  );
  const closesBeforeSnapshot = closeCalls();

  /* 5. the rightbar is NEVER touched: reopening it while a non-standard tier
   * is active must survive the self-heal (regression: 1.0.x called
   * layout.closeRightbar on every heal, which retracted the grid track while
   * the seat stayed expanded — the panel then overlaid the conversation). */
  detailsClosed = false; // user expanded the rightbar
  mutationCb && mutationCb();
  setTimeout(() => {
    assert(detailsClosed === false, "self-heal does NOT close the rightbar");
    assert(closeCalls() === closesBeforeSnapshot, "no closeRightbar calls during heal");

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
        userWidth() === "1000px",
        "width re-applied to the remounted root after conversation switch",
      );
      assert(
        fakeBody.getAttribute("data-dsh-width") === "custom",
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
        assert(
          menuItem("standard").querySelector(".dshwm-value").textContent === "920px",
          "standard keeps a px value in English (no prose label)",
        );
        assert(
          menuItem("full").querySelector(".dshwm-value").textContent === "1824px",
          "full shows the live maximum in English",
        );
        localeService.setLocale("zh");
        assert(
          menuItem("standard").querySelector(".dshwm-label").textContent === "标准",
          "back to Chinese re-renders",
        );

        /* 8b. the picker advertises nominal px for the fixed tiers, while
         * standard/full resolve against the live column (full = the maximum). */
        assert(
          menuItem("standard").querySelector(".dshwm-value").textContent === "920px",
          "standard shows the app default px at the live column",
        );
        assert(
          menuItem("medium").querySelector(".dshwm-value").textContent === "1120px",
          "medium shows its nominal 1120px",
        );
        assert(
          menuItem("wide").querySelector(".dshwm-value").textContent === "1280px",
          "wide shows its nominal 1280px",
        );
        assert(
          menuItem("ultra").querySelector(".dshwm-value").textContent === "1400px",
          "ultra shows its nominal 1400px",
        );
        assert(
          menuItem("full").querySelector(".dshwm-value").textContent === "1824px",
          "full shows the live maximum (column − 176px)",
        );

        /* 8c. a narrower column updates standard/full but keeps the fixed
         * tiers at their nominal values. */
        remounted.offsetWidth = 1000;
        (winListeners.resize || []).forEach((fn) => fn());
        setTimeout(() => {
          assert(
            menuItem("standard").querySelector(".dshwm-value").textContent === "680px",
            "resize re-resolves standard through the app default",
          );
          assert(
            menuItem("wide").querySelector(".dshwm-value").textContent === "1280px",
            "resize keeps the nominal wide value",
          );
          assert(
            menuItem("full").querySelector(".dshwm-value").textContent === "824px",
            "resize re-resolves the full maximum",
          );

          /* 8d. custom before the first drag: picking it opens the right-edge
           * guide and the live readout follows the dragged transcript width. */
          delete storage["dsh.widthTierCustom"];
          btn().click();
          assert(
            menuItem("custom").querySelector(".dshwm-value").textContent === "未设置",
            "custom reads 未设置 again after clearing the record",
          );
          menuItem("custom").click();
          assert(fakeBody.getAttribute("data-dsh-width") === "custom", "guide pick selects custom");
          assert(
            fakeBody.getAttribute("data-dsh-width-guide") === "custom",
            "guide marker set on the body",
          );
          const guideEl = fakeBody.children.find((c) => c.id === "dsh-width-guide");
          assert(!!guideEl && guideEl.hidden === false, "guide bubble is visible");
          assert(
            guideEl.querySelector(".dshwg-text").textContent === "拖拽右侧边缘调整对话宽度",
            "guide shows the drag hint",
          );

          firePointer("pointerdown");
          assert(guideEl.dataset.mode === "live", "guide switches to the live readout on press");
          assert(
            guideEl.querySelector(".dshwg-text").textContent === "748px",
            "live readout starts at the current transcript width",
          );
          remounted.__vars["--dsh-chat-content-width"] = "900px";
          shellB.style.setProperty("--dsh-chat-user-width", "900px");
          (docListeners.pointermove || []).forEach((fn) => fn({ target: handle }));
          assert(
            guideEl.querySelector(".dshwg-text").textContent === "900px",
            "live readout follows the dragged width",
          );
          firePointer("pointerup");
          assert(storage["dsh.widthTierCustom"] === "900", "guide drag records the settled width");
          assert(
            menuItem("custom").querySelector(".dshwm-value").textContent === "900px",
            "custom menu item shows the recorded width",
          );

          (docListeners.keydown || []).forEach((fn) => fn({ key: "Escape" }));
          assert(guideEl.hidden === true, "Escape hides the guide");
          assert(
            fakeBody.attrs.has("data-dsh-width-guide") === false,
            "guide marker removed after Escape",
          );

          /* 9. regression checks for the P1-P3 fixes. Each resize waits one
           * frame, exactly like the browser's rAF-driven handler. */
          (async () => {
            const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
            const PREF = "dsh.conversation.contentWidth";

            /* 9. standard is the app-default reset: it clears the app
             * preference, including a native-drag value. */
            remounted.offsetWidth = 2000;
            storage[PREF] = "1000";
            shellB.style.setProperty("--dsh-chat-user-width", "1000px");
            btn().click();
            menuItem("standard").click();
            assert(!(PREF in storage), "standard clears the app preference");
            assert(userWidth() === undefined, "standard removes the width override");
            assert(
              menuItem("standard").querySelector(".dshwm-value").textContent === "920px",
              "standard advertises the app default",
            );

            /* 9a. a fixed tier picked on a narrow column stores the nominal
             * target, not the clamp; widening restores it. */
            remounted.offsetWidth = 1000;
            (winListeners.resize || []).forEach((fn) => fn());
            btn().click();
            menuItem("wide").click();
            assert(storage[PREF] === "1280", "narrow pick stores the unclamped wide target");
            assert(userWidth() === "824px", "narrow column applies the clamped width");
            remounted.offsetWidth = 2000;
            (winListeners.resize || []).forEach((fn) => fn());
            await wait(50);
            assert(userWidth() === "1280px", "widening restores the configured wide width");
            assert(storage[PREF] === "1280", "app preference stays at the nominal target");
            assert(
              menuItem("wide").querySelector(".dshwm-value").textContent === "1280px",
              "menu advertises the configured width after widening",
            );

            /* 9a2. two resize events share one animation frame. */
            const rafBefore = rafCalls;
            (winListeners.resize || []).forEach((fn) => fn());
            (winListeners.resize || []).forEach((fn) => fn());
            assert(rafCalls - rafBefore === 1, "two resize events share one animation frame");
            await wait(50);

            /* 9b. a zero-layout root keeps the nominal preference instead of
             * persisting the 640px floor; layout recovery applies the tier. */
            remounted.offsetWidth = 0;
            btn().click();
            menuItem("medium").click();
            assert(storage[PREF] === "1120", "zero-layout pick stores the nominal target");
            remounted.offsetWidth = 2000;
            (winListeners.resize || []).forEach((fn) => fn());
            await wait(50);
            assert(userWidth() === "1120px", "layout recovery applies the picked tier");
            assert(storage[PREF] === "1120", "layout recovery keeps the nominal target");

            /* 9c. pointercancel ends the live guide instead of leaving it
             * stuck in dragging mode. */
            btn().click();
            menuItem("custom").click();
            const leftHandle = makeEl("div");
            leftHandle.setAttribute("data-width-handle", "left");
            (docListeners.pointerdown || []).forEach((fn) => fn({ target: leftHandle }));
            const guideAfterPress = fakeBody.children.find((c) => c.id === "dsh-width-guide");
            assert(guideAfterPress.hidden === false, "left-handle press opens the live guide");
            (docListeners.pointercancel || []).forEach((fn) => fn({ target: leftHandle }));
            assert(guideAfterPress.hidden === true, "pointercancel closes the live guide");

            /* 9d. full -> custom -> standard restores the sidebar this plugin
             * collapsed. */
            btn().click();
            menuItem("full").click();
            const collapsedAfterFull = sidebarCollapsed;
            remounted.offsetWidth = 1500;
            resizeObserverCb && resizeObserverCb();
            assert(userWidth() === "1324px", "full follows the column width via ResizeObserver");
            remounted.offsetWidth = 2000;
            resizeObserverCb && resizeObserverCb();
            btn().click();
            menuItem("custom").click();
            btn().click();
            menuItem("standard").click();
            assert(collapsedAfterFull === true, "full collapses the sidebar");
            assert(sidebarCollapsed === false, "standard restores the plugin-owned sidebar after custom");

            /* 9e. another tab's tier change is adopted without rewriting it. */
            storage["dsh.widthTier"] = "wide";
            (winListeners.storage || []).forEach((fn) => fn({
              key: "dsh.widthTier",
              newValue: "wide",
              storageArea: window.localStorage,
            }));
            assert(fakeBody.getAttribute("data-dsh-width") === "wide", "storage event adopts the tier");
            assert(userWidth() === "1280px", "storage event applies the tier width");

            /* 9f. keyboard navigation: open focuses the active item, ArrowDown
             * moves, Escape closes and returns focus to the button. */
            btn().click();
            assert(
              document.activeElement === menuItem("wide"),
              "opening the menu focuses the active tier",
            );
            (docListeners.keydown || []).forEach((fn) => fn({ key: "ArrowDown", preventDefault() {} }));
            assert(
              document.activeElement === menuItem("ultra"),
              "ArrowDown moves to the next tier",
            );
            (docListeners.keydown || []).forEach((fn) => fn({ key: "Escape" }));
            assert(menu().hidden === true, "Escape closes the menu");
            assert(menu().getAttribute("role") === null, "closing the menu drops role=menu");
            assert(document.activeElement === btn(), "Escape returns focus to the button");

            /* 9g. one bar per tier distinguishes full from custom. */
            assert(
              (btn()._html.match(/<rect/g) || []).length === 6,
              "button icon renders one bar per tier",
            );

            /* 10. disposer cleans everything up, including the added
             * listeners and the plugin-owned app preference. */
            disposeAll();
            assert(mutationCb === null, "mutation observer disconnected on dispose");
            assert(!fakeBody.children.includes(btn()), "button removed on dispose");
            assert(!fakeBody.children.includes(menu()), "menu removed on dispose");
            assert(!fakeBody.children.includes(guideEl), "guide removed on dispose");
            assert(!fakeBody.attrs.has("data-dsh-width"), "body attribute removed");
            assert(!fakeBody.attrs.has("data-dsh-width-guide"), "guide attribute removed");
            assert(userWidth() === undefined, "width override removed on dispose");
            assert(!(PREF in storage), "plugin-owned app preference removed on dispose");
            assert((winListeners.resize || []).length === 0, "resize listener removed on dispose");
            assert((winListeners.load || []).length === 0, "load listener removed on dispose");
            assert((winListeners.storage || []).length === 0, "storage listener removed on dispose");
            assert((docListeners.pointermove || []).length === 0, "pointermove listener removed on dispose");
            assert((docListeners.pointercancel || []).length === 0, "pointercancel listener removed on dispose");
            assert(resizeObserverDisconnected === true, "width ResizeObserver disconnected on dispose");
            assert(registeredLocales.size === 0, "locale dictionaries unregistered on dispose");
            console.log("\nAll assertions passed.");
            process.exit(0);
          })().catch((error) => {
            console.error(error);
            process.exit(1);
          });
        }, 50);
      }, 400);
    }, 400);
  }, 400);
}, 500);
