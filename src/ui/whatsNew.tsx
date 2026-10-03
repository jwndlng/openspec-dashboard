// What's new: a top-corner button with the number of changelog entries this browser has not seen, opening a dialog
// that lists every entry by month. The list is compiled in (changelog.ts) and "seen" lives in localStorage, so nothing
// here makes a request; the releases link is one the user follows.
import { useEffect, useState } from "preact/hooks";
import { CHANGELOG } from "./changelog.ts";
import { IconGift } from "./icons.tsx";
import { renderMarkdown } from "./markdown.tsx";
import { Modal } from "./modal.tsx";
import { unseenLabel } from "./activityState.ts";
import { formatEntryDate, groupByMonth, loadSeenIds, saveSeenIds, unseenIds } from "./whatsNewState.ts";

export const RELEASES_URL = "https://github.com/jwndlng/openspec-dashboard/releases";

const allIds = () => new Set(CHANGELOG.map((e) => e.id));

export function WhatsNew() {
  const [seen, setSeen] = useState<ReadonlySet<string> | undefined>(undefined);
  // The ids that were unseen when the dialog opened: they keep their New mark until it closes.
  const [open, setOpen] = useState<ReadonlySet<string>>();

  useEffect(() => {
    const remembered = loadSeenIds();
    if (remembered) {
      setSeen(remembered);
      return;
    }
    // First visit (or nothing readable): everything that exists now counts as seen, so the count starts at zero.
    saveSeenIds(allIds(), CHANGELOG);
    setSeen(loadSeenIds());
  }, []);

  const unseen = unseenIds(CHANGELOG, seen);
  const count = unseenLabel(unseen.length);

  const show = () => {
    setOpen(new Set(unseen));
    // Saved at once, so a reload while the dialog is open does not count them again.
    const everything = allIds();
    saveSeenIds(everything, CHANGELOG);
    setSeen(seen && everything);
  };

  return (
    <>
      <button
        type="button"
        class="btn sm ghost whats-new-btn"
        onClick={show}
        title={count ? `What's new — ${unseen.length} new since you last looked` : "What's new"}
        aria-label={count ? `What's new, ${unseen.length} new` : "What's new"}
      >
        <IconGift size={14} />
        What's new
        {count && (
          <span class="whats-new-count" aria-hidden="true">
            {count}
          </span>
        )}
      </button>
      {open && <WhatsNewDialog fresh={open} onClose={() => setOpen(undefined)} />}
    </>
  );
}

function WhatsNewDialog({ fresh, onClose }: { fresh: ReadonlySet<string>; onClose: () => void }) {
  return (
    <Modal label="What's new" title="What's new" subtitle="New features in the dashboard, newest first" icon={<IconGift size={18} />} onClose={onClose}>
      <div class="whats-new">
        {groupByMonth(CHANGELOG).map((month) => (
          <section key={month.key} class="whats-new-month">
            <h3>{month.label}</h3>
            <ul>
              {month.entries.map((entry) => (
                <li key={entry.id} class={fresh.has(entry.id) ? "fresh" : undefined}>
                  <div class="whats-new-head">
                    <strong>{entry.title}</strong>
                    {fresh.has(entry.id) && <span class="badge info whats-new-mark">New</span>}
                    <time dateTime={entry.date}>{formatEntryDate(entry.date)}</time>
                  </div>
                  {renderMarkdown(entry.summary)}
                </li>
              ))}
            </ul>
          </section>
        ))}
        <p class="whats-new-foot">
          Every fix and change is in the{" "}
          <a href={RELEASES_URL} target="_blank" rel="noopener noreferrer">
            release notes on GitHub
          </a>
          .
        </p>
      </div>
    </Modal>
  );
}
