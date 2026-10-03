/**
 * Runs an embedded Postgres (no Docker or local install needed), then either:
 *   - keeps it running until Ctrl+C:        tsx scripts/db.ts
 *   - runs a command against it and exits:  tsx scripts/db.ts npx prisma migrate dev
 *
 * If Postgres is already listening on the port (e.g. `npm run dev` is running in
 * another terminal), that instance is reused instead of starting a second one.
 *
 * Data lives in .pgdata/ at the repo root. Set DEBUG_PG=1 for Postgres logs.
 */
import EmbeddedPostgres from "embedded-postgres";
import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";

const PORT = 5433;
const DEFAULT_DATABASE_URL =
  `postgresql://permit_tools:permit_tools@localhost:${PORT}/permit_tools`;
const databaseDir = path.join(__dirname, "..", ".pgdata");
const quiet = !process.env.DEBUG_PG;

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = DEFAULT_DATABASE_URL;
}

const pg = new EmbeddedPostgres({
  databaseDir,
  user: "permit_tools",
  password: "permit_tools",
  port: PORT,
  persistent: true,
  ...(quiet ? { onLog: () => {} } : {}),
});

function isPortOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: "127.0.0.1" });
    const done = (result: boolean) => {
      socket.destroy();
      resolve(result);
    };
    socket.once("connect", () => done(true));
    socket.once("error", () => done(false));
    socket.setTimeout(1000, () => done(false));
  });
}

function runCommand(command: string[], onExit: (code: number) => void) {
  const child = spawn(command[0], command.slice(1), {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: {
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL,
    },
  });
  child.on("error", (err) => {
    console.error(`Failed to run \`${command.join(" ")}\`:`, err.message);
    onExit(1);
  });
  child.on("exit", (code) => onExit(code ?? 0));
}

async function main() {
  const command = process.argv.slice(2);

  // Reuse an already-running instance (e.g. started by `npm run dev`).
  if (await isPortOpen(PORT)) {
    if (command.length === 0) {
      console.log(`Postgres is already running on port ${PORT}. Nothing to do.`);
      return;
    }
    runCommand(command, (code) => process.exit(code));
    return;
  }

  const firstRun = !fs.existsSync(path.join(databaseDir, "PG_VERSION"));
  if (firstRun) {
    await pg.initialise();
  }
  await pg.start();
  if (firstRun) {
    await pg.createDatabase("permit_tools");
  }

  if (command.length === 0) {
    console.log(`Postgres running on port ${PORT}. Press Ctrl+C to stop.`);
    const stop = async () => {
      await pg.stop();
      process.exit(0);
    };
    process.on("SIGINT", stop);
    process.on("SIGTERM", stop);
    return;
  }

  runCommand(command, async (code) => {
    await pg.stop();
    process.exit(code);
  });
}

main().catch(async (err) => {
  console.error("Failed to start the embedded Postgres:", err ?? "(no error detail)");
  await pg.stop().catch(() => {});
  process.exit(1);
});
