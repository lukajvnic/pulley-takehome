import type { ReactNode } from "react";
import type { ApprovalStatus } from "@prisma/client";

const styles: Record<ApprovalStatus, string> = {
  preparing: "bg-gray-100 text-gray-700",
  submitted: "bg-blue-100 text-blue-800",
  comments: "bg-amber-100 text-amber-800",
  approved: "bg-green-100 text-green-800",
};

const labels: Record<ApprovalStatus, string> = {
  preparing: "Preparing",
  submitted: "Submitted",
  comments: "Comments",
  approved: "Approved",
};

export function Pill({ className, children }: { className: string; children: ReactNode }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}>
      {children}
    </span>
  );
}

export function StatusPill({ status }: { status: ApprovalStatus }) {
  return <Pill className={styles[status]}>{labels[status]}</Pill>;
}
