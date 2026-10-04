import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRightIcon } from "@/components/icons";
import { LINK } from "@/components/styles";

/** "← Parent", above a page's title. */
export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="text-sm text-gray-500 hover:text-gray-700">
      ← {children}
    </Link>
  );
}

/** A link that opens in a new tab, marked with ↗. */
export function ExternalLink({
  href,
  className = "",
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={`inline-flex items-center gap-0.5 rounded-xs text-small ${LINK} ${className}`}
    >
      {children}
      <ArrowUpRightIcon />
    </a>
  );
}
