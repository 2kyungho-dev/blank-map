import { useState } from 'react';
import type { Chapter, Node } from '../types';
import { chLabel, nodeLabel, type Loc } from '../nav';

export interface NodeStat { total: number; ok: number; bad: boolean; }
interface Props {
  chapters: Chapter[];
  stat: Map<string, NodeStat>; // key: chapter id or node id
  curChId: string;
  curNodeId: string;
  activeUnitId: string;
  activeSecId: string;
  all: boolean;
  onPickChapter: (chId: string) => void;
  onPickNode: (loc: Loc, level: 2 | 3 | 4) => void;
}

function Bar({ s }: { s?: NodeStat }) {
  if (!s) return null;
  const pct = s.total ? (s.ok / s.total) * 100 : 0;
  return (
    <span className="tprog" title={`${s.ok}/${s.total}`}>
      <span className="tbar"><i style={{ width: pct + '%' }} /></span>
      <span className="tnum">{s.ok}/{s.total}</span>
      {s.bad && <span className="dot" title="오답 있음" />}
    </span>
  );
}

export function Toc(p: Props) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const isChOpen = (id: string) => (id in open ? open[id] : id === p.curChId);
  const isSecOpen = (n: Node) => (n.id in open ? open[n.id] : n.id === p.activeSecId);
  const toggle = (id: string, cur: boolean) => setOpen(o => ({ ...o, [id]: !cur }));

  return (
    <nav className="toc" aria-label="목차">
      <div className="toc-title">목차</div>
      {p.chapters.map((c, ci) => {
        const chOpen = isChOpen(c.id);
        const curCh = !p.all && c.id === p.curChId;
        return (
          <div className="tch" key={c.id} style={{ ['--cc' as string]: `var(--c${(ci % 4) + 1})` }}>
            <div className={'trow tch-row' + (curCh ? ' cur' : '')}>
              <button className="chev" aria-label="접기/펼치기" aria-expanded={chOpen} onClick={() => toggle(c.id, chOpen)}>{chOpen ? '▾' : '▸'}</button>
              <button className="tlabel" onClick={() => { p.onPickChapter(c.id); if (!chOpen) toggle(c.id, chOpen); }}>
                <span className="tchip">{chLabel(c)}</span>
                <span className="ttext">{c.title.replace(/^Ch\d+\s*[·:.-]?\s*/i, '') || c.title}</span>
              </button>
              <Bar s={p.stat.get(c.id)} />
            </div>
            {chOpen && c.nodes.map(sec => {
              const secOpen = sec.children.length > 0 && isSecOpen(sec);
              const secCur = !p.all && c.id === p.curChId && sec.id === p.activeSecId;
              return (
                <div key={sec.id}>
                  <div className={'trow tsec' + (secCur && !sec.children.length && sec.id === p.activeUnitId ? ' cur' : secCur ? ' within' : '')}>
                    {sec.children.length > 0
                      ? <button className="chev" aria-label="접기/펼치기" aria-expanded={secOpen} onClick={() => toggle(sec.id, secOpen)}>{secOpen ? '▾' : '▸'}</button>
                      : <span className="chev sp" />}
                    <button className="tlabel" onClick={() => { p.onPickNode({ chId: c.id, nodeId: sec.id }, sec.level); if (sec.children.length && !secOpen) toggle(sec.id, secOpen); }}>
                      <span className="tnum2">{sec.num}</span>
                      <span className="ttext">{sec.title}</span>
                    </button>
                    <Bar s={p.stat.get(sec.id)} />
                  </div>
                  {secOpen && sec.children.map(sub => {
                    const cur = !p.all && c.id === p.curChId && sub.id === p.activeUnitId;
                    return (
                      <div key={sub.id} className={'trow tsub' + (cur ? ' cur' : '')}>
                        <button className="tlabel" onClick={() => p.onPickNode({ chId: c.id, nodeId: sub.id }, sub.level)} aria-current={cur ? 'true' : undefined}>
                          <span className="tnum2">{nodeLabel(sub) === sub.num ? sub.num : ''}</span>
                          <span className="ttext">{sub.title}</span>
                        </button>
                        <Bar s={p.stat.get(sub.id)} />
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}
