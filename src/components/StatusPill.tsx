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

export function StatusPill({ status }: { status: ApprovalStatus }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}
