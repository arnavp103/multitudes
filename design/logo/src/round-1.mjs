/**
 * Round 1 logo explorations. Each variant is pure data plus functions that
 * draw the mark into a 64×64 viewBox.
 *
 * Draw functions receive `{ p, paint, mono }`:
 * - `p`     the variant palette for the current mode (light or dark), as OKLCH
 * - `paint` turns an OKLCH triple into an SVG colour (hex, or `currentColor`
 *           for the single-colour version)
 * - `mono`  true when drawing the single-colour version
 *
 * `palette` lists the light-mode accents in token order: index 0 becomes
 * `--brand-1` (the primary/action accent), 1 → `--brand-2`, and so on.
 */
import { mix } from "./color.mjs";
import {
  arc,
  band,
  fmt,
  polyline,
  range,
  ribbon,
  sine,
  smooth,
  TAU,
  wavyRay,
} from "./geometry.mjs";

const stroke = (d, color, width, extra = "") =>
  `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"${extra}/>`;
const fill = (d, color, extra = "") =>
  `<path d="${d}" fill="${color}"${extra}/>`;

/** Shared draw for "n stacked sine strokes" families. */
const stackedStrokes = ({
  rows,
  x0,
  x1,
  amp,
  length,
  width,
  phase = Math.PI,
}) =>
  rows.map(({ cy, color, a = amp, ph = phase }) =>
    stroke(
      smooth(sine({ x0, x1, cy, amp: a, length, phase: ph, steps: 24 })),
      color,
      width,
    ),
  );

