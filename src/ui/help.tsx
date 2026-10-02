// The Help view: built-in guidance in sections, a list of them at the start, ?section= deep links, and the tour.
import { useRef } from "preact/hooks";
import { HELP_SECTION_IDS, HELP_SECTIONS } from "./helpContent.tsx";
import { IconHelp } from "./icons.tsx";
import { useSectionNav } from "./settingsNav.tsx";
import { serializeSection } from "./settingsSections.ts";
import { currentQuery, hrefWithQuery } from "./url.ts";

const HELP_PAGE = { prefix: "help", known: HELP_SECTION_IDS, layout: ".help-layout" };

export function Help({ onTour }: { onTour: () => void }) {
  const scroller = useRef<HTMLDivElement>(null);
  const nav = useSectionNav(scroller, HELP_SECTION_IDS, HELP_PAGE);
  return (
    <div class="help-scroll" ref={scroller}>
      <div class="help-layout">
        <header class="help-intro">
          <span class="help-icon" aria-hidden="true">
            <IconHelp size={22} />
          </span>
          <div class="help-intro-text">
            <h1>Help</h1>
            <p>How the dashboard works, what it shows and what it changes. New here? The tour points out where everything is.</p>
          </div>
          <button type="button" class="btn primary" onClick={onTour}>
            Take the tour
          </button>
        </header>
        <nav class="help-toc" aria-label="Help sections">
          <ol>
            {HELP_SECTIONS.map((s) => (
              <li key={s.id}>
                <a
                  href={hrefWithQuery("/help", serializeSection(currentQuery(), s.id, HELP_SECTION_IDS[0]))}
                  aria-current={nav.current === s.id ? "true" : undefined}
                  onClick={(e) => {
                    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                    e.preventDefault();
                    nav.jump(s.id);
                  }}
                >
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        {HELP_SECTIONS.map((s) => (
          // tabIndex -1: the focus target of a jump, not a tab stop.
          <section key={s.id} id={`help-${s.id}`} class="help-section" aria-labelledby={`help-${s.id}-title`} tabIndex={-1}>
            <h2 id={`help-${s.id}-title`}>{s.title}</h2>
            {s.body()}
          </section>
        ))}
      </div>
    </div>
  );
}
