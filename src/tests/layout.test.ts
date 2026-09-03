import { describe, expect, it } from 'vitest';
import { PATTERNS } from '$lib/data/breakouts';
import { G, layout, type Board } from '$lib/engine/layout';

/** Vary heights so the tests do not accidentally depend on every box being identical. */
const heights = (p: (typeof PATTERNS)[number]) =>
  Object.fromEntries(p.nodes.map((n, i) => [n.id, 58 + (i % 3) * 14]));

const boards: Array<[string, Board]> = PATTERNS.map((p) => [p.patternId, layout(p, heights(p))]);

const overlap = (
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
) => a.x < b.x + b.w - 2 && a.x + a.w > b.x + 2 && a.y < b.y + b.h - 2 && a.y + a.h > b.y + 2;

const boxRect = (u: Board['units'][number]) => ({ x: u.x, y: u.boxY, w: G.W, h: u.boxH });
/** The whole welded unit: region bar, box and outcome strip. */
const unitRect = (u: Board['units'][number]) => ({ x: u.x, y: u.unitTop, w: G.W, h: u.bottom - u.unitTop });

describe('board layout', () => {
  it('places every test exactly once', () => {
    for (const p of PATTERNS) {
      const b = layout(p, heights(p));
      expect(b.units).toHaveLength(p.nodes.length);
      expect(new Set(b.units.map((u) => u.id)).size).toBe(p.nodes.length);
      for (const n of p.nodes) expect(b.byId[n.id], `${p.patternId}: ${n.id} unplaced`).toBeTruthy();
    }
  });

  it('never overlaps two test boxes', () => {
    for (const [id, b] of boards) {
      for (let i = 0; i < b.units.length; i++) {
        for (let j = i + 1; j < b.units.length; j++) {
          expect(
            overlap(boxRect(b.units[i]), boxRect(b.units[j])),
            `${id}: ${b.units[i].id} overlaps ${b.units[j].id}`,
          ).toBe(false);
        }
      }
    }
  });

  it('gives FN the left lane on every test that has one', () => {
    for (const [id, b] of boards) {
      const byNode: Record<string, typeof b.chevrons> = {};
      for (const c of b.chevrons) (byNode[c.nodeId] ??= []).push(c);
      for (const [nodeId, cs] of Object.entries(byNode)) {
        const fn = cs.find((c) => c.kind === 'FN');
        if (!fn) continue;
        for (const other of cs) {
          if (other.kind === 'FN') continue;
          expect(other.x, `${id}:${nodeId} — ${other.kind} sits left of FN`).toBeGreaterThan(fn.x);
        }
      }
    }
  });

  it('keeps every chevron inside the footprint of its own test', () => {
    for (const [id, b] of boards) {
      for (const c of b.chevrons) {
        const u = b.byId[c.nodeId];
        expect(c.x, `${id}:${c.nodeId} chevron starts left of its box`).toBeGreaterThanOrEqual(u.x);
        expect(c.x + c.w, `${id}:${c.nodeId} chevron runs past its box`)
          .toBeLessThanOrEqual(u.x + G.W + 1);
      }
    }
  });

  it('never runs a chevron through a different unit, bar and strip included', () => {
    for (const [id, b] of boards) {
      for (const c of b.chevrons) {
        for (const u of b.units) {
          if (u.id === c.nodeId || u.id === c.targetId) continue;
          expect(
            overlap({ x: c.x, y: c.y, w: c.w, h: c.h }, unitRect(u)),
            `${id}: ${c.nodeId} ${c.ratings.join('/')} crosses ${u.id}`,
          ).toBe(false);
        }
      }
    }
  });

  /* A jump tag hangs under a chevron that stops short. It has to finish before the next unit
     begins, or it prints on top of that unit's region bar. */
  it('finishes every jump tag before the next unit starts', () => {
    const TAG_H = 22;
    for (const [id, b] of boards) {
      for (const j of b.jumps) {
        const from = b.byId[j.nodeId];
        const nextTop = Math.min(
          ...b.units.filter((u) => u.unitTop >= from.bottom).map((u) => u.unitTop),
        );
        if (!Number.isFinite(nextTop)) continue;
        expect(j.y + TAG_H, `${id}: jump tag on ${j.nodeId} runs into the next unit`)
          .toBeLessThanOrEqual(nextTop);
      }
    }
  });

  /* A tag sits under its own arrow, but the arrows beside it hang lower, so a full-width tag
     prints across them. Each tag is clipped to the gap before the next arrow on its right. */
  it('keeps every jump tag clear of the chevrons beside it', () => {
    const TAG_H = 22;
    for (const [id, b] of boards) {
      for (const j of b.jumps) {
        for (const c of b.chevrons) {
          if (c.x + c.w <= j.x || c.x >= j.x + j.w) continue;
          const clash = c.y < j.y + TAG_H && c.y + c.h > j.y;
          expect(clash, `${id}: jump tag on ${j.nodeId} runs across a ${c.kind} chevron`).toBe(false);
        }
      }
    }
  });

  /* Badges render in the gutter right of a box, so the board has to reserve that space. */
  it('reserves the badge gutter inside the board width', () => {
    for (const [id, b] of boards) {
      const widest = Math.max(...b.units.map((u) => u.x + G.W));
      expect(b.width, `${id}: board is too narrow for the badge gutter`)
        .toBeGreaterThanOrEqual(widest + G.BADGE);
    }
  });

  it('only emits a jump tag when the arrow cannot reach its target', () => {
    for (const [id, b] of boards) {
      for (const j of b.jumps) {
        const reaching = b.chevrons.filter((c) => c.nodeId === j.nodeId && c.targetId === j.targetId);
        expect(reaching.every((c) => !c.reaches), `${id}: needless jump tag on ${j.nodeId}`).toBe(true);
      }
      for (const c of b.chevrons) {
        if (c.reaches) continue;
        expect(
          b.jumps.some((j) => j.nodeId === c.nodeId && j.targetId === c.targetId),
          `${id}: ${c.nodeId} stops short with nothing naming its target`,
        ).toBe(true);
      }
    }
  });

  it('fits every outcome strip inside its box width', () => {
    for (const [id, b] of boards) {
      for (const s of b.strips) {
        expect(s.cells.length, `${id}:${s.nodeId} strip has no cells`).toBeGreaterThan(0);
        expect(s.cells.length, `${id}:${s.nodeId} strip has more than four cells`)
          .toBeLessThanOrEqual(4);
        expect(s.w).toBe(G.W);
      }
    }
  });

  it('lands every chevron that claims to reach its target on that target', () => {
    for (const [id, b] of boards) {
      for (const c of b.chevrons) {
        if (!c.reaches) continue;
        expect(c.y + c.h, `${id}: ${c.nodeId} → ${c.targetId} does not meet the box`)
          .toBe(b.byId[c.targetId].unitTop);
      }
    }
  });
});