export const variants = [
  {
    id: "R1-01",
    slug: "triad",
    name: "Triad",
    idea: "Three in-phase sine strokes, 1.5 periods, heavy round caps. The plainest, most legible reading of the brief.",
    direction: "3 stripes · in phase · geometric · stroke",
    font: "Geist_wght_600",
    palette: [
      [0.45, 0.17, 268],
      [0.62, 0.15, 240],
      [0.8, 0.11, 195],
    ],
    mark: ({ p, paint }) =>
      stackedStrokes({
        x0: 10,
        x1: 54,
        amp: 4.5,
        length: 29.33,
        width: 8,
        rows: [18, 32, 46].map((cy, i) => ({ cy, color: paint(p[i]) })),
      }).join(""),
    favicon: ({ p, paint }) =>
      stackedStrokes({
        x0: 9,
        x1: 55,
        amp: 4,
        length: 30.67,
        width: 10.5,
        rows: [14, 32, 50].map((cy, i) => ({ cy, color: paint(p[i]) })),
      }).join(""),
  },
  {
    id: "R1-02",
    slug: "phase",
    name: "Phase",
    idea: "Seven hairline waves, each shifted a little further in phase, so the stack twists into a ribbon. Many voices, one shape.",
    direction: "7 lines · progressive phase · line art",
    font: "Instrument_Sans_wght_500",
    palette: [
      [0.5, 0.2, 295],
      [0.62, 0.22, 340],
      [0.82, 0.08, 300],
    ],
    mark: ({ p, paint }) =>
      range(0, 6, 6)
        .map((i) =>
          stroke(
            smooth(
              sine({
                x0: 8,
                x1: 56,
                cy: 15 + i * 5.7,
                amp: 6.5,
                length: 40,
                phase: (i * Math.PI) / 6,
                steps: 24,
              }),
            ),
            paint(mix(p[0], p[1], i / 6)),
            2.4,
          ),
        )
        .join(""),
    favicon: ({ p, paint }) =>
      range(0, 3, 3)
        .map((i) =>
          stroke(
            smooth(
              sine({
                x0: 8,
                x1: 56,
                cy: 17 + i * 10,
                amp: 7.5,
                length: 40,
                phase: (i * Math.PI) / 4,
                steps: 24,
              }),
            ),
            paint(mix(p[0], p[1], i / 3)),
            4.5,
          ),
        )
        .join(""),
  },
  {
    id: "R1-03",
    slug: "damped",
    name: "Damped",
    idea: "Four stripes that calm from a big swell to a flat line: noisy runs settling into signal, the evals story.",
    direction: "4 stripes · decaying amplitude · geometric · stroke",
    font: "Hanken_Grotesk_wght_500",
    palette: [
      [0.36, 0.09, 255],
      [0.55, 0.1, 240],
      [0.78, 0.09, 175],
      [0.88, 0.05, 85],
    ],
    mark: ({ p, paint }) =>
      stackedStrokes({
        x0: 9,
        x1: 55,
        length: 23,
        width: 6,
        rows: [
          { cy: 13, a: 6.5 },
          { cy: 26, a: 4.2 },
          { cy: 39, a: 2 },
          { cy: 51, a: 0.01 },
        ].map((row, i) => ({ ...row, color: paint(p[i]) })),
      }).join(""),
    favicon: ({ p, paint }) =>
      stackedStrokes({
        x0: 9,
        x1: 55,
        length: 23,
        width: 8.5,
        rows: [
          { cy: 15, a: 6 },
          { cy: 33, a: 3 },
          { cy: 50, a: 0.01 },
        ].map((row, i) => ({ ...row, color: paint(p[i]) })),
      }).join(""),
  },
  {
    id: "R1-04",
    slug: "brush",
    name: "Brush",
    idea: "Three loaded-brush strokes with tapering tails and a slight upward drift. Hand-made rather than engineered.",
    direction: "3 stripes · hand-drawn · variable width · filled",
    font: "Bricolage_Grotesque_wght_600",
    palette: [
      [0.32, 0.08, 270],
      [0.64, 0.19, 40],
      [0.8, 0.14, 85],
    ],
    mark: ({ p, paint }) => brush({ p, paint, maxWidth: 9 }),
    favicon: ({ p, paint }) => brush({ p, paint, maxWidth: 12 }),
  },
  {
    id: "R1-05",
    slug: "disc",
    name: "Disc",
    idea: "A sunset disc sliced by wave lines into five bands. Reads as a badge or a planet at small sizes.",
    direction: "5 bands · contained in circle · filled",
    font: "Outfit_wght_400",
    palette: [
      [0.42, 0.13, 350],
      [0.68, 0.17, 25],
      [0.82, 0.12, 65],
    ],
    mark: ({ p, paint }) =>
      disc({ p, paint, cuts: [15.5, 26.5, 37.5, 48.5], id: "r105" }),
    favicon: ({ p, paint }) =>
      disc({ p, paint, cuts: [22, 42], id: "r105f", gap: 2 }),
  },
  {
    id: "R1-06",
    slug: "arches",
    name: "Arches",
    idea: "Bouncing |sin| waves stacked three deep, so every row is a lowercase m. The monogram hides in the pattern.",
    direction: "3 stripes · cusped waves · monogram · stroke",
    font: "Sora_wght_500",
    palette: [
      [0.5, 0.19, 262],
      [0.62, 0.15, 160],
      [0.85, 0.18, 125],
    ],
    mark: ({ p, paint }) =>
      arches({ p, paint, rows: [24, 38, 52], width: 5, amp: 13 }),
    favicon: ({ p, paint }) =>
      arches({ p, paint, rows: [26, 44], width: 7.5, amp: 15 }),
  },
  {
    id: "R1-07",
    slug: "square",
    name: "Square",
    idea: "Square waves, quarter-period apart: a clock, a logic trace, a terminal. The most engineered direction.",
    direction: "3 stripes · stepped · offset phase · geometric",
    font: "Geist_Mono_wght_500",
    palette: [
      [0.55, 0.22, 262],
      [0.8, 0.16, 75],
      [0.55, 0.03, 250],
    ],
    mark: ({ p, paint }) =>
      square({ p, paint, width: 4.5, rows: [16, 32, 48] }),
    favicon: ({ p, paint }) =>
      square({ p, paint, width: 6, rows: [14, 32, 50] }),
  },
  {
    id: "R1-08",
    slug: "braid",
    name: "Braid",
    idea: "Two families of waves in opposite phase cross into a woven lattice. Ink with one cyan thread.",
    direction: "5+5 lines · interference · line art · near-mono",
    font: "Familjen_Grotesk_wght_500",
    palette: [
      [0.6, 0.13, 215],
      [0.3, 0.02, 250],
      [0.85, 0.1, 180],
    ],
    mark: ({ p, paint }) =>
      braid({ p, paint, rows: [16, 24, 32, 40, 48], width: 1.9, amp: 6 }),
    favicon: ({ p, paint }) =>
      braid({ p, paint, rows: [18, 32, 46], width: 3.6, amp: 7 }),
  },
  {
    id: "R1-09",
    slug: "fan",
    name: "Fan",
    idea: "Five wavy rays fanning out from one point, gaining amplitude as they travel. One prompt, many trajectories.",
    direction: "5 rays · radiating · prismatic · stroke",
    font: "Gabarito_wght_600",
    palette: [
      [0.55, 0.18, 255],
      [0.65, 0.2, 15],
      [0.8, 0.15, 75],
      [0.7, 0.15, 155],
    ],
    mark: ({ p, paint }) =>
      fan({
        p,
        paint,
        width: 3.8,
        rays: [
          [-36, mix(p[0], p[1], 0.5)],
          [-18, p[1]],
          [0, p[2]],
          [18, p[3]],
          [36, p[0]],
        ],
      }),
    favicon: ({ p, paint }) =>
      fan({
        p,
        paint,
        width: 6,
        rays: [
          [-32, p[1]],
          [0, p[2]],
          [32, p[0]],
        ],
      }),
  },
  {
    id: "R1-10",
    slug: "tile",
    name: "Tile",
    idea: "An app-icon tile with three waves knocked out of it; the middle wave carries the warm second accent.",
    direction: "3 stripes · contained in tile · negative space",
    font: "Geist_wght_600",
    palette: [
      [0.45, 0.2, 268],
      [0.75, 0.1, 275],
      [0.9, 0.12, 95],
    ],
    mark: (ctx) => tile({ ...ctx, inset: 4, width: 5, id: "r110" }),
    favicon: (ctx) => tile({ ...ctx, inset: 0, width: 7, id: "r110f" }),
  },
  {
    id: "R1-11",
    slug: "ripple",
    name: "Ripple",
    idea: "A drop and the rings it sends out, each ring slightly wavy. Waves read as propagation, not stripes.",
    direction: "4 arcs · radial · wobble · stroke",
    font: "Lexend_wght_300",
    palette: [
      [0.5, 0.1, 195],
      [0.72, 0.11, 190],
      [0.86, 0.06, 80],
    ],
    mark: ({ p, paint }) =>
      ripple({
        p,
        paint,
        width: 4.6,
        dot: 5,
        rings: [
          [17, p[0]],
          [27.5, mix(p[0], p[1], 0.5)],
          [38, p[1]],
          [48.5, p[2]],
        ],
      }),
    favicon: ({ p, paint }) =>
      ripple({
        p,
        paint,
        width: 7,
        dot: 7,
        still: true,
        rings: [
          [22, p[0]],
          [37, p[1]],
          [52, p[2]],
        ],
      }),
  },
  {
    id: "R1-12",
    slug: "pollen",
    name: "Pollen",
    idea: "Five rows of dots riding a wave, dot size swelling at the crests. Literally a multitude of points.",
    direction: "5×9 dots · halftone wave · filled",
    font: "Instrument_Sans_wght_500",
    palette: [
      [0.45, 0.1, 150],
      [0.62, 0.13, 135],
      [0.85, 0.17, 120],
    ],
    mark: ({ p, paint }) => pollen({ p, paint, cols: 9, rows: 5, size: 1 }),
    favicon: ({ p, paint }) =>
      pollen({ p, paint, cols: 5, rows: 3, size: 2.1 }),
  },
  {
    id: "R1-13",
    slug: "overprint",
    name: "Overprint",
    idea: "Three fat wave ribbons in CMY, a third of a period apart, overprinting like a riso pull. Overlaps make new colours.",
    direction: "3 ribbons · phase-offset · multiply overlap · filled",
    font: "Unbounded_wght_500",
    palette: [
      [0.58, 0.22, 350],
      [0.7, 0.13, 225],
      [0.88, 0.16, 95],
    ],
    mark: ({ p, paint, mono }) => overprint({ p, paint, mono, width: 12 }),
    favicon: ({ p, paint, mono }) => overprint({ p, paint, mono, width: 15 }),
  },
  {
    id: "R1-14",
    slug: "stairs",
    name: "Stairs",
    idea: "Four one-period wave segments climbing diagonally. Momentum and progress rather than a static stack.",
    direction: "4 segments · staggered offset · stroke",
    font: "Syne_wght_600",
    palette: [
      [0.45, 0.16, 0],
      [0.65, 0.17, 10],
      [0.85, 0.07, 20],
    ],
    mark: ({ p, paint }) =>
      stairs({
        paint,
        width: 5.5,
        steps: [
          [8, 51, p[0]],
          [16, 38, mix(p[0], p[1], 0.5)],
          [24, 25, p[1]],
          [32, 12, p[2]],
        ],
      }),
    favicon: ({ p, paint }) =>
      stairs({
        paint,
        width: 7.5,
        len: 26,
        steps: [
          [5, 50, p[0]],
          [19, 32, p[1]],
          [33, 14, p[2]],
        ],
      }),
  },
  {
    id: "R1-15",
    slug: "waveform",
    name: "Waveform",
    idea: "Vertical bars tracing a beating wave, like an audio meter. Stripes turned 90°; feels live and observable.",
    direction: "9 vertical bars · envelope · filled",
    font: "Geist_Mono_wght_500",
    palette: [
      [0.55, 0.16, 150],
      [0.85, 0.19, 125],
      [0.7, 0.16, 30],
    ],
    mark: ({ p, paint }) => waveform({ p, paint, bars: 9, gap: 2.4 }),
    favicon: ({ p, paint }) => waveform({ p, paint, bars: 5, gap: 4 }),
  },
  {
    id: "R1-16",
    slug: "cursive",
    name: "Cursive",
    idea: "Looping trochoid lines like handwriting or a seismograph trace. Three hands writing at once.",
    direction: "3 looped lines · calligraphic · line art",
    font: "Instrument_Serif",
    palette: [
      [0.55, 0.11, 70],
      [0.3, 0.03, 260],
      [0.85, 0.09, 90],
    ],
    mark: ({ p, paint }) =>
      [
        [19, 2.3, 4.4, p[1]],
        [33, 2.3, 4.4, p[0]],
        [47, 2.3, 4.4, p[2]],
      ]
        .map(([cy, a, b, c]) =>
          stroke(smooth(trochoid({ cy, a, b, turns: 3 })), paint(c), 2.8),
        )
        .join(""),
    favicon: ({ p, paint }) =>
      stroke(
        smooth(trochoid({ cy: 32, a: 3.4, b: 10, turns: 2 })),
        paint(p[0]),
        6,
      ),
  },
  {
    id: "R1-17",
    slug: "strata",
    name: "Strata",
    idea: "Layered wave fills inside a soft square: dusk sky over a sea. Calm, deep, more illustrative than graphic.",
    direction: "4 layers · stacked fills · contained",
    font: "Geist_wght_500",
    palette: [
      [0.35, 0.1, 275],
      [0.65, 0.12, 290],
      [0.85, 0.08, 50],
    ],
    mark: ({ p, paint, mono }) =>
      strata({ p, paint, mono, inset: 4, id: "r117" }),
    favicon: ({ p, paint, mono }) =>
      strata({ p, paint, mono, inset: 0, id: "r117f" }),
  },
  {
    id: "R1-18",
    slug: "globe",
    name: "Globe",
    idea: "Wavy latitude lines that thicken toward the equator, implying a sphere. A world of many; the equator in gold.",
    direction: "7 stripes · varying weight · contained in circle",
    font: "Outfit_wght_400",
    palette: [
      [0.5, 0.13, 165],
      [0.82, 0.1, 165],
      [0.8, 0.14, 85],
    ],
    mark: ({ p, paint }) => globe({ p, paint, count: 7, weight: 4.4 }),
    favicon: ({ p, paint }) => globe({ p, paint, count: 5, weight: 6.5 }),
  },
];

