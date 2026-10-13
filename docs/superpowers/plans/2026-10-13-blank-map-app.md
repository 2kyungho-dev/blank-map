# 빈칸지도 앱 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Ch7–10 빈칸지도를 목차 중심의 React 단일 앱(단일 HTML 산출물)으로 만든다.

**Architecture:** 챕터 내용은 `content/chNN.md`(제목 계층 = 목차, 글머리 = 빈칸 줄). 빌드 시 `import.meta.glob(?raw)`로 읽어 `parse.ts`가 트리로 변환, `engine.ts`가 채점, `store.ts`가 챕터별 localStorage 상태, React UI가 목차 트리 + 본문을 렌더.

**Tech Stack:** Vite, React 18, TypeScript, vitest, vite-plugin-singlefile.

**Spec:** `docs/superpowers/specs/2026-10-13-blank-map-app-design.md`

## Global Constraints
- 앱 루트: `/Users/kyungho/Documents/학교/대학교/예과 2학년/2학기/세포분자생물학/1_셀편/빈칸지도_app/` (git 저장소 아님 → 커밋 단계 없음)
- 산출물: `dist/빈칸지도.html` 단일 파일, 외부 CDN/네트워크 의존 금지, 오프라인 동작
- 빈칸 문법 `[[정답|대체1|대체2]]` — 첫 항목이 표시되는 정답
- 채점: 대소문자·공백·하이픈·그리스 문자(α→alpha 등)·`′'’` 무시, 길이 ≥5의 영숫자 정답은 편집거리 1(≥10자는 2)이면 "철자"
- localStorage 키 `blankmap_<chId>` (chId = ch07|ch08|ch09|ch10), 모든 접근 try/catch
- 한국어 UI, 라이트/다크(prefers-color-scheme) 지원, 폭 375px에서 가로 스크롤 없음
- 챕터 색: 기존 팔레트 재사용 (`--c1 #2f6fb3`, `--c2 #b5462f`, `--c3 #6a4fb0`, 4번째 `--c4 #1f8a6c`)

## Content file format (모든 콘텐츠 Task가 따른다)
```
---
id: ch07
title: Ch7 · Replication, Maintenance, and Rearrangements of Genomic DNA
prof: 이규영
lead: 한 줄 설명(시험 일정·범위)
link: 챕터를 묶는 연결고리 한 문단 (HTML 허용: <b>)
---
## 7.1 DNA Replication
> 절 한 줄 질문/요약(선택, 인용문 한 줄)
### 7.1.1 DNA polymerase의 한계
- 새 dNTP는 [[3′-OH|3'oh|3oh]]에만 붙임 {fire:K-1} {src:vault,기출}
- 일반 문장 줄 {star:교수 강조}
#### 7.1.1.a (선택, 소소절)
- ...
```
- `##` = 절, `###` = 소절(필수 리프 단위), `####` = 소소절(선택). 글머리(`- `) 하나 = 한 줄. 빈칸 없는 줄도 허용(맥락용).
- 줄 끝 태그: `{fire:라벨}` 기출 출제, `{star:라벨}` 교수 강조, `{src:vault,야마,기출,PPT}` 근거. 태그는 파서가 제거해 `tags`로 보관.
- 줄 안 HTML은 `<b>`, `<i>`, `<sub>`, `<sup>`만 허용.

## Review Focus
- 정답에 `|`가 들어간 칸/빈 대체답(`[[a||b]]`) → 빈 문자열 대체답은 무시되어 빈 입력이 정답 처리되면 안 됨
- 한 줄에 빈칸 0개인 줄이 있는 소절 → 진행률 0/0이 NaN%로 표시되면 안 됨
- localStorage 비어 있음/예외/손상 JSON → 앱이 빈 상태로 정상 렌더
- 재도전 모드에서 같은 줄의 비활성 칸이 정답으로 채워져 보이고 입력 불가
- 소절 id가 챕터 내에서 유일, 칸 id가 줄 순서 변경에도 소절·줄 번호로 결정적
- 기존 `ch07map_v2` 형식(`{v,ever,round,mode,active}`)에서 가져오기: 칸 id 형식이 달라 매칭 불가 → 가져오기는 "기록 불가, 새로 시작" 안내만 (거짓 이관 금지)

