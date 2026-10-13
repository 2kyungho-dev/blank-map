export type Part = { kind: 'text'; html: string } | { kind: 'blank'; id: string; alts: string[] };
export interface Line { id: string; parts: Part[]; fire?: string; star?: string; src: string[]; }
export interface Node { id: string; level: 2|3|4; num: string; title: string; summary?: string; lines: Line[]; children: Node[]; }
export interface Chapter { id: string; title: string; prof: string; lead: string; link: string; nodes: Node[]; }
