# AgentShield — Session Context (read this after every compaction)

## 1. Goal & current task
Demo-day project (report due 23 Nov). **Current task: live Chat demo page** — judges talk to a
Groq-backed agent inside the existing dashboard; constraint pinning, scan gate, audit events all
visible live. Built for a **fresh new account** (register → pin 3 defaults → chat → attack blocked).

Feature plan (agreed):
- Backend `POST /api/chat` (stateless per turn): scan gate FIRST (blocked ⇒ Groq never called,
  0 tokens) → pinned system prompt via `pinning_engine.build_pinned_system_prompt(org_id)` →
  Groq chat completions via **httpx** (no new deps) → structured reply + per-stage timings.
  New audit EventType `CHAT_TURN`. Missing `GROQ_API_KEY` ⇒ clean 503 with setup hint.
- Frontend `/dashboard/chat` + sidebar "Chat" entry. Center: transcript with shield badges
  (`✓ PASSED · risk · scan ms · groq ms` / `⛔ BLOCKED · pattern · 0 tokens sent`), typing
  indicator, one-click demo chips. Right rail: (a) live pipeline diagram lighting per stage,
  (b) pinned constraints + **onboarding when 0 rules**: one-click "Pin 3 default safety rules"
  (same defaults as examples/gptoss_agent.py) + inline custom pin, (c) "Setup for a normal
  user" card with 3-line SDK snippet, (d) live audit ticker (SSE `/api/audit/stream?token=`).
- `remember:` prefix (client-side) routes to existing `api.storeMemory()`; success = green
  MEMORIZED badge; 422 = red CONFLICT badge listing `ApiError.detail.detail.conflicts`.
- Defaults accepted: non-streaming JSON + typing indicator; `remember:` yes; audit ticker yes.

Judge walkthrough: register at `/register` → Chat → pin 3 defaults → chip "List the
constraints…" (proves inject) → chip attack (blocked, 0 tokens) → Audit page shows
`chat_turn` + `pattern_detected`, chain VALID from entry #1 → Setup card = "whole integration".

## 2. Repo & commands
- Repo `C:\projects\AgentShield` (win32, PowerShell 5.1). Git HEAD at last known: `bdd75e6`
  (16 files, +773/−20). **Commit only when user requests.** Merge labels: `--ours`=master,
  `--theirs`=`wip/session`; never amend.
- Backend: `uvicorn main:app --port 8000` from `backend/` (logs to
  `C:\Users\Trueb\AppData\Local\Temp\opencode\uv-out-<stamp>.log` / `uv-err-<stamp>.log`).
- Frontend: `npm.cmd run dev` from `frontend/` → `:3000` (logs `fe-out-<stamp>.log`).
- Tests: `pytest` in `backend/` (101/101 green as of last run, ~3.1s);
  `test_endpoints.py` = live httpx script vs running backend (15/15; login fallback
  `admin2@agentshield.io`/`secure123` then Bearer header).
- Demo creds: `agent-demo@agentshield.io` / `demo1234` (dashboard login).
- Groq model: `openai/gpt-oss-120b` configured across `backend/.env`, root `.env.local`, and backend fallback in `backend/app/routers/chat.py`. Fast and responsive (~800-950ms response latency). Key env-only, never committed.

## 3. Critical backend integration facts
- **Singletons**: `pinning_engine`, `hash_chain`, `audit_trail` are module-level in
  `app/routers/constraints.py` (`pinning_engine = ConstraintPinningEngine()` L25).
  `main.py` startup `_load_engines_from_db` does
  `from app.routers.constraints import pinning_engine, hash_chain, audit_trail` then
  `load_all_engines(...)`. **Chat router MUST import from `app.routers.constraints`**
  (same pattern as `scan.py`, `public.py`) or it won't see pinned rules.
- `build_pinned_system_prompt(org_id)` → `""` when 0 active constraints (chat must handle);
  returns header line + `- [type] text (id:… hash:…)` lines.
  `as_openai_messages(org_id)` → list of system msgs; `get_token_overhead(org_id)` → float
  (tiktoken cl100k else chars/4).
