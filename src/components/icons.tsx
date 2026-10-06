import type { ReactNode } from "react";

// Line icons used in more than one place. They take the text color.

type IconProps = { size?: number; className?: string };

function Icon({
  size,
  strokeWidth,
  className,
  children,
}: IconProps & { size: number; strokeWidth: number; children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const CheckIcon = ({ size = 14, className }: IconProps) => (
  <Icon size={size} strokeWidth={2.2} className={className}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Icon>
);

/** Marks a link that opens in a new tab. */
export const ArrowUpRightIcon = ({ size = 12, className }: IconProps) => (
  <Icon size={size} strokeWidth={2.4} className={className}>
    <path d="M7 17L17 7M9 7h8v8" />
  </Icon>
);

export const PlusIcon = ({ size = 14, className }: IconProps) => (
  <Icon size={size} strokeWidth={2.2} className={className}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);

export const ChevronDownIcon = ({ size = 14, className }: IconProps) => (
  <Icon size={size} strokeWidth={2} className={className}>
    <path d="M6 9l6 6 6-6" />
  </Icon>
);

/** A curved arrow back, for undo. */
export const UndoIcon = ({ size = 16, className }: IconProps) => (
  <Icon size={size} strokeWidth={2} className={className}>
    <path d="M9 14L4 9l5-5" />
    <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
  </Icon>
);

export const FileIcon =({ size = 18, className }: IconProps) => (
  <Icon size={size} strokeWidth={1.6} className={className}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
  </Icon>
);

/** Turns while something is in progress. */
export const SpinnerIcon = ({ size = 14, className = "" }: IconProps) => (
  <Icon size={size} strokeWidth={2.5} className={`animate-spin ${className}`}>
    <circle cx="12" cy="12" r="9" className="opacity-25" />
    <path d="M21 12a9 9 0 0 0-9-9" />
  </Icon>
);
