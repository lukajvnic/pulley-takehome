"use client";

import { useCallback, useId, useRef, useState, type ReactNode } from "react";
import { useDismiss } from "@/lib/use-dismiss";
import { LABEL } from "@/components/styles";

/**
 * A button that opens a panel of options below it, headed by `label`. It
 * closes on a click outside or Escape.
 */
export function Popover({
  label,
  trigger,
  triggerClassName,
  title,
  className = "",
  panelClassName,
  children,
}: {
  label: string;
  trigger: ReactNode;
  triggerClassName: string;
  title?: string;
  className?: string;
  /** Width and position of the panel, which opens at the bottom of the trigger. */
  panelClassName: string;
  children: ReactNode;
}) {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const area = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, area, button, close);

  return (
    // z-10 keeps the trigger clickable above a row's stretched toggle; z-40
    // while open lets the panel cover the rows below.
    <div ref={area} className={`relative ${open ? "z-40" : "z-10"} ${className}`}>
      <button
        ref={button}
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls={panelId}
        title={title}
        className={triggerClassName}
      >
        {trigger}
      </button>
      {open && (
        <div
          id={panelId}
          className={`absolute top-full rounded-lg border border-line-strong bg-white p-1.5 shadow-popover ${panelClassName}`}
        >
          <div className={`px-2.5 pt-2 pb-1.5 ${LABEL}`}>{label}</div>
          {children}
        </div>
      )}
    </div>
  );
}