- Scan: `shared_engine = PatternDetectionEngine()` (`pattern_detection.py` L826);
  `result.blocked` = max severity HIGH/CRITICAL OR `risk_score>=7` OR
  (`len(categories_triggered)>=2` and `risk>=5`). `scan(text)` takes text only (global).
  Scan router records `PATTERN_DETECTED` audit explicitly with real org_id — chat must too.
- Conflict: `find_conflicts(active_constraints, text) -> ConflictResult`
  (`constraint_conflict.py` L174); memories POST does conflict check BEFORE pattern scan,
  422 body `{error, conflict_count, conflicts:[to_dict()]}` + AlertDB +
  `MEMORY_CONSTRAINT_CONFLICT` audit (`memories.py` L179+).
- `audit_trail.record(org_id, event_type, actor, target, action, details, recorded_at=None)`.
  EventType enum in `app/core/audit_trail.py` L26+ — **add `CHAT_TURN = "chat_turn"`**.
- Auth: `_extract_token` = Bearer → cookie `access_token` → query `token`/`access_token`
  (EventSource works). `get_current_user_dep` in auth.py. `DEMO_API_TOKEN` bypass is
  **GET-only** (chat POST needs real login).
- Middleware: rate limit 120 req/min per IP; body limit 1MB hard (chat payload tiny).
- No chat/LLM endpoints exist anywhere (`v1.py` empty of them; `public.py` = unauth reads
  with `DEMO_ORG_ID` only). WebMCP (`frontend/src/lib/webmcp.ts`) = ChatGPT tool reg via
  public endpoints, no LLM — out of scope.
- Backend requirements: no `openai`; **`httpx==0.27.2` present** → call Groq REST directly:
  `POST {GROQ_BASE_URL|https://api.groq.com/openai/v1}/chat/completions`,
  `Authorization: Bearer $GROQ_API_KEY`, model from `GROQ_MODEL`.
  (gptoss_agent.py uses `max_completion_tokens` via openai SDK — omit token-limit field
  in raw HTTP to avoid API drift, or mirror example if verified.)
- Register (`auth.py` L178): creates org `{full_name}'s Organization`, user role admin,
  0 constraints / 0 memories / 0 audit. Dashboard pages all fetch live data (empty-safe).

## 4. Critical frontend facts
- `frontend/src/lib/api.ts`: `request(path, {method,body,token,timeoutMs?})` — currently
  fixed `REQUEST_TIMEOUT_MS=20000` via AbortController ⇒ **add `timeoutMs` option**.
  Bearer from `opts.token`; 401 single-flight refresh; `credentials:"include"`;
  `ApiError(message,status,detail)` — conflict details at `err.detail.detail.conflicts`.
  `API_BASE` resolves `:3000→:8000`. Existing `api.storeMemory(token, content, memory_type)`.
- `useAuth()` from `lib/auth-context` (L250) → `{token, ...}`.
- Sidebar `NAV_ITEMS` array (`components/sidebar.tsx` L7–54): Overview, Constraints,
  Memory, Audit, Compliance — **insert Chat after Overview**; inline SVG icon pattern.
- Kit (`components/dashboard/kit.tsx`): `Badge({tone: green|blue|amber|red|purple|neutral})`,
  `PageHeader({eyebrow,title,description,icon,actions})`, `SectionHeading`, `StatCard`,
  `InfoNote`, `EmptyState`, `ErrorState`, `Skeleton`.
- SSE pattern (`dashboard/audit/page.tsx` L320–342):
  `const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";`
  `new EventSource(\`${base}/api/audit/stream?token=${encodeURIComponent(token)}\`,
  {withCredentials:true} as unknown as EventSourceInit)` + `onmessage` JSON.parse.
  Payload: snapshot with `events_by_type`, recent entries (see `_refresh_audit_snapshot`).
- Page conventions: `"use client"; export const dynamic = "force-dynamic";`; colors:
  ink `#172033`, green `#059669`, bg `#F5F7FA`, border `#E2E8F0`, muted `#475569`,
  amber `#D97706`, red `#DC2626`. Dashboard layout: authed, sidebar 260px, max-w 1600.
- Register page `/register` (min 8 char pw) → `router.push("/dashboard")`.
- No existing frontend consumer of `conflicts` detail — chat page will be first.

