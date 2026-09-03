import { CONCLUSION_CODE, type Conclusion, type Pattern, type Rating } from '$lib/data/breakouts';
import { chunksOf, groupsOf, kindOf, pairing, type Group } from './graph';

/** Board geometry. All in CSS px at zoom 1. */
export const G = {
  W: 322, // test box width
  STAG: 150, // how far an assisted retest shifts right
  CHEV: 96, // vertical room between one unit and the next
  BADGE: 150, // gutter right of a box for the 'You are here' / rating badge
  SECT: 34, // height of a black region bar
  STRIP: 43, // fallback height of an outcome strip; the real one is measured
  CW: 58, // chevron width
  CGAP: 5,
} as const;

export interface Unit {
  id: string;
  col: number;
  x: number;
  /** Top of the whole welded unit — the region bar if it has one, else the box. */
  unitTop: number;
  boxY: number;
  boxH: number;
  stripH: number;
  hasBar: boolean;
  region: string;
  /** Bottom of the unit, below the strip. Chevrons hang from here. */
  bottom: number;
}

export interface Cell {
  ratings: Rating[];
  code: string;
  conclusion: Conclusion | undefined;
  finding: string;
  /** Set when the breakout carries on after this finding. */
  continuesTo?: string;
}

export interface Strip {
  nodeId: string;
  x: number;
  y: number;
  w: number;
  label: string;
  cells: Cell[];
}

export interface Chevron {
  nodeId: string;
  ratings: Rating[];
  kind: 'FN' | 'DN' | 'P';
  x: number;
  y: number;
  w: number;
  h: number;
  targetId: string;
  /** False when the arrow stops short and a jump tag names its destination. */
  reaches: boolean;
}

export interface Jump {
  nodeId: string;
  ratings: Rating[];
  x: number;
  y: number;
  /** Room available before the next chevron to the right. The tag is clipped to this so a
   *  left-lane tag cannot run across the right-aligned arrows beside it. */
  w: number;
  targetId: string;
}

export interface Board {
  units: Unit[];
  byId: Record<string, Unit>;
  strips: Strip[];
  chevrons: Chevron[];
  jumps: Jump[];
  width: number;
  height: number;
}

/** Groups that produce a finding become strip cells; a branch that only routes stays an arrow. */
/** Jump-tag geometry. Kept here so the layout can reason about the space a tag occupies. */
const JUMP_MAX = 250;
const JUMP_H = 22;

const stripGroups = (gs: Group[]) => gs.filter((g) => g.branch.finding || !g.branch.next);
const routeGroups = (gs: Group[]) => gs.filter((g) => g.branch.next && !g.branch.finding);

/**
 * Place a pattern on the board.
 *
 * Pure: box heights are measured by the caller and passed in, so the same layout can be
 * unit-tested with synthetic heights. Falls back to `fallbackH` for unmeasured boxes.
 */
