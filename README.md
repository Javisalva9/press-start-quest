# Press Start Quest

**English** · [Español](README.es.md)

Installable mobile web app (PWA) that imports your PC game library, enriches it
with length, rating and cover art, and suggests what to play each day so you can
work through your backlog.

> Status: stage 1 (Steam and catalog) done. Next: stage 2, classification and
> progress.

## What it does today

- Sign in with Steam; sessions renew on their own for 30 days.
- Imports the Steam library (playtime, last session, achievements) and the
  wishlist, in the background, with a progress screen.
- Enriches each game with the Steam Store and IGDB: cover, rating, length,
  genres and themes. DLC, demos, Playtests, betas and soundtracks stay out.
- Library with search, filters and sorting, and a page for each game, where
  you can type a length IGDB doesn't know.
- Warns when the Steam profile is private, with the steps to fix it.
- Installable on the phone (PWA), in English and Spanish, and usable offline
  with the last data loaded.

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
│  ├─ api/                NestJS, schema and migrations in prisma/
│  │  └─ src/
│  │     ├─ auth/  users/  sources/  library/
│  │     ├─ sync/         import, enrichment, wishlist, achievements
│  │     ├─ catalog/      game classification and metadata rules
│  │     └─ providers/    Steam (Web API and Store) and IGDB clients
│  └─ web/                React + Vite: pages/, components/, api/, locales/
├─ packages/shared/       zod types and schemas shared by web and API
└─ .github/workflows/     CI on every pull request
```

## Running locally

Requirements: Node.js 24 (see `.node-version`) and pnpm 12 (see
`packageManager`).

```bash
pnpm install                              # installs everything and generates the Prisma client
cp apps/api/.env.example apps/api/.env    # then fill in the variables
pnpm --filter @psq/api db:deploy          # applies the migrations to your database
pnpm dev                                  # API on :3000 and web on :5173
```

Sign in at http://localhost:5173: the first visit imports your library.

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
| `pnpm --filter @psq/api db:deploy`  | Applies pending migrations (what Render runs)                |
| `pnpm --filter @psq/api db:studio`  | Opens Prisma Studio to browse the database                   |
| `pnpm --filter @psq/web icons`      | Regenerates the app icons from `apps/web/public/favicon.svg` |

## How the sync works

`POST /api/sync` starts a job and answers at once; the web app polls
`GET /api/sync/jobs/:id` for its progress. The job runs four steps:

1. **Library**: owned games and playtime from the Steam Web API, written in
   bulk; after the first sync, only what changed.
2. **Wishlist**: becomes the "wishlist" view, with Steam's priority.
3. **Enrichment**: Steam Store (one request every 1.6 s, its limit) and IGDB
   (4 per second) for games never enriched or older than 30 days. The catalog
   is shared, so a game is only fetched once for everyone.
4. **Achievements**: for played games whose playtime changed.

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
Real `.env` files are never committed. The API refuses to start if a required
one is missing, and says which.

| Variable                     | App | What for                                       |
| ---------------------------- | --- | ---------------------------------------------- |
| `DATABASE_URL`               | API | Pooled Neon connection (`sslmode=verify-full`) |
| `DATABASE_URL_DIRECT`        | API | Direct Neon connection, for migrations         |
| `WEB_URL`                    | API | Web app URL: Steam sends users back there      |
| `CORS_ORIGIN`                | API | Web URLs allowed to call the API               |
| `JWT_SECRET`                 | API | Signs access tokens (48 random bytes)          |
| `STEAM_API_KEY`              | API | Steam Web API                                  |
| `IGDB_CLIENT_ID` / `_SECRET` | API | IGDB, through a Twitch application             |
| `VITE_API_URL`               | Web | API URL on Render (empty locally)              |
