import type { Chapter, Node } from './types';
import { blanksOf } from './parse';

export type Scope = 'sub' | 'sec' | 'ch' | 'all';
export interface Loc { chId: string; nodeId: string; }
export type BlankRef = { id: string; alts: string[] };

export function chLabel(c: Chapter): string {
  const n = parseInt(c.id.replace(/\D/g, ''), 10);
  return Number.isFinite(n) ? `Ch${n}` : c.id;
}

export function nodeLabel(n: Node): string {
  return n.num || n.title;
}

export function pathTo(nodes: Node[], id: string, acc: Node[] = []): Node[] | null {
  for (const n of nodes) {
    if (n.id === id) return [...acc, n];
    const r = pathTo(n.children, id, [...acc, n]);
    if (r) return r;
  }
  return null;
}

/** 소절 단위: 절에 level-3 자식이 있으면 그 자식들, 없으면 절 자체. */
export function unitsOf(c: Chapter): Node[] {
  return c.nodes.flatMap(n => (n.level === 2 && n.children.length ? n.children : [n]));
}

export function firstLoc(c: Chapter): Loc {
  const u = unitsOf(c)[0] ?? c.nodes[0];
  return { chId: c.id, nodeId: u ? u.id : '' };
}

export function unitFor(c: Chapter, nodeId: string): Node | undefined {
  const p = pathTo(c.nodes, nodeId);
  if (!p) return unitsOf(c)[0];
  const [a, b] = p;
  if (a.level === 2 && a.children.length) return b ?? a.children[0];
  return a;
}

export function secFor(c: Chapter, nodeId: string): Node | undefined {
  const p = pathTo(c.nodes, nodeId);
  return p ? p[0] : c.nodes[0];
}

export interface Root { chapter: Chapter; nodes: Node[]; whole: boolean; secCrumb?: Node; }

export function resolveRoots(chapters: Chapter[], loc: Loc, scope: Scope): Root[] {
  if (scope === 'all') return chapters.map(chapter => ({ chapter, nodes: chapter.nodes, whole: true }));
  const chapter = chapters.find(c => c.id === loc.chId) ?? chapters[0];
  if (!chapter) return [];
  if (scope === 'ch') return [{ chapter, nodes: chapter.nodes, whole: true }];
  if (scope === 'sec') {
    const s = secFor(chapter, loc.nodeId);
    return s ? [{ chapter, nodes: [s], whole: false }] : [];
  }
  const u = unitFor(chapter, loc.nodeId);
  if (!u) return [];
  const s = secFor(chapter, u.id);
  return [{ chapter, nodes: [u], whole: false, secCrumb: s && s !== u ? s : undefined }];
}

export function blanksOfRoots(roots: Root[]): { chId: string; b: ReturnType<typeof blanksOf>[number] }[] {
  const out: { chId: string; b: ReturnType<typeof blanksOf>[number] }[] = [];
  for (const r of roots) for (const n of r.nodes) for (const b of blanksOf(n, true)) out.push({ chId: r.chapter.id, b });
  return out;
}
