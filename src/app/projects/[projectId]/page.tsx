import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { StatusPill } from "@/components/StatusPill";

export const dynamic = "force-dynamic";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: {
      members: { include: { user: true } },
      permits: { include: { approvals: { orderBy: { name: "asc" } } } },
    },
  });
  if (!project) notFound();

  return (
    <div>
      <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">
        ← Projects
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">{project.name}</h1>
      <p className="mt-1 text-sm text-gray-500">
        {project.address} · {project.ahjName}
      </p>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-medium">Permits</h2>
        <div className="space-y-4">
          {project.permits.map((permit) => (
            <div key={permit.id} className="rounded-lg border border-gray-200 bg-white">
              <div className="border-b border-gray-100 px-4 py-3">
                <span className="font-medium">{permit.name}</span>
                {permit.permitNumber && (
                  <span className="ml-2 text-sm text-gray-500">{permit.permitNumber}</span>
                )}
              </div>
              <ul className="divide-y divide-gray-100">
                {permit.approvals.map((approval) => (
                  <li key={approval.id}>
                    <Link
                      href={`/approvals/${approval.id}`}
                      className="flex items-center justify-between px-4 py-3 transition hover:bg-gray-50"
                    >
                      <span className="text-sm">{approval.name}</span>
                      <StatusPill status={approval.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-medium">Project Team</h2>
        <ul className="rounded-lg border border-gray-200 bg-white divide-y divide-gray-100">
          {project.members.map((member) => (
            <li key={member.id} className="flex items-center justify-between px-4 py-3">
              <span className="text-sm">{member.user.name}</span>
              <span className="text-xs uppercase tracking-wide text-gray-500">
                {member.user.role}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
