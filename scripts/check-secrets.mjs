// Pre-commit hook (lefthook.yml): gitleaks looks for secrets (API keys,
// tokens, passwords, database URLs with a password) in the changes about
// to be committed, and stops the commit if it finds one: a secret that
// reaches a public repository has to be changed everywhere, as it stays
// in the history.
//
// Without gitleaks installed it only warns: CI runs the same check on
// every pull request anyway.
import { spawnSync } from 'node:child_process';

const result = spawnSync(
  'gitleaks',
  ['git', '--pre-commit', '--staged', '--redact', '--no-banner', '--verbose'],
  { stdio: 'inherit' },
);

if (result.error?.code === 'ENOENT') {
  console.warn(
    'gitleaks is not installed, so this commit was not checked for secrets.\n' +
      'Install it once: winget install Gitleaks.Gitleaks (Windows) or brew install gitleaks (macOS).',
  );
  process.exit(0);
}
process.exit(result.status ?? 1);