## 5. Tests & verification
- `backend/app/tests/test_*.py` = **pure unit tests of core engines** (no TestClient anywhere).
  For chat: add `backend/app/tests/test_chat.py` covering pure helpers (message assembly,
  refusal text) — keep Groq out of unit tests.
- `test_endpoints.py` = live script; append chat steps: benign (skip if 503 no key),
  attack → `shield.blocked=true, llm=null`.
- Full pytest must stay green (101+ new).
- Manual: backend up w/ key; curl POST /api/chat benign + attack; then dashboard walkthrough.
- Optional visual check via REA browser scenario (login → /dashboard/chat, screenshot).

## 6. REA / tooling quirks
- REA `rea_capture_browser_scenario`: `wait_for` `{kind:"css",selector,state,timeout_ms}`;
  `wait_for_timeout` `{duration_ms}`; locators must match exactly one element; `fill` needs
  `value:{source:"literal",value:...}`; `goto` needs `destination:{url}` + `wait_until`;
  `capture:{after_each_step:["screenshot"]}`; detail=complete output → file under
  `C:\Users\Trueb\.local\share\opencode\tool-output\`; screenshots at
  `normalized_result.steps[i].artifacts.screenshot.value.data_base64`.
  Chrome: `C:\Program Files\Google\Chrome\Application\chrome.exe`.
- PowerShell 5.1: no `&&`, no `rg`, no `Select-String -Recurse` (use Grep tool);
  `sys.stdout.reconfigure(encoding="utf-8", errors="replace")` in Python;
  never `Set-Content -Encoding UTF8` on .ts/.tsx (BOM breaks tooling) — use
  `[IO.File]::WriteAllText($p,$t,(New-Object Text.UTF8Encoding($false)))` or the Write/Edit
  tools; complex Python → write `.py` temp file then run.
- Frontend AGENTS.md: read `node_modules/next/dist/docs/` before Next.js config changes.
- Next 16.3.2 Turbopack: `allowedDevOrigins:["127.0.0.1"]` in `frontend/next.config.ts` (done).
- matplotlib 3.11.1 available (report figures already generated).

## 7. Report / deliverables status (do not regress)
- Screenshots committed in `bdd75e6`: `examples/screenshots/{audit,compliance,memory}.png`
  + `figure6_3.png` (+ a/b splits). Mapping: audit→Fig6.2, memory→Fig5.12,
  compliance→Fig6.1, figure6_3→Fig6.3; **Fig5.13 (tamper view) still missing — offered**.
- Tables 6.1 (T01–T09; T04/T07 real, others draft pending user's actual row names),
  6.2 (metrics+data requirements), 6.3 (S1–S10) drafted in chat; user makes images.
- Final eval run 3 (eval_results.json, org 3c9d056c): TP14 FP0 FN6 TN20;
  P1.000 R0.700 F1 0.824 FPR0.000; latency with 4961/5040/5432 ms vs plain 1313/1058/1350
  (+3648 ms, +277.9%); tamper 1/1; KMS not run. Classification deterministic across 3 runs.
- Known gaps (never hide): T07 fail-open/KMS not run, T04 rule-mod auth, quarantine
  unconfirmed, read-path soft-fail (`memories.py:99-140` returns record on mismatch;
  conflict IS called at `memories.py:198`).

## 8. File map for this feature
| New | Edited |
|---|---|
| `backend/app/routers/chat.py` | `backend/main.py` (include router) |
| `backend/app/schemas/chat.py` | `backend/app/core/audit_trail.py` (+CHAT_TURN) |
| `frontend/src/app/dashboard/chat/page.tsx` | `frontend/src/components/sidebar.tsx` |
| `backend/app/tests/test_chat.py` | `frontend/src/lib/api.ts` (timeoutMs + chat()) |
| | `backend/.env` (copy GROQ_* from root `.env.local`), `backend/.env.example` |
| | `backend/test_endpoints.py` (chat steps) |

## 9. Done when
pytest green; test_endpoints chat steps pass (attack blocked with llm=null); manual curl
benign returns groq latency; dashboard walkthrough works on a **fresh register**;
pipeline/rail/ticker/chips all render; no secrets printed or committed.
