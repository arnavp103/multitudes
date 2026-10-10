/**
 * Turn a variant definition into concrete artefacts: SVG documents, the
 * light/dark accent palette, and the accent CSS custom properties.
 */
import { readFileSync } from "node:fs";

import { clampToGamut, css, hex, toDark } from "./color.mjs";
import { fmt } from "./geometry.mjs";

const wordmarks = JSON.parse(
  readFileSync(new URL("../wordmarks.json", import.meta.url), "utf8"),
);

/** Base-theme foregrounds from tooling/tailwind/theme.css, used for wordmark ink. */
export const ink = {
  light: hex([0.22, 0.015, 240]),
  dark: hex([0.94, 0.008, 240]),
};

/**
 * Light and dark OKLCH palettes for a variant (2–4 accents). In dark mode the
 * primary accent is kept at L ≥ 0.72 so dark text on it stays readable.
 */
export const palettes = (variant) => {
  const base = variant.palette.map(clampToGamut);
  const light = base.slice(0, 4);
  const dark = light
    .map(toDark)
    .map(([l, c, h], i) => [i === 0 ? Math.max(l, 0.72) : l, c, h]);
  return { light, dark };
};

const paintHex = (lch) => hex(lch);
const paintMono = () => "currentColor";

/** Inner SVG markup for the mark, favicon, or mono version in a given mode. */
export const drawMark = (variant, { mode = "light", kind = "mark" } = {}) => {
  const { light, dark } = palettes(variant);
  const p = mode === "dark" ? dark : light;
  if (kind === "mono")
    return variant.mark({ p, light, paint: paintMono, mono: true });
  return variant[kind]({ p, light, paint: paintHex, mono: false });
};

const svgDoc = (viewBox, inner, extra = "") =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"${extra}>${inner}</svg>\n`;

/** Standalone 64×64 SVG document. */
export const markSvg = (variant, options) =>
  svgDoc("0 0 64 64", drawMark(variant, options));

/**
 * Favicon that follows the browser's colour scheme: the light and dark
 * renderings are both embedded and toggled with `prefers-color-scheme`.
 */
export const faviconSvg = (variant) =>
  svgDoc(
    "0 0 64 64",
    `<style>.d{display:none}@media (prefers-color-scheme:dark){.l{display:none}.d{display:inline}}</style><g class="l">${drawMark(variant, { mode: "light", kind: "favicon" })}</g><g class="d">${drawMark(variant, { mode: "dark", kind: "favicon" })}</g>`,
  );

/**
 * Horizontal lockup: mark plus outlined wordmark, optically centred on the
 * mark. Pass `textColor` to override the wordmark ink (e.g. `currentColor`).
 */
export const lockupSvg = (
  variant,
  { mode = "light", textColor, mono = false } = {},
) => {
  const word = wordmarks[variant.font];
  const height = 27;
  const scale = height / (word.box.y2 - word.box.y1);
  const x = 64 + 14 - word.box.x1 * scale;
  const y = 32 - ((word.box.y1 + word.box.y2) / 2) * scale;
  const width = Math.ceil(64 + 14 + (word.box.x2 - word.box.x1) * scale + 6);
  const color = mono ? "currentColor" : (textColor ?? ink[mode]);
  const mark = drawMark(variant, { mode, kind: mono ? "mono" : "mark" });
  const text = `<path transform="translate(${fmt(x)} ${fmt(y)}) scale(${fmt(scale * 1000) / 1000})" d="${word.d}" fill="${color}"/>`;
  return svgDoc(`0 0 ${width} 64`, `${mark}${text}`);
};

/** The accent tokens for one variant, as plain data. */
export const tokens = (variant) => {
  const { light, dark } = palettes(variant);
  const describe = (lch) => ({ oklch: css(lch), hex: hex(lch) });
  return {
    light: light.map(describe),
    dark: dark.map(describe),
    lightInk: { oklch: "oklch(0.99 0 0)", hex: "#fcfcfc" },
    darkInk: {
      oklch: css([0.18, 0.03, dark[0][2]]),
      hex: hex([0.18, 0.03, dark[0][2]]),
    },
  };
};

/**
 * Accent CSS: the variant's `--brand-*` tokens per mode, plus the mapping onto
 * the shadcn accent variables. Only accent-related variables are overridden;
 * every neutral (background, card, border, …) stays with the base theme.
 */
export const accentCss = (variant) => {
  const t = tokens(variant);
  const block = (selector, colors, onBrand) =>
    [
      `${selector} {`,
      ...colors.map((c, i) => `  --brand-${i + 1}: ${c.oklch}; /* ${c.hex} */`),
      `  --brand-1-foreground: ${onBrand.oklch};`,
      "}",
    ].join("\n");
  return `/* ${variant.id} ${variant.name}: accent tokens derived from the mark. */
${block(":root", t.light, t.lightInk)}
${block(".dark", t.dark, t.darkInk)}

/* Mapping onto the base theme's accent slots. */
:root,
.dark {
  --primary: var(--brand-1);
  --primary-foreground: var(--brand-1-foreground);
  --ring: var(--brand-1);
  --accent: color-mix(in oklch, var(--brand-1) 13%, var(--background));
  --accent-foreground: color-mix(in oklch, var(--brand-1) 35%, var(--foreground));
  --sidebar-primary: var(--primary);
  --sidebar-primary-foreground: var(--primary-foreground);
  --sidebar-accent: var(--accent);
  --sidebar-accent-foreground: var(--accent-foreground);
  --sidebar-ring: var(--ring);
  --chart-1: var(--brand-1);
  --chart-2: var(--brand-2);
  --chart-3: var(--brand-3);
  --chart-4: var(--brand-4, color-mix(in oklch, var(--brand-1) 50%, var(--brand-3)));
  --chart-5: color-mix(in oklch, var(--brand-2) 50%, var(--brand-3));
}
`;
};
