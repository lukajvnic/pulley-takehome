import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { db } from "@/lib/db";
import { longDate, responseLetterFileName } from "@/lib/format";

/** Everything the response letter shows, straight from the database. */
const loadLetter = (letterId: string) =>
  db.commentLetter.findUniqueOrThrow({
    where: { documentId: letterId },
    include: {
      document: {
        include: {
          approval: {
            include: {
              permit: {
                include: { project: { include: { members: { include: { user: true } } } } },
              },
            },
          },
        },
      },
      comments: {
        orderBy: { position: "asc" },
        include: { attachments: { include: { document: true } } },
      },
    },
  });

type Letter = Awaited<ReturnType<typeof loadLetter>>;
type Comment = Letter["comments"][number];

/**
 * The package the response goes out with: once it's sent, its submission and
 * the files in it; until then no submission yet, and the files uploaded since
 * the last one, which is what submitting sends.
 */
async function loadPackage(approvalId: string, round: number) {
  const sent = await db.submission.findUnique({
    where: { approvalId_number: { approvalId, number: round + 1 } },
  });
  const submissionId = sent?.id ?? null;
  const documents = await db.document.findMany({
    where: {
      approvalId,
      submittal: { kind: "required_upload", status: "uploaded", submissionId },
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return { submissionId, enclosures: documents };
}

// Colors mirror the app's ink tokens (globals.css); PDFs can't read CSS variables.
const INK = "#17191c";
const MUTED = "#5b606a";
const LINE = "#e2e2dd";

const styles = StyleSheet.create({
  page: {
    paddingTop: 56,
    paddingBottom: 64,
    paddingHorizontal: 60,
    fontFamily: "Helvetica",
    fontSize: 10.5,
    lineHeight: 1.45,
    color: INK,
  },
  draft: {
    position: "absolute",
    top: 24,
    right: 60,
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    letterSpacing: 1,
    color: "#8a3a0b",
  },
  muted: { color: MUTED },
  block: { marginBottom: 16 },
  bold: { fontFamily: "Helvetica-Bold" },
  section: {
    marginTop: 14,
    marginBottom: 6,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
    fontFamily: "Helvetica-Bold",
    fontSize: 9.5,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  item: { flexDirection: "row", marginBottom: 12 },
  number: { width: 40, fontFamily: "Helvetica-Bold" },
  itemBody: { flex: 1 },
  comment: { color: MUTED, fontSize: 9.5, marginBottom: 4 },
  // Anchored from the top: react-pdf misplaces render-prop text positioned by
  // `bottom`. 752 of the page's 792pt leaves the same margin as the header.
  footer: { position: "absolute", top: 752, fontSize: 8.5, color: MUTED },
});

/** Comments grouped under their discipline, keeping the letter's order. */
function bySection(comments: Comment[]) {
  const sections: { discipline: string | null; comments: Comment[] }[] = [];
  for (const comment of comments) {
    const last = sections.at(-1);
    if (last && last.discipline === comment.discipline) last.comments.push(comment);
    else sections.push({ discipline: comment.discipline, comments: [comment] });
  }
  return sections;
}

/**
 * A comment's attached files, split into the ones going out with this response
 * and the ones the jurisdiction already has from an earlier submission.
 */
function attachedFiles(comment: Comment, submissionId: string | null) {
  const names = (enclosed: boolean) =>
    comment.attachments
      .filter((attachment) => (attachment.submissionId === submissionId) === enclosed)
      .map((attachment) => attachment.document.name)
      .join(", ");
  return { enclosed: names(true), earlier: names(false) };
}

function responseText(comment: Comment, draft: boolean) {
  if (comment.response?.trim()) return comment.response.trim();
  if (comment.commentType !== "correction") return "Acknowledged. No response required.";
  return draft ? "Response pending." : "No response provided.";
}

function ResponseLetter({
  letter,
  submissionId,
  enclosures,
  date,
  draft,
}: {
  letter: Letter;
  submissionId: string | null;
  enclosures: string[];
  date: Date;
  draft: boolean;
}) {
  const { approval } = letter.document;
  const { permit } = approval;
  const { project } = permit;
  // No auth yet, so the letter is signed by the project's PM.
  const signer =
    project.members.find((m) => m.user.role === "pm")?.user ?? project.members[0]?.user;
  const title = `Response to review cycle ${letter.round} comments`;

  return (
    <Document title={title} author={signer?.name} subject={project.name}>
      <Page size="LETTER" style={styles.page}>
        {draft && <Text style={styles.draft} fixed>DRAFT · NOT SUBMITTED</Text>}

        <Text style={styles.block}>{longDate(date)}</Text>

        {/* Addressed to the jurisdiction, not the reviewer: many letters route
            resubmittals to an intake desk or portal, and the permit number in
            the RE line is what matches the response to the review. */}
        <Text style={styles.block}>{project.ahjName}</Text>

        <View style={styles.block}>
          <Text>
            <Text style={styles.bold}>RE: </Text>
            {permit.name}
            {permit.permitNumber ? ` ${permit.permitNumber}` : ""} · {approval.name}
          </Text>
          <Text>
            <Text style={styles.bold}>Project: </Text>
            {project.name}, {project.address}
          </Text>
          <Text>
            <Text style={styles.bold}>Subject: </Text>
            {title}
          </Text>
        </View>

        <Text style={styles.block}>
          To Whom It May Concern,{"\n\n"}
          Please find below our responses to the plan review comments
          {letter.letterDate
            ? ` dated ${letter.letterDate.toLocaleDateString("en-US", { dateStyle: "long", timeZone: "UTC" })}`
            : ""}
          . Each response is numbered to match your letter, and revisions are clouded on the
          resubmitted drawings.
        </Text>

        {bySection(letter.comments).map((section, i) => (
          <View key={i}>
            {section.discipline && (
              <Text style={styles.section} minPresenceAhead={60}>
                {section.discipline}
              </Text>
            )}
            {section.comments.map((comment) => {
              const { enclosed, earlier } = attachedFiles(comment, submissionId);
              return (
                <View key={comment.id} style={styles.item} wrap={false}>
                  <Text style={styles.number}>{comment.number || "·"}</Text>
                  <View style={styles.itemBody}>
                    <Text style={styles.comment}>{comment.text}</Text>
                    <Text>
                      <Text style={styles.bold}>Response: </Text>
                      {responseText(comment, draft)}
                    </Text>
                    {enclosed && <Text style={styles.muted}>Enclosed: {enclosed}</Text>}
                    {earlier && <Text style={styles.muted}>Previously submitted: {earlier}</Text>}
                  </View>
                </View>
              );
            })}
          </View>
        ))}

        {enclosures.length > 0 && (
          <View style={{ marginTop: 8 }} wrap={false}>
            <Text style={styles.bold}>Enclosures</Text>
            {enclosures.map((name, i) => (
              <Text key={i}>· {name}</Text>
            ))}
          </View>
        )}

        <View style={{ marginTop: 20 }} wrap={false}>
          <Text>Sincerely,</Text>
          <Text style={{ marginTop: 18 }}>{signer?.name ?? "The project team"}</Text>
          {signer?.role === "pm" && <Text style={styles.muted}>Project Manager</Text>}
        </View>

        <Text style={[styles.footer, { left: 60 }]} fixed>
          {title}
        </Text>
        <Text
          // Page numbers fill in after layout, so the box needs a width up front.
          style={[styles.footer, { right: 60, width: 60, textAlign: "right" }]}
          fixed
          render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
        />
      </Page>
    </Document>
  );
}

/**
 * Renders the response to a comment letter from what's saved now, with the ids
 * of the files it lists as enclosed. Drafts are marked so a downloaded copy
 * can't be mistaken for the one that went out.
 */
export async function renderResponseLetter(
  letterId: string,
  { draft, date = new Date() }: { draft: boolean; date?: Date }
) {
  const letter = await loadLetter(letterId);
  const { submissionId, enclosures } = await loadPackage(letter.document.approvalId, letter.round);
  const pdf = await renderToBuffer(
    <ResponseLetter
      letter={letter}
      submissionId={submissionId}
      enclosures={enclosures.map((document) => document.name)}
      date={date}
      draft={draft}
    />
  );
  return {
    pdf,
    fileName: responseLetterFileName(letter.round),
    enclosedIds: enclosures.map((document) => document.id),
  };
}