/* ------------------------------------------------------------------------ */
/* Draw helpers for the more involved variants.                              */
/* ------------------------------------------------------------------------ */

/** Deterministic wobble so the hand-drawn variant is stable between runs. */
const wobble = (seed) => (x) =>
  0.7 * Math.sin(x * 0.42 + seed * 1.7) + 0.12 * Math.sin(x * 0.9 + seed);

function brush({ p, paint, maxWidth }) {
  return [0, 1, 2]
    .map((i) => {
      const x0 = 7 + i * 1.5;
      const centre = sine({
        x0,
        x1: 57 - (2 - i) * 1.2,
        cy: 18 + i * 14,
        amp: 4.6,
        length: 34,
        phase: Math.PI * 0.95,
        steps: 40,
        warp: (x) => wobble(i)(x) - ((x - x0) / 50) * 3,
      });
      const width = (t) =>
        maxWidth *
        Math.min(1, 0.45 + t * 9) *
        (1 - 0.72 * t ** 1.8) *
        (1 + 0.06 * Math.sin(t * 11 + i));
      return fill(ribbon(centre, width), paint(p[i]));
    })
    .join("");
}

function disc({ p, paint, cuts, id, gap = 1.3 }) {
  const wave = (cy, offset) =>
    sine({
      x0: 2,
      x1: 62,
      cy: cy + offset,
      amp: 4,
      length: 28,
      phase: 0,
      steps: 40,
    });
  const edges = [null, ...cuts, null];
  const colors = range(0, 1, edges.length - 2).map((t) =>
    t < 0.5 ? mix(p[2], p[1], t * 2) : mix(p[1], p[0], (t - 0.5) * 2),
  );
  const bands = edges.slice(0, -1).map((top, i) => {
    const bottom = edges[i + 1];
    const upper =
      top === null
        ? [
            [2, 0],
            [62, 0],
          ]
        : wave(top, gap);
    const lower =
      bottom === null
        ? [
            [2, 64],
            [62, 64],
          ]
        : wave(bottom, -gap);
    const shape =
      top === null || bottom === null
        ? top === null
          ? `M2 0L62 0${polyline([...lower].reverse()).replace(/^M/, "L")}Z`
          : `${polyline(upper)}L62 64L2 64Z`
        : band(upper, lower);
    return fill(shape, paint(colors[i]));
  });
  return `<defs><clipPath id="${id}"><circle cx="32" cy="32" r="28"/></clipPath></defs><g clip-path="url(#${id})">${bands.join("")}</g>`;
}

