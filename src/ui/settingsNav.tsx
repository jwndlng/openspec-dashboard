// Section navigation of the Settings page: jump links, the "which section is in view" marker and ?section= deep links.
import type { ComponentChildren, RefObject } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { currentSection, navOffset, rowScrollLeft, SECTION_IDS, serializeSection } from "./settingsSections.ts";
import { currentQuery, hrefWithQuery, replaceQuery } from "./url.ts";

export interface SettingsSection {
  id: string;
  label: string;
  /** Short figure next to the label, e.g. "12/17". */
  count?: string;
  /** Something here is waiting for the user (e.g. repositories to enable). */
  attention?: boolean;
  content: ComponentChildren;
}

const sectionElementId = (id: string) => `settings-${id}`;

/** How long a programmatic scroll may take before the view-tracking takes over again. */
const SCROLL_SETTLE_MS = 700;
/** How long the navigation glides to a new current section (matches the transition in styles.css). */
const GLIDE_MS = 220;

function prefersReducedMotion(): boolean {
  return matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Tracks the section at the top of `scroller`, jumps to sections, and keeps ?section= in step. A jump pins its target
 * as current until the user scrolls again, so the marker neither flickers through the sections passing by nor snaps
 * to a neighbour when the target is too short to reach the top. Pass no ids until the sections are rendered.
 * The navigation scrolls with the content; on wide screens SettingsNav moves it along beside the current section.
 */
export function useSectionNav(scroller: RefObject<HTMLElement>, ids: string[]) {
  const [current, setCurrent] = useState<string | undefined>(ids[0]);
  const pin = useRef<{ id: string; settled: boolean; scrollTop: number } | null>(null);
  const pendingDeepLink = useRef<string | undefined>(new URLSearchParams(currentQuery()).get("section") ?? undefined);
  const key = ids.join(" ");

  // Bring a section to the top of the view (scroll-margin-top keeps it level with where the nav starts).
  const scrollToSection = (id: string, smooth: boolean) => {
    const target = document.getElementById(sectionElementId(id));
    target?.scrollIntoView({ block: "start", behavior: smooth && !prefersReducedMotion() ? "smooth" : "auto" });
  };

  // `byUser` is false for a deep link on load: no animation, and focus stays where the browser put it.
  const jump = (id: string, byUser: boolean) => {
    const el = scroller.current;
    const target = document.getElementById(sectionElementId(id));
    if (!el || !target) return;
    setCurrent(id);
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
        const section = document.getElementById(sectionElementId(id));
        return section ? [{ id, top: section.getBoundingClientRect().top - top }] : [];
      });
      const atEnd = el.scrollTop > 0 && el.scrollTop + el.clientHeight >= el.scrollHeight - 2;
      setCurrent(currentSection(rects, atEnd));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    // Panels above the section jumped to can still grow after the jump (discovery results arrive, a repository is
    // enabled). If the user has not scrolled since, keep that section at the top.
    const layout = el.querySelector(".settings-layout");
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
    if (wanted && !(SECTION_IDS as readonly string[]).includes(wanted)) pendingDeepLink.current = undefined;
    setCurrent((was) => (was && ids.includes(was) ? was : ids[0]));
  }, [key]);

  // Reflect the current section in the URL without adding history entries; a pending deep link keeps its parameter.
  useEffect(() => {
    if (!current || pendingDeepLink.current) return;
    const next = serializeSection(currentQuery(), current, ids[0]);
    if (next !== currentQuery()) replaceQuery(next);
  }, [current, key]);

  return { current, jump: (id: string) => jump(id, true) };
}

function isPlainClick(e: MouseEvent): boolean {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
}

export function SettingsNav({ sections, current, onJump }: { sections: SettingsSection[]; current: string | undefined; onJump: (id: string) => void }) {
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

  // Wide screens: the navigation moves along with the content, level with the current section and in view while that
  // section is read (styles.css applies --nav-offset only there). It glides when the current section changes and keeps
  // exact pace with the view otherwise. Placed again when the layout's size changes: sections above the current one can
  // grow (discovery results, a repository enabled) and the last section clamps the offset.
  const placedFor = useRef(current);
  useEffect(() => {
    const el = nav.current;
    const layout = el?.parentElement;
    const scroller = el?.closest<HTMLElement>(".settings-scroll");
    if (!el || !layout || !scroller) return;
    let frame = 0;
    let glideEnd = 0;
    if (placedFor.current !== current) {
      placedFor.current = current;
      el.dataset.glide = "true";
      glideEnd = window.setTimeout(() => delete el.dataset.glide, GLIDE_MS);
    }
    const place = () => {
      frame = 0;
      const first = layout.querySelector<HTMLElement>(".settings-section");
      const section = current ? document.getElementById(sectionElementId(current)) : null;
      if (!first || !section) return;
      const home = first.getBoundingClientRect().top;
      const rect = section.getBoundingClientRect();
      const margin = Number.parseFloat(getComputedStyle(section).scrollMarginTop) || 0;
      const at = { sectionTop: rect.top - home, sectionBottom: rect.bottom - home, viewTop: scroller.getBoundingClientRect().top + margin - home };
      el.style.setProperty("--nav-offset", `${navOffset(at, el.offsetHeight, layout.clientHeight)}px`);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(place);
    };
    place();
    const resized = new ResizeObserver(() => place());
    resized.observe(layout);
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      resized.disconnect();
      scroller.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
      clearTimeout(glideEnd);
    };
  }, [current]);

  return (
    <nav ref={nav} class="settings-nav" aria-label="Settings sections">
      <ul>
        {sections.map((s) => (
          <li key={s.id}>
            <a
              href={hrefWithQuery("/settings", serializeSection("", s.id, sections[0]?.id))}
              class={`settings-link ${s.attention ? "attention" : ""}`}
              aria-current={s.id === current ? "true" : undefined}
              onClick={(e) => {
                if (!isPlainClick(e)) return;
                e.preventDefault();
                onJump(s.id);
              }}
            >
              <span class="label">{s.label}</span>
              {s.count !== undefined && (
                <span class="count" title={s.attention ? "waiting to be enabled" : undefined}>
                  {s.attention ? `${s.count} new` : s.count}
                </span>
              )}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function SettingsSections({ sections }: { sections: SettingsSection[] }) {
  return (
    <>
      {sections.map((s) => (
        // tabIndex -1: the focus target of a jump, not a tab stop.
        <section key={s.id} id={sectionElementId(s.id)} class="settings-section" aria-label={s.label} tabIndex={-1}>
          {s.content}
        </section>
      ))}
    </>
  );
}
