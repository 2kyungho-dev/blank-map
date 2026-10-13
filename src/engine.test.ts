import { describe, it, expect } from 'vitest';
import { judge, norm } from './engine';

describe('judge', () => {
  it('ok ignoring prime/case/hyphen', () => {
    expect(judge("3'-OH", ['3′-OH', '3oh'])).toBe('ok');
    expect(judge('PRIMASE', ['primase'])).toBe('ok');
  });
  it('spelling tolerance', () => {
    expect(judge('primse', ['primase'])).toBe('sp');
  });
  it('wrong / empty', () => {
    expect(judge('xyz', ['primase'])).toBe('no');
    expect(judge('', ['a'])).toBe('');
  });
  it('greek', () => {
    expect(judge('δ', ['δ', 'delta'])).toBe('ok');
    expect(judge('ε', ['epsilon'])).toBe('ok');
    expect(norm('α')).toBe('alpha');
  });
  it('empty alt is ignored', () => {
    expect(judge('', ['a', ''])).toBe('');
    expect(judge('x', ['a', ''])).toBe('no');
    expect(judge('  ', ['', 'a'])).toBe('');
  });
});
