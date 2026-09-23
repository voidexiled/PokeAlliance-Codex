#!/usr/bin/env node
// Local render + measure harness for Claude Design .dc.html artboards.
//
// It drives the real Design Component runtime (design-type/artifact-type/dc-runtime.js,
// served as the board's ./support.js) inside Playwright Chromium, so the output is what
// the Claude Design canvas shows. Board state is injected by subclassing the board's
// Component so the constructor merges --state into this.state.
//
// Usage:
//   node render.mjs <board.dc.html> [--state '{"view":"slots"}'] [--width 1440] [--height H]
//                   [--out shot.png] [--clip x,y,w,h | --selector css] [--pad 0] [--scale 1]
//                   [--measure out.json [--boxes '{"name":"css"}']] [--frame] [--quiet]
//   node render.mjs --all <dir> --outdir <dir> [--scale 1]
//
// Notes:
// - Default viewport is the artboard frame from canvas.json next to the board (w x h),
//   falling back to 1440 x 900. Screenshots are full page unless --clip/--selector/--frame.
// - /_blob/<id> is served from blobs/ through blob-map.json; Google Fonts load from the network.
// - Animations are disabled for screenshots (Playwright "disabled": finite animations jump
//   to their end state, infinite ones reset to their start frame).
// - --boxes adds to the measure file the box of the first element each selector matches, in
//   document coordinates (`boxes: { name: { x, y, w, h } | null }`, null when it matches
//   nothing visible): the anchors a site page is measured against (§14.5 step 1).
// - Every path this file resolves is relative to its own directory, so the harness runs from
//   any checkout of the repository.

import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// design/render/render.mjs -> repository root.
const REPO_PKG = path.resolve(HERE, '..', '..', 'package.json');
const requireRepo = createRequire(pathToFileURL(REPO_PKG));
const { chromium } = requireRepo('@playwright/test');

const RUNTIME_PATH = path.join(HERE, 'design-type', 'artifact-type', 'dc-runtime.js');
// blob-map.json stores paths relative to this directory (blobs/<file>.png).
const BLOB_MAP = JSON.parse(fs.readFileSync(path.join(HERE, 'blob-map.json'), 'utf8'));
const blobFile = (id) => (BLOB_MAP[id] ? path.resolve(HERE, BLOB_MAP[id]) : null);
const ORIGIN = 'http://design.local';

const MIME = {
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.css': 'text/css',
  '.js': 'text/javascript',
};

// ---------- CLI ----------

function parseArgs(argv) {
  const opts = { positional: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) {
      opts.positional.push(a);
      continue;
    }
    const key = a.slice(2);
    if (['frame', 'quiet', 'no-measure'].includes(key)) {
      opts[key] = true;
      continue;
    }
    opts[key] = argv[++i];
  }
  return opts;
}

function frameFor(boardPath) {
  const canvasPath = path.join(path.dirname(boardPath), 'canvas.json');
  try {
    const canvas = JSON.parse(fs.readFileSync(canvasPath, 'utf8'));
    const entry = canvas.boards && canvas.boards[path.basename(boardPath)];
    if (entry && entry.w && entry.h) return { w: entry.w, h: entry.h };
  } catch {
    /* no canvas.json */
  }
  return null;
}

// Appends a subclass that merges the requested state into the logic instance.
function injectState(src, state) {
  if (!state || !Object.keys(state).length) return src;
  const open = src.search(/<script[^>]*data-dc-script[^>]*>/);
  if (open < 0) return src;
  const close = src.indexOf('</script>', open);
  if (close < 0) return src;
  const json = JSON.stringify(state).replace(/</g, '\\u003c');
  const patch = `\n;Component = class extends Component { constructor(p) { super(p); this.state = Object.assign({}, this.state || {}, ${json}); } };\n`;
  return src.slice(0, close) + patch + src.slice(close);
}

// ---------- page measurement (runs in the browser) ----------

