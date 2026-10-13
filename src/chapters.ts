import { parseChapter } from './parse';
import type { Chapter } from './types';

const mods = import.meta.glob('../content/ch{07,08,09,10}.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

export const chapters: Chapter[] = Object.keys(mods)
  .sort()
  .map(k => parseChapter(mods[k]));
