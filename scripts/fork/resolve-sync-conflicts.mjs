#!/usr/bin/env node
// Resolves the merge conflicts an upstream sync can hit in files where this fork's changes are
// mechanical (see FORK.md, "How a sync resolves conflicts"). Run it inside a conflicted
// `git merge upstream/main`. It stages what it resolves and exits 1, resolving nothing, when
// any conflicted file is outside its set or the fork changed such a file in an unexpected way.

import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' });
// Stage blob of a conflicted file: 1 = merge base, 2 = ours (fork), 3 = theirs (upstream).
const stage = (n, path) => {
  try {
    return git('show', `:${n}:${path}`);
  } catch {
    return null;
  }
};

const LOCALE = /^src\/i18n\/locales\/[^/]+\.json$/;
const TOOLCHAIN = new Set([
  '.github/workflows/ci.yml',
  '.github/workflows/release.yml',
  'README.md',
  'README_CN.md',
  'AGENTS.md',
]);

/* ---------- versions ---------- */

const parts = (spec) => (String(spec).match(/\d+(?:\.\d+)*/)?.[0] ?? '0').split('.').map(Number);
const compare = (a, b) => {
  const [x, y] = [parts(a), parts(b)];
  for (let i = 0; i < Math.max(x.length, y.length); i += 1) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d) return d;
  }
  return 0;
};
/** The higher of two version specs; upstream's wins a tie. */
const higher = (ours, theirs) => (compare(ours, theirs) > 0 ? ours : theirs);

/* ---------- package.json ---------- */

const DEP_SECTIONS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function mergePackageJson(baseText, oursText, theirsText) {
  const base = JSON.parse(baseText ?? '{}');
  const ours = JSON.parse(oursText);
  const theirs = JSON.parse(theirsText);
  const out = structuredClone(theirs);

  for (const section of DEP_SECTIONS) {
    const [b, o, t] = [base[section] ?? {}, ours[section] ?? {}, theirs[section] ?? {}];
    const merged = { ...t };
    for (const [name, spec] of Object.entries(o)) {
      if (name in t) merged[name] = higher(spec, t[name]);
      else if (!(name in b) || spec !== b[name]) merged[name] = spec; // fork added or changed it
      // else: upstream removed it and the fork left it alone, so it goes
    }
    for (const name of Object.keys(b)) {
      if (!(name in o) && name in t && t[name] === b[name]) delete merged[name]; // fork removed it
    }
    if (Object.keys(merged).length) out[section] = merged;
    else delete out[section];
  }

  if (ours.packageManager && theirs.packageManager) {
    out.packageManager = higher(ours.packageManager, theirs.packageManager);
  }
  out.overrides = { ...(theirs.overrides ?? {}), ...(ours.overrides ?? {}) };
  if (!Object.keys(out.overrides).length) delete out.overrides;
  if (ours.engines) out.engines = ours.engines;

  // Scripts the fork changed stay; everything else follows upstream.
  for (const [name, command] of Object.entries(ours.scripts ?? {})) {
    if ((base.scripts ?? {})[name] !== command) (out.scripts ??= {})[name] = command;
  }

  // Any other top-level field the fork changed and upstream did not.
  const handled = new Set([...DEP_SECTIONS, 'packageManager', 'overrides', 'engines', 'scripts']);
  for (const key of Object.keys(ours)) {
    if (handled.has(key)) continue;
    if (!same(ours[key], base[key]) && same(theirs[key], base[key])) out[key] = ours[key];
    else if (!same(ours[key], base[key]) && !same(ours[key], theirs[key])) {
      throw new Error(`package.json "${key}" changed on both sides`);
    }
  }
  return `${JSON.stringify(out, null, 2)}\n`;
}

/* ---------- locale files: upstream's file plus the fork's ledger block ---------- */

function mergeLocale(path, baseText, oursText, theirsText) {
  const ours = JSON.parse(oursText);
  const theirs = JSON.parse(theirsText);
  if ('ledger' in theirs) throw new Error(`${path}: upstream now has a "ledger" key`);
  const { ledger, ...oursRest } = ours;
  if (!ledger) throw new Error(`${path}: the fork's file has no "ledger" block`);
  if (baseText !== null && !same(oursRest, JSON.parse(baseText))) {
    throw new Error(`${path}: the fork changed keys outside its "ledger" block`);
  }
  const block = JSON.stringify({ ledger }, null, 2).slice(1, -1).replace(/^\n|\n$/g, '');
  const trimmed = theirsText.replace(/\s*\}\s*$/, '');
  const text = `${trimmed},\n${block}\n}\n`;
  JSON.parse(text);
  return text;
}