function measureInPage() {
  const host = document.querySelector('#dc-root > .sc-host');
  if (!host) return { error: 'no .sc-host' };
  const root = [...host.children].find(
    (e) => e.tagName === 'DIV' && !e.classList.contains('sc-logic-error'),
  );
  if (!root) return { error: 'no root div' };
  const RR = root.getBoundingClientRect();
  const sx = window.scrollX,
    sy = window.scrollY;
  const declaredHeight = parseFloat(root.style.height) || RR.height;
  const rootTop = RR.top;
  const rootBottom = RR.top + declaredHeight;
  const r1 = (v) => Math.round(v * 10) / 10;

  const cssPath = (el) => {
    const parts = [];
    let cur = el;
    while (cur && cur !== document.body && cur.id !== 'dc-root') {
      const p = cur.parentElement;
      if (!p) break;
      const idx = [...p.children].indexOf(cur) + 1;
      parts.unshift(`${cur.tagName.toLowerCase()}:nth-child(${idx})`);
      cur = p;
    }
    return '#dc-root > ' + parts.join(' > ');
  };

  const visible = (el) => {
    if (!el.checkVisibility) return true;
    return el.checkVisibility({ opacityProperty: true, visibilityProperty: true });
  };

  const isOverlay = (el, cs) => {
    if (cs.position !== 'absolute' && cs.position !== 'fixed') return false;
    return el.getAttribute('role') === 'tooltip' || el.classList.contains('tt');
  };

  // Clip rect from ancestors with non-visible overflow (up to, not including, `stop`).
  const clipCache = new Map();
  const clipOf = (el) => {
    if (clipCache.has(el)) return clipCache.get(el);
    let clip = { top: -Infinity, bottom: Infinity, left: -Infinity, right: Infinity };
    const p = el.parentElement;
    if (p && p !== document.body) {
      const pc = clipOf(p);
      clip = { ...pc };
      const cs = getComputedStyle(p);
      if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
        const r = p.getBoundingClientRect();
        clip.top = Math.max(clip.top, r.top);
        clip.bottom = Math.min(clip.bottom, r.bottom);
        clip.left = Math.max(clip.left, r.left);
        clip.right = Math.min(clip.right, r.right);
      }
    }
    clipCache.set(el, clip);
    return clip;
  };

  const paints = (cs) => {
    const bg = cs.backgroundColor;
    const hasBg = bg && bg !== 'transparent' && !/rgba\([^)]*,\s*0\)$/.test(bg);
    const hasImg = cs.backgroundImage && cs.backgroundImage !== 'none';
    const hasBorder = ['Top', 'Right', 'Bottom', 'Left'].some(
      (s) =>
        parseFloat(cs['border' + s + 'Width']) > 0 &&
        cs['border' + s + 'Style'] !== 'none' &&
        !/rgba\([^)]*,\s*0\)$/.test(cs['border' + s + 'Color']),
    );
    return hasBg || hasImg || hasBorder;
  };
  const REPLACED = new Set([
    'IMG',
    'SVG',
    'CANVAS',
    'VIDEO',
    'INPUT',
    'SELECT',
    'TEXTAREA',
    'PICTURE',
  ]);

  // Lowest painted content inside `scope` (excluding `scope` itself and `exclude` boxes).
  // opts.skipOverlays: ignore tooltip subtrees; opts.chromeCut: ignore full-height layout boxes.
  const contentBottom = (scope, opts = {}) => {
    let best = -Infinity,
      bestEl = null,
      bestKind = null;
    const consider = (bottom, top, left, right, el, kind) => {
      const c = clipOf(el);
      const b = Math.min(bottom, c.bottom);
      if (b <= Math.max(top, c.top) || Math.min(right, c.right) <= Math.max(left, c.left)) return;
      if (opts.within && (left >= opts.within.right || right <= opts.within.left)) return;
      if (b > best) {
        best = b;
        bestEl = el;
        bestKind = kind;
      }
    };
    const walk = (el) => {
      for (const child of el.children) {
        const cs = getComputedStyle(child);
        if (cs.display === 'none') continue;
        if (opts.skipOverlays && isOverlay(child, cs)) continue;
        if (!visible(child)) {
          if (cs.display !== 'contents') continue;
        }
        const r = child.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && !(opts.exclude && opts.exclude.has(child))) {
          const tag = child.tagName.toUpperCase();
          if (REPLACED.has(tag)) consider(r.bottom, r.top, r.left, r.right, child, 'replaced');
          else if (paints(cs)) {
            const chrome =
              opts.chromeCut && r.height > 0.5 * declaredHeight && r.bottom >= rootBottom - 2;
            if (!chrome) consider(r.bottom, r.top, r.left, r.right, child, 'box');
          }
        }
        if (child.tagName.toUpperCase() !== 'SVG') walk(child);
      }
      // Text nodes directly under el.
      for (const n of el.childNodes) {
        if (n.nodeType !== 3 || !n.nodeValue.trim()) continue;
        if (!visible(el)) continue;
        const range = document.createRange();
        range.selectNodeContents(n);
        for (const r of range.getClientRects()) {
          if (r.width > 0 && r.height > 0) consider(r.bottom, r.top, r.left, r.right, el, 'text');
        }
      }
    };
    walk(scope);
    return { bottom: best, el: bestEl, kind: bestKind };
  };

  const rootContent = contentBottom(root, {
    chromeCut: true,
    within: { left: RR.left, right: RR.right },
  });
  const contentHeight = rootContent.bottom === -Infinity ? 0 : rootContent.bottom - rootTop;

  // Visual box of a grid item: descend through unpainted single-element wrappers.
  const visualBox = (el) => {
    let cur = el;
    for (let d = 0; d < 4; d++) {
      const cs = getComputedStyle(cur);
      if (paints(cs)) return cur;
      const kids = [...cur.children].filter(
        (k) => getComputedStyle(k).display !== 'none' && !isOverlay(k, getComputedStyle(k)),
      );
      if (kids.length !== 1) return cur;
      cur = kids[0];
    }
    return el;
  };

  // Measures one multi-item container (a CSS grid, or a wrapping flex row).
  const measureContainer = (g, gcs, kind) => {
    const items = [...g.children].filter((c) => {
      const cs = getComputedStyle(c);
      if (cs.display === 'none' || cs.position === 'absolute' || cs.position === 'fixed')
        return false;
      const r = c.getBoundingClientRect();
      return r.width > 0 || r.height > 0;
    });
    if (items.length < 2) return null;
    const info = items.map((c, index) => {
      const r = c.getBoundingClientRect();
      const vb = visualBox(c);
      const vr = vb.getBoundingClientRect();
      const vcs = getComputedStyle(vb);
      const cb = contentBottom(vb, { skipOverlays: true });
      const inner = cb.bottom === -Infinity ? vr.top : Math.min(cb.bottom, vr.bottom);
      const zones = {};
      for (const z of vb.querySelectorAll('[data-zone]')) {
        const name = z.getAttribute('data-zone');
        if (name in zones || !visible(z)) continue;
        zones[name] = r1(z.getBoundingClientRect().top - vr.top);
      }
      return {
        index,
        top: r.top,
        left: r.left,
        el: c,
        h: r1(r.height),
        boxH: r1(vr.height),
        boxW: r1(vr.width),
        hollowBottom: r1(vr.bottom - inner),
        padBottom: r1(parseFloat(vcs.paddingBottom) + parseFloat(vcs.borderBottomWidth)),
        painted: paints(vcs),
        zones,
      };
    });
    const sorted = [...info].sort((a, b) => a.top - b.top);
    const rows = [];
    for (const it of sorted) {
      const row = rows.find((rw) => Math.abs(rw.top - it.top) <= 2);
      if (row) row.items.push(it);
      else rows.push({ top: it.top, items: [it] });
    }
    const rowOut = rows.map((rw) => {
      rw.items.sort((a, b) => a.left - b.left);
      const hs = rw.items.map((i) => i.boxH);
      const zoneNames = [...new Set(rw.items.flatMap((i) => Object.keys(i.zones)))];
      const zones = {};
      for (const zn of zoneNames) {
        const offs = rw.items.map((i) => (zn in i.zones ? i.zones[zn] : null));
        const present = offs.filter((v) => v !== null);
        zones[zn] = {
          offsets: offs,
          spread: present.length >= 2 ? r1(Math.max(...present) - Math.min(...present)) : 0,
          missing: offs.length - present.length,
        };
      }
      const out = {
        y: r1(rw.top - rootTop),
        children: rw.items.map((i) => i.index),
        heights: hs,
        heightSpread: r1(Math.max(...hs) - Math.min(...hs)),
        hollowBottom: rw.items.map((i) => i.hollowBottom),
        padBottom: rw.items.map((i) => i.padBottom),
      };
      const raw = rw.items.map((i) => i.h);
      if (raw.some((v, k) => Math.abs(v - hs[k]) > 0.5)) out.itemHeights = raw;
      if (zoneNames.length) out.zones = zones;
      return out;
    });
    const cols =
      kind === 'grid'
        ? gcs.gridTemplateColumns
            .replace(/\[[^\]]*\]/g, ' ')
            .trim()
            .split(/\s+/)
            .filter(Boolean).length
        : Math.max(...rowOut.map((r) => r.children.length));
    const gr = g.getBoundingClientRect();
    const painted = info.filter((i) => i.painted).length;
    // A "card" is a painted box big enough to hold a title plus content (chips, bars, slots excluded).
    const cardLike = info.filter((i) => i.painted && i.boxH >= 56 && i.boxW >= 96).length;
    return {
      kind,
      path: cssPath(g),
      rect: { x: r1(gr.left + sx), y: r1(gr.top + sy), w: r1(gr.width), h: r1(gr.height) },
      columns: cols,
      children: items.length,
      painted,
      cards: cardLike * 2 >= items.length,
      inTooltip: !!g.closest('[role="tooltip"]'),
      alignItems: gcs.alignItems,
      label: (items[0].innerText || '').replace(/\s+/g, ' ').trim().slice(0, 48),
      maxSpread: Math.max(...rowOut.map((r) => r.heightSpread)),
      rows: rowOut,
    };
  };

  const grids = [];
  const flexWraps = [];
  for (const g of [root, ...root.querySelectorAll('*')]) {
    const gcs = getComputedStyle(g);
    const isGrid = gcs.display === 'grid' || gcs.display === 'inline-grid';
    const isWrap =
      (gcs.display === 'flex' || gcs.display === 'inline-flex') &&
      gcs.flexWrap !== 'nowrap' &&
      gcs.flexDirection.startsWith('row');
    if (!isGrid && !isWrap) continue;
    if (!visible(g)) continue;
    const m = measureContainer(g, gcs, isGrid ? 'grid' : 'flex-wrap');
    if (!m) continue;
    (isGrid ? grids : flexWraps).push(m);
  }

  const text = root.innerText || '';
  const holes = text.match(/\{\{[^}]*\}\}/g) || [];
  const brokenImgs = [...root.querySelectorAll('img')]
    .filter((i) => visible(i) && (!i.complete || i.naturalWidth === 0))
    .map((i) => i.getAttribute('src'));
  const fonts = [...document.fonts]
    .filter((f) => f.status === 'loaded')
    .map((f) => `${f.family.replace(/"/g, '')} ${f.weight}`);

  return {
    declaredHeight: r1(declaredHeight),
    renderedHeight: r1(RR.height),
    width: r1(RR.width),
    contentHeight: r1(contentHeight),
    overflow: contentHeight > declaredHeight + 0.5,
    emptyTail: r1(declaredHeight - contentHeight),
    lowest: rootContent.el ? { path: cssPath(rootContent.el), kind: rootContent.kind } : null,
    rawHoles: holes,
    brokenImages: brokenImgs,
    webFontsLoaded: [...new Set(fonts)],
    grids,
    flexWraps,
  };
}

