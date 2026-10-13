import type { Chapter, Line, Node, Part } from './types';

type BlankPart = Extract<Part, { kind: 'blank' }>;

function cleanHtml(s: string): string {
  return s
    .split(/(<\/?(?:b|i|sub|sup)>)/i)
    .map((seg, i) => (i % 2 === 1 ? seg : seg.replace(/</g, '&lt;').replace(/>/g, '&gt;')))
    .join('');
}

function parseFrontMatter(md: string): { meta: Record<string, string>; body: string[] } {
  const lines = md.replace(/\r\n?/g, '\n').split('\n');
  const meta: Record<string, string> = {};
  let i = 0;
  if (lines[0]?.trim() === '---') {
    i = 1;
    for (; i < lines.length && lines[i].trim() !== '---'; i++) {
      const m = /^([A-Za-z_]+):\s*(.*)$/.exec(lines[i]);
      if (m) meta[m[1]] = m[2].trim();
    }
    i++;
  }
  return { meta, body: lines.slice(i) };
}

function parseLine(raw: string, lineId: string): Line {
  let fire: string | undefined, star: string | undefined;
  let src: string[] = [];
  const text = raw.replace(/\{(fire|star|src):([^}]*)\}/g, (_, k: string, v: string) => {
    if (k === 'fire') {
      const t = v.trim();
      if (fire === undefined) fire = t;
      else if (t && !fire.split('/').includes(t)) fire = fire ? `${fire}/${t}` : t;
    }
    else if (k === 'star') star = v.trim();
    else src = src.concat(v.split(',').map(x => x.trim()).filter(Boolean));
    return '';
  }).trim();
  const parts: Part[] = [];
  const re = /\[\[([^\]]+)\]\]/g;
  let last = 0, k = 0, m: RegExpExecArray | null;
  const pushText = (t: string) => { if (t) parts.push({ kind: 'text', html: cleanHtml(t) }); };
  while ((m = re.exec(text))) {
    pushText(text.slice(last, m.index));
    const alts = m[1].split('|').map(x => x.trim()).filter(Boolean);
    if (alts.length) parts.push({ kind: 'blank', id: `${lineId}.${k++}`, alts });
    else pushText(m[0]);
    last = m.index + m[0].length;
  }
  pushText(text.slice(last));
  const line: Line = { id: lineId, parts, src };
  if (fire !== undefined) line.fire = fire;
  if (star !== undefined) line.star = star;
  return line;
}

export function parseChapter(md: string): Chapter {
  const { meta, body } = parseFrontMatter(md);
  const id = meta.id || 'ch??';
  const chapter: Chapter = { id, title: meta.title || '', prof: meta.prof || '', lead: meta.lead || '', link: meta.link || '', nodes: [] };
  const stack: Node[] = []; // stack[0]=level2 ... 
  let cur: Node | null = null;
  let sawLine = false;
  for (const rawLine of body) {
    const h = /^(#{2,4})\s+(.*\S)\s*$/.exec(rawLine);
    if (h) {
      const level = h[1].length as 2 | 3 | 4;
      while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
      const parent = stack[stack.length - 1];
      const siblings = parent ? parent.children : chapter.nodes;
      const nm = /^(\d+(?:\.\w+)*)\.?\s+(.+)$/.exec(h[2]);
      const nodeId = `${parent ? parent.id : id}.${siblings.length}`;
      const node: Node = { id: nodeId, level, num: nm ? nm[1] : '', title: nm ? nm[2] : h[2], lines: [], children: [] };
      siblings.push(node);
      stack.push(node);
      cur = node;
      sawLine = false;
      continue;
    }
    if (!cur) continue;
    const q = /^>\s?(.*)$/.exec(rawLine);
    if (q && !sawLine && cur.summary === undefined) { cur.summary = q[1].trim(); continue; }
    const b = /^\s*[-*]\s+(.*\S)\s*$/.exec(rawLine);
    if (b) {
      sawLine = true;
      cur.lines.push(parseLine(b[1], `${cur.id}:${cur.lines.length}`));
    }
  }
  return chapter;
}

export function blanksOf(n: Node, deep = false): BlankPart[] {
  const out: BlankPart[] = [];
  for (const l of n.lines) for (const p of l.parts) if (p.kind === 'blank') out.push(p);
  if (deep) for (const c of n.children) out.push(...blanksOf(c, true));
  return out;
}

export function allBlanks(c: Chapter): BlankPart[] {
  return c.nodes.flatMap(n => blanksOf(n, true));
}
