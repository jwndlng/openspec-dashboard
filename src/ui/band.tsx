// Pieces of a view's header band, shared by the boards and the projects overview.

/** A labelled count in a header band. */
export function Stat({ label, value, tone }: { label: string; value: number; tone?: "success" }) {
  return (
    <span class={`stat ${tone ?? ""}`}>
      {label} <strong>{value}</strong>
    </span>
  );
}