// ---------- rendering ----------

async function openBoard(browser, boardPath, opts) {
  const abs = path.resolve(boardPath);
  const name = path.basename(abs);
  const frame = frameFor(abs);
  const width = opts.width ? Number(opts.width) : frame ? frame.w : 1440;
  const height = opts.height ? Number(opts.height) : frame ? frame.h : 900;
  const scale = opts.scale ? Number(opts.scale) : 1;
  const state = opts.state ? JSON.parse(opts.state) : null;
  const src = injectState(fs.readFileSync(abs, 'utf8'), state);
  const runtime = fs.readFileSync(RUNTIME_PATH, 'utf8');

  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: scale,
  });
  const page = await context.newPage();
  const log = { missingBlobs: new Set(), errors: [], warnings: [] };

  page.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'error') log.errors.push(t);
    else if (m.type() === 'warning' && t.includes('dc-runtime')) log.warnings.push(t);
  });
  page.on('pageerror', (e) => log.errors.push(String(e)));

  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === ORIGIN) {
      const p = decodeURIComponent(url.pathname);
      if (p === '/' + name)
        return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: src });
      if (p === '/support.js')
        return route.fulfill({ status: 200, contentType: 'text/javascript', body: runtime });
      const m = p.match(/^\/_blob\/([0-9a-f]+)/);
      if (m) {
        const file = blobFile(m[1]);
        if (file && fs.existsSync(file)) {
          return route.fulfill({
            status: 200,
            contentType: MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
            body: fs.readFileSync(file),
          });
        }
        log.missingBlobs.add(m[1]);
        return route.fulfill({ status: 404, body: '' });
      }
      return route.fulfill({ status: 404, body: '' });
    }
    if (
      /(^|\.)fonts\.(googleapis|gstatic)\.com$/.test(url.hostname) ||
      url.hostname === 'cdn.jsdelivr.net'
    ) {
      return route.continue().catch(() => {});
    }
    return route.abort();
  });

  await page.goto(`${ORIGIN}/${encodeURIComponent(name)}`, { waitUntil: 'load' });
  await page.waitForFunction(
    () => {
      const h = document.querySelector('#dc-root > .sc-host');
      return h && h.children.length > 0 && !document.querySelector('.sc-placeholder');
    },
    null,
    { timeout: 30000 },
  );
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      [...document.images].map((img) =>
        img.complete
          ? null
          : new Promise((r) => {
              img.onload = img.onerror = r;
            }),
      ),
    );
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
  await page.waitForLoadState('networkidle').catch(() => {});
  return { page, context, log, width, height, frame };
}

