// The Help view: built-in guidance in sections, the section navigation Settings has, ?section= deep links, the tour and
// setup.
import { useRef } from "preact/hooks";
import { HELP_SECTION_IDS, HELP_SECTIONS } from "./helpContent.tsx";
import { IconHelp } from "./icons.tsx";
import { type NavSection, SectionList, SectionNav, type SectionPage, useSectionNav } from "./sectionNav.tsx";

export const HELP_PAGE: SectionPage = {
  prefix: "help",
  known: HELP_SECTION_IDS,
  layout: ".help-layout",
  scroller: ".help-scroll",
  label: "Help sections",
  path: "/help",
  keepQuery: true,
};

/** Help's sections as the navigation and the section list take them. */
export function helpNavSections(): NavSection[] {
  return HELP_SECTIONS.map((s) => ({
    id: s.id,
    label: s.title,
    content: (
      <>
        <h2>{s.title}</h2>
        {s.body()}
      </>
    ),
  }));
}

export function Help({ onTour, onSetup }: { onTour: () => void; onSetup: () => void }) {
  const scroller = useRef<HTMLDivElement>(null);
  const nav = useSectionNav(scroller, HELP_SECTION_IDS, HELP_PAGE);
  const sections = helpNavSections();
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
          <div class="help-intro-actions">
            <button type="button" class="btn primary" onClick={onTour}>
              Take the tour
            </button>
            <button type="button" class="btn" onClick={onSetup}>
              Run setup again
            </button>
          </div>
        </header>
        <SectionNav page={HELP_PAGE} sections={sections} current={nav.current} anchor={nav.anchor} onJump={nav.jump} />
        <div class="help-sections">
          <SectionList page={HELP_PAGE} sections={sections} sectionClass="help-section" />
        </div>
      </div>
    </div>
  );
}
