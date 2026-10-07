# Prompt

Feedback on the Activity view (src/ui/activity.tsx, src/ui/activityState.ts, spec activity-feed).

1. The top of the view has room for simple metrics. Add a compact summary strip above the feed for the retained window (7 days), e.g.:
   - changes created
   - changes moved
   - changes archived
   - tasks completed
   - agent sessions run
   - entries that need attention (the `danger` tone from `tone()`)
   The counts must cover the whole retained log, not just the loaded page (100 by default). So the server returns them as an aggregate alongside or next to `ActivityPage`, respecting the current repository and kind filters. The summary describes the feed only: the spec forbids the log from feeding board or overview counts, and that stays true.

2. A very busy log makes the view effectively unscrollable. Paging is already 100 entries plus "Load older". Additionally, collapse a day with many entries to its first N, with "Show N more" to expand it. Keep the sticky day headings working.

The demo's sample activity (src/ui/demo/sampleData.ts `buildActivity`) should exercise both: enough entries in one day to collapse, and non-zero counts for every metric.
