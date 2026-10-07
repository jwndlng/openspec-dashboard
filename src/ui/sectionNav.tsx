// Section navigation shared by Settings and Help: jump links, the "which section is in view" marker and ?section= deep
// links.
import type { ComponentChildren, RefObject } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { currentSection, navOffset, rowScrollLeft, serializeSection } from "./settingsSections.ts";
import { currentQuery, hrefWithQuery, replaceQuery } from "./url.ts";

export interface NavSection {
  id: string;
  label: string;
  /** Short figure next to the label, e.g. "12/17". */
  count?: string;
  /** Something here is waiting for the user (e.g. repositories to enable). */
  attention?: boolean;
  /** Appended to the count while `attention`, e.g. Discovered's "3 new". */
  countNote?: string;
  /** Tooltip on the count while `attention`. */
  countTitle?: string;
  content: ComponentChildren;
}

/** A page with ?section= navigation: its sections' element ids are `<prefix>-<id>`, inside the `layout` element. */
export interface SectionPage {
  prefix: string;
  /** Every section the page can have, also those that mount later; a deep link to any other id is dropped. */
  known: readonly string[];
  /** Selector of the element whose growth keeps a jumped-to section at the top. */
  layout: string;
  /** Selector of the page's one scroll area, which the navigation and the sections share. */
  scroller: string;
  /** Accessible name of the navigation. */
  label: string;
  /** Route the entries link to. */
  path: string;
  /** Whether the entries' links keep the current URL's other query parameters. */
  keepQuery: boolean;
}

/** How long a programmatic scroll may take before the view-tracking takes over again. */
const SCROLL_SETTLE_MS = 700;
/** How long the navigation glides to the section it is placed by when that changes. */
const GLIDE_MS = 220;
/** Below this width the navigation is a row above the sections and is not moved along (styles.css). */
const NARROW = "(max-width: 720px)";

