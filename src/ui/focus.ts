// Focus a form's first field when it opens, and never again.
//
// An inline `ref={(el) => el?.focus()}` is a new function on every render, so Preact re-attaches it on every render
// and focuses the element again — pulling the keyboard focus out of whatever field the user moved to. Hold one
// `focusOnce()` for the life of the component instead: the ref value stays the same, and the guard covers a
// re-attach (a keyed move) as well.

/** A ref callback that focuses the first element it is given and ignores every later call. */
export function focusOnce(): (el: { focus(): void } | null) => void {
  let focused = false;
  return (el) => {
    if (!el || focused) return;
    focused = true;
    el.focus();
  };
}
