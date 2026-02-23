import React from 'react';

/**
 * ConnectorLines — Act 2 scroll connectors
 *
 * Two curved paths connecting 3 feature blocks vertically. Drawn on scroll
 * when `visible` prop becomes true. Uses stroke-dashoffset animation for
 * a progressive drawing effect.
 *
 * Props:
 *   - visible (boolean): When true, triggers the draw animation.
 *   - height (number, optional): SVG height in px. Defaults to 400.
 *
 * Hidden on mobile (< 768px) via CSS media query.
 */

export default function ConnectorLines({ visible = false, height = 400 }) {
  // Two cubic-bezier paths connecting top -> middle -> bottom points.
  // The paths have a gentle S-curve for organic feel.
  const midY = height / 2;

  // Path 1: top-center to mid-center (gentle rightward curve)
  const path1 = `M 20 0 C 20 ${midY * 0.35}, 30 ${midY * 0.65}, 20 ${midY}`;

  // Path 2: mid-center to bottom-center (gentle leftward curve)
  const path2 = `M 20 ${midY} C 20 ${midY + (midY * 0.35)}, 10 ${midY + (midY * 0.65)}, 20 ${height}`;

  // Estimated path lengths (slightly overestimate to ensure full draw)
  const pathLength1 = midY * 1.15;
  const pathLength2 = midY * 1.15;

  return (
    <svg
      aria-hidden="true"
      width="40"
      height={height}
      viewBox={`0 0 40 ${height}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="connector-lines-svg"
      style={{
        position: 'absolute',
        left: '50%',
        transform: 'translateX(-50%)',
        top: 0,
        pointerEvents: 'none',
        zIndex: 0,
      }}
    >
      <style>{`
  .connector-lines-svg {
    overflow: visible;
  }

  @media (max-width: 768px) {
    .connector-lines-svg {
      display: none;
    }
  }

  .connector-path {
    stroke: var(--text-4, #9ca3af);
    stroke-opacity: 0.3;
    stroke-width: 1.5;
    stroke-linecap: round;
    fill: none;
    will-change: stroke-dashoffset;
    transition: stroke-dashoffset 1.2s cubic-bezier(0.22, 1, 0.36, 1);
  }

  .connector-path-1 {
    stroke-dasharray: ${pathLength1};
    stroke-dashoffset: ${pathLength1};
  }

  .connector-path-2 {
    stroke-dasharray: ${pathLength2};
    stroke-dashoffset: ${pathLength2};
  }

  .connector-path-1.visible {
    stroke-dashoffset: 0;
  }

  .connector-path-2.visible {
    stroke-dashoffset: 0;
    transition-delay: 0.4s;
  }
`}</style>

      {/* Top dot */}
      <circle
        cx="20"
        cy="0"
        r="2.5"
        fill="var(--text-4, #9ca3af)"
        fillOpacity={visible ? 0.4 : 0}
        style={{
          transition: 'fill-opacity 0.6s ease-out',
        }}
      />

      {/* Path 1: top to middle */}
      <path
        d={path1}
        className={`connector-path connector-path-1${visible ? ' visible' : ''}`}
      />

      {/* Middle dot */}
      <circle
        cx="20"
        cy={midY}
        r="2.5"
        fill="var(--text-4, #9ca3af)"
        fillOpacity={visible ? 0.4 : 0}
        style={{
          transition: 'fill-opacity 0.6s ease-out 0.6s',
        }}
      />

      {/* Path 2: middle to bottom */}
      <path
        d={path2}
        className={`connector-path connector-path-2${visible ? ' visible' : ''}`}
      />

      {/* Bottom dot */}
      <circle
        cx="20"
        cy={height}
        r="2.5"
        fill="var(--text-4, #9ca3af)"
        fillOpacity={visible ? 0.4 : 0}
        style={{
          transition: 'fill-opacity 0.6s ease-out 1.2s',
        }}
      />
    </svg>
  );
}
