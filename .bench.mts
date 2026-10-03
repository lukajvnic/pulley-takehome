import fs from "node:fs";
import { extractComments } from "@/lib/parse-comment-letter";
const PRICES: Record<string, [number, number]> = { "gpt-6-luna": [0.1, 0.5], "gpt-6.1-sol": [2, 10] };
const letters = fs.readdirSync("sample-letters").filter((f) => f.endsWith(".pdf"));
const runs = Object.keys(PRICES).flatMap((model) => letters.map((file) => ({ model, file })));
const results = await Promise.all(runs.map(async ({ model, file }) => {
  const start = Date.now();
  try {
    const { parsed, usage } = await extractComments(fs.readFileSync("sample-letters/" + file), file, model);
    const [pi, po] = PRICES[model];
    const cost = ((usage?.input_tokens ?? 0) * pi + (usage?.output_tokens ?? 0) * po) / 1e6;
    return { model, file, secs: Math.round((Date.now() - start) / 1000), cost, parsed };
  } catch (e) { return { model, file, error: String(e) }; }
}));
fs.writeFileSync("/private/tmp/claude-501/-Users-luka-dev-pulley/61e7e244-f509-4e00-9e63-3c011d957d39/scratchpad/bench.json", JSON.stringify(results, null, 2));
for (const r of results) {
  if ("error" in r) { console.log(r.model, r.file, "ERROR", r.error); continue; }
  const types = r.parsed.comments.reduce((a: Record<string, number>, c) => ((a[c.commentType] = (a[c.commentType] ?? 0) + 1), a), {});
  console.log(r.model.padEnd(12), r.file.replace("comment-letter-", "").padEnd(22), String(r.parsed.comments.length).padStart(3), "comments", JSON.stringify(types), `${r.secs}s $${r.cost.toFixed(4)}`, r.parsed.letterDate, r.parsed.reviewerName);
}