function prefersReducedMotion(): boolean {
  return matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Tracks the section at the top of `scroller`, jumps to sections, and keeps ?section= in step. A jump pins its target
 * as current until the user scrolls again, so the marker neither flickers through the sections passing by nor snaps
 * to a neighbour when the target is too short to reach the top. Pass no ids until the sections are rendered.
 * `current` is the entry to mark: at the end of the page the last section, which may be too short to reach the top.
 * `anchor` is the section the wide navigation is placed by: the one really at the top of the view (or a jump's
 * target while it is pinned), so that reaching the end does not pull the navigation down to a short last section.
 */
export function useSectionNav(scroller: RefObject<HTMLElement>, ids: string[], page: SectionPage) {
  const elementId = (id: string) => `${page.prefix}-${id}`;
  const [current, setCurrent] = useState<string | undefined>(ids[0]);
  const [anchor, setAnchor] = useState<string | undefined>(ids[0]);
  const pin = useRef<{ id: string; settled: boolean; scrollTop: number } | null>(null);
  const pendingDeepLink = useRef<string | undefined>(new URLSearchParams(currentQuery()).get("section") ?? undefined);
  const key = ids.join(" ");

  // Bring a section to the top of the view (scroll-margin-top keeps it level with where the nav starts).
  const scrollToSection = (id: string, smooth: boolean) => {
    const target = document.getElementById(elementId(id));
    target?.scrollIntoView({ block: "start", behavior: smooth && !prefersReducedMotion() ? "smooth" : "auto" });
  };

  // `byUser` is false for a deep link on load: no animation, and focus stays where the browser put it.
  const jump = (id: string, byUser: boolean) => {
    const el = scroller.current;
    const target = document.getElementById(elementId(id));
    if (!el || !target) return;
    setCurrent(id);
    setAnchor(id);
    pin.current = { id, settled: false, scrollTop: el.scrollTop };
    const settle = () => {
      if (pin.current) pin.current = { ...pin.current, settled: true, scrollTop: el.scrollTop };
    };
    el.addEventListener("scrollend", settle, { once: true });
    setTimeout(settle, SCROLL_SETTLE_MS);
    scrollToSection(id, byUser);
    if (byUser) target.focus({ preventScroll: true });
  };

  // Follow manual scrolling.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      if (pin.current) {
        if (!pin.current.settled || Math.abs(el.scrollTop - pin.current.scrollTop) < 2) return;
        pin.current = null;
      }
      const top = el.getBoundingClientRect().top;
      const rects = ids.flatMap((id) => {
        const section = document.getElementById(elementId(id));
        return section ? [{ id, top: section.getBoundingClientRect().top - top }] : [];
      });
      const atEnd = el.scrollTop > 0 && el.scrollTop + el.clientHeight >= el.scrollHeight - 2;
      setCurrent(currentSection(rects, atEnd));
      setAnchor(currentSection(rects, false));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    // Panels above the section jumped to can still grow after the jump (discovery results arrive, a repository is
    // enabled). If the user has not scrolled since, keep that section at the top.
    const layout = el.querySelector(page.layout);
    const relayout = new ResizeObserver(() => {
      const p = pin.current;
      if (p?.settled && Math.abs(el.scrollTop - p.scrollTop) < 2) {
        scrollToSection(p.id, false);
        pin.current = { ...p, scrollTop: el.scrollTop };
      }
    });
    if (layout) relayout.observe(layout);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      relayout.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [key]);

  // A deep link is honoured once its section exists (the shared-config section mounts after the config has loaded).
  useEffect(() => {
    if (ids.length === 0) return;
    const wanted = pendingDeepLink.current;
    if (wanted && ids.includes(wanted)) {
      pendingDeepLink.current = undefined;
      jump(wanted, false);
      return;
    }
    if (wanted && !page.known.includes(wanted)) pendingDeepLink.current = undefined;
    setCurrent((was) => (was && ids.includes(was) ? was : ids[0]));
    setAnchor((was) => (was && ids.includes(was) ? was : ids[0]));
  }, [key]);

  // Reflect the current section in the URL without adding history entries; a pending deep link keeps its parameter.
  useEffect(() => {
    if (!current || pendingDeepLink.current) return;
    const next = serializeSection(currentQuery(), current, ids[0]);
    if (next !== currentQuery()) replaceQuery(next);
  }, [current, key]);

  return { current, anchor, jump: (id: string) => jump(id, true) };
}

/** Where an entry links to: the page's route with that section, keeping the other parameters of `query` if it should. */
export function sectionHref(page: SectionPage, id: string, first: string | undefined, query: string): string {
  return hrefWithQuery(page.path, serializeSection(page.keepQuery ? query : "", id, first));
}

function isPlainClick(e: MouseEvent): boolean {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
}

