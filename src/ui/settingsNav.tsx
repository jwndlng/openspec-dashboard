// Section navigation of the Settings page: jump links, the "which section is in view" marker and ?section= deep links.
import type { ComponentChildren, RefObject } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { currentSection, rowScrollLeft, SECTION_IDS, serializeSection } from "./settingsSections.ts";
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
  const pendingDeepLink = useRef<string | undefined>(new URLSearchParams(currentQuery()).get("section") ?? undefined);
  const key = ids.join(" ");

  // `byUser` is false for a deep link on load: no animation, and focus stays where the browser put it.
  const jump = (id: string, byUser: boolean) => {
    const el = scroller.current;
    const target = document.getElementById(sectionElementId(id));
    if (!el || !target) return;
    setCurrent(id);
    pin.current = { settled: false, scrollTop: el.scrollTop };
    const settle = () => {
      if (pin.current) pin.current = { settled: true, scrollTop: el.scrollTop };
    };
    el.addEventListener("scrollend", settle, { once: true });
    setTimeout(settle, SCROLL_SETTLE_MS);
    target.scrollIntoView({ block: "start", behavior: byUser && !prefersReducedMotion() ? "smooth" : "auto" });
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
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
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
  useEffect(() => {
    const row = list.current;
    const entry = row?.querySelector<HTMLElement>('[aria-current="true"]')?.parentElement;
    if (row && entry) row.scrollLeft = rowScrollLeft(row, { offsetLeft: entry.offsetLeft - row.offsetLeft, offsetWidth: entry.offsetWidth });
  }, [current]);

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
      {sections.map((s) => (
        // tabIndex -1: the focus target of a jump, not a tab stop.
        <section key={s.id} id={sectionElementId(s.id)} class="settings-section" aria-label={s.label} tabIndex={-1}>
          {s.content}
        </section>
      ))}
    </>
  );
}
