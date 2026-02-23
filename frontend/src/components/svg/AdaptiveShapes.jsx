import React from 'react';

/**
 * AdaptiveShapes — Welcome screen animation
 *
 * Abstract geometric forms (circles, lines, rectangles) that rearrange
 * through three configurations: scattered -> tree-like -> grid-like -> scattered.
 * Represents adaptability. ~12s total cycle, ease-in-out.
 *
 * All styles are self-contained. Colors use CSS custom properties from the
 * design system. One accent element for visual interest.
 */

// Each element: type, plus three states (scattered, tree, grid).
// Positions are within a 300x200 coordinate space.
const elements = [
  // Circles
  {
    type: 'circle',
    r: 4,
    states: [
      { cx: 40, cy: 30 },
      { cx: 150, cy: 20 },
      { cx: 30, cy: 30 },
    ],
    accent: false,
  },
  {
    type: 'circle',
    r: 5,
    states: [
      { cx: 250, cy: 160 },
      { cx: 150, cy: 60 },
      { cx: 90, cy: 30 },
    ],
    accent: false,
  },
  {
    type: 'circle',
    r: 3,
    states: [
      { cx: 130, cy: 170 },
      { cx: 100, cy: 100 },
      { cx: 150, cy: 30 },
    ],
    accent: true, // accent element
  },
  {
    type: 'circle',
    r: 6,
    states: [
      { cx: 270, cy: 40 },
      { cx: 200, cy: 100 },
      { cx: 210, cy: 30 },
    ],
    accent: false,
  },
  // Lines
  {
    type: 'line',
    length: 30,
    states: [
      { x: 70, y: 100, rotation: 25 },
      { x: 130, y: 65, rotation: 90 },
      { x: 30, y: 80, rotation: 0 },
    ],
    accent: false,
  },
  {
    type: 'line',
    length: 24,
    states: [
      { x: 200, y: 80, rotation: -15 },
      { x: 170, y: 65, rotation: 90 },
      { x: 90, y: 80, rotation: 0 },
    ],
    accent: false,
  },
  {
    type: 'line',
    length: 36,
    states: [
      { x: 160, y: 30, rotation: 70 },
      { x: 150, y: 40, rotation: 0 },
      { x: 150, y: 80, rotation: 0 },
    ],
    accent: false,
  },
  {
    type: 'line',
    length: 28,
    states: [
      { x: 20, y: 150, rotation: -40 },
      { x: 110, y: 140, rotation: 45 },
      { x: 210, y: 80, rotation: 0 },
    ],
    accent: false,
  },
  // Rectangles
  {
    type: 'rect',
    w: 14,
    h: 10,
    states: [
      { x: 100, y: 60, rotation: 30 },
      { x: 80, y: 140, rotation: 0 },
      { x: 30, y: 130, rotation: 0 },
    ],
    accent: false,
  },
  {
    type: 'rect',
    w: 10,
    h: 14,
    states: [
      { x: 220, y: 120, rotation: -20 },
      { x: 220, y: 140, rotation: 0 },
      { x: 90, y: 130, rotation: 0 },
    ],
    accent: false,
  },
  {
    type: 'rect',
    w: 12,
    h: 8,
    states: [
      { x: 50, y: 80, rotation: 55 },
      { x: 190, y: 140, rotation: 0 },
      { x: 150, y: 130, rotation: 0 },
    ],
    accent: false,
  },
  {
    type: 'rect',
    w: 8,
    h: 12,
    states: [
      { x: 180, y: 170, rotation: -10 },
      { x: 150, y: 100, rotation: 0 },
      { x: 210, y: 130, rotation: 0 },
    ],
    accent: false,
  },
  // Extra small elements for richness
  {
    type: 'circle',
    r: 3,
    states: [
      { cx: 80, cy: 140 },
      { cx: 60, cy: 100 },
      { cx: 270, cy: 30 },
    ],
    accent: false,
  },
  {
    type: 'line',
    length: 20,
    states: [
      { x: 260, y: 100, rotation: 45 },
      { x: 240, y: 100, rotation: -45 },
      { x: 270, y: 80, rotation: 0 },
    ],
    accent: false,
  },
];

function buildKeyframes(el, index) {
  const s = el.states;
  if (el.type === 'circle') {
    return `
@keyframes shape-${index} {
  0%, 100% { transform: translate(${s[0].cx}px, ${s[0].cy}px); }
  30%, 36% { transform: translate(${s[1].cx}px, ${s[1].cy}px); }
  65%, 71% { transform: translate(${s[2].cx}px, ${s[2].cy}px); }
}`;
  }
  // line and rect use the same x/y/rotation state shape
  return `
@keyframes shape-${index} {
  0%, 100% { transform: translate(${s[0].x}px, ${s[0].y}px) rotate(${s[0].rotation}deg); }
  30%, 36% { transform: translate(${s[1].x}px, ${s[1].y}px) rotate(${s[1].rotation}deg); }
  65%, 71% { transform: translate(${s[2].x}px, ${s[2].y}px) rotate(${s[2].rotation}deg); }
}`;
}

function renderElement(el, index) {
  const baseStyle = {
    animation: `shape-${index} 12s ease-in-out infinite`,
    willChange: 'transform',
  };

  if (el.type === 'circle') {
    return (
      <circle
        key={index}
        cx={0}
        cy={0}
        r={el.r}
        fill={
          el.accent
            ? 'var(--accent, #2563eb)'
            : 'var(--text-4, #9ca3af)'
        }
        fillOpacity={el.accent ? 0.4 : 0.7}
        style={baseStyle}
      />
    );
  }

  if (el.type === 'line') {
    return (
      <line
        key={index}
        x1={0}
        y1={0}
        x2={el.length}
        y2={0}
        stroke="var(--border-subtle, rgba(0,0,0,0.05))"
        strokeOpacity={0.8}
        strokeWidth={1.5}
        strokeLinecap="round"
        style={baseStyle}
      />
    );
  }

  // rect
  return (
    <rect
      key={index}
      x={-el.w / 2}
      y={-el.h / 2}
      width={el.w}
      height={el.h}
      rx={2}
      fill="none"
      stroke="var(--text-4, #9ca3af)"
      strokeOpacity={0.5}
      strokeWidth={1}
      style={baseStyle}
    />
  );
}

const allKeyframes = elements.map(buildKeyframes).join('\n');

const reducedMotionCSS = `
@media (prefers-reduced-motion: reduce) {
  svg circle, svg line, svg rect {
    animation: none !important;
  }
}`;

export default function AdaptiveShapes() {

  return (
    <svg
      aria-hidden="true"
      width="300"
      height="200"
      viewBox="0 0 300 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        display: 'block',
        margin: '0 auto',
        overflow: 'visible',
      }}
    >
      <style>{allKeyframes + reducedMotionCSS}</style>
      {elements.map(renderElement)}
    </svg>
  );
}
