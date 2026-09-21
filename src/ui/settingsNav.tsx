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

/** Matches the narrow-screen breakpoint in styles.css, where the navigation is a row above the sections. */
const NARROW_QUERY = "(max-width: 720px)";

function prefersReducedMotion(): boolean {
  return matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Tracks the section at the top of `scroller`, jumps to sections, and keeps ?section= in step. A jump pins its target
 * as current until the user scrolls again, so the marker neither flickers through the sections passing by nor snaps
 * to a neighbour when the target is too short to reach the top. Pass no ids until the sections are rendered.
 */
export function useSectionNav(scroller: RefObject<HTMLElement>, ids: string[]) {
  const [current, setCurrent] = useState<string | undefined>(ids[0]);
  const pin = useRef<{ settled: boolean; scrollTop: number } | null>(null);
  /** The section the navigation currently sits beside; undefined is its home position at the top. */
  const anchor = useRef<string | undefined>(undefined);
  const pendingDeepLink = useRef<string | undefined>(new URLSearchParams(currentQuery()).get("section") ?? undefined);
  const key = ids.join(" ");

  // The navigation moves with the content on a jump too: it is placed beside the section jumped to (wide), or directly
  // above it (narrow row). Written straight to the element, so the layout is final before the scroll below and no
  // render sits in between; the element has no style prop, so re-renders leave it alone.
  const placeNav = (id: string | undefined) => {
    const el = scroller.current;
    const navEl = el?.querySelector<HTMLElement>(".settings-nav");
    const layout = navEl?.parentElement;
    const index = id === undefined ? 0 : ids.indexOf(id);
    const target = index > 0 ? document.getElementById(sectionElementId(ids[index])) : null;
    const first = document.getElementById(sectionElementId(ids[0]));
    if (!navEl || !layout) return;
    anchor.current = target ? id : undefined;
    // Narrow: CSS `order` puts the row right before the section (sections use odd numbers, see SettingsSections).
    navEl.style.setProperty("--nav-order", String(target ? index * 2 : 0));
    // Wide: measured with the offset cleared, although relative positioning does not move anything else anyway.
    navEl.style.setProperty("--nav-offset", "0px");
    if (target && first) {
      const offset = navOffset(target.getBoundingClientRect().top - first.getBoundingClientRect().top, navEl.offsetHeight, layout.clientHeight);
      navEl.style.setProperty("--nav-offset", `${Math.round(offset)}px`);
    }
  };

  // Bring a section to the top of the view. On narrow screens the row sits directly above it after placeNav, so the
  // row is the thing to scroll to and the section follows it.
  const scrollToSection = (id: string, smooth: boolean) => {
    const el = scroller.current;
    const target = document.getElementById(sectionElementId(id));
    if (!el || !target) return;
    const navEl = el.querySelector<HTMLElement>(".settings-nav");
    const scrollTarget = anchor.current && navEl && matchMedia(NARROW_QUERY).matches ? navEl : target;
    scrollTarget.scrollIntoView({ block: "start", behavior: smooth && !prefersReducedMotion() ? "smooth" : "auto" });
  };

  // `byUser` is false for a deep link on load: no animation, and focus stays where the browser put it.
  const jump = (id: string, byUser: boolean) => {
    const el = scroller.current;
    const target = document.getElementById(sectionElementId(id));
    if (!el || !target) return;
    setCurrent(id);
    placeNav(id);
    pin.current = { settled: false, scrollTop: el.scrollTop };
    const settle = () => {
      if (pin.current) pin.current = { settled: true, scrollTop: el.scrollTop };
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
      // Back at the very top, the navigation belongs beside the first section again.
      if (el.scrollTop <= 0 && anchor.current) placeNav(undefined);
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
    // The wide offset is in pixels, so it goes stale whenever the page's layout changes: a panel above grows (discovery
    // results arrive, a repository is enabled) or the window is resized. Re-place the navigation then — and if the user
    // has not scrolled since the jump, keep the section jumped to at the top as well.
    const layout = el.querySelector(".settings-layout");
    const relayout = new ResizeObserver(() => {
      const id = anchor.current;
      if (!id) return;
      placeNav(id);
      if (pin.current?.settled && Math.abs(el.scrollTop - pin.current.scrollTop) < 2) {
        scrollToSection(id, false);
        pin.current = { settled: true, scrollTop: el.scrollTop };
      }
    });
    if (layout) relayout.observe(layout);
    const onResize = () => placeNav(anchor.current);
    el.addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onResize);
    return () => {
      el.removeEventListener("scroll", onScroll);
      removeEventListener("resize", onResize);
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
  const list = useRef<HTMLUListElement>(null);

  // In the narrow-screen row the current entry may be off to the side. Only ever scroll the row itself: the navigation
  // moves with the page, and revealing the entry any other way would pull the page back up to it.
  // Also when the row's width changes (the page's scrollbar appearing is enough) or the entries' contents change.
  useEffect(() => {
    const row = list.current;
    if (!row) return;
    const reveal = () => {
      const entry = row.querySelector<HTMLElement>('[aria-current="true"]')?.parentElement;
      // The row is its entries' offsetParent (position: relative in styles.css), so offsetLeft is in the row's own
      // scroll coordinates and does not change as the row scrolls.
      if (entry) row.scrollLeft = rowScrollLeft(row, entry);
    };
    reveal();
    const resized = new ResizeObserver(reveal);
    resized.observe(row);
    return () => resized.disconnect();
    // The entries' own widths matter too: a count going from "…" to "3 new" pushes everything after it sideways.
  }, [current, sections.map((s) => `${s.label}${s.count ?? ""}`).join("|")]);

  return (
    <nav class="settings-nav" aria-label="Settings sections">
      <ul ref={list}>
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
      {sections.map((s, i) => (
        // tabIndex -1: the focus target of a jump, not a tab stop. The order (odd numbers) only applies on narrow
        // screens, where the navigation row takes the even number before the section it was moved to.
        <section key={s.id} id={sectionElementId(s.id)} class="settings-section" style={{ "--section-order": i * 2 + 1 }} aria-label={s.label} tabIndex={-1}>
          {s.content}
        </section>
      ))}
    </>
  );
}