function arches({ p, paint, rows, width, amp }) {
  return rows
    .map((cy, i) => {
      const pts = range(10, 54, 64).map((x) => [
        x,
        cy - amp * Math.abs(Math.sin((Math.PI * (x - 10)) / 22)),
      ]);
      return stroke(polyline(pts), paint(p[i]), width);
    })
    .join("");
}

function square({ p, paint, width, rows }) {
  const period = 19.2;
  return rows
    .map((cy, i) => {
      const shift = (i * period) / 4;
      const level = (x) =>
        cy +
        (Math.sin((TAU * (x - 8 + shift)) / period + 0.001) >= 0 ? -4.5 : 4.5);
      const pts = range(8, 56, 96).reduce((acc, x) => {
        const y = level(x);
        const last = acc.at(-1);
        if (!last) return [[x, y]];
        if (last[1] === y) return x === 56 ? [...acc, [x, y]] : acc;
        return [...acc, [x, last[1]], [x, y]];
      }, []);
      return `<path d="${polyline(pts)}" fill="none" stroke="${paint(p[i])}" stroke-width="${width}" stroke-linecap="square" stroke-linejoin="miter"/>`;
    })
    .join("");
}

function braid({ p, paint, rows, width, amp }) {
  const set = (sign, color) =>
    rows
      .map((cy) =>
        stroke(
          smooth(
            sine({ x0: 8, x1: 56, cy, amp: sign * amp, length: 32, steps: 24 }),
          ),
          color,
          width,
        ),
      )
      .join("");
  return set(1, paint(p[1])) + set(-1, paint(p[0]));
}

