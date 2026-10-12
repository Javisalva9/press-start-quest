# Press Start Quest

**English** · [Español](README.es.md)

Installable mobile web app (PWA) that imports your PC game library, enriches it
with length, rating and cover art, and suggests what to play each day so you can
work through your backlog.

> Status: stage 1 (Steam and catalog) in progress.

## Stack

| Part       | Technology                                                             |
| ---------- | ---------------------------------------------------------------------- |
| Web        | React 19, Vite, TypeScript, React Router, TanStack Query, Tailwind CSS |
| API        | NestJS 12, TypeScript, Swagger                                         |
| Database   | PostgreSQL (Neon) with Prisma 7 and `@prisma/adapter-pg`               |
| Shared     | `packages/shared`: types and zod validation                            |
| Quality    | Vitest, oxlint, Prettier and GitHub Actions                            |
| Deployment | Render (API and web) and Neon (database), free tier                    |

## Structure

```text
press-start-quest/
├─ apps/
│  ├─ api/                NestJS: modules in src/, schema in prisma/
│  └─ web/                React + Vite
├─ packages/shared/       zod types and schemas shared by web and API
└─ .github/workflows/     CI on every pull request
```

## Running locally

Requirements: Node.js 24 (see `.node-version`) and pnpm 12 (see
`packageManager`).

```bash
pnpm install                         # installs everything and generates the Prisma client
cp apps/api/.env.example apps/api/.env   # then fill in the variables
pnpm dev                             # API on :3000 and web on :5173
```

- Web: http://localhost:5173
- API: http://localhost:3000/api/health
- API docs: http://localhost:3000/api/docs

## Scripts

| Command                             | What it does                                                 |
| ----------------------------------- | ------------------------------------------------------------ |
| `pnpm dev`                          | Starts shared, API and web in watch mode                     |
| `pnpm build`                        | Builds the three packages in order                           |
| `pnpm lint`                         | Runs oxlint                                                  |
| `pnpm typecheck`                    | Checks TypeScript types                                      |
| `pnpm test`                         | Runs the unit tests                                          |
| `pnpm format`                       | Formats the code with Prettier                               |
| `pnpm --filter @psq/api db:migrate` | Creates and applies a migration in development               |
| `pnpm --filter @psq/web icons`      | Regenerates the app icons from `apps/web/public/favicon.svg` |

## Languages

The web app is available in English (default) and Spanish, using
[react-i18next](https://react.i18next.com/). On first launch it uses the
device's language if it's one of the two, and English otherwise.

- No text is written inside a component: it lives in
  `apps/web/src/locales/en.json` and `es.json`, and the component calls
  `t('key.of.the.text')`.
- oxlint (`react/jsx-no-literals`) flags literal text in JSX.
- TypeScript checks that every key exists in `en.json`.
- A test fails if a key or a `{{…}}` placeholder is missing in either language,
  so CI won't let a half-done translation be merged.

This README is also in both languages (`README.md` and `README.es.md`): if you
change one, update the other in the same PR.

## Environment variables

Each app has its own `.env.example` listing every variable and what it's for.
Real `.env` files are never committed.
