import { describe, it, expect, beforeEach, vi } from 'vitest';
import { emptyState, loadState, saveState, resultOf, stats, activeSet } from './store';

function memStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => { m.set(k, String(v)); },
    removeItem: (k: string) => { m.delete(k); },
    clear: () => m.clear(),
  };
}
beforeEach(() => { vi.unstubAllGlobals(); vi.stubGlobal('localStorage', memStorage()); });

describe('store persistence', () => {
  it('empty storage -> emptyState', () => {
    expect(loadState('ch07')).toEqual(emptyState());
  });
  it('corrupt JSON -> emptyState', () => {
    localStorage.setItem('blankmap_ch07', '{not json');
    expect(loadState('ch07')).toEqual(emptyState());
    localStorage.setItem('blankmap_ch07', '[1,2]');
    expect(loadState('ch07')).toEqual(emptyState());
    localStorage.setItem('blankmap_ch07', JSON.stringify({ v: 5, round: 'x', mode: 'zzz' }));
    expect(loadState('ch07')).toEqual(emptyState());
  });
  it('throwing storage is safe', () => {
    vi.stubGlobal('localStorage', {
      getItem() { throw new Error('x'); },
      setItem() { throw new Error('x'); },
    });
    expect(loadState('ch07')).toEqual(emptyState());
    expect(() => saveState('ch07', emptyState())).not.toThrow();
  });
  it('round trip', () => {
    const s = emptyState();
    s.v['a'] = 'hi'; s.ever['a'] = 1; s.round = 3; s.mode = 'retry'; s.active = ['a'];
    saveState('ch07', s);
    expect(localStorage.getItem('blankmap_ch07')).not.toBeNull();
    expect(loadState('ch07')).toEqual(s);
    expect(loadState('ch08')).toEqual(emptyState());
  });
  it('old ch07map_v2 shape is not imported', () => {
    localStorage.setItem('ch07map_v2', JSON.stringify({ v: { x: 'y' }, ever: {}, round: 2, mode: 'all', active: null }));
    expect(loadState('ch07')).toEqual(emptyState());
  });
});

describe('derived', () => {
  const blanks = [
    { id: 'a', alts: ['alpha1'] },
    { id: 'b', alts: ['beta', ''] },
    { id: 'c', alts: ['gamma'] },
    { id: 'd', alts: ['delta'] },
  ];
  it('resultOf', () => {
    const s = emptyState(); s.v.a = 'alpha1'; s.v.b = ''; s.v.c = 'zzz';
    expect(resultOf(s, blanks[0])).toBe('ok');
    expect(resultOf(s, blanks[1])).toBe('');
    expect(resultOf(s, blanks[2])).toBe('no');
    expect(resultOf(s, blanks[3])).toBe('');
  });
  it('stats', () => {
    const s = emptyState(); s.v.a = 'alpha1'; s.v.b = 'beta'; s.v.c = 'zzz'; s.ever.c = 1;
    const st = stats(s, blanks);
    expect(st).toMatchObject({ total: 4, ok: 2, sp: 0, no: 1, empty: 1, ever: 1 });
    expect(st.pct).toBe(50);
  });
  it('stats of empty list: pct 0, not NaN', () => {
    expect(stats(emptyState(), [])).toEqual({ total: 0, ok: 0, sp: 0, no: 0, empty: 0, ever: 0, pct: 0 });
  });
  it('activeSet', () => {
    const s = emptyState();
    expect(activeSet(s, blanks).size).toBe(4);
    s.mode = 'retry'; s.active = ['a', 'zz'];
    expect([...activeSet(s, blanks)]).toEqual(['a']);
    s.active = null;
    expect(activeSet(s, blanks).size).toBe(0);
  });
});