## File Structure
```
빈칸지도_app/
  package.json, vite.config.ts, tsconfig.json, index.html
  src/main.tsx            진입
  src/types.ts            Chapter/Node/Line/Part/Blank 타입
  src/engine.ts           norm, lev, judge  (+ engine.test.ts)
  src/parse.ts            parseChapter(md): Chapter  (+ parse.test.ts)
  src/chapters.ts         content/*.md 로드 → Chapter[]
  src/store.ts            챕터별 상태 load/save, 파생 통계  (+ store.test.ts)
  src/App.tsx             레이아웃, 범위 선택, 상태 연결
  src/components/Toc.tsx  목차 트리 (진행률·오답 점)
  src/components/Pane.tsx 본문(breadcrumb, 이전/다음, 줄 목록)
  src/components/BlankInput.tsx, Toolbar.tsx
  src/styles.css          기존 팔레트 기반
  content/ch07.md ch08.md ch09.md ch10.md
```

---

### Task 1: 스캐폴드 + 타입 + 엔진 + 파서 (TDD)

**Files:** Create `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/types.ts`, `src/engine.ts`, `src/engine.test.ts`, `src/parse.ts`, `src/parse.test.ts`, `content/ch00_sample.md`(테스트 전용 샘플, 이후 삭제하지 않음 — `chapters.ts`는 `ch0[7-9]|ch10`만 로드)

**Interfaces — Produces (후속 Task가 의존, 이름·시그니처 고정):**
```ts
// types.ts
export type Part = { kind: 'text'; html: string } | { kind: 'blank'; id: string; alts: string[] };
export interface Line { id: string; parts: Part[]; fire?: string; star?: string; src: string[]; }
export interface Node { id: string; level: 2|3|4; num: string; title: string; summary?: string; lines: Line[]; children: Node[]; }
export interface Chapter { id: string; title: string; prof: string; lead: string; link: string; nodes: Node[]; }
// engine.ts
export function norm(s: string): string;
export function judge(val: string, alts: string[]): '' | 'ok' | 'sp' | 'no';
// parse.ts
export function parseChapter(md: string): Chapter;
export function blanksOf(n: Node, deep?: boolean): Extract<Part,{kind:'blank'}>[]; // deep=true: 자손 포함
export function allBlanks(c: Chapter): Extract<Part,{kind:'blank'}>[];
```
- 노드 `id`: 챕터 id + 헤딩 경로 인덱스, 예 `ch07.0.1` (0-based). 칸 `id`: `${lineId}.${k}`, 줄 `id`: `${nodeId}:${lineIdx}`. `num`은 제목 맨 앞 `7.1.1` 같은 숫자 토큰(없으면 빈 문자열), `title`은 그 뒤 텍스트.
- 헤딩 바로 아래 `> ` 인용 줄 1개 → `summary`.

