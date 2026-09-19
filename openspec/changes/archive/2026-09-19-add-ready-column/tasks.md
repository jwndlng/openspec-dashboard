## 1. Stage derivation

- [x] 1.1 Add `"ready"` to `Stage` and make `IMPLEMENTATION_COLUMNS` `["Ready", "Implementing", "Done", "Archived"]` in `src/shared/types.ts`
- [x] 1.2 In `deriveStage()` (`src/shared/columns.ts`) return `{ stage: "ready", column: "Ready" }` for the "all artifacts done" rule; keep rule order otherwise
- [x] 1.3 Update `test/parsers.test.ts`: `0/12` and `0/0` with all artifacts done → `Ready`; `1/12` → `Implementing`; ticked tasks with an open artifact → `Implementing`; `boardColumns()` ends with `Ready, Implementing, Done, Archived`

## 2. UI and docs

- [x] 2.1 Check `src/ui/kanban.tsx` and `src/ui/styles.css` for anything keyed on the `implementing` stage or column name (badges, header counts, "no tasks" warning) and make it work for `Ready`
- [x] 2.2 Update the README column description
- [x] 2.3 `bun test`, typecheck, and confirm on the real board that `0/N` changes sit in `Ready` and move to `Implementing` after ticking one task
