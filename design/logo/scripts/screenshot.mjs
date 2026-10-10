/**
 * Screenshot a round of logo explorations.
 *
 *   node design/logo/scripts/screenshot.mjs <round> <outDir> [sheet|app|all]
 *
 * `sheet` captures the contact sheet (overview + one card per variant).
 * `app` signs in to the local Studio started by `pnpm dev:up` (via
 * `pnpm dev:login studio admin`), then captures the dashboard in light and
 * dark mode for every variant with only its accent tokens and logo swapped
 * in, and composes the pair side by side. Development-only; never run it
 * against a deployed Studio.
 */
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { accentCss, lockupSvg } from "../src/render.mjs";

const repo = fileURLToPath(new URL("../../../", import.meta.url));
const require = createRequire(join(repo, "tooling/dev/package.json"));
const { chromium } = require("@playwright/test");

const [round = "1", outDir = "/tmp/logo-shots", what = "all"] =
  process.argv.slice(2);
const { variants } = await import(`../src/round-${round}.mjs`);
const sheetPath = fileURLToPath(
  new URL(`../explorations/round-${round}/contact-sheet.html`, import.meta.url),
);
const profile = JSON.parse(
  readFileSync(join(repo, ".local/profile.json"), "utf8"),
);
const studio = `http://localhost:${profile.studioPort}`;

const ensure = (dir) => (mkdirSync(dir, { recursive: true }), dir);

/** Capture the overview and each variant card from the contact sheet. */
const shootSheet = async (browser) => {
  const dir = ensure(join(outDir, `round-${round}`, "sheet"));
  const page = await browser.newPage({ deviceScaleFactor: 2 });
  await page.goto(pathToFileURL(sheetPath).href);
  await page
    .locator("#overview")
    .screenshot({ path: join(dir, "overview.png") });
  for (const v of variants) {
    await page
      .locator(`[id="${v.id}"]`)
      .screenshot({ path: join(dir, `${v.id}.png`) });
  }
  await page.close();
};

/** Run `pnpm dev:login studio admin` and return its one-time link. */
const loginLink = () =>
  new Promise((resolve, reject) => {
    const child = spawn("pnpm", ["dev:login", "studio", "admin"], {
      cwd: repo,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const onData = (chunk) => {
      const match = /(http:\/\/localhost:\d+\/\S+)/.exec(String(chunk));
      if (match) resolve({ url: match[1], child });
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.on("exit", (code) =>
      reject(new Error(`dev:login exited (${code}) before printing a link`)),
    );
  });

/** Sign in once and return the resulting storage state. */
const signIn = async (browser) => {
  const { url, child } = await loginLink();
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(url);
  await page.waitForURL((u) => u.origin === studio, { timeout: 30_000 });
  const state = await context.storageState();
  await context.close();
  child.kill("SIGINT");
  return state;
};

const shootDashboard = async (browser, state, mode, variant, path) => {
  const context = await browser.newContext({
    storageState: state,
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  await context.addInitScript((theme) => {
    localStorage.setItem("multitudes-theme", theme);
  }, mode);
  const page = await context.newPage();
  await page.goto(`${studio}/`, { waitUntil: "networkidle" });
  if (variant) {
    await page.addStyleTag({ content: accentCss(variant) });
    await page.evaluate(
      (svg) => {
        const slot = document.querySelector('[data-slot="logo"]');
        if (!slot) throw new Error("No [data-slot=logo] in the Studio shell");
        slot.innerHTML = svg;
        const el = slot.querySelector("svg");
        el.style.height = "30px";
        el.style.width = "auto";
      },
      lockupSvg(variant, { mode, textColor: "currentColor" }),
    );
  }
  // Hide the Next.js dev indicator and focus the task field so the focus
  // ring (an accent token) is visible alongside the primary button.
  await page.addStyleTag({ content: "nextjs-portal { display: none; }" });
  await page.focus("textarea");
  await page.waitForTimeout(150);
  await page.screenshot({ path, fullPage: true });
  await context.close();
};

/** Place the light and dark captures side by side in one image. */
const compose = async (browser, light, dark, path, title) => {
  const page = await browser.newPage({
    viewport: { width: 2904, height: 1000 },
  });
  const img = (p) =>
    `<img src="data:image/png;base64,${readFileSync(p).toString("base64")}">`;
  await page.setContent(`<body style="margin:0;background:#d9dce1;font:600 22px system-ui;color:#2a2f38">
    <div style="padding:12px 16px">${title}</div>
    <div style="display:flex;gap:8px;padding:0 8px 8px">${img(light)}${img(dark)}</div></body>`);
  await page.screenshot({ path, fullPage: true });
  await page.close();
};

const shootApp = async (browser) => {
  const dir = ensure(join(outDir, `round-${round}`, "app"));
  const raw = ensure(join(outDir, `round-${round}`, "raw"));
  const state = await signIn(browser);
  const targets = [
    { id: "current", label: "Current theme (no overrides)" },
    ...variants.map((v) => ({ id: v.id, label: `${v.id} ${v.name}`, v })),
  ];
  for (const { id, label, v } of targets) {
    const [light, dark] = ["light", "dark"].map((m) =>
      join(raw, `${id}-${m}.png`),
    );
    await shootDashboard(browser, state, "light", v, light);
    await shootDashboard(browser, state, "dark", v, dark);
    await compose(browser, light, dark, join(dir, `${id}.png`), label);
    console.log(`app: ${id}`);
  }
};

const browser = await chromium.launch();
try {
  if (what === "sheet" || what === "all") await shootSheet(browser);
  if (what === "app" || what === "all") await shootApp(browser);
} finally {
  await browser.close();
}
console.log(`Screenshots written to ${join(outDir, `round-${round}`)}`);