- [ ] **Step 1:** `npm create`를 쓰지 말고 파일을 직접 작성: package.json(scripts: dev, build=`tsc --noEmit && vite build`, test=`vitest run`), deps react, react-dom; dev: vite, @vitejs/plugin-react, vite-plugin-singlefile, typescript, vitest, @types/react, @types/react-dom. `vite.config.ts`는 react() + viteSingleFile(), `build.outDir=dist`, rollupOptions input index.html, 출력 후 `dist/index.html`을 `빈칸지도.html`로 복사하는 작은 플러그인(writeBundle) 포함. `npm install`.
- [ ] **Step 2: 실패 테스트** `engine.test.ts`: `judge('3\'-OH',['3′-OH','3oh'])==='ok'`, `judge('PRIMASE',['primase'])==='ok'`, `judge('primse',['primase'])==='sp'`, `judge('xyz',['primase'])==='no'`, `judge('',['a'])===''`, `judge('δ',['δ','delta'])==='ok'`, `judge('ε',['epsilon'])==='ok'`, 빈 대체답 `judge('',['a',''])===''`. `parse.test.ts`: front matter 파싱, `##/###` 트리, 빈칸 id 유일성, `{fire:K-1}` 태그 추출·본문 제거, 빈칸 0개 줄 허용, `> ` summary, num/title 분리, `blanksOf` deep.
- [ ] **Step 3:** `npx vitest run` → FAIL 확인.
- [ ] **Step 4: 구현.** engine은 기존 코드 이식:
```ts
const greek: Record<string,string> = {"α":"alpha","β":"beta","γ":"gamma","δ":"delta","ε":"epsilon","ζ":"zeta","η":"eta","ι":"iota","κ":"kappa","₃":"3","⁶":"6"};
export function norm(s: string) { s=(s||"").toLowerCase().trim(); s=s.replace(/[αβγδεζηικ₃⁶]/g,m=>greek[m]); return s.replace(/[\s\-–—_·.,/()′'’`→>~]/g,""); }
function lev(a:string,b:string){/* Damerau-Levenshtein, 기존 코드와 동일 */}
export function judge(val:string, alts:string[]) {
  const v=norm(val); if(!v) return "";
  const ns=alts.map(norm).filter(Boolean);
  if(ns.includes(v)) return "ok";
  for(const a of ns){ if(/^[a-z0-9]+$/.test(a)&&a.length>=5){ const d=lev(v,a); if(d<=(a.length>=10?2:1)) return "sp"; } }
  return "no";
}
```
  (lev는 기존 HTML의 `lev` 함수를 TypeScript로 옮겨 쓴다.) parse는 줄 단위 상태 기계로 구현(정규식 `/\[\[([^\]]+)\]\]/g`, 태그 `/\{(fire|star|src):([^}]*)\}/g`).
- [ ] **Step 5:** `npx vitest run` → PASS.

---

### Task 2: 상태 저장소 (TDD)

**Files:** Create `src/store.ts`, `src/store.test.ts`

**Interfaces — Consumes:** Task 1 types. **Produces:**
```ts
export interface ChState { v: Record<string,string>; ever: Record<string,1>; round: number; mode: 'all'|'retry'|'review'; active: string[]|null; }
export const emptyState: () => ChState;
export function loadState(chId: string): ChState;      // 예외·손상 시 emptyState
export function saveState(chId: string, s: ChState): void; // 예외 무시
export type Result = '' | 'ok' | 'sp' | 'no';
export function resultOf(s: ChState, b: {id:string; alts:string[]}): Result; // judge(s.v[id], alts)
export function stats(s: ChState, blanks: {id:string; alts:string[]}[]): { total:number; ok:number; sp:number; no:number; empty:number; ever:number; pct:number }; // total=0이면 pct=0
export function activeSet(s: ChState, blanks:{id:string}[]): Set<string>; // mode all → 모두, 그 외 s.active
```
- [ ] 테스트 먼저: 손상 JSON/빈 storage/throwing storage(모킹) → emptyState; `stats` 빈 배열 pct 0; 빈 대체답 처리; round trip.
- [ ] FAIL 확인 → 구현 → PASS. (vitest `environment: 'jsdom'` 추가 필요 시 devDep `jsdom`.)

---

### Task 3: UI (목차 트리 + 본문 + 툴바)

**Files:** Create `src/chapters.ts`, `src/App.tsx`, `src/main.tsx`, `src/components/{Toc,Pane,BlankInput,Toolbar}.tsx`, `src/styles.css`

**Interfaces — Consumes:** Task 1·2 전부. `chapters.ts`: `export const chapters: Chapter[]` (`import.meta.glob('../content/ch{07,08,09,10}.md',{query:'?raw',import:'default',eager:true})`를 파일명 순서로 parse).

동작 요구(전부 구현):
- 레이아웃: 좌측 Toc(≥860px 고정 사이드바 / 이하 햄버거 서랍), 우측 Pane. 최상단 헤더에 챕터 탭(Ch7–Ch10 + "전체").
- Toc: 챕터 → 절 → 소절 트리, 접기/펼치기, 각 항목에 `ok/total` 진행률 바와 오답(no/sp 또는 ever) 빨간 점, 현재 항목 강조(목차 강조형), 소절 클릭 시 해당 소절로 이동.
- 범위 선택 토글: 소절 / 절 / 챕터 / 전체(Ch7–10). 범위 안의 모든 칸이 한 화면 연속 렌더(헤딩 계층 유지, sticky 소제목).
- Pane 상단 breadcrumb(`Ch8 › 8.2 › 8.2.2`), 이전/다음 소절 버튼, 본문 줄: `🔥`/`⭐` 배지(툴팁에 라벨), 근거 `src` 작은 칩.
- BlankInput: Enter → 채점 후 다음 활성·미정답 칸 포커스, blur 채점, 입력 시 상태 초기화·저장, 색 상태(ok/sp/no), `sp`엔 "철자: 정답", `no`엔 "→ 정답", ever 표시 ↻.
- Toolbar(범위 기준): 채점, ▶ 틀린 것만 다시(해당 범위 틀린 칸만 활성화, 같은 줄 다른 칸은 정답 채움·비활성), 첫 글자 힌트, 남은 답 보기, 틀린 것 복사, 처음부터(확인창, 해당 챕터만 초기화), 통계(맞음/철자/틀림/남은 칸/한 번이라도 틀림) + 진행 바, 전부 맞음 시 "↻ 틀렸던 N칸만 복습" 박스.
- 모드/active/round는 챕터별 상태(`ChState`)에 저장. 범위가 여러 챕터인 "전체"에서는 칸마다 소속 챕터 상태를 사용.
- 챕터 `link` 박스를 챕터 본문 맨 아래, `lead`를 챕터 제목 아래에 표시. 다크모드/폰 레이아웃 준수.
- 기존 index.html 파일은 `<div id="root">`만 포함.

- [ ] Step 1: 컴포넌트 구현 (콘텐츠 없이 `content/ch00_sample.md`를 임시로 로드하도록 `chapters.ts`에 `import.meta.env.DEV` 폴백은 두지 말 것 — 대신 Task 4 샘플 콘텐츠 4개 최소본이 생길 때까지 `content/ch07.md` 등에 헤딩 2개+줄 3개짜리 스텁을 만든다. Task 4–7이 덮어쓴다).
- [ ] Step 2: `npm run build` 성공, `dist/빈칸지도.html` 생성 확인 (`ls -la`, 외부 URL 없음: `grep -c "https\?://" dist/빈칸지도.html`은 라이브러리 내부 주석 외 0 근처).
- [ ] Step 3: 브라우저(preview_start/navigate로 file:// 또는 `npx vite preview`)에서 스모크: 목차 클릭 이동, 빈칸 입력→Enter→초록, 틀린 입력→빨강, 새로고침 후 복원, 재도전 모드, 폭 375px 레이아웃. 스크린샷으로 확인하고 문제 수정.

---

### Task 4–7: 콘텐츠 (병렬 가능 — 서로 독립)

각 Task 입력/출력: **Create/Overwrite `content/chNN.md`** (위 Content file format). 공통 지침:
1. 기존 HTML(`~/Downloads/Ch07_빈칸지도.html`, `Ch08`, `Ch09`; Ch10은 없음)의 `DATA` 내용을 **모두 보존**하되 교재 목차(소절) 순서로 재배치. 기존 `<span class='fire'>🔥…</span>` → `{fire:…}`.
2. vault 노트(`Kyungho's Vault/00. Inbox/셀_C{N}_*.md`; Ch10은 `셀_C10_Protein Synthesis, Processing, and Regulation.md`), 야마(`20_세포분자생물학/2. 야마/`의 해당 챕터 PDF, `21_야마_draft/`), 기출(`20_세포분자생물학/3. 역대 기출/` 및 `claude_야마작성/Chapter10_중하_기출_추출본.md`), 강의 PPT(`1. 올해 수업자료/`)와 **대조**해 (a) 빠진 개념·용어·수치·메커니즘 순서를 새 빈칸으로 추가, (b) 틀린 정답 수정, (c) 기출에 나온 자리에 `{fire:연도-번호}`, 교수 강조에 `{star:…}`, 각 줄 근거 `{src:…}`.
3. 대체 정답을 넉넉히(한/영, 약어, 하이픈/공백 변형은 norm이 처리하므로 불필요). 한 줄에 빈칸 1~3개, 한 소절 줄 수 4~12개.
4. 모든 빈칸 정답은 **자료에서 확인된 사실**만. 자료 간 충돌하면 야마·교수 강의 우선하고 `{src:…}`에 충돌을 짧게 메모(줄 끝 HTML 주석 금지).
5. 마무리 검증: `npx vitest run`의 파서 테스트와 별개로 `node`로 `parseChapter`를 돌려(예: `npx tsx -e`) 헤딩 수·줄 수·칸 수를 보고하고 파서 에러가 없는지 확인.

