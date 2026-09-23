// A dialog over the dimmed, blurred page, like the change detail view: a titled panel that closes on Escape, on a click
// on the backdrop and with its close control. Used by the New change form and the repository's branch list.
import type { ComponentChildren } from "preact";
import { useEffect, useRef } from "preact/hooks";
import { IconX } from "./icons.tsx";

export function Modal({
  label,
  title,
  subtitle,
  icon,
  onClose,
  canClose,
  wide,
  children,
}: {
  /** The dialog's accessible name. */
  label: string;
  title: string;
  subtitle?: ComponentChildren;
  icon?: ComponentChildren;
  onClose: () => void;
  /** Asked before any close; false keeps the dialog open (e.g. while a request is in flight). */
  canClose?: () => boolean;
  wide?: boolean;
  children: ComponentChildren;
}) {
  const pressed = useRef(false);
  const close = () => {
    if (!canClose || canClose()) onClose();
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Only this dialog closes; whatever is behind it keeps its own Escape handling out of the way.
      e.stopPropagation();
      close();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  });
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents lint/a11y/noStaticElementInteractions: the backdrop is a pointer shortcut; Escape and the close control are its keyboard equivalents
    <div
      class="overlay modal-overlay"
      onMouseDown={(e) => {
        pressed.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && pressed.current) close();
        pressed.current = false;
      }}
    >
      <div class={`modal ${wide ? "wide" : ""}`} role="dialog" aria-modal="true" aria-label={label}>
        <header class="modal-head">
          {icon && (
            <span class="modal-icon" aria-hidden="true">
              {icon}
            </span>
          )}
          <div class="modal-title">
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button type="button" class="btn sm ghost detail-close" onClick={close} title="Close (Esc)" aria-label="Close">
            <IconX size={14} />
          </button>
        </header>
        <div class="modal-body">{children}</div>
      </div>
    </div>
  );
}