function fan({ paint, width, rays }) {
  const hub = `<circle cx="9" cy="32" r="${fmt(width * 0.95)}" fill="${paint(rays[Math.floor(rays.length / 2)][1])}"/>`;
  return (
    hub +
    rays
      .map(([angle, color]) =>
        stroke(
          smooth(
            wavyRay({
              origin: [9, 32],
              angle,
              length:
                angle === 0
                  ? 47
                  : 45 / Math.cos((angle * Math.PI) / 180) ** 0.25,
              amp: (t) => 3.4 * t,
              wavelength: 15,
              steps: 40,
            }).slice(7),
          ),
          paint(color),
          width,
        ),
      )
      .join("")
  );
}

function tile({ light: p, paint, mono, inset, width, id }) {
  const size = 64 - inset * 2;
  const rect = `<rect x="${inset}" y="${inset}" width="${size}" height="${size}" rx="${fmt(size * 0.25)}"`;
  const waves = [24, 32, 40].map((cy) =>
    smooth(
      sine({
        x0: 17,
        x1: 47,
        cy: cy + (cy - 32) * (inset ? 0 : 0.3),
        amp: 3.4,
        length: 20,
        phase: Math.PI,
        steps: 24,
      }),
    ),
  );
  if (mono) {
    return `<defs><mask id="${id}">${rect} fill="#fff"/>${waves.map((d) => stroke(d, "#000", width)).join("")}</mask></defs>${rect} fill="currentColor" mask="url(#${id})"/>`;
  }
  const colors = ["#ffffff", paint(p[2]), "#ffffff"];
  return `${rect} fill="${paint(p[0])}"/>${waves.map((d, i) => stroke(d, colors[i], width)).join("")}`;
}