- **Task 4 `content/ch07.md`**: Ch7 이규영 (7.1 Replication, 7.2 DNA Repair, 7.3 Rearrangements). 기존 Ch7 HTML + 노트 `셀_C7_*`.
- **Task 5 `content/ch08.md`**: Ch8 RNA Synthesis and Processing (8.1 Bacteria, 8.2 Eukaryotic pol & GTF, 8.3 Processing: rRNA/tRNA, mRNA cap·polyA, splicing, alternative splicing, RNA editing, degradation). 기존 Ch8 HTML 중 8.x 내용 + 노트 `셀_C8_*`. 교재 목차는 `Chapter_8_9_목차.txt` 참고.
- **Task 6 `content/ch09.md`**: Ch9 Transcriptional Regulation and Epigenetics (9.1 E. coli lac operon, 9.2 진핵 전사인자·실험법·elongation 조절, 9.3 Chromatin·Epigenetics). **주의:** 기존 `Ch08_빈칸지도.html`은 Ch8+Ch9(교재)를 섞어 담고 있으니 lac operon·전사인자·pausing·histone·DNA methylation은 ch09로 옮기고, `Ch09_빈칸지도.html`(Protein Synthesis, 조현주)은 ch10으로 간다. 노트 `셀_C9_*`.
- **Task 7 `content/ch10.md`**: Ch10 Protein Synthesis, Processing, and Regulation (조현주; 10.1 Translation, 10.2 Folding·Chaperone·Misfolding, 10.3 PTM·Degradation). 기존 `Ch09_빈칸지도.html` 내용 전부 + 노트 `셀_C10_*` + `Chapter10_중하_기출_추출본.md` + 야마 Ch10 상/중/하 + 강의 PDF 1008/1012 (v2) 대조·보강.

---

### Task 8: 통합 검증

- [ ] `npx vitest run` 전부 통과
- [ ] `npm run build` 성공, `dist/빈칸지도.html` 단일 파일(외부 요청 0)
- [ ] 브라우저: 4챕터 모두 목차 트리가 교재 계층대로 표시, 빈 소절 없음, 콘솔 에러 0
- [ ] 샘플 풀이 시나리오: 한 소절 풀기 → 일부 오답 → ▶ 재도전 → 전부 정답 → ↻ 복습 → 새로고침 후 상태 복원
- [ ] 칸 수/줄 수/태그(🔥) 수를 챕터별로 보고
