# functional-movement-assessment

An interactive board for learning the **SFMA breakout process**. Pick a top-tier pattern, tap a
chevron to rate each test, and watch the path resolve to a conclusion.

The published charts draw the breakouts as a branching maze. They are not one. Across the ten
top-tier patterns there are 81 tests, and almost every branch is the same three rules applied
again and again:

1. **Active, then passive.** If a motion fails actively, repeat it passively. Passive is clean →
   the range exists and the fault is control (*stability / motor control*). Passive is also
   limited → the range genuinely is not there (*mobility*). **Thirty of the 81 tests exist only
   to make this one comparison.**
2. **Loaded, then unloaded.** Take weight off the pattern and retest. Same logic as rule 1,
   substituting position for assistance.
3. **Pain ends the branch.** Any `FP` or `DP` stops the breakout where it stands.

Learn the rules and you can derive the chart instead of memorising it. That is the whole point of
the tool.

## Running it

```bash
npm install
npm run dev            # local dev server
npm test               # graph + layout invariants
npm run build          # static site -> build/
npm run build:single   # one self-contained HTML file, for sharing a preview
```

## How it is put together

| Path | What it is |
|---|---|
| `src/lib/data/breakouts.json` | The decision graph: 10 patterns, 81 tests, four branches each |
| `src/lib/data/breakouts.ts` | Types and labels over that JSON |
| `src/lib/engine/graph.ts` | Walking the graph: grouping branches, findings, verdicts |
| `src/lib/engine/layout.ts` | **Pure** board layout — positions in, no DOM |
| `src/lib/components/Board.svelte` | Renders the layout; owns pan and zoom |
| `scripts/extract-graph.mjs` | Regenerates the JSON from the EMR source |

`layout()` is deliberately a pure function of `(pattern, measured heights)`. Box heights depend on
text wrapping, so the component measures them and feeds them back in. That keeps every layout
invariant unit-testable rather than something you can only check by looking at a screenshot —
see `src/tests/layout.test.ts`, which asserts that boxes never overlap, that FN always owns the
left lane, that no chevron crosses a test it does not belong to, and that any arrow stopping
short is always accompanied by a tag naming its destination.

## Where the graph comes from

The decision graph is maintained in
[`danstonedev/devpt-emr-platform`](https://github.com/danstonedev/devpt-emr-platform) at
`src/lib/config/sfmaBreakouts.ts`. This repo holds a **snapshot**, not a submodule — the learning
tool deliberately has no EMR dependency, no auth, and no patient data. Re-extract with:

```bash
node scripts/extract-graph.mjs ../devpt-emr-platform
```

`src/tests/graph.test.ts` re-checks the structural guarantees after any re-extract: every branch
either continues to a real test or terminates with a conclusion, every test is reachable, and no
single arrow ever carries two different conclusions.

## Design decisions worth knowing

- **One arrow per outcome, never per destination.** The paper charts merge ratings into combined
  arrows like `DN/FP/DP`. Merging by destination alone would collapse **25** arrows that lead to
  *different* conclusions — in the worst cases a single `FN/FP/DN/DP` arrow hiding four. Arrows
  here group by destination *and* outcome, so an arrow always means exactly one thing.
- **A finding puts a cell on the outcome strip; pure routing stays an arrow.** A test whose
  branches produce findings gets the `SMCD | MD | P/D` strip welded under it, whether or not flow
  continues afterwards.
- **FN always owns the left lane**, running long past an assisted retest to the next test. An FN
  that skips the retest is normal flow, not an exception.

## Scope

This is a teaching model of a published decision structure, written for students learning the
reasoning. Conclusions it shows are classifications *within that model* — what the algorithm
returns for a given set of ratings. They are not a diagnosis and do not replace examination.
SFMA and FMS are the work of Functional Movement Systems; this repository reproduces none of
their manuals, score sheets, or artwork.