function ripple({ paint, width, dot, rings, still = false }) {
  const [cx, cy] = [10, 54];
  const arcs = rings.map(([r, color], i) =>
    stroke(
      smooth(
        arc({
          cx,
          cy,
          r,
          from: -90,
          to: 0,
          wobble: still ? () => 0 : (t) => 0.9 * Math.sin(t * 7 + i * 1.6),
          steps: 30,
        }),
      ),
      paint(color),
      width,
    ),
  );
  return `<circle cx="${cx}" cy="${cy}" r="${dot}" fill="${paint(rings[0][1])}"/>${arcs.join("")}`;
}

function pollen({ p, paint, cols, rows, size }) {
  const xs = range(9, 55, cols - 1);
  const ys = range(13, 51, rows - 1);
  return ys
    .flatMap((cy, row) => {
      const t = rows === 1 ? 0 : row / (rows - 1);
      const color = paint(
        t < 0.5 ? mix(p[0], p[1], t * 2) : mix(p[1], p[2], (t - 0.5) * 2),
      );
      return xs.map((x) => {
        const theta = (TAU * (x - 9)) / 46 + row * 0.55;
        const y = cy + 3.6 * Math.sin(theta);
        const r = size * (1.5 + 1.25 * (0.5 + 0.5 * Math.cos(theta)));
        return `<circle cx="${fmt(x)}" cy="${fmt(y)}" r="${fmt(r)}" fill="${color}"/>`;
      });
    })
    .join("");
}

