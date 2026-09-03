import {
  RATINGS,
  type Branch,
  type Conclusion,
  type Pattern,
  type Rating,
  type TestNode,
} from '$lib/data/breakouts';

export type Answers = Partial<Record<string, Rating>>;

export interface Step {
  node: TestNode;
  rating: Rating | '';
  branch: Branch | null;
}

/** A set of branches that share both a destination and an outcome, so they are one arrow.
 *  Branches that share a destination but differ in finding stay separate — merging them
 *  would hide a conclusion, which is the failure mode the paper charts have. */
export interface Group {
  key: string;
  branch: Branch;
  ratings: Rating[];
}

export const nodeMap = (p: Pattern): Record<string, TestNode> =>
  Object.fromEntries(p.nodes.map((n) => [n.id, n]));

export function groupsOf(node: TestNode): Group[] {
  const out: Group[] = [];
  for (const r of RATINGS) {
    const b = node.branches[r];
    const key = `${b.next ? 'n:' + b.next : 't:'}|${b.conclusion ?? ''}|${b.finding ?? ''}`;
    let g = out.find((z) => z.key === key);
    if (!g) out.push((g = { key, branch: b, ratings: [] }));
    g.ratings.push(r);
  }
  return out;
}

/** Split a group into one chevron per rating kind, so a single arrow never carries
 *  two colours' worth of meaning. */
export const chunksOf = (g: Group): Rating[][] =>
  [
    g.ratings.filter((r) => r === 'FN'),
    g.ratings.filter((r) => r === 'DN'),
    g.ratings.filter((r) => r === 'FP' || r === 'DP'),
  ].filter((c) => c.length > 0);

export const kindOf = (rs: Rating[]): 'FN' | 'DN' | 'P' =>
  rs.some((r) => r === 'FP' || r === 'DP') ? 'P' : rs.some((r) => r === 'DN') ? 'DN' : 'FN';

/** Which tests are the assisted retest of the test immediately before them. Only a
 *  passive/stabilized test reached from exactly one place counts. */
export function pairing(p: Pattern) {
  const preds: Record<string, Set<string>> = {};
  for (const n of p.nodes) {
    for (const r of RATINGS) {
      const nx = n.branches[r].next;
      if (nx) (preds[nx] ??= new Set()).add(n.id);
    }
  }
  const partner: Record<string, string> = {};
  const isPartner: Record<string, string> = {};
  for (const n of p.nodes) {
    if (n.mode !== 'passive' && n.mode !== 'stabilized') continue;
    const ps = [...(preds[n.id] ?? [])];
    if (ps.length === 1 && !partner[ps[0]]) {
      partner[ps[0]] = n.id;
      isPartner[n.id] = ps[0];
    }
  }
  return { partner, isPartner, preds };
}

/** Replay the answers from the pattern's first test. Stops at the first unanswered test. */
export function walk(p: Pattern, answers: Answers): Step[] {
  const nodes = nodeMap(p);
  const out: Step[] = [];
  let id: string | undefined = p.start;
  let guard = 0;
  while (id !== undefined && guard++ <= p.nodes.length) {
    const here: string = id;
    const node: TestNode | undefined = nodes[here];
    if (!node) break;
    // Answers is a partial map: an unanswered test simply has no entry.
    const picked: Rating | undefined = answers[here];
    const branch: Branch | null = picked ? node.branches[picked] : null;
    out.push({ node, rating: picked ?? '', branch });
    if (!branch) break;
    id = branch.next;
  }
  return out;
}

export const currentNode = (path: Step[]): TestNode | null => {
  const last = path[path.length - 1];
  return last && !last.rating ? last.node : null;
};

export const isComplete = (path: Step[]): boolean => {
  const last = path[path.length - 1];
  return !!last?.rating && !last.branch?.next;
};

export interface Finding {
  rating: Rating;
  test: string;
  finding: string;
  conclusion?: Conclusion;
}

export const findingsOf = (path: Step[]): Finding[] =>
  path
    .filter((s): s is Step & { rating: Rating; branch: Branch } => !!s.branch?.finding && !!s.rating)
    .map((s) => ({
      rating: s.rating,
      test: s.node.short,
      finding: s.branch.finding as string,
      conclusion: s.branch.conclusion,
    }));

/** One class of finding gives that class; more than one is genuinely mixed. */
export function verdict(path: Step[]): Conclusion | '' {
  if (!isComplete(path)) return '';
  const set = new Set(findingsOf(path).map((f) => f.conclusion).filter(Boolean) as Conclusion[]);
  return set.size === 1 ? [...set][0] : 'mixed-or-inconclusive';
}

/** Drop answers that are no longer on the path after an earlier answer changed. */
export function prune(p: Pattern, answers: Answers): Answers {
  const live = new Set(walk(p, answers).map((s) => s.node.id));
  return Object.fromEntries(Object.entries(answers).filter(([k]) => live.has(k))) as Answers;
}
