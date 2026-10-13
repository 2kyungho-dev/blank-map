export interface ToolbarStats {
  ok: number; sp: number; no: number; left: number; ever: number; act: number; total: number; pct: number;
}
interface Props {
  stats: ToolbarStats;
  roundLabel: string;
  hintOn: boolean;
  retryActive: boolean;
  copyLabel: string;
  onCheck: () => void;
  onRetry: () => void;
  onHint: () => void;
  onReveal: () => void;
  onCopy: () => void;
  onReset: () => void;
  onShowAll: () => void;
  retryDisabled: boolean;
}

export function Toolbar(p: Props) {
  const s = p.stats;
  return (
    <div className="bar">
      <div className="round">{p.roundLabel} <small>· 이번 회차 {s.act}칸 · 범위 전체 {s.total}칸</small></div>
      <div className="btns">
        <button className="pri" onClick={p.onCheck}>채점</button>
        <button className="go" onClick={p.onRetry} disabled={p.retryDisabled}>▶ 틀린 것만 다시</button>
        <button className={p.hintOn ? 'on' : ''} onClick={p.onHint}>첫 글자 힌트</button>
        <button onClick={p.onReveal}>남은 답 보기</button>
        <button onClick={p.onCopy}>{p.copyLabel}</button>
        {p.retryActive && <button onClick={p.onShowAll}>모든 칸 보기</button>}
        <button onClick={p.onReset}>처음부터</button>
      </div>
      <div className="score">
        <span>맞음 <b>{s.ok}</b></span>
        <span>철자 <b>{s.sp}</b></span>
        <span>틀림 <b>{s.no}</b></span>
        <span>남은 칸 <b>{s.left}</b></span>
        <span>한 번이라도 틀림 <b>{s.ever}</b></span>
      </div>
      <div className="prog"><i style={{ width: `${Math.max(0, Math.min(100, s.pct))}%` }} /></div>
    </div>
  );
}
