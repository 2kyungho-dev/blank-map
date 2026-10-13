import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { chapters } from './chapters';
import { allBlanks } from './parse';
import { activeSet, emptyState, loadState, resultOf, saveState, type ChState, type Result } from './store';
import { chLabel, firstLoc, nodeLabel, resolveRoots, blanksOfRoots, secFor, unitFor, unitsOf, type Loc, type Scope } from './nav';
import type { Line, Node } from './types';
import { Toc, type NodeStat } from './components/Toc';
import { Pane, type Crumb } from './components/Pane';
import { Toolbar } from './components/Toolbar';
import { ConfirmModal } from './components/ConfirmModal';
import { buildRoundMarkdown, downloadMarkdown, safeFileName } from './export';
import { judge } from './engine';

interface BInfo { chId: string; alts: string[]; line: Line; node: Node; }
const blankIndex = new Map<string, BInfo>();
const nodeIndex = new Map<string, Node>();
const chBlanks: Record<string, { id: string; alts: string[] }[]> = {};
(() => {
  const walk = (chId: string, n: Node) => {
    nodeIndex.set(n.id, n);
    for (const l of n.lines) for (const p of l.parts) if (p.kind === 'blank') blankIndex.set(p.id, { chId, alts: p.alts, line: l, node: n });
    n.children.forEach(c => walk(chId, c));
  };
  for (const c of chapters) { c.nodes.forEach(n => walk(c.id, n)); chBlanks[c.id] = allBlanks(c); }
})();

const UI_KEY = 'blankmap_ui';
function loadUi(): { loc: Loc; scope: Scope } {
  const def = { loc: chapters[0] ? firstLoc(chapters[0]) : { chId: '', nodeId: '' }, scope: 'sub' as Scope };
  try {
    const o = JSON.parse(localStorage.getItem(UI_KEY) || 'null');
    if (o && chapters.some(c => c.id === o.loc?.chId) && nodeIndex.has(o.loc?.nodeId) && ['sub', 'sec', 'ch', 'all'].includes(o.scope)) return { loc: o.loc, scope: o.scope };
  } catch { /* ignore */ }
  return def;
}

