# Press Start Quest

**English** · [Español](README.es.md)

Installable mobile web app (PWA) that imports your PC game library, enriches it
with length, rating and cover art, and suggests what to play each day so you can
work through your backlog.

> Status: stages 1 to 3 (Steam and catalog, classification and progress,
> recommendations) done. Next: stage 4, deals, notifications and motivation.

## What it does today

- Sign in with Steam; sessions renew on their own for 30 days.
- Imports the Steam library (playtime, last session, achievements) and the
  wishlist, in the background, with a progress screen.
- Enriches each game with the Steam Store and IGDB: cover, rating, length,
  genres and themes. DLC, demos, Playtests, betas and soundtracks stay out.
- Library with search, filters and sorting, and a page for each game, where
  you can type a length IGDB doesn't know.
- Warns when the Steam profile is private, with the steps to fix it.
- Classifies each game as completable, endless or sandbox, flags closed
  servers, and spots games that look finished (all achievements, the ending
  achievement or enough hours) for the player to confirm in **Catch up**, a
  swipe-card review.
- Home screen with **your next game**: one pick and two alternatives of other
  genres, with the reasons why, filtered by how long you feel like playing.
  It scores the backlog on rating, taste, time left, curators and momentum.
- A taste profile learned from what you play, finish, drop and rate (half
  stars, on completed games).
- Progress ring, streaks, games added by hand from IGDB (with external sources
  such as a friend's), and curators' lists to follow.
- Nightly sync with daily playtime snapshots, and a weekly encrypted backup.
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
│  │     ├─ auth/  users/  sources/  library/  curators/  stats/
│  │     ├─ sync/         import, enrichment, classification, nightly photos
│  │     ├─ catalog/      game classification and metadata rules
│  │     ├─ taste/        taste profile
│  │     ├─ recommendations/  scoring and "your next game"
│  │     └─ providers/    Steam (Web API and Store) and IGDB clients
│  └─ web/                React + Vite: pages/, components/, api/, locales/
├─ packages/shared/       zod types and schemas shared by web and API
└─ .github/workflows/     CI, nightly sync and weekly backup
```

## Running locally

Requirements: Node.js 24 (see `.node-version`) and pnpm 12 (see
`packageManager`).

Recommended: [gitleaks](https://github.com/gitleaks/gitleaks)
(`winget install Gitleaks.Gitleaks` on Windows). `pnpm install` sets up a
pre-commit hook (lefthook) that uses it to stop any commit with a secret in
it; without gitleaks it only warns, and CI runs the same check on every pull
request.

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
`GET /api/sync/jobs/:id` for its progress. The job runs these steps:

1. **Library**: owned games and playtime from the Steam Web API, written in
   bulk; after the first sync, only what changed.
2. **Wishlist**: becomes the "wishlist" view, with Steam's priority.
3. **Enrichment**: Steam Store (one request every 1.6 s, its limit) and IGDB
   (4 per second) for games never enriched or older than 30 days. The catalog
   is shared, so a game is only fetched once for everyone.
4. **Achievements**: for played games whose playtime changed.
5. **Classification**: game type and servers, then the games that look
   finished and the automatic statuses (playing, on hold). All from the
   database, no external calls.
6. **Taste profile**: worked out again, so the next recommendation knows.

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

## Backups

Neon's free plan can only restore the last 6 hours. Every Sunday the
**Weekly backup** workflow dumps the whole database, restores it into an empty
Postgres to check it, encrypts it with [age](https://age-encryption.org) and
keeps it as an artifact for 90 days. It can also be run by hand from the
Actions tab, before a risky migration for instance.

The repository is public, and so are its artifacts: only the encrypted file is
uploaded. The public key (`age1…`, which can only encrypt) is the repository
variable `AGE_RECIPIENT`; the private key, the only one that decrypts, never
goes to GitHub. The database URL is the secret `DATABASE_URL_DIRECT`.

To get a backup back:

1. In **Actions → Weekly backup**, open a run and download its artifact. Unzip
   it: inside is `psq-backup-YYYY-MM-DD.dump.age`.
2. Decrypt it with the private key:
   `age --decrypt --identity psq-backup-key.txt --output backup.dump psq-backup-YYYY-MM-DD.dump.age`
3. Restore it with `pg_restore` 18 or newer, into a new Neon branch first to
   look at it before touching production:
   `pg_restore --clean --if-exists --no-owner --no-privileges --dbname "<direct URL>" backup.dump`

`pg_restore` can also bring back a single table: add `--table=user_games`.
