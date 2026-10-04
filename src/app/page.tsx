import Link from "next/link";
import { db } from "@/lib/db";
import { plural } from "@/lib/format";
import { Pill } from "@/components/StatusPill";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const projects = await db.project.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      members: { include: { user: true } },
      permits: { include: { approvals: true } },
    },
  });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Projects</h1>
      <ul className="space-y-3">
        {projects.map((project) => {
          const approvals = project.permits.flatMap((p) => p.approvals);
          const openComments = approvals.filter((a) => a.status === "comments").length;
          return (
            <li key={project.id}>
              <Link
                href={`/projects/${project.id}`}
                className="block rounded-lg border border-gray-200 bg-white p-4 transition hover:border-gray-300 hover:shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium">{project.name}</div>
                    <div className="mt-1 text-sm text-gray-500">
                      {project.address} · {project.ahjName}
                    </div>
                  </div>
                  {openComments > 0 && (
                    <Pill className="bg-amber-100 text-amber-800">
                      {openComments} with comments
                    </Pill>
                  )}
                </div>
                <div className="mt-2 text-sm text-gray-500">
                  {plural(project.permits.length, "permit")} ·{" "}
                  {plural(project.members.length, "team member")}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
