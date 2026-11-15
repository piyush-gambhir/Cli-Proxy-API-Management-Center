#!/usr/bin/env node











import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { matchesGlob } from 'node:path';

const args = process.argv.slice(2);
const allowStale = args.includes('--allow-stale');
const upstreamRef = args.find((arg) => !arg.startsWith('--')) ?? 'upstream/main';
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();

const base = git('merge-base', 'HEAD', upstreamRef);
const changed = git('diff', '--name-only', '--no-renames', base, 'HEAD').split('\n').filter(Boolean);


const doc = readFileSync(new URL('../../FORK.md', import.meta.url), 'utf8');
const section = doc.split(/^## /m).find((part) => part.startsWith('Files that differ from upstream'));
if (!section) {
  console.error('FORK.md has no "Files that differ from upstream" section.');
  process.exit(1);
}
const patterns = [...section.matchAll(/^\|\s*`([^`]+)`\s*\|/gm)].map((match) => match[1]);

const undocumented = changed.filter((file) => !patterns.some((pattern) => matchesGlob(file, pattern)));
const stale = patterns.filter((pattern) => !changed.some((file) => matchesGlob(file, pattern)));

console.log(`Compared HEAD with ${upstreamRef} at ${base.slice(0, 7)}: ${changed.length} files differ, ${patterns.length} rows in FORK.md.`);
if (undocumented.length) {
  console.error('\nChanged but not listed in FORK.md (add a row, or restore the upstream file):');
  for (const file of undocumented) console.error(`  ${file}`);
}
if (stale.length) {
  const log = allowStale ? console.warn : console.error;
  log(`\nListed in FORK.md but no longer different from upstream (remove the row)${allowStale ? ' [warning]' : ''}:`);
  for (const pattern of stale) log(`  ${pattern}`);
}
process.exit(undocumented.length || (stale.length && !allowStale) ? 1 : 0);
