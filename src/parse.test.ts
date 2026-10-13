import { describe, it, expect } from 'vitest';
import md from '../content/ch00_sample.md?raw';
import { parseChapter, blanksOf, allBlanks } from './parse';

const c = parseChapter(md);

describe('parseChapter', () => {
  it('front matter', () => {
    expect(c.id).toBe('ch00');
    expect(c.title).toBe('Sample Chapter');
    expect(c.prof).toBe('테스터');
    expect(c.lead).toBe('테스트 전용 샘플');
    expect(c.link).toContain('<b>샘플</b>');
  });
  it('tree', () => {
    expect(c.nodes.map(n => n.id)).toEqual(['ch00.0', 'ch00.1']);
    expect(c.nodes[0].level).toBe(2);
    expect(c.nodes[0].children.map(n => n.id)).toEqual(['ch00.0.0', 'ch00.0.1']);
    expect(c.nodes[0].children[0].children[0].id).toBe('ch00.0.0.0');
    expect(c.nodes[0].children[0].children[0].level).toBe(4);
  });
  it('num/title split and summary', () => {
    expect(c.nodes[0].num).toBe('0.1');
    expect(c.nodes[0].title).toBe('First Section');
    expect(c.nodes[0].summary).toBe('첫 절 질문');
    expect(c.nodes[0].children[0].num).toBe('0.1.1');
    expect(c.nodes[0].children[0].children[0].num).toBe('0.1.1.a');
  });
  it('tags extracted and removed', () => {
    const l = c.nodes[0].children[0].lines[0];
    expect(l.fire).toBe('25-2/22-5');
    expect(l.src).toEqual(['vault', '기출']);
    expect(JSON.stringify(l.parts)).not.toContain('fire');
    expect(c.nodes[0].children[0].lines[1].star).toBe('교수 강조');
  });
  it('blank parts and no-blank lines', () => {
    const lines = c.nodes[0].children[0].lines;
    expect(lines[1].parts.every(p => p.kind === 'text')).toBe(true);
    const bs = lines[2].parts.filter(p => p.kind === 'blank');
    expect(bs.length).toBe(2);
  });
  it('html whitelist', () => {
    const t = c.nodes[0].children[0].lines[2].parts.filter(p => p.kind === 'text').map(p => (p as any).html).join('');
    expect(t).toContain('<b>굵게</b>');
    expect(t).not.toContain('<script>');
  });
  it('empty alt dropped', () => {
    const b = c.nodes[0].children[1].lines[0].parts.find(p => p.kind === 'blank') as any;
    expect(b.alts).toEqual(['a', 'b']);
  });
  it('unique deterministic ids', () => {
    const ids = allBlanks(c).map(b => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(c.nodes[0].children[0].lines[0].id).toBe('ch00.0.0:0');
    expect(ids[0]).toBe('ch00.0.0:0.0');
  });
  it('blanksOf deep', () => {
    const n = c.nodes[0].children[0];
    expect(blanksOf(n).length).toBe(3);
    expect(blanksOf(n, true).length).toBe(4);
    expect(allBlanks(c).length).toBe(6);
  });
});

describe('fire tag variants', () => {
  const md = (line: string) => `---\nid: t\ntitle: T\n---\n## 1 A\n### 1.1 B\n- ${line}\n`;
  const first = (line: string) => parseChapter(md(line)).nodes[0].children[0].lines[0];
  it('bare {fire:} yields empty label (still marked)', () => {
    expect(first('a [[b]] {fire:}').fire).toBe('');
  });
  it('bare tag with a labelled one keeps the label', () => {
    expect(first('a [[b]] {fire:} {fire:25-2}').fire).toBe('25-2');
  });
  it('no tag leaves fire undefined', () => {
    expect(first('a [[b]]').fire).toBeUndefined();
  });
});
