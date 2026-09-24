// The product mark, drawn from logoMark.ts in the theme's own tokens: ink in the text colour the .logo-mark rule sets,
// ground in the page background. Decorative: the product name is beside it.
import { h } from "preact";
import { MARK_PARTS, MARK_VIEWBOX } from "./logoMark.ts";

const FILL = { none: "none", ink: "currentColor", ground: "var(--bg-base)" };

export function LogoMark({ size = 48 }: { size?: number }) {
  return (
    <svg class="logo-mark" width={size} height={size} viewBox={MARK_VIEWBOX} fill="none" aria-hidden="true" focusable="false">
      {MARK_PARTS.map((part) =>
        h(part.el, {
          ...part.attrs,
          // A presentation attribute cannot take var(), a style can.
          style: { fill: FILL[part.fill] },
          stroke: part.strokeWidth === undefined ? undefined : "currentColor",
          "stroke-width": part.strokeWidth,
          opacity: part.opacity,
          transform: part.at ? `translate(${part.at[0]} ${part.at[1]})` : undefined,
        }),
      )}
    </svg>
  );
}
