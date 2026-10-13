import type { Chapter, Line, Node, Part } from './types';
import { judge } from './engine';
import type { ChState } from './store';

type Blank = Extract<Part, { kind: 'blank' }>;
type Mark = 'ok' | 'sp' | 'no' | 'empty';

export function htmlToMd(html: string): string {
  return html
    .replace(/<b>([\s\S]*?)<\/b>/gi, '**$1**')
    .replace(/<i>([\s\S]*?)<\/i>/gi, '*$1*')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

export function safeFileName(name: string): string {
  const s = name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim();
  return s || '빈칸지도 기록';
}

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();
const nodeTitle = (n: Node) => `${n.num} ${n.title}`.trim();

function markOf(s: ChState, b: Blank): { mark: Mark; ans: string; mine: string } {
  const mine = clean(s.v[b.id] ?? '');
  const r = judge(mine, b.alts);
  return { mark: r === '' ? 'empty' : r, ans: b.alts[0], mine };
}

function blankMd(s: ChState, b: Blank): string {
  const { mark, ans, mine } = markOf(s, b);
  if (mark === 'ok') return `**${ans}**${s.ever[b.id] ? '↻' : ''}`;
  if (mark === 'sp') return `🟡~~${mine}~~→**${ans}**`;
  if (mark === 'no') return `❌~~${mine}~~→**${ans}**`;
  return `⬜→**${ans}**`;
}

function lineMd(s: ChState, l: Line): string {
  const body = l.parts.map(p => (p.kind === 'text' ? htmlToMd(p.html) : blankMd(s, p))).join('');
  const tags = [l.fire !== undefined ? `¥${l.fire}` : '', l.star !== undefined ? '⭐' : ''].filter(Boolean).join(' ');
  return `- ${clean(body)}${tags ? ' ' + tags : ''}`;
}

function blanksIn(n: Node): Blank[] {
  const own = n.lines.flatMap(l => l.parts.filter((p): p is Blank => p.kind === 'blank'));
  return own.concat(n.children.flatMap(blanksIn));
}

function count(ch: Chapter, s: ChState) {
  const c = { ok: 0, sp: 0, no: 0, empty: 0, total: 0, ever: 0 };
  for (const b of ch.nodes.flatMap(blanksIn)) {
    c.total++;
    c[markOf(s, b).mark]++;
    if (s.ever[b.id]) c.ever++;
  }
  return c;
}

const pct = (ok: number, total: number) => `${total ? Math.round((ok / total) * 100) : 0}%`;
const pad2 = (n: number) => String(n).padStart(2, '0');
const stamp = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

export interface RoundExport {
  name: string;
  now: Date;
  chapters: Chapter[];
  states: Record<string, ChState>;
}

export function buildRoundMarkdown({ name, now, chapters, states }: RoundExport): string {
  const out: string[] = [];
  const shortTitle = (c: Chapter) => c.title.split(/\s*[·:]\s*/)[0];
  out.push(`# ${clean(name) || '빈칸지도 기록'}`, '');
  out.push(`- 저장 일시: ${stamp(now)}`);
  out.push(`- 범위: ${chapters.map(shortTitle).join(', ')}`);
  out.push(`- 회차: ${chapters.map(c => `${shortTitle(c)} ${states[c.id]?.mode === 'review' ? '복습' : `${states[c.id]?.round ?? 1}회차`}`).join(', ')}`);
  out.push('', '## 요약', '');
  out.push('| 챕터 | 맞음 | 철자 | 틀림 | 미입력 | 전체 | 정답률 | 한 번이라도 틀림(↻) |', '|---|---:|---:|---:|---:|---:|---:|---:|');
  const sum = { ok: 0, sp: 0, no: 0, empty: 0, total: 0, ever: 0 };
  for (const c of chapters) {
    const k = count(c, states[c.id] ?? ({ v: {}, ever: {} } as ChState));
    (Object.keys(sum) as (keyof typeof sum)[]).forEach(key => { sum[key] += k[key]; });
    out.push(`| ${shortTitle(c)} | ${k.ok} | ${k.sp} | ${k.no} | ${k.empty} | ${k.total} | ${pct(k.ok, k.total)} | ${k.ever} |`);
  }
  if (chapters.length > 1) out.push(`| **합계** | ${sum.ok} | ${sum.sp} | ${sum.no} | ${sum.empty} | ${sum.total} | ${pct(sum.ok, sum.total)} | ${sum.ever} |`);
  out.push('', '> 범례: **굵게** = 정답 · 🟡~~내 답~~→**정답** = 철자 오류 · ❌~~내 답~~→**정답** = 오답 · ⬜→**정답** = 미입력 · ↻ = 한 번이라도 틀림 · ¥ = 기출 · ⭐ = 교수 강조');

  const walk = (c: Chapter, s: ChState, n: Node) => {
    out.push('', `${'#'.repeat(n.level + 1)} ${nodeTitle(n)}`, '');
    if (n.summary) out.push(`> ${n.summary}`, '');
    for (const l of n.lines) out.push(lineMd(s, l));
    n.children.forEach(k => walk(c, s, k));
  };
  const review: string[] = [];
  for (const c of chapters) {
    const s = states[c.id] ?? ({ v: {}, ever: {}, round: 1, mode: 'all', active: null } as ChState);
    out.push('', `## ${c.title}`);
    c.nodes.forEach(n => walk(c, s, n));

    const rev: string[] = [];
    const visit = (n: Node) => {
      // 아직 손대지 않은 소절의 빈칸까지 '미입력'으로 늘어놓지 않는다
      const attempted = n.lines.some(l => l.parts.some(p => p.kind === 'blank' && clean(s.v[p.id] ?? '') !== ''));
      for (const l of n.lines) for (const b of l.parts) {
        if (b.kind !== 'blank') continue;
        const { mark, ans, mine } = markOf(s, b);
        if (mark === 'ok' || (mark === 'empty' && !attempted)) continue;
        const text = clean(l.parts.map(p => (p.kind === 'text' ? htmlToMd(p.html) : p.id === b.id ? '[ ? ]' : p.alts[0])).join(''));
        const tag = mark === 'sp' ? '철자' : mark === 'no' ? '오답' : '미입력';
        rev.push(`- (${tag}) **${nodeTitle(n)}** — ${text} → 내 답: ${mine || '(빈칸)'} / 정답: ${ans}`);
      }
      n.children.forEach(visit);
    };
    c.nodes.forEach(visit);
    if (rev.length) review.push('', `### ${shortTitle(c)} (${rev.length}칸)`, '', ...rev);
  }
  out.push('', '---', '', '## 틀리거나 비운 칸 (복습용)');
  out.push(...(review.length ? review : ['', '모두 맞혔습니다. 🎉']));
  return out.join('\n') + '\n';
}

export function downloadMarkdown(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
