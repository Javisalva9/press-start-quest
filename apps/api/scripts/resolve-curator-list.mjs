// Finds the IGDB id of each game in a curator's list, with the player's
// IGDB keys from apps/api/.env. Run it from apps/api after a build:
//
//   pnpm build && node scripts/resolve-curator-list.mjs alexelcapso
//
// Reads data/curators/<name>.source.json, writes data/curators/<name>.json
// and prints every match with its alternatives, marking the doubtful ones
// (no exact title, or not the expected year) to be reviewed by hand.
import 'dotenv/config';
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { IgdbApi } from '../dist/providers/igdb/igdb-api.js';

const name = process.argv[2];
if (!name) {
  console.error('Usage: node scripts/resolve-curator-list.mjs <list name>');
  process.exit(1);
}
const source = JSON.parse(
  readFileSync(`data/curators/${name}.source.json`, 'utf8'),
);
// The API reads its keys from a config service; here, straight from .env.
const igdb = new IgdbApi({ get: (key) => process.env[key] });

/** "DOOM®" and "Doom" are the same title. */
const normalize = (title) =>
  title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z0-9]/g, '');

const games = new Map();
let doubtful = 0;

/** Two entries can be the same PC game (Metal Gear Solid 1 and 2). */
const add = (found, entry) => {
  const game = games.get(found.igdbId) ?? {
    igdbId: found.igdbId,
    title: found.title,
    year: found.releaseYear,
    listedAs: [],
  };
  game.listedAs.push(entry.listed);
  games.set(found.igdbId, game);
};
for (const entry of source.entries) {
  if (entry.excluded) {
    console.log(`  —  ${entry.listed}: left out (${entry.excluded})`);
    continue;
  }
  // A slug is exact: no search, no doubt.
  if (entry.slug) {
    const game = await igdb.findBySlug(entry.slug);
    console.log(
      `${game ? ' OK ' : ' ?? '} ${entry.listed} → ${
        game
          ? `${game.title} (${game.releaseYear ?? '?'}) #${game.igdbId}`
          : `NO GAME WITH SLUG ${entry.slug}`
      }`,
    );
    if (game) {
      add(game, entry);
    } else {
      doubtful += 1;
    }
    continue;
  }
  // The search text, then the alternatives, until one finds something.
  let searched = entry.search;
  let results = [];
  for (const text of [entry.search, ...(entry.alternatives ?? [])]) {
    results = await igdb.searchPcGames(text, 10);
    searched = text;
    if (results.length > 0) {
      break;
    }
  }
  const exact = results.filter(
    (result) => normalize(result.title) === normalize(searched),
  );
  // Exact title (and year, when given) first; then the year alone; then the
  // exact title; then IGDB's best guess, marked for review.
  const ofYear = (result) => !entry.year || result.releaseYear === entry.year;
  const pick =
    exact.find(ofYear) ??
    (entry.year ? results.find(ofYear) : undefined) ??
    exact[0] ??
    results[0];
  const sure =
    pick &&
    normalize(pick.title) === normalize(searched) &&
    (!entry.year || pick.releaseYear === entry.year);
  if (!sure) {
    doubtful += 1;
  }
  console.log(
    `${sure ? ' OK ' : ' ?? '} ${entry.listed} → ${
      pick
        ? `${pick.title} (${pick.releaseYear ?? '?'}) #${pick.igdbId}`
        : 'NOT FOUND'
    }`,
  );
  if (!sure) {
    for (const result of results) {
      console.log(
        `        ${result.title} (${result.releaseYear ?? '?'}) #${result.igdbId}`,
      );
    }
  }
  if (pick) {
    add(pick, entry);
  }
}

const output = `data/curators/${name}.json`;
writeFileSync(
  output,
  `${JSON.stringify({ curator: source.curator, games: [...games.values()] }, null, 2)}\n`,
);
// The repository's format (short arrays on one line…), so the file passes
// pnpm format:check as written.
execSync(`pnpm exec prettier --write ${output}`, { stdio: 'ignore' });
console.log(
  `\n${games.size} games written to data/curators/${name}.json, ${doubtful} to review (??).`,
);
