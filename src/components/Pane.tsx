import { Fragment, type ReactNode } from 'react';
import type { Chapter, Line, Node } from '../types';
import { BlankInput } from './BlankInput';
import { chLabel, nodeLabel, type Root, type Scope } from '../nav';
import { resultOf, type ChState, type Result } from '../store';

export interface Crumb { label: string; onClick: () => void; }

interface Props {
  roots: Root[];
  scope: Scope;
  onScope: (s: Scope) => void;
  crumbs: Crumb[];
  prevLabel: string | null;
  nextLabel: string | null;
  onPrev: () => void;
  onNext: () => void;
  states: Record<string, ChState>;
  active: Record<string, Set<string>>;
  typing: Set<string>;
  revealed: Set<string>;
  hint: boolean;
  chIndex: (id: string) => number;
  onInput: (id: string, v: string) => void;
  onCommit: (id: string, mark: boolean) => void;
  onEnter: (el: HTMLInputElement) => void;
  toolbar: ReactNode;
  done: ReactNode;
  paneRef: React.RefObject<HTMLDivElement>;
}

const SCOPES: [Scope, string][] = [['sub', '소절'], ['sec', '절'], ['ch', '챕터'], ['all', '전체']];

function lineHasActive(l: Line, act: Set<string>) {
  return l.parts.some(x => x.kind === 'blank' && act.has(x.id));
}
function nodeHasActive(n: Node, act: Set<string>): boolean {
  return n.lines.some(l => lineHasActive(l, act)) || n.children.some(c => nodeHasActive(c, act));
}

export function Pane(p: Props) {
  const renderLine = (ch: Chapter, l: Line, retry: boolean) => {
    const st = p.states[ch.id];
    const act = p.active[ch.id];
    if (retry && !lineHasActive(l, act)) return null;
    return (
      <li key={l.id} className={l.fire ? 'hasfire' : undefined}>
        {l.parts.map((pt, i) => {
          if (pt.kind === 'text') return <span key={i} dangerouslySetInnerHTML={{ __html: pt.html }} />;
          const isAct = act.has(pt.id);
          const filled = retry && !isAct;
          const value = filled ? pt.alts[0] : st.v[pt.id] ?? '';
          const res: Result = filled ? 'ok' : p.typing.has(pt.id) ? '' : resultOf(st, pt);
          return (
            <BlankInput key={pt.id} id={pt.id} alts={pt.alts} value={value} res={res}
              ever={!!st.ever[pt.id]} readOnly={!isAct} rev={p.revealed.has(pt.id)} hint={p.hint}
              onInput={p.onInput} onCommit={p.onCommit} onEnter={p.onEnter} />
          );
        })}
        {l.fire !== undefined && <span className="badge fire" title={'기출 ' + l.fire}>¥<small>{l.fire}</small></span>}
        {l.star !== undefined && <span className="badge star" title={'교수 강조 ' + l.star}>⭐<small>{l.star}</small></span>}
      </li>
    );
  };

  const renderNode = (ch: Chapter, n: Node, ci: number): ReactNode => {
    const retry = p.states[ch.id].mode !== 'all';
    if (retry && !nodeHasActive(n, p.active[ch.id])) return null;
    const H = (n.level === 2 ? 'h2' : n.level === 3 ? 'h3' : 'h4') as 'h2' | 'h3' | 'h4';
    return (
      <section key={n.id} id={'n-' + n.id} className={'nd l' + n.level} style={{ ['--cc' as string]: `var(--c${(ci % 4) + 1})` }}>
        <H className="nh"><span className="nnum">{n.num}</span> {n.title}</H>
        {n.summary && <p className="q">{n.summary}</p>}
        {n.lines.length > 0 && <ul>{n.lines.map(l => renderLine(ch, l, retry))}</ul>}
        {n.children.map(c => renderNode(ch, c, ci))}
      </section>
    );
  };

  return (
    <main className="pane" ref={p.paneRef}>
      <div className="phead">
        <div className="crumbs" aria-label="현재 위치">
          {p.crumbs.map((c, i) => (
            <Fragment key={i}>
              {i > 0 && <span className="sep">›</span>}
              <button className="crumb" onClick={c.onClick}>{c.label}</button>
            </Fragment>
          ))}
        </div>
        <div className="scope" role="group" aria-label="범위">
          {SCOPES.map(([s, l]) => (
            <button key={s} className={p.scope === s ? 'on' : ''} aria-pressed={p.scope === s} onClick={() => p.onScope(s)}>{l}</button>
          ))}
        </div>
        {p.scope !== 'all' && (
          <div className="step">
            <button disabled={!p.prevLabel} onClick={p.onPrev}>‹ {p.prevLabel ?? '이전'}</button>
            <button disabled={!p.nextLabel} onClick={p.onNext}>{p.nextLabel ?? '다음'} ›</button>
          </div>
        )}
      </div>
      {p.toolbar}
      {p.done}
      {p.roots.map(r => {
        const ci = p.chIndex(r.chapter.id);
        const body = r.nodes.map(n => renderNode(r.chapter, n, ci)).filter(Boolean);
        return (
          <article key={r.chapter.id} id={"c-" + r.chapter.id} className="chap" style={{ ['--cc' as string]: `var(--c${(ci % 4) + 1})` }}>
            <header className="chhead">
              <h1><span className="tchip">{chLabel(r.chapter)}</span> {r.chapter.title.replace(/^Ch\d+\s*[·:.-]?\s*/i, '')}</h1>
              <p className="lead">{r.chapter.prof && r.chapter.prof !== '-' ? r.chapter.prof + ' · ' : ''}{r.chapter.lead}</p>
              {r.secCrumb && <p className="seclabel">{nodeLabel(r.secCrumb)} {r.secCrumb.title}</p>}
            </header>
            {body.length ? body : <p className="empty">이 범위에는 활성 칸이 없어요. 상단 “모든 칸 보기”로 돌아갈 수 있어요.</p>}
            {r.whole && r.chapter.link && (
              <div className="link" dangerouslySetInnerHTML={{ __html: '<b>연결고리</b> · ' + r.chapter.link }} />
            )}
          </article>
        );
      })}
    </main>
  );
}
