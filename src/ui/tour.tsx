// The first-visit tour: a dialog over the dimmed, inert page that points at one control of the hero at a time.
// It only explains — the page behind it takes no clicks — and it reads and writes nothing but the DOM it measures.
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { cardPlacement, type Placement, type Rect, stepLabel, TOUR_STEPS, type TourAnchor, type TourStep, visibleSteps } from "./tourState.ts";

const anchorElement = (anchor: TourAnchor) => document.querySelector<HTMLElement>(`[data-tour="${anchor}"]`);
/** Room around the highlighted control, so its focus ring and rounded corners stay inside the spotlight. */
const PAD = 6;

function prefersReducedMotion(): boolean {
  return matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** `finished` is true for Done on the last step, false for Skip tour, Escape or a route change. */
export function Tour({ onClose }: { onClose: (finished: boolean) => void }) {
  // Fixed when the tour starts, so "n of m" stays the same for the whole run.
  const [steps] = useState<TourStep[]>(() => visibleSteps(TOUR_STEPS, (a) => anchorElement(a) !== null));
  const [index, setIndex] = useState(0);
  const [spot, setSpot] = useState<Rect>();
  const [placement, setPlacement] = useState<Placement>();
  const card = useRef<HTMLDivElement>(null);
  const next = useRef<HTMLButtonElement>(null);
  const step = steps[index];
  const last = index === steps.length - 1;

  const forward = () => (last ? onClose(true) : setIndex((i) => Math.min(i + 1, steps.length - 1)));
  const back = () => setIndex((i) => Math.max(0, i - 1));

  // Bring the control into view once per step; measuring follows below.
  useLayoutEffect(() => {
    if (step.anchor) anchorElement(step.anchor)?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: prefersReducedMotion() ? "auto" : "smooth" });
    next.current?.focus();
  }, [index]);

  // Measure the control and place the card, again on every resize and scroll (any scroll area: the hero can sit in one).
  useLayoutEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const el = step.anchor ? anchorElement(step.anchor) : null;
      const box = el?.getBoundingClientRect();
      const rect = box ? { top: box.top - PAD, left: box.left - PAD, width: box.width + 2 * PAD, height: box.height + 2 * PAD } : undefined;
      setSpot(rect);
      const size = card.current ? { width: card.current.offsetWidth, height: card.current.offsetHeight } : { width: 360, height: 180 };
      setPlacement(cardPlacement(rect, size, { width: innerWidth, height: innerHeight }));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    // The card's height depends on the step's text, which only exists after the first placement.
    schedule();
    addEventListener("resize", schedule);
    addEventListener("scroll", schedule, true);
    return () => {
      removeEventListener("resize", schedule);
      removeEventListener("scroll", schedule, true);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [index]);

  // Keys, captured before anything behind the tour sees them, the way Modal does.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose(false);
      else if (e.key === "ArrowRight") forward();
      else if (e.key === "ArrowLeft") back();
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  });

  return (
    <div class="tour">
      {spot ? <div class="tour-spot" style={{ top: `${spot.top}px`, left: `${spot.left}px`, width: `${spot.width}px`, height: `${spot.height}px` }} /> : <div class="tour-scrim" />}
      <div
        ref={card}
        class="tour-card"
        role="dialog"
        aria-modal="true"
        aria-label="Dashboard tour"
        aria-describedby="tour-step-text"
        style={placement ? { top: `${placement.top}px`, left: `${placement.left}px`, width: `${placement.width}px` } : { opacity: 0 } /* not hidden: it takes focus before it is placed */}
      >
        <div class="tour-head">
          <h2>{step.title}</h2>
          <span class="tour-count">{stepLabel(index, steps.length)}</span>
        </div>
        <p id="tour-step-text">{step.text}</p>
        <div class="tour-actions">
          <button type="button" class="btn sm ghost" onClick={() => onClose(false)}>
            Skip tour
          </button>
          <span class="grow" />
          {index > 0 && (
            <button type="button" class="btn sm" onClick={back}>
              Back
            </button>
          )}
          <button type="button" class="btn sm primary" ref={next} onClick={forward}>
            {last ? "Done" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
