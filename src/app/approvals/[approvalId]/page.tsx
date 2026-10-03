import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { StatusPill } from "@/components/StatusPill";
import { StageActions } from "@/components/StageActions";
import { UploadButton } from "@/components/UploadButton";

export const dynamic = "force-dynamic";

const longDate = (d: Date) =>
  d.toLocaleDateString("en-US", { dateStyle: "long" });

function daysSince(d: Date) {
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86_400_000));
}

export default async function ApprovalPage({
  params,
}: {
  params: Promise<{ approvalId: string }>;
}) {
  const { approvalId } = await params;
  const approval = await db.approval.findUnique({
    where: { id: approvalId },
    include: {
      documents: {
        where: { type: "submittal" },
        include: { submittal: true },
        orderBy: { name: "asc" },
      },
      permit: { include: { project: true } },
    },
  });
  if (!approval) notFound();

  const project = approval.permit.project;

  return (
    <div>
      <Link
        href={`/projects/${project.id}`}
        className="text-sm text-gray-500 hover:text-gray-700"
      >
        ← {project.name}
      </Link>
      <div className="mt-2 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{approval.name}</h1>
            <StatusPill status={approval.status} />
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {approval.permit.name}
            {approval.permit.permitNumber ? ` · ${approval.permit.permitNumber}` : ""}
            {` · ${project.ahjName}`}
          </p>
        </div>
        <StageActions approvalId={approval.id} status={approval.status} />
      </div>

      <div className="mt-8">
        {approval.status === "preparing" && <Preparing approval={approval} />}
        {approval.status === "submitted" && <Submitted approval={approval} />}
        {approval.status === "comments" && <Comments approval={approval} />}
        {approval.status === "approved" && <Approved approval={approval} />}
      </div>
    </div>
  );
}

type ApprovalWithDocs = NonNullable<
  Awaited<
    ReturnType<
      typeof db.approval.findUnique<{
        where: { id: string };
        include: {
          documents: { include: { submittal: true } };
          permit: { include: { project: true } };
        };
      }>
    >
  >
>;

/** The documents that make up the submission package. */
function PackageList({
  approval,
  editable,
}: {
  approval: ApprovalWithDocs;
  editable: boolean;
}) {
  return (
    <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
      {approval.documents.map((doc) => (
        <li key={doc.id} className="flex items-center justify-between px-4 py-3">
          <div>
            <div className="text-sm">{doc.name}</div>
            {doc.submittal?.status === "uploaded" && doc.filePath ? (
              <a
                href={`/api/files/${doc.filePath}`}
                target="_blank"
                className="text-xs text-blue-600 hover:underline"
              >
                View file
                {doc.uploadedAt ? ` · added ${longDate(doc.uploadedAt)}` : ""}
              </a>
            ) : (
              <div className="text-xs text-gray-400">Not uploaded</div>
            )}
          </div>
          {doc.submittal?.status === "uploaded" ? (
            <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
              Ready
            </span>
          ) : editable ? (
            <UploadButton uploadUrl={`/api/documents/${doc.id}/upload`} label="Upload" />
          ) : (
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
              Missing
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

function Preparing({ approval }: { approval: ApprovalWithDocs }) {
  const total = approval.documents.length;
  const ready = approval.documents.filter((d) => d.submittal?.status === "uploaded").length;
  const outstanding = total - ready;

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-lg font-medium">Submission package</h2>
        <span className="text-sm text-gray-500">
          {ready} of {total} documents ready
        </span>
      </div>

      <PackageList approval={approval} editable />

      <p className="mt-3 text-sm text-gray-500">
        {outstanding === 0
          ? `Everything is ready. Submit the package to ${approval.permit.project.ahjName}.`
          : `${outstanding} document${outstanding === 1 ? "" : "s"} still outstanding before this is ready to submit.`}
      </p>
    </section>
  );
}

function Submitted({ approval }: { approval: ApprovalWithDocs }) {
  const ahj = approval.permit.project.ahjName;
  return (
    <section>
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <p className="font-medium text-blue-900">
          Submitted to {ahj}. Under review.
        </p>
        {approval.submittedAt && (
          <p className="mt-1 text-sm text-blue-700">
            Sent {longDate(approval.submittedAt)} · day{" "}
            {daysSince(approval.submittedAt)} of review
          </p>
        )}
      </div>

      <div className="mt-6">
        <h2 className="mb-3 text-lg font-medium">What we submitted</h2>
        <PackageList approval={approval} editable={false} />
      </div>
    </section>
  );
}

function Comments({ approval }: { approval: ApprovalWithDocs }) {
  const ahj = approval.permit.project.ahjName;
  return (
    <section>
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <p className="font-medium text-amber-900">
          Comments have been received from {ahj}.
        </p>
      </div>

      <div className="mt-6">
        <h2 className="mb-3 text-lg font-medium">Comments</h2>
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
          <p className="text-sm text-gray-700">
            No comments have been added to Pulley yet.
          </p>
          <p className="mt-1 text-sm text-gray-500">
            The comments from {ahj} need to get in here before the team can respond
            to them.
          </p>
        </div>
      </div>
    </section>
  );
}

function Approved({ approval }: { approval: ApprovalWithDocs }) {
  return (
    <section>
      <div className="rounded-lg border border-green-200 bg-green-50 p-4">
        <p className="font-medium text-green-900">
          Approved by {approval.permit.project.ahjName}.
        </p>
        {approval.approvedAt && (
          <p className="mt-1 text-sm text-green-700">
            {longDate(approval.approvedAt)}
          </p>
        )}
      </div>

      {approval.documents.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-3 text-lg font-medium">What we submitted</h2>
          <PackageList approval={approval} editable={false} />
        </div>
      )}
    </section>
  );
}
