"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef } from "react";

import { useTachyonDirection } from "./tachyon";

/**
 * Fixed, decorative layer behind the app chrome. Each direction shows one
 * child (see tooling/tailwind/tachyon/base.css); only the active direction's
 * animation runs. Everything is aria-hidden and ignores the pointer.
 */
export function TachyonBackdrop() {
  const [direction] = useTachyonDirection();
  return (
    <div data-slot="tachyon-backdrop" aria-hidden>
      <ConstructionCurves />
      <ParticleField active={direction === "d2"} />
      <Orbits />
      <CelRibbons />
    </div>
  );
}

/** D1: a cubic Bezier with handles and its de Casteljau construction at t = 1/2. */
function ConstructionCurves() {
  const handle = { strokeWidth: 1, strokeDasharray: "none" };
  return (
    <svg
      data-backdrop="d1"
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMaxYMax slice"
      fill="none"
      stroke="currentColor"
      style={{ color: "var(--tc-ink)", opacity: 0.3 }}
    >
      <path
        className="tc-draw"
        pathLength={1}
        strokeWidth={1.5}
        d="M560 900 C760 560 1160 980 1380 330"
      />
      <path
        className="tc-draw"
        pathLength={1}
        strokeWidth={1.25}
        d="M1010 130 C1110 40 1250 210 1420 96"
      />
      <g className="tc-fade" style={handle}>
        <line x1={560} y1={900} x2={760} y2={560} />
        <line x1={1380} y1={330} x2={1160} y2={980} />
        <line x1={1010} y1={130} x2={1110} y2={40} />
        <line x1={1420} y1={96} x2={1250} y2={210} />
        <rect x={756} y={556} width={8} height={8} />
        <rect x={1156} y={976} width={8} height={8} />
        <rect x={1106} y={36} width={8} height={8} />
        <rect x={1246} y={206} width={8} height={8} />
        <circle cx={1380} cy={330} r={3.5} />
        <circle cx={1010} cy={130} r={3.5} />
        <circle cx={1420} cy={96} r={3.5} />
      </g>
      <g className="tc-fade" strokeDasharray="4 5" strokeWidth={1}>
        <polyline points="660,730 960,770 1270,655" />
        <line x1={810} y1={750} x2={1115} y2={712.5} />
      </g>
      <g className="tc-fade" fill="currentColor" stroke="none">
        {[
          [660, 730],
          [960, 770],
          [1270, 655],
          [810, 750],
          [1115, 712.5],
        ].map(([cx, cy]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={2.5} />
        ))}
      </g>
      <g className="tc-fade" strokeWidth={1.25}>
        <circle cx={962.5} cy={731.25} r={7} />
        <line x1={948} y1={731.25} x2={977} y2={731.25} />
        <line x1={962.5} y1={717} x2={962.5} y2={746} />
      </g>
      <g
        className="tc-fade"
        fill="currentColor"
        stroke="none"
        style={{ fontFamily: "var(--tc-font-note)", fontSize: 18 }}
      >
        <text x={984} y={706}>
          t = 1/2
        </text>
        <text x={772} y={548}>
          P1
        </text>
        <text x={1176} y={968}>
          P2
        </text>
        <text x={1394} y={322}>
          P3
        </text>
      </g>
    </svg>
  );
}

/** D3: slow orbital linework with a degree ring and a transfer arc. */
function Orbits() {
  const ticks = Array.from({ length: 12 }, (_, index) => index * 30);
  return (
    <svg
      data-backdrop="d3"
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMaxYMax slice"
      fill="none"
      stroke="currentColor"
      style={{ color: "var(--tc-ink)", opacity: 0.32 }}
    >
      <g className="tc-orbit">
        <circle
          cx={1180}
          cy={760}
          r={430}
          strokeDasharray="1 11"
          strokeWidth={6}
        />
        <g
          fill="currentColor"
          stroke="none"
          style={{ fontFamily: "var(--tc-font-data)", fontSize: 11 }}
        >
          {ticks.map((degrees) => {
            const radians = ((degrees - 90) * Math.PI) / 180;
            return (
              <text
                key={degrees}
                x={1180 + 462 * Math.cos(radians)}
                y={760 + 462 * Math.sin(radians)}
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {String(degrees).padStart(3, "0")}
              </text>
            );
          })}
        </g>
      </g>
      <ellipse
        cx={1180}
        cy={760}
        rx={600}
        ry={290}
        transform="rotate(-18 1180 760)"
        strokeWidth={1}
      />
      <g className="tc-orbit-reverse">
        <circle cx={1180} cy={760} r={250} strokeWidth={1} />
        {[0, 90, 180, 270].map((degrees) => (
          <rect
            key={degrees}
            x={1180 - 5}
            y={760 - 250 - 5}
            width={10}
            height={10}
            transform={`rotate(${degrees} 1180 760) rotate(45 1180 510)`}
            style={{ fill: "var(--tachyon-signal)", stroke: "none" }}
          />
        ))}
      </g>
      <path
        className="tc-draw"
        pathLength={1}
        strokeDasharray="6 6"
        strokeWidth={1.25}
        d="M930 760 C930 520 1180 360 1420 470"
        style={{ stroke: "var(--tachyon-signal)" }}
      />
      <g strokeWidth={1}>
        <line x1={1160} y1={760} x2={1200} y2={760} />
        <line x1={1180} y1={740} x2={1180} y2={780} />
      </g>
    </svg>
  );
}

