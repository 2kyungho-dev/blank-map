import { memo } from 'react';
import type { Result } from '../store';

export interface BlankInputProps {
  id: string;
  alts: string[];
  value: string;
  res: Result;
  ever: boolean;
  readOnly: boolean;
  rev: boolean;
  hint: boolean;
  onInput: (id: string, v: string) => void;
  onCommit: (id: string, mark: boolean) => void;
  onEnter: (el: HTMLInputElement) => void;
}

function widthEm(s: string): number {
  let w = 0;
  for (const ch of s) w += /[ᄀ-ᇿ㄰-㆏가-힯一-鿿]/.test(ch) ? 1.05 : 0.62;
  return Math.max(3.4, Math.min(26, w + 1.2));
}

function BlankInputImpl(p: BlankInputProps) {
  const { id, alts, res, rev } = p;
  const cls = ['b', res, p.ever ? 'ever' : '', rev && res !== 'ok' ? 'rev' : ''].filter(Boolean).join(' ');
  let em = '';
  if (res === 'sp') em = '철자: ' + alts[0];
  else if (res === 'no') em = '→ ' + alts[0];
  else if (rev && res !== 'ok') em = '→ ' + alts[0];
  // 폭은 대표 정답(alts[0]) 기준. 더 긴 대체답을 직접 입력하면 입력한 만큼만 늘어난다.
  const sizeBy = p.value.length > alts[0].length ? p.value : alts[0];
  return (
    <span className={cls} data-id={id}>
      <input
        className="bi"
        data-res={res}
        value={p.value}
        readOnly={p.readOnly}
        placeholder={p.hint ? alts[0].slice(0, 1) + '…' : ''}
        style={{ width: widthEm(sizeBy) + 'em' }}
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        aria-label="빈칸"
        onChange={e => p.onInput(id, e.target.value)}
        onBlur={() => p.onCommit(id, false)}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
            e.preventDefault();
            p.onCommit(id, true);
            p.onEnter(e.currentTarget);
          }
        }}
      />
      {p.ever && <span className="ev" title="한 번이라도 틀림">↻</span>}
      {em && <em>{em}</em>}
    </span>
  );
}

export const BlankInput = memo(BlankInputImpl);
