import { useEffect, type RefObject } from "react";

/** Closes a popover on a click outside `area` or on Escape, which returns focus to its button. */
export function useDismiss(
  open: boolean,
  area: RefObject<HTMLElement | null>,
  button: RefObject<HTMLButtonElement | null>,
  onClose: () => void
) {
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!area.current?.contains(event.target as Node)) onClose();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      onClose();
      button.current?.focus();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, area, button, onClose]);
}