/* ---------- CI, release and toolchain docs: upstream's file, higher versions ---------- */

const VERSION_PATTERNS = [
  /(node-version:\s*'?)([0-9][0-9.]*)('?)/g,
  /(bun-version:\s*'?)([0-9][0-9.]*)('?)/g,
  /(\*\*Bun )([0-9][0-9.]*)(\*\*)/g,
  /(`bun@)([0-9][0-9.]*)(`)/g,
  /(CI uses Node\.js )([0-9][0-9.]*[0-9])()/g,
];
const ACTION = /(uses:\s*)([\w.-]+\/[\w./-]+)@(v[0-9][0-9.]*|[0-9a-f]{40} # v[0-9][0-9.]*)/g;
/** Version of an action ref: `v3` or a pinned `<sha> # v3.0.4`. */
const actionVersion = (ref) => ref.match(/v([0-9][0-9.]*)\s*$/)?.[1] ?? '0';
const higherAction = (ours, theirs) =>
  compare(actionVersion(ours), actionVersion(theirs)) > 0 ? ours : theirs;

const blank = (text) =>
  [...VERSION_PATTERNS, ACTION].reduce(
    (out, pattern) => out.replace(pattern, (...m) => (pattern === ACTION ? `${m[1]}${m[2]}@V` : `${m[1]}V${m[3]}`)),
    text
  );

function mergeToolchain(path, baseText, oursText, theirsText) {
  if (baseText !== null && blank(oursText) !== blank(baseText)) {
    throw new Error(`${path}: the fork changed more than version numbers`);
  }
  let text = theirsText;
  for (const pattern of VERSION_PATTERNS) {
    const mine = [...oursText.matchAll(pattern)].map((m) => m[2]);
    if (!mine.length) continue;
    const best = mine.reduce((a, b) => (compare(a, b) >= 0 ? a : b));
    text = text.replace(pattern, (_, pre, version, post) => `${pre}${higher(best, version)}${post}`);
  }
  const actions = new Map([...oursText.matchAll(ACTION)].map((m) => [m[2], m[3]]));
  text = text.replace(ACTION, (_, pre, name, version) =>
    `${pre}${name}@${actions.has(name) ? higherAction(actions.get(name), version) : version}`
  );
  return text;
}

/* ---------- main ---------- */

const conflicted = git('diff', '--name-only', '--diff-filter=U').split('\n').filter(Boolean);
if (!conflicted.length) {
  console.log('No conflicts.');
  process.exit(0);
}
const unsupported = conflicted.filter(
  (path) => !['package.json', 'bun.lock'].includes(path) && !LOCALE.test(path) && !TOOLCHAIN.has(path)
);
if (unsupported.length) {
  console.error(`Needs a manual merge (see FORK.md):\n  ${unsupported.join('\n  ')}`);
  process.exit(1);
}

const resolved = new Map();
try {
  for (const path of conflicted) {
    const [base, ours, theirs] = [stage(1, path), stage(2, path), stage(3, path)];
    if (path === 'bun.lock') continue; // regenerated below
    if (ours === null || theirs === null) throw new Error(`${path}: deleted on one side`);
    if (path === 'package.json') resolved.set(path, mergePackageJson(base, ours, theirs));
    else if (LOCALE.test(path)) resolved.set(path, mergeLocale(path, base, ours, theirs));
    else resolved.set(path, mergeToolchain(path, base, ours, theirs));
  }
} catch (error) {
  console.error(`Needs a manual merge: ${error.message}`);
  process.exit(1);
}

for (const [path, text] of resolved) {
  writeFileSync(path, text);
  git('add', '--', path);
  console.log(`resolved ${path}`);
}
if (conflicted.includes('bun.lock') || conflicted.includes('package.json')) {
  // Start from upstream's lockfile and re-resolve it against the merged package.json.
  if (conflicted.includes('bun.lock')) git('checkout', '--theirs', '--', 'bun.lock');
  execFileSync('bun', ['install'], { stdio: 'inherit' });
  git('add', '--', 'bun.lock');
  console.log('regenerated bun.lock');
}