export function layout(
  p: Pattern,
  heights: Record<string, number>,
  fallbackH = 62,
  /** Measured strip height. Strips are one uniform row, so a single value covers them all.
   *  Reserving less than they render puts every chevron below a strip inside it. */
  stripH: number = G.STRIP,
): Board {
  const { partner, isPartner } = pairing(p);
  const nodes = Object.fromEntries(p.nodes.map((n) => [n.id, n]));
  const H = (id: string) => heights[id] ?? fallbackH;

  const groups: Record<string, Group[]> = {};
  for (const n of p.nodes) groups[n.id] = groupsOf(n);

  /* --- rows: spine at column 0, each assisted retest one column right and one row down --- */
  const units: Unit[] = [];
  const byId: Record<string, Unit> = {};
  let y = 0;
  let region: string | null = null;
  let maxX = 0;

  const spine = p.nodes.filter((n) => !isPartner[n.id]).sort((a, b) => a.depth - b.depth);
  for (const head of spine) {
    let col = 0;
    let id: string | undefined = head.id;
    let first = true;
    while (id) {
      const node = nodes[id];
      const hasBar = first && node.region !== region;
      if (hasBar) region = node.region;
      const boxH = H(id);
      const sh = stripGroups(groups[id]).length ? stripH : 0;
      const boxY = y + (hasBar ? G.SECT : 0);
      const u: Unit = {
        id,
        col,
        x: col * G.STAG,
        unitTop: y,
        boxY,
        boxH,
        stripH: sh,
        hasBar,
        region: node.region,
        bottom: boxY + boxH + sh,
      };
      units.push(u);
      byId[id] = u;
      maxX = Math.max(maxX, u.x + G.W);
      y = u.bottom + G.CHEV;
      first = false;
      col++;
      id = partner[id];
    }
  }

  /* --- outcome strips --- */
  const strips: Strip[] = [];
  for (const n of p.nodes) {
    const cells = stripGroups(groups[n.id]);
    if (!cells.length) continue;
    const u = byId[n.id];
    strips.push({
      nodeId: n.id,
      x: u.x,
      y: u.boxY + u.boxH,
      w: G.W,
      label: n.region,
      cells: cells.map((g) => ({
        ratings: g.ratings,
        code: g.branch.conclusion ? CONCLUSION_CODE[g.branch.conclusion] : '?',
        conclusion: g.branch.conclusion,
        finding: g.branch.finding ?? '',
        continuesTo: g.branch.next,
      })),
    });
  }

  /* --- chevrons: FN always owns the left lane; everything else is right-aligned --- */
  const chevrons: Chevron[] = [];
  const jumps: Jump[] = [];

  for (const n of p.nodes) {
    const A = byId[n.id];
    const gs = routeGroups(groups[n.id]);
    if (!gs.length) continue;

    /** A target is reachable in a straight line when it shares this column and no other
     *  test in that column sits between here and there. */
    const clear = (g: Group) => {
      const B = byId[g.branch.next as string];
      if (!B || B.col !== A.col || B.unitTop <= A.bottom) return false;
      return !units.some(
        (m) =>
          m.id !== A.id && m.id !== B.id && m.col === A.col &&
          m.unitTop > A.bottom && m.unitTop < B.unitTop,
      );
    };

    const fnG = gs.find((g) => g.ratings.includes('FN'));
    const straight = fnG && clear(fnG) ? fnG : gs.find(clear);
    const side = gs.filter((g) => g !== fnG);
    const total = side.reduce((a, g) => a + chunksOf(g).length * (G.CW + G.CGAP), 0) - G.CGAP;
    let sx = Math.max(A.x + 6, A.x + G.W - 24 - Math.max(total, 0));

    for (const g of gs) {
      const B = byId[g.branch.next as string];
      const reaches = g === straight || B.unitTop === A.bottom + G.CHEV;
      const top = A.bottom;
      const bot = reaches ? B.unitTop : top + G.CHEV - 42;
      let cx = g === fnG ? A.x + 26 : sx;
      const firstX = cx;

      for (const c of chunksOf(g)) {
        chevrons.push({
          nodeId: n.id, ratings: c, kind: kindOf(c),
          x: cx, y: top, w: G.CW, h: bot - top,
          targetId: g.branch.next as string, reaches,
        });
        cx += G.CW + G.CGAP;
        if (g !== fnG) sx += G.CW + G.CGAP;
      }
      if (!reaches) {
        jumps.push({
          nodeId: n.id, ratings: g.ratings,
          x: firstX, y: bot + 5, w: JUMP_MAX, targetId: g.branch.next as string,
        });
      }
    }
  }

  /* Clip each tag to the gap before the nearest arrow to its right that shares its band. */
  for (const j of jumps) {
    let limit = JUMP_MAX;
    for (const c of chevrons) {
      if (c.x <= j.x) continue;
      if (c.y >= j.y + JUMP_H || c.y + c.h <= j.y) continue; // no vertical overlap
      limit = Math.min(limit, c.x - j.x - 6);
    }
    j.w = Math.max(limit, 64);
  }

  const height = Math.max(y, ...jumps.map((j) => j.y + JUMP_H)) + 40;
  return { units, byId, strips, chevrons, jumps, width: maxX + G.BADGE, height };
}
