/**
 * Outline the "Multitudes" wordmark in each candidate typeface and write the
 * glyph outlines to `design/logo/wordmarks.json`, so the generated SVGs never
 * depend on fonts being installed.
 *
 * This is a one-off exploration helper, not part of any build. It needs
 * `opentype.js` and the candidate TTFs (all SIL OFL, from Google Fonts):
 *
 *   OPENTYPE_DIR=/tmp/logo-tools FONT_DIR=/tmp/logo-tools/fonts \
 *     node design/logo/scripts/outline-wordmarks.mjs
 *
 * `OPENTYPE_DIR` is a directory containing `node_modules/opentype.js`; font
 * files are named after the keys of `faces` below.
 */
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(join(process.env.OPENTYPE_DIR, "package.json"));
const opentype = require("opentype.js");

/** Font file stem → [label, text, letter-spacing in em]. */
const faces = {
  Geist_wght_600: ["Geist 600", "Multitudes", -0.02],
  Geist_wght_500: ["Geist 500", "multitudes", -0.01],
  Instrument_Sans_wght_500: ["Instrument Sans 500", "multitudes", -0.01],
  Hanken_Grotesk_wght_500: ["Hanken Grotesk 500", "Multitudes", 0],
  Bricolage_Grotesque_wght_600: [
    "Bricolage Grotesque 600",
    "multitudes",
    -0.02,
  ],
  Outfit_wght_400: ["Outfit 400", "multitudes", 0],
  Sora_wght_500: ["Sora 500", "Multitudes", -0.02],
  Geist_Mono_wght_500: ["Geist Mono 500", "multitudes", -0.02],
  Familjen_Grotesk_wght_500: ["Familjen Grotesk 500", "Multitudes", 0],
  Gabarito_wght_600: ["Gabarito 600", "Multitudes", -0.01],
  Lexend_wght_300: ["Lexend 300", "multitudes", 0.02],
  Unbounded_wght_500: ["Unbounded 500", "multitudes", -0.02],
  Syne_wght_600: ["Syne 600", "Multitudes", 0],
  Instrument_Serif: ["Instrument Serif", "Multitudes", 0],
};

/** Lay out `text` at 100 units per em and return path data plus metrics. */
const outline = (font, text, tracking) => {
  const size = 100;
  const scale = size / font.unitsPerEm;
  const glyphs = font.stringToGlyphs(text);
  const { commands, x } = glyphs.reduce(
    (acc, glyph, index) => {
      const kern =
        index > 0 ? font.getKerningValue(glyphs[index - 1], glyph) * scale : 0;
      const at = acc.x + kern;
      return {
        commands: [...acc.commands, ...glyph.getPath(at, 0, size).commands],
        x: at + glyph.advanceWidth * scale + tracking * size,
      };
    },
    { commands: [], x: 0 },
  );
  const path = new opentype.Path();
  path.commands = commands;
  const box = path.getBoundingBox();
  return {
    d: path.toPathData(2),
    advance: x - tracking * size,
    capHeight: (font.tables.os2.sCapHeight || font.ascender * 0.7) * scale,
    xHeight: (font.tables.os2.sxHeight || font.ascender * 0.5) * scale,
    box: { x1: box.x1, y1: box.y1, x2: box.x2, y2: box.y2 },
  };
};

const fontDir = process.env.FONT_DIR;
const result = Object.fromEntries(
  Object.entries(faces).map(([stem, [label, text, tracking]]) => {
    const font = opentype.loadSync(join(fontDir, `${stem}.ttf`));
    return [stem, { label, text, ...outline(font, text, tracking) }];
  }),
);
const out = fileURLToPath(new URL("../wordmarks.json", import.meta.url));
writeFileSync(out, `${JSON.stringify(result, null, 1)}\n`);
console.log(`Wrote ${Object.keys(result).length} wordmarks to ${out}`);
