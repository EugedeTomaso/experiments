import React, { useMemo } from 'react';

/**
 * ConvergingLines — Hero background animation
 *
 * ~10 thin lines scattered across the viewport that slowly drift toward
 * a center point, fade, and reset. Fragments unifying. Very subtle, ambient.
 *
 * Uses CSS keyframe animations with stroke-dasharray/dashoffset for a drawing
 * effect. All styles are self-contained via an inline <style> tag.
 */

function generateLines() {
  // Pre-defined line configurations for deterministic rendering.
  // Each line starts at a scattered position and converges toward center (~600, 400).
  return [
    { x1: 80, y1: 60, x2: 520, y2: 360, dur: 18, delay: 0, dash: 120 },
    { x1: 1120, y1: 100, x2: 680, y2: 370, dur: 22, delay: 1.5, dash: 140 },
    { x1: 200, y1: 720, x2: 540, y2: 440, dur: 20, delay: 3, dash: 100 },
    { x1: 1050, y1: 680, x2: 660, y2: 430, dur: 17, delay: 0.8, dash: 130 },
    { x1: 50, y1: 380, x2: 500, y2: 400, dur: 24, delay: 4.2, dash: 110 },
    { x1: 1150, y1: 400, x2: 700, y2: 400, dur: 19, delay: 2.5, dash: 150 },
    { x1: 400, y1: 30, x2: 570, y2: 350, dur: 21, delay: 5, dash: 90 },
    { x1: 750, y1: 770, x2: 630, y2: 450, dur: 16, delay: 1.2, dash: 125 },
    { x1: 150, y1: 200, x2: 530, y2: 380, dur: 23, delay: 6.5, dash: 105 },
    { x1: 950, y1: 150, x2: 650, y2: 380, dur: 25, delay: 3.8, dash: 135 },
  ];
}

export default function ConvergingLines() {
  const lines = useMemo(() => generateLines(), []);

  // Build keyframe rules for each line with literal values (not CSS vars)
  // so they resolve correctly in all browsers.
  const styleContent = lines
    .map((l, i) => {
      const tx = ((l.x2 - l.x1) * 0.15).toFixed(1);
      const ty = ((l.y2 - l.y1) * 0.15).toFixed(1);
      return `
@keyframes converge-${i} {
  0% {
    opacity: 0;
    stroke-dashoffset: ${l.dash};
    transform: translate(0px, 0px);
  }
  10% {
    opacity: 1;
  }
  80% {
    opacity: 1;
    stroke-dashoffset: 0;
  }
  100% {
    opacity: 0;
    stroke-dashoffset: 0;
    transform: translate(${tx}px, ${ty}px);
  }
}

.cl-${i} {
  opacity: 0;
  stroke-dasharray: ${l.dash};
  stroke-dashoffset: ${l.dash};
  animation: converge-${i} ${l.dur}s ${l.delay}s ease-in-out infinite;
}`;
    })
    .join('\n');

  return (
    <svg
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        pointerEvents: 'none',
      }}
      viewBox="0 0 1200 800"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <style>{`
  .converging-line {
    stroke: var(--text-4, #9ca3af);
    stroke-width: 1;
    stroke-linecap: round;
    fill: none;
    will-change: transform, opacity;
  }
  @media (prefers-reduced-motion: reduce) {
    .converging-line {
      animation: none !important;
      opacity: 0.18;
      stroke-dashoffset: 0;
    }
  }
  ${styleContent}
`}</style>

      {lines.map((l, i) => (
        <line
          key={i}
          className={`converging-line cl-${i}`}
          x1={l.x1}
          y1={l.y1}
          x2={l.x2}
          y2={l.y2}
          strokeOpacity={0.18 + (i % 3) * 0.03}
        />
      ))}
    </svg>
  );
}