/** D4: cel-shaded Bezier ribbons (base, hard shade, broken highlight) and a doodle. */
function CelRibbons() {
  const outline: CSSProperties = {
    stroke: "var(--tc-outline)",
    strokeWidth: 1.5,
    strokeLinejoin: "round",
  };
  const ribbonA =
    "M-50 760 C260 640 520 860 820 760 C1120 660 1260 600 1500 690 L1500 800 C1300 720 1000 930 820 880 C600 830 260 770 -50 890 Z";
  const ribbonB =
    "M1080 -40 C1190 90 1310 40 1500 120 L1500 214 C1330 124 1190 196 1080 56 Z";
  return (
    <svg
      data-backdrop="d4"
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMax slice"
      fill="none"
    >
      <g className="tc-drift">
        <path
          d={ribbonA}
          transform="translate(9 14)"
          style={{
            fill: "color-mix(in oklab, var(--tachyon-signal) 40%, var(--tc-shade))",
          }}
        />
        <path
          d={ribbonA}
          style={{
            ...outline,
            fill: "color-mix(in oklab, var(--tachyon-signal) 26%, var(--tc-paper))",
          }}
        />
        <path
          d="M40 752 C280 672 500 846 820 772"
          strokeDasharray="300 26 40 600"
          style={{
            stroke: "oklch(1 0 0 / 0.7)",
            strokeWidth: 4,
            strokeLinecap: "round",
          }}
        />
      </g>
      <g className="tc-drift-slow">
        <path
          d={ribbonB}
          transform="translate(-8 12)"
          style={{
            fill: "color-mix(in oklab, var(--tachyon-flare) 45%, var(--tc-shade))",
          }}
        />
        <path
          d={ribbonB}
          style={{
            ...outline,
            fill: "color-mix(in oklab, var(--tachyon-flare) 70%, var(--tc-paper))",
          }}
        />
        <path
          d="M1120 14 C1210 96 1330 62 1470 128"
          strokeDasharray="120 18 24 600"
          style={{
            stroke: "oklch(1 0 0 / 0.75)",
            strokeWidth: 3.5,
            strokeLinecap: "round",
          }}
        />
      </g>
      <path
        className="tc-draw"
        pathLength={1}
        d="M1312 330 l10 -34 M1300 306 l34 8 M1306 296 l24 24 M1330 292 l-26 26"
        style={{
          stroke: "var(--tc-ink)",
          strokeWidth: 2.5,
          strokeLinecap: "round",
          opacity: 0.55,
        }}
      />
    </svg>
  );
}

/**
 * D2: particles advected through an analytic vector field, after anvaka's
 * fieldplay. Trails fade by erasing a little alpha each frame; colours come
 * from the accent tokens so they follow the logo palette and light/dark mode.
 */
function ParticleField({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!active || !canvas || !context) return;

    const root = document.documentElement;
    const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0;
    let height = 0;
    let frame = 0;
    let time = 0;
    let colors: string[] = [];
    let alpha = 0.5;
    let particles: { x: number; y: number; age: number; color: number }[] = [];

    const readColors = () => {
      const style = getComputedStyle(root);
      const token = (name: string) => style.getPropertyValue(name).trim();
      colors = [
        token("--tachyon-signal"),
        token("--tachyon-signal"),
        token("--tachyon-trace"),
        token("--tachyon-flare"),
      ];
      alpha = root.classList.contains("dark") ? 0.55 : 0.5;
      context.clearRect(0, 0, canvas.width, canvas.height);
    };

    const spawn = () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      age: Math.floor(Math.random() * 200),
      color: Math.floor(Math.random() * 4),
    });

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      particles = Array.from(
        { length: Math.round((width * height) / 1300) },
        spawn,
      );
      readColors();
    };

    /** Velocity at a screen point: a smooth, slowly evolving swirl. */
    const velocity = (x: number, y: number) => {
      const scale = 5 / Math.max(width, 1);
      const px = (x - width * 0.6) * scale;
      const py = (y - height * 0.5) * scale;
      return {
        vx: Math.sin(py * 1.4 + time) + 0.55 * Math.cos(px * 0.8 - py * 0.5),
        vy: 0.9 * Math.cos(px * 1.2 - time * 0.6) + 0.35 * Math.sin(py * 0.9),
      };
    };

    const step = () => {
      context.globalCompositeOperation = "destination-out";
      context.fillStyle = "rgba(0,0,0,0.045)";
      context.fillRect(0, 0, width, height);
      context.globalCompositeOperation = "source-over";
      context.lineWidth = 1.1;
      context.globalAlpha = alpha;
      for (const [index, particle] of particles.entries()) {
        const { vx, vy } = velocity(particle.x, particle.y);
        const nx = particle.x + vx * 1.6;
        const ny = particle.y + vy * 1.6;
        context.strokeStyle = colors[particle.color] ?? "currentColor";
        context.beginPath();
        context.moveTo(particle.x, particle.y);
        context.lineTo(nx, ny);
        context.stroke();
        particle.x = nx;
        particle.y = ny;
        particle.age += 1;
        if (particle.age > 260 || nx < 0 || ny < 0 || nx > width || ny > height)
          particles[index] = { ...spawn(), age: 0 };
      }
      context.globalAlpha = 1;
      time += 0.0018;
    };

    const loop = () => {
      step();
      frame = requestAnimationFrame(loop);
    };

    resize();
    if (reduceMotion) {
      for (let index = 0; index < 160; index += 1) step();
    } else {
      frame = requestAnimationFrame(loop);
    }

    const themeObserver = new MutationObserver(readColors);
    themeObserver.observe(root, {
      attributes: true,
      attributeFilter: ["class"],
    });
    const onVisibility = () => {
      cancelAnimationFrame(frame);
      if (!document.hidden && !reduceMotion)
        frame = requestAnimationFrame(loop);
    };
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelAnimationFrame(frame);
      themeObserver.disconnect();
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [active]);

  return <canvas data-backdrop="d2" ref={canvasRef} />;
}
