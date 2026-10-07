// The hero's way home: the mark and the title both link to the Projects overview. Two anchors because they sit in
// different cells of the hero's grid, but one stop: the mark's link is hidden from the keyboard and assistive
// technology, so the title's is the one link they meet.
import type { ComponentChildren } from "preact";
import { LogoMark } from "./logo.tsx";
import { followInApp, href } from "./url.ts";

const HOME = "/";

export function HeroHomeMark({ size }: { size?: number }) {
  const mark = <LogoMark size={size} />;
  // biome-ignore lint/a11y/useAnchorContent: deliberately hidden — the title beside it is the same link, with its name
  return <a class="hero-home-mark" href={href(HOME)} tabIndex={-1} aria-hidden="true" onClick={(e) => followInApp(e, HOME)}>{mark}</a>;
}

export function HeroHomeTitle({ current, children }: { current: boolean; children: ComponentChildren }) {
  return (
    <a class="hero-home" href={href(HOME)} aria-current={current ? "page" : undefined} onClick={(e) => followInApp(e, HOME)}>
      {children}
    </a>
  );
}