function overprint({ p, paint, mono, width }) {
  const ribbons = [
    [22, 0, p[1]],
    [32, TAU / 3, p[0]],
    [42, (2 * TAU) / 3, p[2]],
  ].map(([cy, phase, color]) =>
    stroke(
      smooth(
        sine({ x0: 13, x1: 51, cy, amp: 6, length: 38, phase, steps: 24 }),
      ),
      paint(color),
      width,
      mono ? ' stroke-opacity="0.55"' : ' style="mix-blend-mode:multiply"',
    ),
  );
  return `<g style="isolation:isolate">${ribbons.join("")}</g>`;
}

function stairs({ paint, width, steps, len = 20 }) {
  return steps
    .map(([x0, cy, color]) =>
      stroke(
        smooth(
          sine({
            x0,
            x1: x0 + len,
            cy,
            amp: 3.6,
            length: len,
            phase: Math.PI,
            steps: 16,
          }),
        ),
        paint(color),
        width,
      ),
    )
    .join("");
}

function waveform({ p, paint, bars, gap }) {
  const span = 50;
  const w = (span - gap * (bars - 1)) / bars;
  return range(0, bars - 1, bars - 1)
    .map((i) => {
      const t = i / (bars - 1);
      const env = Math.sin(Math.PI * (0.12 + t * 0.76));
      const h = Math.max(
        w,
        46 * env * (0.55 + 0.45 * Math.abs(Math.sin(t * 7.2 + 0.4))),
      );
      const x = 7 + i * (w + gap);
      const color = i === Math.floor(bars / 2) ? p[2] : mix(p[0], p[1], t);
      return `<rect x="${fmt(x)}" y="${fmt(32 - h / 2)}" width="${fmt(w)}" height="${fmt(h)}" rx="${fmt(w / 2)}" fill="${paint(color)}"/>`;
    })
    .join("");
}

/** Prolate trochoid (loops when b > a), centred horizontally in the box. */
function trochoid({ cy, a, b, turns }) {
  const tMax = turns * TAU;
  const width = a * tMax;
  const x0 = 32 - width / 2;
  return range(0, tMax, turns * 24).map((t) => [
    x0 + a * t - b * Math.sin(t),
    cy - b * Math.cos(t) + b * 0.0,
  ]);
}

function strata({ p, paint, mono, inset, id }) {
  const size = 64 - inset * 2;
  const clip = `<defs><clipPath id="${id}"><rect x="${inset}" y="${inset}" width="${size}" height="${size}" rx="${fmt(size * 0.3)}"/></clipPath></defs>`;
  const layer = (cy, phase) =>
    `${polyline(sine({ x0: 0, x1: 64, cy, amp: 4, length: 40, phase, steps: 32 }))}L64 64L0 64Z`;
  const layers = [
    [0, null, mix(p[2], p[2], 0)],
    [22, 0, p[1]],
    [35, 0.9, mix(p[0], p[1], 0.45)],
    [48, 1.8, p[0]],
  ];
  const shapes = layers.map(([cy, phase, color], i) => {
    const d = phase === null ? "M0 0H64V64H0Z" : layer(cy, phase);
    const c = mono ? "currentColor" : paint(color);
    const opacity = mono ? ` fill-opacity="${[0.25, 0.5, 0.75, 1][i]}"` : "";
    return fill(d, c, opacity);
  });
  return `${clip}<g clip-path="url(#${id})">${shapes.join("")}</g>`;
}

function globe({ p, paint, count, weight }) {
  const r = 27;
  const ys = range(-r * 0.86, r * 0.86, count - 1);
  return `<defs><clipPath id="globe-${count}"><circle cx="32" cy="32" r="${r}"/></clipPath></defs><g clip-path="url(#globe-${count})">${ys
    .map((dy, i) => {
      const k = Math.sqrt(1 - (dy / r) ** 2);
      const equator = i === (count - 1) / 2;
      return stroke(
        smooth(
          sine({
            x0: 2,
            x1: 62,
            cy: 32 + dy,
            amp: 2.6 * k,
            length: 26,
            phase: i * 0.5,
            steps: 32,
          }),
        ),
        paint(equator ? p[2] : p[0]),
        fmt(weight * (0.35 + 0.65 * k)),
      );
    })
    .join("")}</g>`;
}
