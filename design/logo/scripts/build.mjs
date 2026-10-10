/**
 * Generate a round of logo explorations:
 *
 *   node design/logo/scripts/build.mjs 1
 *
 * Writes, per variant, `explorations/round-N/<id>-<slug>/`:
 *   mark.svg, mark-dark.svg      the mark for light / dark backgrounds
 *   lockup.svg, lockup-dark.svg  mark + outlined wordmark
 *   favicon.svg                  simplified mark for 16–32 px; follows
 *                                prefers-color-scheme
 *   mono.svg                     single colour (`currentColor`)
 *   accent.css                   `--brand-*` tokens + accent mapping
 * and, for the round, `palettes.json` and `contact-sheet.html`.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  accentCss,
  drawMark,
  faviconSvg,
  ink,
  lockupSvg,
  markSvg,
  tokens,
} from "../src/render.mjs";

const round = process.argv[2] ?? "1";
const { variants } = await import(`../src/round-${round}.mjs`);
const outDir = fileURLToPath(
  new URL(`../explorations/round-${round}/`, import.meta.url),
);

const files = (variant) => ({
  "mark.svg": markSvg(variant, { mode: "light" }),
  "mark-dark.svg": markSvg(variant, { mode: "dark" }),
  "lockup.svg": lockupSvg(variant, { mode: "light" }),
  "lockup-dark.svg": lockupSvg(variant, { mode: "dark" }),
  "favicon.svg": faviconSvg(variant),
  "mono.svg": markSvg(variant, { kind: "mono" }),
  "accent.css": accentCss(variant),
});

const folder = (variant) => `${variant.id}-${variant.slug}`;

variants.forEach((variant) => {
  const dir = join(outDir, folder(variant));
  mkdirSync(dir, { recursive: true });
  Object.entries(files(variant)).forEach(([name, body]) =>
    writeFileSync(join(dir, name), body),
  );
});

writeFileSync(
  join(outDir, "palettes.json"),
  `${JSON.stringify(
    Object.fromEntries(
      variants.map((v) => [v.id, { name: v.name, ...tokens(v) }]),
    ),
    null,
    2,
  )}\n`,
);

/* ---------------------------- contact sheet ---------------------------- */

const svg = (viewBox, inner, size) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" style="${size}">${inner}</svg>`;
const mark = (v, mode, kind, px) =>
  svg("0 0 64 64", drawMark(v, { mode, kind }), `width:${px}px;height:${px}px`);
const lockup = (v, mode, mono = false) =>
  lockupSvg(v, { mode, mono }).replace("<svg ", '<svg style="height:56px" ');

const swatches = (list, label) => `
  <div class="swatches">
    <span class="swatch-label">${label}</span>
    ${list
      .map(
        (c, i) => `<div class="swatch">
          <span class="chip" style="background:${c.hex}"></span>
          <code>--brand-${i + 1}</code>
          <code>${c.hex}</code>
          <code class="dim">${c.oklch}</code>
        </div>`,
      )
      .join("")}
  </div>`;

const card = (v) => {
  const t = tokens(v);
  return `
<section class="card" id="${v.id}">
  <header>
    <h2><span class="id">${v.id}</span> ${v.name}</h2>
    <p class="direction">${v.direction}</p>
    <p class="idea">${v.idea}</p>
  </header>
  <div class="grid">
    <div class="tile light big">${mark(v, "light", "mark", 160)}</div>
    <div class="tile dark big">${mark(v, "dark", "mark", 160)}</div>
    <div class="stack">
      <div class="tile light wide">${lockup(v, "light")}</div>
      <div class="tile dark wide">${lockup(v, "dark")}</div>
      <div class="row">
        <div class="tile light small">
          ${[16, 32, 48].map((s) => mark(v, "light", "favicon", s)).join("")}
          <span class="caption">favicon</span>
        </div>
        <div class="tile dark small">
          ${[16, 32, 48].map((s) => mark(v, "dark", "favicon", s)).join("")}
        </div>
        <div class="tile light small mono-light">${mark(v, "light", "mono", 48)}<span class="caption">mono</span></div>
        <div class="tile dark small mono-dark">${mark(v, "dark", "mono", 48)}</div>
      </div>
    </div>
  </div>
  ${swatches(t.light, "Light")}
  ${swatches(t.dark, "Dark")}
  <p class="font">Wordmark: ${v.font.replace(/_wght_/, " ").replace(/_/g, " ")}</p>
</section>`;
};

