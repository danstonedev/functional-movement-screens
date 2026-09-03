import raw from './breakouts.json';

export type Rating = 'FN' | 'FP' | 'DN' | 'DP';
export type Conclusion =
  | 'mobility-dysfunction'
  | 'stability-motor-control-dysfunction'
  | 'painful-finding'
  | 'mixed-or-inconclusive';

/** How the test is performed. `active` is unassisted; `passive` and `stabilized` are the
 *  assisted retests that make the mobility-vs-motor-control comparison possible. */
export type TestMode = 'active' | 'passive' | 'stabilized' | 'neutral';

export interface Branch {
  /** Next test, when the breakout continues. Absent means this branch ends it. */
  next?: string;
  /** What this branch establishes. Present on every terminal branch. */
  finding?: string;
  conclusion?: Conclusion;
}

export interface TestNode {
  id: string;
  /** Full name as recorded, e.g. "Active Supine Cervical Flexion". */
  label: string;
  /** Name with the mode prefix stripped — the mode is shown as its own tag. */
  short: string;
  /** What counts as a pass. */
  criterion: string;
  mode: TestMode;
  /** Patient position, e.g. "Supine". Empty when the source does not imply one. */
  position: string;
  /** Body region, used for the section bands on the board. */
  region: string;
  /** Longest-path distance from the pattern's first test. */
  depth: number;
  branches: Record<Rating, Branch>;
}

export interface Pattern {
  patternId: string;
  /** Id of the first test. */
  start: string;
  nodes: TestNode[];
}

interface Bundle {
  ratings: Record<Rating, string>;
  conclusions: Record<Conclusion, string>;
  patterns: Pattern[];
}

const bundle = raw as unknown as Bundle;

export const RATINGS: Rating[] = ['FN', 'FP', 'DN', 'DP'];
export const RATING_LABELS = bundle.ratings;
export const CONCLUSION_LABELS = bundle.conclusions;
export const PATTERNS: Pattern[] = bundle.patterns;

/** Short codes used on the outcome strips. */
export const CONCLUSION_CODE: Record<Conclusion, string> = {
  'stability-motor-control-dysfunction': 'SMCD',
  'mobility-dysfunction': 'MD',
  'painful-finding': 'P/D',
  'mixed-or-inconclusive': 'MIX',
};

export const CONCLUSION_NOTE: Record<Conclusion, string> = {
  'mobility-dysfunction':
    'The range is not available. Change length or joint mobility first — control work will not hold on a range they do not own.',
  'stability-motor-control-dysfunction':
    'The range is there; they cannot produce or hold it. Load control inside the range they already have.',
  'painful-finding':
    'Pain was provoked, so the breakout stops. This region needs local examination, not more provocation.',
  'mixed-or-inconclusive':
    'More than one class of finding came back. That is a real result — the chain crossed several regions and they disagreed.',
};

export const getPattern = (id: string): Pattern | undefined =>
  PATTERNS.find((p) => p.patternId === id);

export function patternTitle(id: string): string {
  return id
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/Pattern (One|Two)/, (_m, d) => 'Pattern ' + (d === 'One' ? '1' : '2'));
}
