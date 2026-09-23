// The product mark, drawn from logoMark.ts in the theme's own accent tokens. Decorative: the product name is beside it.
import { MARK_ARCS, MARK_CORE, MARK_HEAD, MARK_TILE_RADIUS, MARK_VIEWBOX } from "./logoMark.ts";

export function LogoMark({ size = 48 }: { size?: number }) {
  return (
    <svg class="logo-mark" width={size} height={size} viewBox={MARK_VIEWBOX} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="logo-mark-tile" x1="0" y1="48" x2="48" y2="0" gradientUnits="userSpaceOnUse">
          <stop style={{ stopColor: "var(--brand-strong)" }} />
          <stop offset=".55" style={{ stopColor: "var(--brand)" }} />
          <stop offset="1" style={{ stopColor: "var(--brand-fg)" }} />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx={MARK_TILE_RADIUS} fill="url(#logo-mark-tile)" />
      {MARK_ARCS.map((arc) => (
        <path key={arc.d} d={arc.d} stroke="currentColor" stroke-opacity={arc.opacity} stroke-width="4" stroke-linecap="round" fill="none" />
      ))}
      <circle cx={MARK_HEAD.cx} cy={MARK_HEAD.cy} r={MARK_HEAD.r} fill="currentColor" />
      <rect x={MARK_CORE.x} y={MARK_CORE.y} width={MARK_CORE.size} height={MARK_CORE.size} rx={MARK_CORE.rx} fill="currentColor" fill-opacity=".92" />
    </svg>
  );
}
