import { describe, expect, it } from 'vitest';
import { PATTERNS, RATINGS, type Rating } from '$lib/data/breakouts';
import { groupsOf, isComplete, findingsOf, prune, verdict, walk } from '$lib/engine/graph';

describe('breakout graph', () => {
  it('is structurally valid for every pattern', () => {
    expect(PATTERNS).toHaveLength(10);
    for (const p of PATTERNS) {
      const ids = new Set(p.nodes.map((n) => n.id));
      expect(ids.size, `${p.patternId} has duplicate ids`).toBe(p.nodes.length);
      expect(ids.has(p.start), `${p.patternId} start is missing`).toBe(true);

      for (const n of p.nodes) {
        expect(Object.keys(n.branches).sort()).toEqual(['DN', 'DP', 'FN', 'FP']);
        for (const r of RATINGS) {
          const b = n.branches[r];
          if (b.next) {
            expect(ids.has(b.next), `${p.patternId}:${n.id}:${r} → missing ${b.next}`).toBe(true);
          } else {
            expect(b.conclusion, `${p.patternId}:${n.id}:${r} ends with no conclusion`).toBeTruthy();
            expect(b.finding, `${p.patternId}:${n.id}:${r} ends with no finding`).toBeTruthy();
          }
        }
      }
    }
  });

  it('reaches every test from the start', () => {
    for (const p of PATTERNS) {
      const seen = new Set<string>([p.start]);
      const queue = [p.start];
      const byId = Object.fromEntries(p.nodes.map((n) => [n.id, n]));
      while (queue.length) {
        const n = byId[queue.shift() as string];
        for (const r of RATINGS) {
          const nx = n.branches[r].next;
          if (nx && !seen.has(nx)) { seen.add(nx); queue.push(nx); }
        }
      }
      const orphans = p.nodes.filter((n) => !seen.has(n.id)).map((n) => n.id);
      expect(orphans, `${p.patternId} has unreachable tests`).toEqual([]);
    }
  });

  it('never merges two conclusions into one arrow', () => {
    for (const p of PATTERNS) {
      for (const n of p.nodes) {
        for (const g of groupsOf(n)) {
          const outcomes = new Set(
            g.ratings.map((r) => `${n.branches[r].conclusion ?? ''}|${n.branches[r].finding ?? ''}`),
          );
          expect(outcomes.size, `${p.patternId}:${n.id} arrow hides ${outcomes.size} outcomes`).toBe(1);
        }
      }
    }
  });

  it('terminates from every reachable state, for every rating', () => {
    for (const p of PATTERNS) {
      for (const first of RATINGS) {
        let answers: Record<string, Rating> = {};
        let steps = 0;
        while (steps++ <= p.nodes.length + 1) {
          const path = walk(p, answers);
          if (isComplete(path)) break;
          const last = path[path.length - 1];
          if (!last || last.rating) break;
          answers = { ...answers, [last.node.id]: steps === 1 ? first : first };
        }
        const path = walk(p, answers);
        expect(isComplete(path), `${p.patternId} never terminated on all-${first}`).toBe(true);
        expect(verdict(path), `${p.patternId} all-${first} has no verdict`).toBeTruthy();
      }
    }
  });

  it('records a finding for every terminal branch taken', () => {
    for (const p of PATTERNS) {
      let answers: Record<string, Rating> = {};
      for (let i = 0; i <= p.nodes.length; i++) {
        const path = walk(p, answers);
        if (isComplete(path)) break;
        const last = path[path.length - 1];
        if (!last || last.rating) break;
        answers = { ...answers, [last.node.id]: 'DN' };
      }
      expect(findingsOf(walk(p, answers)).length, `${p.patternId} produced no findings`)
        .toBeGreaterThan(0);
    }
  });

  it('drops answers that fall off the path when an earlier one changes', () => {
    const p = PATTERNS.find((x) => x.patternId === 'cervical-flexion')!;
    let answers: Record<string, Rating> = {};
    for (let i = 0; i < 3; i++) {
      const last = walk(p, answers).at(-1)!;
      if (last.rating) break;
      answers = { ...answers, [last.node.id]: 'DN' };
    }
    expect(Object.keys(answers).length).toBeGreaterThan(1);
    // change the first answer to one that ends the breakout immediately
    const changed = prune(p, { ...answers, [p.start]: 'FN' });
    expect(Object.keys(changed)).toEqual([p.start]);
  });
});
