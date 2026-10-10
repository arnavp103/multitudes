/**
 * Minimal OKLCH helpers for the logo explorations: gamut-mapped conversion to
 * sRGB hex, CSS formatting, and the light → dark lightness transform used to
 * derive dark-mode accents from a mark's light-mode colours.
 */

/** @typedef {[number, number, number]} Lch  [lightness 0–1, chroma, hue°] */

const toLinearRgb = ([l, c, h]) => {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
};

const inGamut = (lch) =>
  toLinearRgb(lch).every((v) => v >= -0.0001 && v <= 1.0001);

/** Reduce chroma (keeping lightness and hue) until the colour fits in sRGB. */
export const clampToGamut = ([l, c, h]) => {
  if (inGamut([l, c, h])) return [l, c, h];
  const search = (lo, hi, steps) => {
    if (steps === 0) return lo;
    const mid = (lo + hi) / 2;
    return inGamut([l, mid, h])
      ? search(mid, hi, steps - 1)
      : search(lo, mid, steps - 1);
  };
  return [l, search(0, c, 24), h];
};

const encode = (v) => {
  const x = Math.min(1, Math.max(0, v));
  const s = x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
  return Math.round(s * 255)
    .toString(16)
    .padStart(2, "0");
};

/** Gamut-mapped sRGB hex for an OKLCH triple. */
export const hex = (lch) =>
  `#${toLinearRgb(clampToGamut(lch)).map(encode).join("")}`;

const round = (v, digits) => Number(v.toFixed(digits));

/** CSS `oklch()` string for a gamut-mapped OKLCH triple. */
export const css = (lch) => {
  const [l, c, h] = clampToGamut(lch);
  return `oklch(${round(l, 3)} ${round(c, 3)} ${round(h, 1)})`;
};

/**
 * Dark-mode counterpart of a light-mode accent: compress lightness into the
 * upper band so every stripe stays legible on the dark background.
 */
export const toDark = ([l, c, h]) => [0.45 + 0.5 * l, c, h];

/** Linear interpolation in OKLCH (shortest hue path). */
export const mix = ([l1, c1, h1], [l2, c2, h2], t) => {
  const dh = ((((h2 - h1) % 360) + 540) % 360) - 180;
  return [l1 + (l2 - l1) * t, c1 + (c2 - c1) * t, (h1 + dh * t + 360) % 360];
};
