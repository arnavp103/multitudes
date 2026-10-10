/**
 * Pure geometry helpers for wave marks. Every function returns data or SVG
 * path strings; nothing touches the filesystem.
 */

/** @typedef {[number, number]} Point */

const TAU = Math.PI * 2;
const fmt = (n) => Number(n.toFixed(2)).toString();

/** Evenly spaced numbers from `a` to `b` inclusive. */
export const range = (a, b, n) =>
  Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);

/**
 * Sample a sine wave: y = cy + amp · sin(2π (x − x0) / length + phase).
 * @returns {Point[]}
 */
export const sine = ({
  x0,
  x1,
  cy,
  amp,
  length,
  phase = 0,
  steps = 48,
  warp = () => 0,
}) =>
  range(x0, x1, steps).map((x) => [
    x,
    cy + amp * Math.sin((TAU * (x - x0)) / length + phase) + warp(x),
  ]);

/** Polyline path through `points`. */
export const polyline = (points) =>
  points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${fmt(x)} ${fmt(y)}`)
    .join("");

/**
 * Smooth open curve through `points` (Catmull–Rom converted to cubic Béziers),
 * which keeps exported paths short and visually exact at any size.
 */
export const smooth = (points) => {
  const at = (i) => points[Math.max(0, Math.min(points.length - 1, i))];
  const segments = points.slice(1).map((p2, index) => {
    const i = index + 1;
    const [p0, p1, p3] = [at(i - 2), at(i - 1), at(i + 1)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    return `C${fmt(c1[0])} ${fmt(c1[1])} ${fmt(c2[0])} ${fmt(c2[1])} ${fmt(p2[0])} ${fmt(p2[1])}`;
  });
  return `M${fmt(points[0][0])} ${fmt(points[0][1])}${segments.join("")}`;
};

/** Closed region between an upper and lower curve sampled at the same x. */
export const band = (upper, lower) =>
  `${polyline(upper)}${polyline([...lower].reverse()).replace(/^M/, "L")}Z`;

/**
 * Variable-width stroke outline: offsets the centreline along its normals by
 * `width(t) / 2` (t ∈ [0, 1]) and closes the shape. Used for brush marks.
 */
export const ribbon = (points, width) => {
  const normals = points.map((_, i) => {
    const [a, b] = [
      points[Math.max(0, i - 1)],
      points[Math.min(points.length - 1, i + 1)],
    ];
    const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
    const len = Math.hypot(dx, dy) || 1;
    return [-dy / len, dx / len];
  });
  const side = (sign) =>
    points.map(([x, y], i) => {
      const w = (width(i / (points.length - 1)) / 2) * sign;
      return [x + normals[i][0] * w, y + normals[i][1] * w];
    });
  return `${smooth(side(1))}${smooth([...side(-1)].reverse()).replace(/^M/, "L")}Z`;
};

/** Points along a ray from `origin` at `angle` (degrees) with a wave across it. */
export const wavyRay = ({
  origin,
  angle,
  length,
  amp,
  wavelength,
  steps = 48,
}) => {
  const r = (angle * Math.PI) / 180;
  const [ux, uy] = [Math.cos(r), Math.sin(r)];
  return range(0, length, steps).map((s) => {
    const offset = amp(s / length) * Math.sin((TAU * s) / wavelength);
    return [origin[0] + ux * s - uy * offset, origin[1] + uy * s + ux * offset];
  });
};

/** Points along a circular arc with an optional radial wobble. */
export const arc = ({ cx, cy, r, from, to, wobble = () => 0, steps = 48 }) =>
  range(from, to, steps).map((deg) => {
    const t = (deg * Math.PI) / 180;
    const rr = r + wobble(t);
    return [cx + rr * Math.cos(t), cy + rr * Math.sin(t)];
  });

export { TAU, fmt };
