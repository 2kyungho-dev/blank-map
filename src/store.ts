import { judge } from './engine';

export interface ChState { v: Record<string, string>; ever: Record<string, 1>; round: number; mode: 'all' | 'retry' | 'review'; active: string[] | null; }
export type Result = '' | 'ok' | 'sp' | 'no';

export const emptyState = (): ChState => ({ v: {}, ever: {}, round: 1, mode: 'all', active: null });

const key = (chId: string) => `blankmap_${chId}`;
const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);

export function loadState(chId: string): ChState {
  try {
    const raw = localStorage.getItem(key(chId));
    if (!raw) return emptyState();
    const o = JSON.parse(raw);
    if (!isObj(o)) return emptyState();
    if (!isObj(o.v) || !isObj(o.ever)) return emptyState();
    if (typeof o.round !== 'number' || !Number.isFinite(o.round)) return emptyState();
    if (o.mode !== 'all' && o.mode !== 'retry' && o.mode !== 'review') return emptyState();
    if (o.active !== null && !(Array.isArray(o.active) && o.active.every(x => typeof x === 'string'))) return emptyState();
    const v: Record<string, string> = {};
    for (const [k, val] of Object.entries(o.v)) if (typeof val === 'string') v[k] = val;
    const ever: Record<string, 1> = {};
    for (const k of Object.keys(o.ever)) ever[k] = 1;
    return { v, ever, round: o.round, mode: o.mode, active: o.active as string[] | null };
  } catch {
    return emptyState();
  }
}

export function saveState(chId: string, s: ChState): void {
  try { localStorage.setItem(key(chId), JSON.stringify(s)); } catch { /* ignore */ }
}

export function resultOf(s: ChState, b: { id: string; alts: string[] }): Result {
  return judge(s.v[b.id] ?? '', b.alts);
}

export function stats(s: ChState, blanks: { id: string; alts: string[] }[]) {
  let ok = 0, sp = 0, no = 0, empty = 0, ever = 0;
  for (const b of blanks) {
    const r = resultOf(s, b);
    if (r === 'ok') ok++; else if (r === 'sp') sp++; else if (r === 'no') no++; else empty++;
    if (s.ever[b.id]) ever++;
  }
  const total = blanks.length;
  return { total, ok, sp, no, empty, ever, pct: total ? (ok / total) * 100 : 0 };
}

export function activeSet(s: ChState, blanks: { id: string }[]): Set<string> {
  if (s.mode === 'all') return new Set(blanks.map(b => b.id));
  const ids = new Set(blanks.map(b => b.id));
  return new Set((s.active ?? []).filter(id => ids.has(id)));
}
