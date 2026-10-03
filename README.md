# Pulley Take-Home Assignment

A simplified permit tracking app. Projects contain permits, permits contain approvals, and each approval moves through a review lifecycle with the **jurisdiction**, the city or county that issues the permit.

Your assignment is described in [ASSIGNMENT_TAKEHOME.md](./ASSIGNMENT_TAKEHOME.md). Follow the setup instructions below to get the app running.

## Stack

- [Next.js](https://nextjs.org/) (App Router) for both frontend and backend
- [Prisma](https://www.prisma.io/) + PostgreSQL. Postgres runs embedded via [`embedded-postgres`](https://www.npmjs.com/package/embedded-postgres), so there is nothing to install or run separately (no Docker). Data lives in `.pgdata/`.
- Tailwind CSS
- Uploaded files are stored on local disk in `uploads/` and served via `/api/files/*`

## Setup

Requirements: Node 22+ (see `.nvmrc`). That's it.

Extract the ZIP file you received by email, open a terminal in the extracted project folder, and run:

```bash
cp .env.example .env    # add your own API key(s) for AI features
npm install
npm run setup           # runs migrations and seeds data
npm run dev             # starts Postgres + Next.js
```

Open http://localhost:3000.

We encourage you to build AI features. Supply your own API key(s) in `.env`; keys are not included.

`npm run dev` starts the embedded Postgres and the Next.js dev server together. If you want to run something else against the database (e.g. `psql`, Prisma Studio), `npm run db` keeps Postgres up on port 5433 by itself, or use `npm run db:migrate` / `npm run db:seed` which wrap the corresponding Prisma commands.

If you ever want a clean slate: `npm run db:reset` (re-runs migrations and the seed).

## Domain primer

- **Project**: a construction project at an address, permitted by a jurisdiction. Each project has a team (`ProjectMember`s).
- **Permit**: a permit being pursued for the project (e.g. Building Permit, Health Permit).
- **Approval**: an individual review a permit needs. Each approval has a status:
  - `preparing`, assembling required documents before submitting
  - `submitted`, the jurisdiction is reviewing
  - `comments`, the jurisdiction responded with review comments (a "comment letter") that must be addressed
  - `approved`, done
- **Document**: a file attached to an approval. Today this is only the required-upload checklist used while preparing.

Approvals move between statuses using the action buttons on the approval page (`PATCH /api/approvals/:id`): submit to the jurisdiction, record that comments came back, or mark it approved. The UI only offers forward moves, but the API itself is intentionally simplistic and will accept any status change, with no rules about what a valid transition is.

There is no auth. The app assumes a single logged-in PM (Ana Reyes).

## Useful things in the repo

- `prisma/schema.prisma`, the data model
- `prisma/seed.ts`, seed data (3 projects with approvals in every status)
- `src/lib/uploads.ts` and `src/app/api/files/[...path]/route.ts`, how file upload and serving already work (see the `preparing` document checklist for a working example)
- `sample-letters/`, the comment letters to build against
