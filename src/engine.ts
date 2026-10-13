const greek: Record<string, string> = { "α": "alpha", "β": "beta", "γ": "gamma", "δ": "delta", "ε": "epsilon", "ζ": "zeta", "η": "eta", "ι": "iota", "κ": "kappa", "₃": "3", "⁶": "6" };

export function norm(s: string): string {
  s = (s || "").toLowerCase().trim();
  s = s.replace(/[αβγδεζηικ₃⁶]/g, m => greek[m]);
  return s.replace(/[\s\-–—_·.,/()′'’`→>~]/g, "");
}

// Damerau-Levenshtein (optimal string alignment)
function lev(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let p: number[] = Array.from({ length: n + 1 }, (_, i) => i);
  let pp: number[] | null = null;
  for (let i = 1; i <= m; i++) {
    const c: number[] = [i];
    for (let j = 1; j <= n; j++) {
      c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (pp && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) c[j] = Math.min(c[j], pp[j - 2] + 1);
    }
    pp = p;
    p = c;
  }
  return p[n];
}

export function judge(val: string, alts: string[]): '' | 'ok' | 'sp' | 'no' {
  const v = norm(val);
  if (!v) return "";
  const ns = alts.map(norm).filter(Boolean);
  if (ns.includes(v)) return "ok";
  for (const a of ns) {
    if (/^[a-z0-9]+$/.test(a) && a.length >= 5) {
      const d = lev(v, a);
      if (d <= (a.length >= 10 ? 2 : 1)) return "sp";
    }
  }
  return "no";
}