const overview = `
<section class="overview" id="overview">
  ${variants
    .map(
      (v) => `<figure>
        <div class="pair">
          <div class="tile light">${mark(v, "light", "mark", 96)}</div>
          <div class="tile dark">${mark(v, "dark", "mark", 96)}</div>
        </div>
        <figcaption><b>${v.id}</b> ${v.name}</figcaption>
      </figure>`,
    )
    .join("")}
</section>`;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Multitudes logo — round ${round}</title>
<style>
  :root { --paper: #f6f7f9; --ink: ${ink.light}; --night: oklch(0.145 0.009 240); --night-card: oklch(0.18 0.009 240); }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 32px; background: var(--paper); color: var(--ink); font: 14px/1.45 ui-sans-serif, system-ui, -apple-system, sans-serif; }
  h1 { font-size: 20px; margin: 0 0 24px; font-weight: 600; }
  .overview { display: grid; grid-template-columns: repeat(6, 1fr); gap: 18px; width: 1440px; padding: 24px; background: #fff; border-radius: 16px; margin-bottom: 40px; }
  .overview figure { margin: 0; }
  .overview .pair { display: grid; grid-template-columns: 1fr 1fr; border-radius: 12px; overflow: hidden; }
  .overview .tile { display: grid; place-items: center; padding: 14px 0; }
  .overview figcaption { margin-top: 8px; font-size: 13px; }
  .card { width: 1200px; background: #fff; border-radius: 16px; padding: 28px; margin-bottom: 40px; }
  .card header h2 { margin: 0; font-size: 22px; font-weight: 600; }
  .card .id { color: #6b7280; font-weight: 500; margin-right: 6px; }
  .direction { margin: 4px 0 0; color: #6b7280; font-size: 13px; }
  .idea { margin: 8px 0 20px; max-width: 70ch; }
  .grid { display: grid; grid-template-columns: 220px 220px 1fr; gap: 12px; }
  .stack { display: grid; gap: 12px; }
  .row { display: grid; grid-template-columns: 1.3fr 1.3fr 1fr 1fr; gap: 12px; }
  .tile { border-radius: 12px; display: flex; align-items: center; justify-content: center; gap: 14px; position: relative; }
  .tile.light { background: var(--paper); color: var(--ink); }
  .tile.dark { background: var(--night); color: ${ink.dark}; }
  .tile.big { height: 220px; }
  .tile.wide { height: 92px; justify-content: flex-start; padding-left: 24px; }
  .tile.small { height: 72px; }
  .caption { position: absolute; left: 10px; bottom: 4px; font-size: 10px; color: #8a8f98; }
  .swatches { display: flex; align-items: center; gap: 14px; margin-top: 18px; }
  .swatch-label { width: 44px; color: #6b7280; font-size: 12px; }
  .swatch { display: grid; grid-template-columns: 34px auto; grid-template-rows: auto auto auto; column-gap: 10px; font-size: 11.5px; width: 250px; }
  .chip { grid-row: 1 / span 3; width: 34px; height: 34px; border-radius: 8px; box-shadow: inset 0 0 0 1px rgb(0 0 0 / 0.08); }
  code { font-family: ui-monospace, SFMono-Regular, monospace; }
  .dim { color: #8a8f98; }
  .font { margin: 14px 0 0; font-size: 12px; color: #6b7280; }
</style>
</head>
<body>
<h1>Multitudes logo explorations, round ${round}</h1>
${overview}
${variants.map(card).join("\n")}
</body>
</html>
`;

writeFileSync(join(outDir, "contact-sheet.html"), html);
console.log(`Round ${round}: ${variants.length} variants written to ${outDir}`);