const stripHtml = (h: string) => h.replace(/<[^>]*>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

export function App() {
  const [states, setStates] = useState<Record<string, ChState>>(() => Object.fromEntries(chapters.map(c => [c.id, loadState(c.id)])));
  const [typing, setTyping] = useState<Set<string>>(new Set());
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [ui, setUi] = useState(loadUi);
  const [hint, setHint] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [revealAsk, setRevealAsk] = useState<number | null>(null);
  const [resetAsk, setResetAsk] = useState(false);
  const [roundName, setRoundName] = useState('');
  const [copyLabel, setCopyLabel] = useState('틀린 것 복사');
  const { loc, scope } = ui;
  const paneRef = useRef<HTMLDivElement>(null);
  const scrollTarget = useRef<string | null>(null);
  const lastNode = useRef<Record<string, string>>({});

  const latest = useRef({ states });
  latest.current = { states };

  useEffect(() => { try { localStorage.setItem(UI_KEY, JSON.stringify(ui)); } catch { /* ignore */ } }, [ui]);
  useEffect(() => { lastNode.current[loc.chId] = loc.nodeId; }, [loc]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawer(false); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);
  useEffect(() => {
    const bar = document.querySelector('.bar');
    if (!bar) return;
    const set = () => document.documentElement.style.setProperty('--tb', bar.getBoundingClientRect().height + 'px');
    set();
    const ro = new ResizeObserver(set);
    ro.observe(bar);
    return () => ro.disconnect();
  });
  useEffect(() => {
    const t = scrollTarget.current;
    if (t === null) return;
    scrollTarget.current = null;
    if (t === 'top') { window.scrollTo({ top: 0 }); return; }
    document.getElementById(t)?.scrollIntoView({ block: 'start' });
  });

  const commitStates = useCallback((changes: Record<string, ChState>) => {
    setStates(prev => {
      const n = { ...prev, ...changes };
      for (const k of Object.keys(changes)) saveState(k, changes[k]);
      return n;
    });
  }, []);

  // ----- derived -----
  const roots = useMemo(() => resolveRoots(chapters, loc, scope), [loc, scope]);
  const scoped = useMemo(() => blanksOfRoots(roots), [roots]);
  const active = useMemo(() => {
    const r: Record<string, Set<string>> = {};
    for (const c of chapters) r[c.id] = activeSet(states[c.id], chBlanks[c.id]);
    return r;
  }, [states]);
  const dispRes = (chId: string, b: { id: string; alts: string[] }): Result => (typing.has(b.id) ? '' : resultOf(states[chId], b));

  const scopeChIds = useMemo(() => Array.from(new Set(roots.map(r => r.chapter.id))), [roots]);

  const actList = scoped.filter(x => active[x.chId].has(x.b.id));
  let sOk = 0, sSp = 0, sNo = 0, sEver = 0;
  for (const x of actList) {
    const r = dispRes(x.chId, x.b);
    if (r === 'ok') sOk++; else if (r === 'sp') sSp++; else if (r === 'no' || revealed.has(x.b.id)) sNo++;
  }
  for (const x of scoped) if (states[x.chId].ever[x.b.id]) sEver++;
  const sLeft = actList.length - sOk;
  const done = actList.length > 0 && sLeft === 0;
  const anyRetry = scopeChIds.some(id => states[id].mode !== 'all');
  const roundLabel = scopeChIds.some(id => states[id].mode === 'review') ? '복습' : `${Math.max(1, ...scopeChIds.map(id => states[id].round))}회차`;

  const tocStat = useMemo(() => {
    const m = new Map<string, NodeStat>();
    const walk = (chId: string, n: Node): NodeStat => {
      const st = states[chId];
      const s: NodeStat = { total: 0, ok: 0, bad: false };
      for (const l of n.lines) for (const p of l.parts) {
        if (p.kind !== 'blank') continue;
        s.total++;
        const r: Result = typing.has(p.id) ? '' : resultOf(st, p);
        if (r === 'ok') s.ok++;
        if (r === 'no' || r === 'sp' || st.ever[p.id]) s.bad = true;
      }
      for (const c of n.children) { const t = walk(chId, c); s.total += t.total; s.ok += t.ok; s.bad = s.bad || t.bad; }
      m.set(n.id, s);
      return s;
    };
    for (const c of chapters) {
      const t: NodeStat = { total: 0, ok: 0, bad: false };
      for (const n of c.nodes) { const s = walk(c.id, n); t.total += s.total; t.ok += s.ok; t.bad = t.bad || s.bad; }
      m.set(c.id, t);
    }
    return m;
  }, [states, typing]);

  // ----- actions -----
  const onInput = useCallback((id: string, v: string) => {
    const info = blankIndex.get(id);
    if (!info) return;
    setTyping(prev => (prev.has(id) ? prev : new Set(prev).add(id)));
    setRevealed(prev => { if (!prev.has(id)) return prev; const n = new Set(prev); n.delete(id); return n; });
    setStates(prev => {
      const s = prev[info.chId];
      const ns = { ...s, v: { ...s.v, [id]: v } };
      saveState(info.chId, ns);
      return { ...prev, [info.chId]: ns };
    });
  }, []);

  const onCommit = useCallback((id: string, mark: boolean) => {
    const info = blankIndex.get(id);
    if (!info) return;
    setTyping(prev => { if (!prev.has(id)) return prev; const n = new Set(prev); n.delete(id); return n; });
    if (!mark) return;
    setStates(prev => {
      const s = prev[info.chId];
      const r = judge(s.v[id] ?? '', info.alts);
      if ((r !== 'no' && r !== 'sp') || s.ever[id]) return prev;
      const ns = { ...s, ever: { ...s.ever, [id]: 1 as const } };
      saveState(info.chId, ns);
      return { ...prev, [info.chId]: ns };
    });
  }, []);

  const onEnter = useCallback((el: HTMLInputElement) => {
    const root = paneRef.current;
    if (!root) return;
    const all = Array.from(root.querySelectorAll<HTMLInputElement>('input.bi'));
    const i = all.indexOf(el);
    const nxt = all.slice(i + 1).find(x => !x.readOnly && x.dataset.res !== 'ok');
    nxt?.focus();
  }, []);

  /** 범위의 활성 칸 중 입력이 있는 것을 채점하고, 오답을 ever에 기록한 새 상태들 반환 */
  const gradeScope = (): Record<string, ChState> => {
    const out: Record<string, ChState> = {};
    for (const id of scopeChIds) out[id] = { ...states[id], ever: { ...states[id].ever } };
    for (const x of actList) {
      const s = out[x.chId];
      if (!(s.v[x.b.id] ?? '').trim()) continue;
      const r = judge(s.v[x.b.id], x.b.alts);
      if (r === 'no' || r === 'sp') s.ever[x.b.id] = 1;
    }
    return out;
  };

  const onCheck = () => {
    commitStates(gradeScope());
    setTyping(prev => { const n = new Set(prev); actList.forEach(x => n.delete(x.b.id)); return n; });
  };

  const startRound = (idsByCh: Record<string, string[]>, mode: 'retry' | 'review', base: Record<string, ChState>) => {
    const out: Record<string, ChState> = {};
    const allIds = new Set<string>();
    for (const chId of Object.keys(idsByCh)) {
      const ids = idsByCh[chId];
      const s = base[chId];
      const v = { ...s.v };
      ids.forEach(i => { v[i] = ''; allIds.add(i); });
      out[chId] = { ...s, v, mode, active: ids, round: mode === 'retry' ? s.round + 1 : s.round };
    }
    commitStates({ ...base, ...out });
    setTyping(prev => { const n = new Set(prev); allIds.forEach(i => n.delete(i)); return n; });
    setRevealed(prev => { const n = new Set(prev); allIds.forEach(i => n.delete(i)); return n; });
    scrollTarget.current = 'top';
    setTimeout(() => {
      const first = paneRef.current?.querySelector<HTMLInputElement>('input.bi:not([readonly])');
      first?.focus({ preventScroll: true });
    }, 300);
  };

  const onRetry = () => {
    const base = gradeScope();
    const wrong: Record<string, string[]> = {};
    for (const x of actList) {
      if (judge(base[x.chId].v[x.b.id] ?? '', x.b.alts) !== 'ok') {
        base[x.chId].ever[x.b.id] = 1;
        (wrong[x.chId] ||= []).push(x.b.id);
      }
    }
    if (!Object.keys(wrong).length) {
      commitStates(base);
      setTyping(prev => { const n = new Set(prev); actList.forEach(x => n.delete(x.b.id)); return n; });
      return;
    }
    startRound(wrong, 'retry', base);
  };

  const onReview = () => {
    const ids: Record<string, string[]> = {};
    for (const x of scoped) if (states[x.chId].ever[x.b.id]) (ids[x.chId] ||= []).push(x.b.id);
    if (Object.keys(ids).length) startRound(ids, 'review', states);
  };

  const onShowAll = () => {
    const out: Record<string, ChState> = {};
    for (const id of scopeChIds) if (states[id].mode !== 'all') out[id] = { ...states[id], mode: 'all', active: null };
    commitStates(out);
  };

  const onReveal = () => {
    const remaining = actList.filter(x => judge(states[x.chId].v[x.b.id] ?? '', x.b.alts) !== 'ok').length;
    if (remaining > 0) setRevealAsk(remaining);
  };
  const doReveal = () => {
    setRevealAsk(null);
    const base = gradeScope();
    const add: string[] = [];
    for (const x of actList) {
      if (judge(base[x.chId].v[x.b.id] ?? '', x.b.alts) !== 'ok') { base[x.chId].ever[x.b.id] = 1; add.push(x.b.id); }
    }
    commitStates(base);
    setTyping(prev => { const n = new Set(prev); actList.forEach(x => n.delete(x.b.id)); return n; });
    setRevealed(prev => { const n = new Set(prev); add.forEach(i => n.add(i)); return n; });
  };

  const resetNames = scopeChIds.map(id => chLabel(chapters.find(c => c.id === id)!)).join(', ');
  const hasAnswers = scopeChIds.some(id => Object.values(states[id].v).some(v => (v ?? '').trim()));
  const onReset = () => { setRoundName(`${resetNames} ${roundLabel}`); setResetAsk(true); };
  const saveRound = () => {
    const now = new Date();
    const name = roundName.trim() || `${resetNames} ${roundLabel}`;
    const chs = scopeChIds.map(id => chapters.find(c => c.id === id)!);
    const d = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    downloadMarkdown(`${safeFileName(name)} (${d}).md`, buildRoundMarkdown({ name, now, chapters: chs, states }));
  };
  const doReset = () => {
    setResetAsk(false);
    const out: Record<string, ChState> = {};
    for (const id of scopeChIds) out[id] = emptyState();
    commitStates(out);
    setTyping(new Set());
    setRevealed(new Set());
  };

  const copyList = async (everOnly: boolean) => {
    const base = everOnly ? states : gradeScope();
    if (!everOnly) commitStates(base);
    const out: string[] = [];
    for (const x of scoped) {
      const s = base[x.chId];
      const r = judge(s.v[x.b.id] ?? '', x.b.alts);
      const bad = everOnly ? !!s.ever[x.b.id] : active[x.chId].has(x.b.id) && r !== 'ok';
      if (!bad) continue;
      const info = blankIndex.get(x.b.id)!;
      const text = info.line.parts.map(p => (p.kind === 'text' ? stripHtml(p.html) : p.id === x.b.id ? '[ ? ]' : p.alts[0])).join('').replace(/\s+/g, ' ').trim();
      const st = everOnly ? '틀렸던 칸' : r === 'sp' ? '철자' : '틀림';
      out.push(`${st} | ${nodeLabel(info.node)} ${info.node.title} | ${text} | 내 답: ${(s.v[x.b.id] ?? '').trim() || '(빈칸)'} | 정답: ${x.b.alts[0]}`);
    }
    const head = scope === 'all' ? '전체' : chLabel(chapters.find(c => c.id === loc.chId)!);
    const txt = `${head} 빈칸지도 ${everOnly ? '틀렸던 칸' : '오답'} ${out.length}개\n` + out.join('\n');
    let okc = false;
    try { await navigator.clipboard.writeText(txt); okc = true; } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = txt; document.body.appendChild(ta); ta.select();
        okc = document.execCommand('copy'); ta.remove();
      } catch { /* ignore */ }
    }
    if (!okc) window.prompt('복사해서 붙여 넣기', txt);
    setCopyLabel(`복사됨 ✓ ${out.length}개`);
    setTimeout(() => setCopyLabel('틀린 것 복사'), 1800);
  };

  // ----- navigation -----
  const setScope = (s: Scope) => { setUi(u => ({ ...u, scope: s })); scrollTarget.current = 'top'; };
  const goLoc = (l: Loc, sc?: Scope, scroll: string | null = 'top') => {
    setUi(u => ({ loc: l, scope: sc ?? u.scope }));
    scrollTarget.current = scroll;
    setDrawer(false);
  };
  const pickChapter = (chId: string) => {
    const c = chapters.find(x => x.id === chId)!;
    if (scope === 'all') { goLoc({ chId, nodeId: lastNode.current[chId] ?? firstLoc(c).nodeId }, 'all', 'c-' + chId); return; }
    goLoc({ chId, nodeId: lastNode.current[chId] ?? firstLoc(c).nodeId }, scope === 'ch' ? 'ch' : scope, 'top');
  };
  const pickNode = (l: Loc, level: 2 | 3 | 4) => {
    const sc: Scope = scope === 'sub' && level === 2 ? 'sec' : scope;
    goLoc(l, sc, sc === 'sub' ? 'top' : 'n-' + l.nodeId);
  };
  const onTab = (id: string) => {
    if (id === 'all') { setScope('all'); return; }
    const c = chapters.find(x => x.id === id)!;
    goLoc({ chId: id, nodeId: lastNode.current[id] ?? firstLoc(c).nodeId }, scope === 'all' ? 'ch' : scope, 'top');
  };

  const curChapter = chapters.find(c => c.id === loc.chId) ?? chapters[0];
  const curUnit = curChapter ? unitFor(curChapter, loc.nodeId) : undefined;
  const curSec = curChapter ? secFor(curChapter, loc.nodeId) : undefined;

  const steps = useMemo(() => {
    if (scope === 'sub') return chapters.flatMap(c => unitsOf(c).map(n => ({ chId: c.id, nodeId: n.id, label: nodeLabel(n), key: n.id })));
    if (scope === 'sec') return chapters.flatMap(c => c.nodes.map(n => ({ chId: c.id, nodeId: n.id, label: nodeLabel(n), key: n.id })));
    return chapters.map(c => ({ chId: c.id, nodeId: firstLoc(c).nodeId, label: chLabel(c), key: c.id }));
  }, [scope]);
  const curKey = scope === 'sub' ? curUnit?.id : scope === 'sec' ? curSec?.id : loc.chId;
  const si = steps.findIndex(s => s.key === curKey);
  const prev = si > 0 ? steps[si - 1] : null;
  const next = si >= 0 && si < steps.length - 1 ? steps[si + 1] : null;

  const crumbs: Crumb[] = [];
  if (scope === 'all') crumbs.push({ label: '전체 Ch7–10', onClick: () => undefined });
  else if (curChapter) {
    crumbs.push({ label: chLabel(curChapter), onClick: () => setScope('ch') });
    if (curSec) crumbs.push({ label: nodeLabel(curSec), onClick: () => setScope('sec') });
    if (curUnit && curUnit !== curSec) crumbs.push({ label: nodeLabel(curUnit), onClick: () => setScope('sub') });
  }

  if (!chapters.length) return <p style={{ padding: 20 }}>content/ch07.md … ch10.md 가 없습니다.</p>;

  const everInScope = sEver;
  const toolbar = (
    <Toolbar
      stats={{ ok: sOk, sp: sSp, no: sNo, left: sLeft, ever: sEver, act: actList.length, total: scoped.length, pct: actList.length ? (sOk / actList.length) * 100 : 0 }}
      roundLabel={roundLabel} hintOn={hint} retryActive={anyRetry} copyLabel={copyLabel}
      onCheck={onCheck} onRetry={onRetry} onHint={() => setHint(h => !h)} onReveal={onReveal}
      onCopy={() => copyList(false)} onReset={onReset} onShowAll={onShowAll} retryDisabled={done || actList.length === 0}
    />
  );
  const doneBox = done ? (
    <div className="done show">
      <b>🎉 {roundLabel}에서 전부 맞음!</b> 한 번이라도 틀린 칸 <b>{everInScope}</b>개 / {scoped.length}
      <div className="btns" style={{ marginTop: 8 }}>
        {everInScope > 0 && <button className="go" onClick={onReview}>↻ 틀렸던 {everInScope}칸만 복습</button>}
        {everInScope > 0 && <button onClick={() => copyList(true)}>틀렸던 칸 목록 복사</button>}
        {anyRetry && <button onClick={onShowAll}>모든 칸 보기</button>}
        <button onClick={onReset}>처음부터</button>
      </div>
    </div>
  ) : null;

  const tabs = [...chapters.map(c => ({ id: c.id, label: chLabel(c), st: tocStat.get(c.id) })), { id: 'all', label: '전체', st: undefined }];
  const activeTab = scope === 'all' ? 'all' : loc.chId;

  return (
    <div className="app">
      <header className="top">
        <button className="menu" aria-label="목차 열기" aria-expanded={drawer} onClick={() => setDrawer(d => !d)}>☰ <span>목차</span></button>
        <div className="brand">셀 2텀 빈칸지도</div>
        <div className="tabs" role="tablist">
          {tabs.map(t => (
            <button key={t.id} role="tab" aria-selected={activeTab === t.id} className={activeTab === t.id ? 'on' : ''} onClick={() => onTab(t.id)}>
              {t.label}
              {t.st && <small>{t.st.total ? Math.round((t.st.ok / t.st.total) * 100) : 0}%</small>}
            </button>
          ))}
        </div>
      </header>
      <div className="layout">
        <aside className={'tocwrap' + (drawer ? ' open' : '')}>
          <Toc chapters={chapters} stat={tocStat} curChId={loc.chId} curNodeId={loc.nodeId}
            activeUnitId={curUnit?.id ?? ''} activeSecId={curSec?.id ?? ''} all={scope === 'all'}
            onPickChapter={pickChapter} onPickNode={pickNode} />
        </aside>
        {drawer && <div className="backdrop" onClick={() => setDrawer(false)} />}
        <Pane roots={roots} scope={scope} onScope={setScope} crumbs={crumbs}
          prevLabel={prev ? prev.label : null} nextLabel={next ? next.label : null}
          onPrev={() => prev && goLoc({ chId: prev.chId, nodeId: prev.nodeId })}
          onNext={() => next && goLoc({ chId: next.chId, nodeId: next.nodeId })}
          states={states} active={active} typing={typing} revealed={revealed} hint={hint}
          chIndex={id => chapters.findIndex(c => c.id === id)}
          onInput={onInput} onCommit={onCommit} onEnter={onEnter}
          toolbar={toolbar} done={doneBox} paneRef={paneRef} />
      </div>
      {resetAsk && (
        <ConfirmModal
          title="처음부터 다시 시작할까요?"
          body={<>
            <p><b>{resetNames}</b>에 입력한 <b>모든 답과 기록</b>이 지워지고 1회차부터 다시 시작합니다.</p>
            <p>한 번이라도 틀린 칸(↻) 표시와 회차 기록도 함께 사라지며, <b>되돌릴 수 없어요.</b></p>
            {hasAnswers && <>
              <label className="namefield" htmlFor="roundname">이 회차의 이름 — 정답·오답 기록을 마크다운(.md) 파일로 저장해요</label>
              <input id="roundname" className="nameinput" value={roundName} maxLength={80} autoComplete="off"
                onChange={e => setRoundName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveRound(); doReset(); } }} />
              <p className="namehint">파일에는 모든 칸의 내 답·정답·결과, 요약, 틀린 칸 복습 목록이 들어갑니다.</p>
            </>}
          </>}
          confirmLabel={hasAnswers ? '.md 저장하고 처음부터' : '모두 지우고 처음부터'}
          confirmTone={hasAnswers ? 'go' : 'danger'}
          secondary={hasAnswers ? { label: '저장 없이 처음부터', onClick: doReset } : undefined}
          onConfirm={() => { if (hasAnswers) saveRound(); doReset(); }}
          onCancel={() => setResetAsk(false)} />
      )}
      {revealAsk !== null && (
        <ConfirmModal
          title="정답을 미리 볼까요?"
          body={<>
            <p>현재 범위에서 아직 못 맞힌 <b>{revealAsk}칸</b>의 정답이 모두 화면에 표시됩니다.</p>
            <p>표시된 칸은 <b>한 번이라도 틀린 칸(↻)</b>으로 기록되어, 나중에 복습 대상에 들어갑니다. 먼저 스스로 떠올려 본 뒤에 보는 게 외우는 데 더 좋아요.</p>
          </>}
          confirmLabel={`정답 ${revealAsk}칸 보기`}
          onConfirm={doReveal}
          onCancel={() => setRevealAsk(null)} />
      )}
    </div>
  );
}
