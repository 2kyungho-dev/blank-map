import { describe, it, expect } from 'vitest';
import { parseChapter } from './parse';
import { emptyState, type ChState } from './store';
import { buildRoundMarkdown, htmlToMd, safeFileName } from './export';

const MD = `---
id: t1
title: T1 · Test Chapter
prof: 테스트 교수님
lead: x
link: y
---
## 1.1 Section
### 1.1.1 First
- DNA pol은 [[primase|프라이메이스]]가 필요 {fire:25-2}
- 새 dNTP는 [[3′-OH|3'oh]]에 붙고 방향은 [[5′→3′|5'3']] <b>이다</b> {star:강조}
- 빈칸 없는 설명 줄
### 1.1.2 Second
- retrovirus = gag · [[pol]] · env
`;

function setup(answers: Record<string, string>, ever: string[] = []) {
  const ch = parseChapter(MD);
  const s: ChState = emptyState();
  const blanks: Record<string, string> = {};
  for (const n of ch.nodes) for (const c of n.children) for (const l of c.lines) for (const p of l.parts) if (p.kind === 'blank') blanks[p.alts[0]] = p.id;
  for (const [a, v] of Object.entries(answers)) s.v[blanks[a]] = v;
  for (const e of ever) s.ever[blanks[e]] = 1;
  return { ch, states: { t1: s } };
}
const NOW = new Date(2026, 9, 14, 3, 5);

describe('buildRoundMarkdown', () => {
  it('has the round name as the title and a summary with counts', () => {
    const { ch, states } = setup({ primase: 'primase', '3′-OH': 'oh', '5′→3′': '5->3' });
    const md = buildRoundMarkdown({ name: '내 1회차', now: NOW, chapters: [ch], states });
    expect(md.startsWith('# 내 1회차\n')).toBe(true);
    expect(md).toContain('2026-10-14 03:05');
    // 맞음 2 (primase, 5->3), 틀림 1 (3′-OH ← oh), 미입력 1 (pol)
    expect(md).toMatch(/\| T1 \| 2 \| 0 \| 1 \| 1 \| 4 \| 50% \|/);
  });

  it('marks correct, spelling, wrong and empty blanks distinctly', () => {
    const { ch, states } = setup({ primase: 'primse', '3′-OH': 'oh', '5′→3′': '5to3' });
    const md = buildRoundMarkdown({ name: 'r', now: NOW, chapters: [ch], states });
    expect(md).toContain('🟡~~primse~~→**primase**');
    expect(md).toContain('❌~~oh~~→**3′-OH**');
    expect(md).toContain('⬜→**pol**');
  });

  it('writes correct answers in bold with ↻ when they were once wrong', () => {
    const { ch, states } = setup({ primase: 'primase', '3′-OH': "3'oh", '5′→3′': "5'3'", pol: 'POL' }, ['primase']);
    const md = buildRoundMarkdown({ name: 'r', now: NOW, chapters: [ch], states });
    expect(md).toContain('**primase**↻');
    expect(md).toContain('**pol**');
    const body = md.slice(md.indexOf('## T1 ·'));
    expect(body).not.toMatch(/❌~~/);
    expect(body).not.toMatch(/⬜→/);
  });

  it('keeps headings hierarchy and tags, converts bold html', () => {
    const { ch, states } = setup({});
    const md = buildRoundMarkdown({ name: 'r', now: NOW, chapters: [ch], states });
    expect(md).toContain('## T1 · Test Chapter');
    expect(md).toContain('### 1.1 Section');
    expect(md).toContain('#### 1.1.1 First');
    expect(md).toContain('¥25-2');
    expect(md).toContain('⭐');
    expect(md).toContain('**이다**');
  });

  it('lists wrong/empty blanks in a review section with the user answer', () => {
    const { ch, states } = setup({ '3′-OH': 'oh' });
    const md = buildRoundMarkdown({ name: 'r', now: NOW, chapters: [ch], states });
    const review = md.slice(md.indexOf('## 틀리거나 비운 칸'));
    expect(review).toContain('내 답: oh');
    expect(review).toContain('정답: 3′-OH');
    expect(review).toContain('내 답: (빈칸)');
  });

  it('review lists empty blanks only for sections where something was answered', () => {
    const { ch, states } = setup({ '3′-OH': 'oh' }); // 1.1.1 attempted, 1.1.2 (pol) untouched
    const md = buildRoundMarkdown({ name: 'r', now: NOW, chapters: [ch], states });
    const review = md.slice(md.indexOf('## 틀리거나 비운 칸'));
    expect(review).toContain('1.1.1 First');
    expect(review).not.toContain('1.1.2 Second');
    expect(md).toMatch(/\| T1 \| 0 \| 0 \| 1 \| 3 \| 4 \| 0% \|/); // summary still counts all 3 empties
  });

  it('does not break on a chapter with no blanks answered (0 percent, no NaN)', () => {
    const { ch, states } = setup({});
    const md = buildRoundMarkdown({ name: 'r', now: NOW, chapters: [ch], states });
    expect(md).not.toContain('NaN');
    expect(md).toMatch(/\| 0% \|/);
  });
});

describe('helpers', () => {
  it('htmlToMd converts allowed tags and unescapes entities', () => {
    expect(htmlToMd('a <b>b</b> &lt;c&gt; H<sub>2</sub>O')).toBe('a **b** <c> H2O');
  });
  it('safeFileName removes path-breaking characters and trims', () => {
    expect(safeFileName(' Ch7/1회차: "A" ')).toBe('Ch7_1회차_ _A_');
    expect(safeFileName('   ')).toBe('빈칸지도 기록');
  });
});