async function renderOne(browser, boardPath, opts) {
  const { page, context, log, width, height } = await openBoard(browser, boardPath, opts);
  try {
    let measure = null;
    if (opts.measure) {
      measure = await page.evaluate(measureInPage);
      measure.board = path.basename(boardPath);
      measure.state = opts.state ? JSON.parse(opts.state) : {};
      measure.viewport = { width, height };
      measure.missingBlobs = [...log.missingBlobs];
      measure.consoleErrors = log.errors;
      if (opts.boxes) {
        const sy = await page.evaluate(() => window.scrollY);
        const sx = await page.evaluate(() => window.scrollX);
        measure.boxes = {};
        for (const [name, selector] of Object.entries(JSON.parse(opts.boxes))) {
          const target = page.locator(selector).first();
          const box = (await target.count()) > 0 ? await target.boundingBox() : null;
          measure.boxes[name] = box
            ? { x: box.x + sx, y: box.y + sy, w: box.width, h: box.height }
            : null;
        }
      }
      fs.mkdirSync(path.dirname(path.resolve(opts.measure)), { recursive: true });
      fs.writeFileSync(opts.measure, JSON.stringify(measure, null, 1));
    }
    if (opts.out) {
      const shot = { path: opts.out, animations: 'disabled', caret: 'hide' };
      const pad = opts.pad ? Number(opts.pad) : 0;
      if (opts.clip) {
        const [x, y, w, h] = opts.clip.split(',').map(Number);
        shot.clip = { x, y, width: w, height: h };
        shot.fullPage = true;
      } else if (opts.selector) {
        const box = await page.locator(opts.selector).first().boundingBox();
        if (!box) throw new Error('selector not found or not visible: ' + opts.selector);
        const sy = await page.evaluate(() => window.scrollY);
        shot.clip = {
          x: Math.max(0, box.x - pad),
          y: Math.max(0, box.y + sy - pad),
          width: box.width + 2 * pad,
          height: box.height + 2 * pad,
        };
        shot.fullPage = true;
      } else if (opts.frame) {
        shot.clip = { x: 0, y: 0, width, height };
        shot.fullPage = true;
      } else {
        shot.fullPage = true;
      }
      fs.mkdirSync(path.dirname(path.resolve(opts.out)), { recursive: true });
      await page.screenshot(shot);
    }
    if (!opts.quiet) {
      const tag = path.basename(boardPath) + (opts.state ? ' ' + opts.state : '');
      if (log.missingBlobs.size)
        console.warn(`[${tag}] missing blobs: ${[...log.missingBlobs].join(' ')}`);
      if (log.errors.length)
        console.warn(`[${tag}] console errors:\n  ` + log.errors.slice(0, 8).join('\n  '));
      if (log.warnings.length)
        console.warn(`[${tag}] runtime warnings:\n  ` + log.warnings.slice(0, 8).join('\n  '));
      if (measure) {
        console.log(
          `[${tag}] declared ${measure.declaredHeight} content ${measure.contentHeight} tail ${measure.emptyTail}` +
            `${measure.overflow ? ' OVERFLOW' : ''} grids ${measure.grids.length} wraps ${measure.flexWraps.length}` +
            ` fonts [${measure.webFontsLoaded.join(', ')}]` +
            `${measure.rawHoles.length ? ' HOLES ' + measure.rawHoles.join(',') : ''}` +
            `${measure.brokenImages.length ? ' BROKEN-IMG ' + measure.brokenImages.length : ''}`,
        );
      }
      if (opts.out) console.log(`[${tag}] -> ${opts.out}`);
    }
    return measure;
  } finally {
    await context.close();
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const browser = await chromium.launch();
  try {
    if (opts.all) {
      const dir = path.resolve(opts.all);
      const outdir = path.resolve(opts.outdir || dir);
      fs.mkdirSync(outdir, { recursive: true });
      const boards = fs
        .readdirSync(dir)
        .filter((f) => f.endsWith('.dc.html'))
        .sort();
      for (const b of boards) {
        const base = b.replace(/\.dc\.html$/, '');
        await renderOne(browser, path.join(dir, b), {
          ...opts,
          all: undefined,
          out: path.join(outdir, base + '.png'),
          measure: path.join(outdir, base + '.measure.json'),
        });
      }
      return;
    }
    const board = opts.positional[0];
    if (!board) {
      console.error(
        'usage: node render.mjs <board.dc.html> [--state json] [--width N] [--height N] [--out png] [--clip x,y,w,h | --selector css] [--pad N] [--scale N] [--measure json] [--frame]\n       node render.mjs --all <dir> --outdir <dir>',
      );
      process.exitCode = 2;
      return;
    }
    if (!opts.out && !opts.measure) opts.out = board.replace(/\.dc\.html$/, '') + '.png';
    await renderOne(browser, board, opts);
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