export function SectionNav({
  page,
  sections,
  current,
  anchor,
  onJump,
}: {
  page: SectionPage;
  sections: NavSection[];
  current: string | undefined;
  anchor: string | undefined;
  onJump: (id: string) => void;
}) {
  const nav = useRef<HTMLElement>(null);

  // In the narrow-screen row the current entry may be off to the side. Only ever scroll the row itself: revealing the
  // entry any other way would scroll the page as well.
  // Also when the row's width changes (the page's scrollbar appearing is enough) or the entries' contents change.
  useEffect(() => {
    // The <nav> is the row's scroller, not the <ul>: Chrome misses clicks on the entries of a scrolled <ul> in there.
    const row = nav.current;
    if (!row) return;
    const reveal = () => {
      const entry = row.querySelector<HTMLElement>('[aria-current="true"]')?.parentElement;
      // The row is its entries' offsetParent (positioned, see styles.css), so offsetLeft is in the row's own scroll
      // coordinates and does not change as the row scrolls.
      if (entry) row.scrollLeft = rowScrollLeft(row, entry);
    };
    reveal();
    const resized = new ResizeObserver(reveal);
    resized.observe(row);
    return () => resized.disconnect();
    // The entries' own widths matter too: a count going from "…" to "3 new" pushes everything after it sideways.
  }, [current, sections.map((s) => `${s.label}${s.count ?? ""}`).join("|")]);

  // Wide screens: the navigation moves along with the content, level with the section it is placed by (`anchor`) and
  // in view while that section is read (styles.css applies --nav-offset only there). --nav-offset is set on every
  // scroll frame without a transition, so the navigation keeps exact pace with the view. When the anchor changes it
  // glides: a transform animation covers only the distance jumped, so the per-frame updates of `top` never restart
  // it. Placed again when the layout's size changes: sections above the anchor can grow (discovery results, a
  // repository enabled) and the last section clamps the offset.
  const placedFor = useRef(anchor);
  const glide = useRef<Animation | null>(null);
  useEffect(() => {
    const el = nav.current;
    const layout = el?.parentElement;
    const scroller = el?.closest<HTMLElement>(page.scroller);
    if (!el || !layout || !scroller) return;
    let frame = 0;
    const place = () => {
      frame = 0;
      const first = sections[0] ? document.getElementById(`${page.prefix}-${sections[0].id}`) : null;
      const section = anchor ? document.getElementById(`${page.prefix}-${anchor}`) : null;
      if (!first || !section) return;
      const home = first.getBoundingClientRect().top;
      const rect = section.getBoundingClientRect();
      const margin = Number.parseFloat(getComputedStyle(section).scrollMarginTop) || 0;
      const at = { sectionTop: rect.top - home, sectionBottom: rect.bottom - home, viewTop: scroller.getBoundingClientRect().top + margin - home };
      // The navigation's entries start level with the first section, its padding above them; on Help the intro is
      // above both, so the room left below is measured from there, not from the top of the layout.
      const start = home - layout.getBoundingClientRect().top - (Number.parseFloat(getComputedStyle(el).paddingTop) || 0);
      el.style.setProperty("--nav-offset", `${navOffset(at, el.offsetHeight, layout.clientHeight - start)}px`);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(place);
    };
    if (placedFor.current !== anchor) {
      placedFor.current = anchor;
      // Where the navigation is seen now, a running glide included, and where it belongs: glide over the difference.
      const before = el.getBoundingClientRect().top;
      glide.current?.cancel();
      glide.current = null;
      place();
      const distance = before - el.getBoundingClientRect().top;
      const animated = typeof el.animate === "function" && !prefersReducedMotion() && !matchMedia(NARROW).matches;
      if (animated && Math.abs(distance) >= 1) {
        glide.current = el.animate([{ transform: `translateY(${distance}px)` }, { transform: "none" }], { duration: GLIDE_MS, easing: "ease" });
      }
    } else {
      place();
    }
    const resized = new ResizeObserver(() => place());
    resized.observe(layout);
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      resized.disconnect();
      scroller.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [anchor, sections.map((s) => s.id).join(" ")]);

  return (
    <nav ref={nav} class="section-nav" aria-label={page.label}>
      <ul>
        {sections.map((s) => (
          <li key={s.id}>
            <a
              href={sectionHref(page, s.id, sections[0]?.id, currentQuery())}
              class={`section-link ${s.attention ? "attention" : ""}`}
              aria-current={s.id === current ? "true" : undefined}
              onClick={(e) => {
                if (!isPlainClick(e)) return;
                e.preventDefault();
                onJump(s.id);
              }}
            >
              <span class="label">{s.label}</span>
              {s.count !== undefined && (
                <span class="count" title={s.attention ? s.countTitle : undefined}>
                  {s.attention && s.countNote ? `${s.count} ${s.countNote}` : s.count}
                </span>
              )}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** The sections themselves, one element each with the id the navigation and ?section= refer to. */
export function SectionList({ page, sections, sectionClass }: { page: SectionPage; sections: NavSection[]; sectionClass: string }) {
  return (
    <>
      {sections.map((s) => (
        // tabIndex -1: the focus target of a jump, not a tab stop.
        <section key={s.id} id={`${page.prefix}-${s.id}`} class={sectionClass} aria-label={s.label} tabIndex={-1}>
          {s.content}
        </section>
      ))}
    </>
  );
}
