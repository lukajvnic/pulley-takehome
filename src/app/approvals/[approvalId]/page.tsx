import { notFound } from "next/navigation";
import { StatusPill } from "@/components/StatusPill";
import { StageActions } from "@/components/StageActions";
import { UploadButton } from "@/components/UploadButton";
import { BackLink } from "@/components/links";
import { FileList, type ListedFile } from "@/components/FileList";
import { longDate, plural } from "@/lib/format";
import { describeFile, loadApproval, type ApprovalWithDocs } from "./data";
import { ReviewCycles, SectionHeader } from "./ReviewCycles";

export const dynamic = "force-dynamic";

function daysSince(d: Date) {
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86_400_000));
}

export default async function ApprovalPage({
  params,
}: {
  params: Promise<{ approvalId: string }>;
}) {
  const { approvalId } = await params;
  const approval = await loadApproval(approvalId);
  if (!approval) notFound();

  const project = approval.permit.project;

  return (
    <div>
      <BackLink href={`/projects/${project.id}`}>{project.name}</BackLink>
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
        {approval.status === "preparing" ? (
          <Preparing approval={approval} />
        ) : (
          <>
            {approval.status === "submitted" && (
              <Banner
                tone="blue"
                title={`Submitted to ${project.ahjName}. Under review.`}
                detail={
                  approval.submittedAt &&
                  `Sent ${longDate(approval.submittedAt)} · day ${daysSince(approval.submittedAt)} of review`
                }
              />
            )}
            {approval.status === "approved" && (
              <Banner
                tone="green"
                title={`Approved by ${project.ahjName}.`}
                detail={approval.approvedAt && longDate(approval.approvedAt)}
              />
            )}
            <ReviewCycles approval={approval} />
          </>
        )}
      </div>
    </div>
  );
}

/** The package being put together for the initial submittal. */
async function Preparing({ approval }: { approval: ApprovalWithDocs }) {
  const total = approval.documents.length;
  const ready = approval.documents.filter((d) => d.submittal?.status === "uploaded").length;
  const outstanding = total - ready;

  const files: ListedFile[] = await Promise.all(
    approval.documents.map((d) =>
      d.submittal?.status === "uploaded" && d.filePath
        ? describeFile({ ...d, filePath: d.filePath, kind: d.submittal.kind })
        : {
            id: d.id,
            name: d.name,
            meta: "Not uploaded yet",
            action: (
              <UploadButton
                uploadUrl={`/api/documents/${d.id}/upload`}
                label="Upload"
                ariaLabel={`Upload ${d.name}`}
              />
            ),
          }
    )
  );

  return (
    <section>
      <SectionHeader title="Initial submittal" />
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-base font-semibold">To submit</h3>
        <span className="text-sm text-ink-muted">
          {ready} of {total} documents ready
        </span>
      </div>

      <FileList files={files} />

      <p className="mt-3 text-sm text-ink-muted">
        {outstanding === 0
          ? `Everything is ready. Submit the package to ${approval.permit.project.ahjName}.`
          : `${plural(outstanding, "document")} still outstanding before this is ready to submit.`}
      </p>
    </section>
  );
}

const BANNER_TONES = {
  blue: { box: "border-blue-200 bg-blue-50", title: "text-blue-900", detail: "text-blue-700" },
  green: { box: "border-green-200 bg-green-50", title: "text-green-900", detail: "text-green-700" },
};

/** Where the approval stands with the jurisdiction, above its history. */
function Banner({
  tone,
  title,
  detail,
}: {
  tone: keyof typeof BANNER_TONES;
  title: string;
  detail?: string | null;
}) {
  const colors = BANNER_TONES[tone];
  return (
    <div className={`mb-10 rounded-lg border p-4 ${colors.box}`}>
      <p className={`font-medium ${colors.title}`}>{title}</p>
      {detail && <p className={`mt-1 text-sm ${colors.detail}`}>{detail}</p>}
    </div>
  );
}
