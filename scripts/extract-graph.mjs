#!/usr/bin/env node
/**
 * Regenerate src/lib/data/breakouts.json from the EMR's decision graph.
 *
 * The graph itself is maintained in danstonedev/devpt-emr-platform at
 * src/lib/config/sfmaBreakouts.ts, where it is already structurally tested. This repo keeps a
 * SNAPSHOT rather than a submodule: the learning tool has no EMR dependency, no auth and no
 * patient data, and must stay that way.
 *
 * The transpile step is deliberate — hand-transcribing 81 nodes invites silent drift.
 *
 *   node scripts/extract-graph.mjs ../devpt-emr-platform
 *
 * Requires esbuild on the PATH (npx esbuild works).
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const emr = process.argv[2];
if (!emr) {
  console.error('usage: node scripts/extract-graph.mjs <path-to-devpt-emr-platform>');
  process.exit(1);
}

const SRC = join(emr, 'src/lib/config/sfmaBreakouts.ts');
const OUT = new URL('../src/lib/data/breakouts.json', import.meta.url);

const work = mkdtempSync(join(tmpdir(), 'fma-extract-'));
const clean = join(work, 'graph.ts');
// The type-only import points at a $lib alias this script cannot resolve; the runtime code
// below it does not need those types.
writeFileSync(clean, readFileSync(SRC, 'utf8').replace(/^import type .*$/m, ''));

const bundled = join(work, 'graph.mjs');
execFileSync('npx', ['esbuild', clean, '--format=esm', '--outfile=' + bundled, '--log-level=error'], {
  stdio: 'inherit',
});
writeFileSync(
  bundled,
  readFileSync(bundled, 'utf8') +
    '\nconsole.log(JSON.stringify(SFMA_BREAKOUT_DEFINITIONS));\n',
);
const patterns = JSON.parse(execFileSync('node', [bundled], { encoding: 'utf8' }));

/* ---- enrichment the board needs and the EMR has no reason to carry ---- */
const POSITIONS = [
  ['prone-on-elbows', 'Prone on elbows'], ['long-sitting', 'Long sitting'],
  ['half-kneeling', 'Half kneeling'], ['quadruped', 'Quadruped'], ['tandem', 'Standing (tandem)'],
  ['supine', 'Supine'], ['prone', 'Prone'], ['seated', 'Seated'], ['standing', 'Standing'],
];
const REGIONS = [
  ['mctsib', 'Vestibular'], ['quadruped', 'Core'], ['half-kneeling', 'Core'], ['rolling', 'Core'],
  ['cervical', 'Cervical'], ['oa ', 'Cervical'], ['thoracic', 'Thoracic'],
  ['lumbar', 'Lumbar'], ['press-up', 'Lumbar'], ['spinal rotation', 'Lumbar'], ['toe touch', 'Lumbar'],
  ['shoulder', 'Shoulder girdle'], ['elbow', 'Shoulder girdle'],
  ['faber', 'Hip'], ['thomas', 'Hip'], ['hip', 'Hip'], ['straight-leg', 'Hip'], ['straight leg', 'Hip'],
  ['knee', 'Knee'], ['ankle', 'Ankle / foot'], ['dorsiflexion', 'Ankle / foot'],
  ['plantarflexion', 'Ankle / foot'], ['inversion', 'Ankle / foot'], ['tibial', 'Ankle / foot'],
];
const match = (hay, table, fallback = '') =>
  (table.find(([k]) => hay.includes(k)) ?? [null, fallback])[1];

for (const p of patterns) {
  let carried = 'Screen';
  for (const n of p.nodes) {
    const hay = `${n.id} ${n.label}`.toLowerCase();
    n.position = match(hay, POSITIONS) ||
      (/faber|thomas/.test(hay) ? 'Supine' : /mctsib/.test(hay) ? 'Standing' : '');
    // Only an id PREFIXED with the mode is that mode — "modified-thomas-after-stabilized"
    // merely follows a stabilised test, it is not one.
    n.mode = n.id.startsWith('active-') ? 'active'
      : n.id.startsWith('passive-') ? 'passive'
      : n.id.startsWith('stabilized-') ? 'stabilized' : 'neutral';
    n.region = match(hay, REGIONS, carried) || carried;
    carried = n.region;
    n.short = n.label.replace(/^(Active|Passive|Stabilized|Stabilised)\s+/, '');
  }
  // Longest path from the start, so a node always sits below everything that reaches it.
  const succ = Object.fromEntries(
    p.nodes.map((n) => [n.id, Object.values(n.branches).map((b) => b.next).filter(Boolean)]),
  );
  const dist = Object.fromEntries(p.nodes.map((n) => [n.id, 0]));
  for (let i = 0; i <= p.nodes.length; i++) {
    for (const [id, ss] of Object.entries(succ)) {
      for (const s of ss) if (dist[s] < dist[id] + 1) dist[s] = dist[id] + 1;
    }
  }
  for (const n of p.nodes) n.depth = dist[n.id];
}

writeFileSync(
  OUT,
  JSON.stringify({
    ratings: {
      FN: 'Functional, non-painful', FP: 'Functional, painful',
      DN: 'Dysfunctional, non-painful', DP: 'Dysfunctional, painful',
    },
    conclusions: {
      'mobility-dysfunction': 'Mobility dysfunction',
      'stability-motor-control-dysfunction': 'Stability / motor-control dysfunction',
      'painful-finding': 'Painful finding — assess locally',
      'mixed-or-inconclusive': 'Mixed / inconclusive',
    },
    patterns,
  }),
);
console.log(
  `wrote ${patterns.length} patterns, ` +
    `${patterns.reduce((a, p) => a + p.nodes.length, 0)} tests`,
);
