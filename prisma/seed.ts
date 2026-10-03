import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";

const db = new PrismaClient();

const UPLOADS = path.join(process.cwd(), "uploads");

/**
 * Writes a tiny one-page PDF so seeded documents are real, openable files
 * rather than dead links. Keeps the seed dependency-free.
 */
function writePlaceholderPdf(filename: string, title: string): string {
  const text = title.replace(/([()\\])/g, "\\$1");
  const content = `BT /F1 16 Tf 72 720 Td (${text}) Tj ET`;
  const objects = [
    "<</Type/Catalog/Pages 2 0 R>>",
    "<</Type/Pages/Kids[3 0 R]/Count 1>>",
    "<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Resources<</Font<</F1 5 0 R>>>>/Contents 4 0 R>>",
    `<</Length ${content.length}>>\nstream\n${content}\nendstream`,
    "<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((obj, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<</Size ${objects.length + 1}/Root 1 0 R>>\nstartxref\n${xref}\n%%EOF\n`;

  fs.mkdirSync(UPLOADS, { recursive: true });
  fs.writeFileSync(path.join(UPLOADS, filename), Buffer.from(pdf, "latin1"));
  return filename;
}

let seq = 0;
/** A document that's already been uploaded. */
function uploaded(name: string, uploadedAt: Date) {
  const filename = `seed-${++seq}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`;
  writePlaceholderPdf(filename, name);
  return {
    name,
    type: "submittal" as const,
    filePath: filename,
    uploadedAt,
    submittal: { create: { status: "uploaded" as const } },
  };
}

/** A document still outstanding. */
const needed = (name: string) => ({
  name,
  type: "submittal" as const,
  submittal: { create: { status: "needed" as const } },
});

async function main() {
  // Reset everything so the seed is idempotent.
  await db.document.deleteMany();
  await db.approval.deleteMany();
  await db.permit.deleteMany();
  await db.projectMember.deleteMany();
  await db.project.deleteMany();
  await db.user.deleteMany();

  // Old seed files, so re-running doesn't accumulate junk.
  if (fs.existsSync(UPLOADS)) {
    for (const f of fs.readdirSync(UPLOADS)) {
      if (f.startsWith("seed-")) fs.unlinkSync(path.join(UPLOADS, f));
    }
  }

  const [ana, ben, carla, dev, erin, frank] = await Promise.all([
    db.user.create({ data: { name: "Ana Reyes", email: "ana@example.com", role: "pm" } }),
    db.user.create({ data: { name: "Ben Whitfield", email: "ben@example.com", role: "designer" } }),
    db.user.create({ data: { name: "Carla Nguyen", email: "carla@example.com", role: "engineer" } }),
    db.user.create({ data: { name: "Dev Patel", email: "dev@example.com", role: "engineer" } }),
    db.user.create({ data: { name: "Erin Kowalski", email: "erin@example.com", role: "consultant" } }),
    db.user.create({ data: { name: "Frank Osei", email: "frank@example.com", role: "designer" } }),
  ]);

  const may = new Date("2026-05-18T12:00:00Z");
  const june = new Date("2026-06-19T12:00:00Z");

  // ── Project 1: Harbor Point Retail ────────────────────────────────
  const harborPoint = await db.project.create({
    data: {
      name: "Harbor Point Retail Tenant Improvement",
      address: "1400 Harbor Point Dr, Oakview, CA",
      ahjName: "City of Oakview",
      members: {
        create: [
          { userId: ana.id },
          { userId: ben.id },
          { userId: carla.id },
          { userId: erin.id },
        ],
      },
    },
  });

  const harborBuildingPermit = await db.permit.create({
    data: {
      projectId: harborPoint.id,
      name: "Building Permit",
      permitNumber: "BLD2026-0412",
    },
  });

  // Starts in preparing so the full flow (submit, comments received, upload
  // the Oakview letter) can be run from the beginning.
  await db.approval.create({
    data: {
      permitId: harborBuildingPermit.id,
      name: "Building Plan Review",
      status: "preparing",
    },
  });

  // Submitted: the whole package went out, now waiting on the jurisdiction.
  await db.approval.create({
    data: {
      permitId: harborBuildingPermit.id,
      name: "Fire Plan Review",
      status: "submitted",
      submittedAt: new Date("2026-06-22T12:00:00Z"),
      documents: {
        create: [
          uploaded("Fire Protection Plans", june),
          uploaded("Sprinkler Hydraulic Calculations", june),
          uploaded("Alarm Riser Diagram", june),
        ],
      },
    },
  });

  // Preparing: partly assembled, one item outstanding.
  await db.permit.create({
    data: {
      projectId: harborPoint.id,
      name: "Mechanical Permit",
      approvals: {
        create: [
          {
            name: "Mechanical Plan Review",
            status: "preparing",
            documents: {
              create: [
                uploaded("Mechanical Plans (stamped)", june),
                uploaded("Equipment Cut Sheets", june),
                needed("Title 24 Energy Calculations"),
              ],
            },
          },
        ],
      },
    },
  });

  // ── Project 2: Sunrise Cafe ───────────────────────────────────────
  const sunrise = await db.project.create({
    data: {
      name: "Sunrise Cafe New Food Facility",
      address: "88 Mercado Way, Suite B, Mesa County, CA",
      ahjName: "Mesa County",
      members: {
        create: [{ userId: ana.id }, { userId: dev.id }, { userId: frank.id }],
      },
    },
  });

  await db.permit.create({
    data: {
      projectId: sunrise.id,
      name: "Health Permit",
      permitNumber: "EH-2026-1187",
      approvals: {
        create: [
          {
            // Starts in preparing; the Mesa letter is uploaded after submitting.
            name: "Environmental Health Plan Review",
            status: "preparing",
          },
        ],
      },
    },
  });

  await db.permit.create({
    data: {
      projectId: sunrise.id,
      name: "Building Permit",
      permitNumber: "BLD2026-0533",
      approvals: {
        create: [
          {
            name: "Building Plan Review",
            status: "approved",
            submittedAt: new Date("2026-05-10T12:00:00Z"),
            approvedAt: new Date("2026-06-30T12:00:00Z"),
            documents: {
              create: [
                uploaded("Architectural Plan Set", may),
                uploaded("Structural Calculations", may),
                uploaded("Permit Application Form", may),
              ],
            },
          },
        ],
      },
    },
  });

  // ── Project 3: Willow Creek ───────────────────────────────────────
  await db.project.create({
    data: {
      name: "Willow Creek Office Fit-Out",
      address: "210 Willow Creek Rd, Brandt, CA",
      ahjName: "City of Brandt",
      members: {
        create: [{ userId: ana.id }, { userId: carla.id }, { userId: erin.id }],
      },
      permits: {
        create: [
          {
            name: "Building Permit",
            approvals: {
              create: [
                {
                  // Nothing assembled yet.
                  name: "Building Plan Review",
                  status: "preparing",
                  documents: {
                    create: [
                      needed("Architectural Plan Set"),
                      needed("Structural Calculations"),
                      needed("Soils Report"),
                      needed("Permit Application Form"),
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  });

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
