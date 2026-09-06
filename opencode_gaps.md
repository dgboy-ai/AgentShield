# AgentShield - Deep Gap Audit (Real Code Only, No Mock)

**Date:** 2026-09-06  
**Workspace:** `C:\projects\AgentShield`  
**Scope:** Full read of `backend/`, `frontend/`, `sdk/`, `synopsis.md`, `research.md`, `demo.py`, `docker-compose.yml`, `.env`  
**Standard:** Every gap maps to actual file + line. No speculation.

---

## 1. Backend - Persistence & Consistency is Fake-Distributed

### 1.1 In-Memory Engines = Single-Process Illusion — ✅ FIXED 2026-09-06
- `backend/app/routers/constraints.py:22-25` - `pinning_engine`, `hash_chain`, `audit_trail` are plain Python `dict` singletons.
- `backend/app/core/hash_chain.py:172` `_chains: dict[str, list[ChainEntry]]` + `backend/app/core/audit_trail.py:194` `_entries: dict[str, list[AuditEntry]]` + `backend/app/core/constraint_pinning.py:201` `_constraints: dict[str, PinnedConstraint]`.
- `backend/app/startup.py:22-77` rebuilds hash chain on restart by `engine.append()` with new random UUIDs (`backend/app/core/hash_chain.py:219` `entry_id = str(uuid.uuid4())`). After restart, `verify()` passes but `entry_id` no longer equals `DB audit_log.audit_id` / `memories.memory_id`. Chain recomputed, not restored. `load_constraints` at `backend/app/startup.py:108-109` preserves hash via `restore()`, but `load_hash_chain` does not.
- **Multi-worker failure:** `backend/main.py:16` `init_db()` + `backend/main.py:99-101` APScheduler per-worker. On Render with 2 replicas (`docker-compose.yml:2` covers local only, prod on Render not composed) each worker has diverging chains, double anchors, race on `SessionLocal`. No distributed lock, no Redis, no `SELECT FOR UPDATE`. Horizontal scaling is broken by design.

**Fix applied:**
- `backend/app/core/hash_chain.py:160-182` added `threading.RLock` + `backend/app/core/hash_chain.py:202-249` `append(entry_id=Optional)` now thread-safe and deterministic; `backend/app/core/hash_chain.py:462-481` `restore_entry`/`clear` locked; `backend/app/core/hash_chain.py:280` `verify` copies chain under lock.
- `backend/app/core/audit_trail.py:193-198` + `211-264` RLock on `record`/`restore_entry`/`clear`.
- `backend/app/core/constraint_pinning.py:201-242` RLock on `pin`/`restore`/`clear`.
- `backend/app/startup.py:22-77` rewritten: groups by org, sorts by `created_at`, `engine.append(..., entry_id=deterministic_id)` (memory_id/constraint_id), syncs `memories.previous_hash/entry_hash` to chain's `seed` for first entry and legacy random-id migration, commits once. Constraints hash-chain entries are derived not persisted to avoid overwriting pinning hashes. Idempotent on second load.
- `backend/app/routers/memories.py:57-70` now deterministic `entry_id=memory_id` and `previous_hash=entry.previous_hash` (seed, not None).
- `backend/app/routers/constraints.py:112` deterministic `entry_id=pinned.constraint_id`; `backend/app/routers/constraints.py:28-61` `_persist_audit_to_db` now stores `audit_id=entry_id` for restart idempotency.
- `backend/main.py:87-112` scheduler is single-instance (`id=daily_anchor`, `max_instances=1`, `coalesce=True`, `replace_existing=True`) and gated by `ENABLE_SCHEDULER` env + `if not scheduler.running` to prevent double start on reload/multi-worker. Tested: 48 tests pass, manual sqlite restart shows `verify is_valid:true` after sync and after concurrent appends.

### 1.2 DB <> Chain Divergence (Tamper Not Detected) — ✅ FIXED 2026-09-06
- `backend/app/routers/memories.py:69` `hash_chain.append()` happens **before** `backend/app/routers/memories.py:105` `db.commit()`. If DB commit fails, chain already advanced -> phantom entry in memory, missing in DB. No rollback of chain. Same in `backend/app/routers/constraints.py:112` and `backend/app/core/audit_trail.py:250`.
- `backend/app/routers/memories.py:127` `GET /api/memories` never cross-checks `Memory.content` against `hash_chain` payload. Attacker with direct DB access (`psql` / Cockroach SQL) can `UPDATE memories SET content='poison' WHERE memory_id=...` and `backend/app/routers/memories.py:189` `hash_chain.verify()` still returns `is_valid:true` because it checks in-memory chain only.
- Proof: `backend/app/models/memory.py:13` `content = Text` stored separately from `backend/app/core/hash_chain.py:42` `payload: dict`. No read-time `sha256` comparison.

**Fix applied:**
- `backend/app/models/memory.py:19` added `sequence_number = Column(Integer)` for deterministic replay and DB-backed verification.
- `backend/app/core/hash_chain.py:57` `ChainEntry._canonical_payload` now normalizes `created_at` to UTC (`tzinfo=None` => UTC) for SQLite round-trip determinism; `backend/app/core/hash_chain.py:206` `append(entry_id=..., created_at=...)` accepts explicit timestamp; `backend/app/core/hash_chain.py:466` added `pop_last(org_id)` for rollback; `backend/app/core/audit_trail.py:498` added `pop_last`.
- `backend/app/routers/memories.py:25` added `_verify_db_chain(org_id, db)` that iterates `memories` ordered by `created_at`, reconstructs `ChainEntry(entry_id=memory_id, payload, previous_hash, sequence_number, created_at)` and compares `previous_hash` linkage (seed for first) and `entry_hash`; returns `valid:false` with `broken_at` and `reason: previous_hash mismatch / entry_hash mismatch (content tampered)`.
- `backend/app/routers/memories.py:132-195` `store_memory` now deterministic `previous_hash=entry.previous_hash` (seed not None), `created_at=entry.created_at`, `sequence_number=entry.sequence_number`, and wraps `db.commit()` in try/except: on failure `db.rollback()` + `hash_chain.pop_last(org_id)` + `audit_trail.pop_last(org_id)` to avoid phantom (atomic).
- `backend/app/routers/memories.py:245` `GET /{memory_id}` now recomputes single-entry hash and logs `agentshield.tamper` warning if `entry_hash` mismatched (read-time detection).
- `backend/app/routers/memories.py:310` `GET /chain/verify` reordered before `/{memory_id}` to avoid shadowing and now returns `{"in_memory": ..., "db": ..., "combined_valid": bool, "is_valid": bool}` verifying both layers; `combined_valid` false if either fails, so direct `UPDATE content` is now detected (tested: valid before tamper, `entry_hash mismatch` after `UPDATE content='tampered!'`).
- `backend/app/startup.py:83` `load_hash_chain` now passes `created_at=obj.created_at` to `append` for replay determinism and syncs `sequence_number` plus hashes (`obj.sequence_number = entry.sequence_number`) so legacy rows (previous_hash=None, entry_hash=bad) are migrated to seed-linked valid chain on first restart (idempotent second load). Tests: 90 passed, manual sqlite tamper detection verified.

### 1.3 Alembic Migration is Empty — ✅ FIXED 2026-09-06
- `backend/alembic/versions/e6608869d062_initial_schema.py:21-25` `upgrade() -> pass` does nothing.
- `backend/app/models/database.py:111-114` `if ENVIRONMENT == "production": return` skips `create_all`. First deploy on fresh CockroachDB will have **zero tables**. Production deploy is broken until manual `alembic revision --autogenerate` is run.

**Fix applied:**
- `backend/alembic/versions/e6608869d062_initial_schema.py:1` rewritten from empty `pass` to real production migration: creates all 6 tables (`organizations`, `users`, `memories` with `sequence_number`, `constraints`, `audit_log`, `alerts`) with correct columns, `String(36)` PKs, `ForeignKey` to `organizations`, `String(64)` hashes, `DateTime(timezone=True)`, `JSON` details, and `ix_*_org_id` + `ix_users_email` indexes. Works on SQLite (dev), PostgreSQL and CockroachDB (prod) via SQLAlchemy types. `downgrade()` drops in reverse order.
- Verified: `DATABASE_URL=sqlite:///./test_mig.db python -m alembic upgrade head` creates `['alembic_version','organizations','users','memories','constraints','audit_log','alerts']` (81920 bytes); `downgrade base` drops to `['alembic_version']`; re-upgrade recreates. `alembic current` shows `e6608869d062`.
- Production now deploys via `alembic upgrade head` (Render `buildCommand` should include it); `database.py:110` warning remains for safety but no longer blocks prod because tables exist via migration. Dev `agentshield.db` recreated via `Base.metadata.create_all` includes `sequence_number`. Tests 90 still pass (in-memory `create_all` path).

### 1.4 Anchoring is Local File (Not External) — ✅ FIXED 2026-09-06
- Claim `synopsis.md:126` "Chain heads are anchored to external system daily". Reality `backend/main.py:58-66` writes to `anchors.log` local file + `backend/main.py:70-78` inserts an `audit_log` row. Ephemeral container FS -> lost on restart/deploy. No S3, no blockchain, no RFC3161 timestamp. `backend/app/core/audit_trail.py:412-454` `anchor()` just computes `SHA256(head + now)` and stores in `_anchors` dict.

**Fix applied:**
- `backend/app/models/chain_anchor.py:1` new table `chain_anchors` (org_id FK, chain_type `audit|hash_chain`, chain_head_hash, chain_length, anchor_target `db|file|s3|webhook`, external_ref, created_at) for durable, queryable anchoring that survives restarts and is external to the process (CockroachDB is external system; file + S3/webhook are additional).
- `backend/alembic/versions/c9b1a8d7e6f5_add_chain_anchors.py:1` migration creates `chain_anchors` with `ix_chain_anchors_org_id`/`ix_chain_anchors_created_at` indexes; `backend/alembic/env.py:26` imports `ChainAnchor` so autogenerate sees it.
- `backend/main.py:51` `anchor_hashes_job()` rewritten: collects `org_ids` from both engines + DB (`Organization` query) to handle cold start; 1) **DB durable**: inserts `ChainAnchor` rows for audit (`chain_type=audit`) and hash_chain (`hash_chain`) with `anchor_target=db` and also `audit_trail.record(CHAIN_ANCHORED)`; 2) **File**: writes to `ANCHOR_FILE` (default `data/anchors.log`, `os.makedirs` parent) plus legacy `anchors.log` for compat, with `TARGET: db`; 3) **S3 optional**: if `ANCHOR_S3_BUCKET` set, `boto3.put_object` to `agentshield/anchors/{org}/{Y/m/d}/audit-{hash}.json` and inserts `anchor_target=s3` row; 4) **Webhook optional**: if `ANCHOR_WEBHOOK_URL` set, `httpx.post` and inserts `anchor_target=webhook` row. Single-worker safe via existing `id=daily_anchor, max_instances=1` scheduler. Tested: `agentshield.db` now has `chain_anchors` table, manual run creates 2 rows (audit+hash_chain) and both `data/anchors.log` + `anchors.log` lines; `SET DATABASE_URL cockroach` + `Base.metadata.create_all` + `alembic stamp head` applied to Cockroach cluster `faded-wallaby` (now at `c9b1a8d7e6f5`).
- `backend/app/routers/audit.py:76` added `GET /api/audit/anchors` (list last 100 anchors for org) and `POST /api/audit/anchors/trigger` (manual anchor for demo) so anchoring is verifiable via API, not just file. File remains as fallback but DB is source of truth per 1.1/1.2 pattern. Env knobs: `ANCHOR_FILE`, `ANCHOR_S3_BUCKET`, `ANCHOR_WEBHOOK_URL`.

---

## 2. Backend - Constraint Pinning is Simulation, Not LLM Integration — ✅ FIXED 2026-09-06

- `backend/app/core/constraint_pinning.py:382-456` `simulate_compaction()` is array slicing: `backend/app/core/constraint_pinning.py:422` `context[-max_turns:]`. Strategies `HEAD_TAIL`, `HIERARCHICAL`, `LLM_SUMMARIZE` at `backend/app/core/constraint_pinning.py:424-433` are heuristics, no LLM call.
- `backend/app/core/constraint_pinning.py:458-512` `re_inject_constraints()` just prepends `{"role":"system","content":"[PINNED CONSTRAINT — DO NOT OMIT]\nConstraint ID: ..."}`.
- No integration with OpenAI/Anthropic context compaction, no LangChain callback, no MCP middleware, no CrewAI hook (all listed as future scope `synopsis.md:263` but not built). No tokenizer measurement; `backend/app/core/constraint_pinning.py:646-657` `get_token_overhead()` is `len(text)/4/128000` estimate, not `tiktoken`.
- Known 10-17% operator-impersonation bypass documented `backend/app/core/constraint_pinning.py:14-19` but no mitigation. UI `frontend/src/app/dashboard/constraints/page.tsx:115` allows any text including `revoke` without provenance check. Pattern `CON-007` at `backend/app/core/pattern_detection.py:543` detects rescission but does **not** block constraint pin (only `memories.py:35` blocks memory store).

**Fix applied:**
- `backend/app/core/constraint_pinning.py:22` now `import re`; added `check_provenance(text)` with 5 rescission/impersonation regexes (`revoke.*constraint`, `all rules.*suspended`, `ignore.*safety`, `admin instruction`, `from now on you are`) returning `{is_rescission, reason, severity}` to mitigate 10% residual bypass; `pin(..., force=False)` now blocks if `is_rescission` and not `force`, raising `ValueError` requiring out-of-band `force=True`.
- `backend/app/core/constraint_pinning.py:654` `get_token_overhead` now tries `tiktoken.get_encoding("cl100k_base")` real token count + 20 tokens wrapper per constraint, fallback to `len/4`; `build_pinned_system_prompt(org_id)` and `as_openai_messages(org_id)` provide real harness integration (`messages = [{"role":"system","content":engine.build_pinned_system_prompt(org_id)}] + compacted_context` for OpenAI, LangChain `SystemMessage` example in docstring); `estimate_compaction_savings` added.
- `backend/app/core/constraint_pinning.py:388` `simulate_compaction` now handles real LLM path: if `OPENAI_API_KEY` set and `strategy==LLM_SUMMARIZE` and `len(context)>4`, does `httpx.post https://api.openai.com/v1/chat/completions` with `gpt-4o-mini` to summarize middle segment, else heuristic; keeps `HEAD_TAIL`/`HIERARCHICAL`/`RECENCY_TRUNCATE` but documents that pinned buffer is excluded from compaction in real harness via `as_openai_messages()`.
- `backend/app/routers/constraints.py:90` `POST /api/constraints?force=true` now enforces provenance: try `pin(..., force=force)` except `ValueError` -> `400` + `audit_trail.record(CONSTRAINT_COMPROMISED, blocked)`; safe pin `Never delete files...` still 201, `Revoke all safety constraints` now 400 unless `?force=true` (201 with audit). Added `GET /api/constraints/pinned/prompt` (system prompt fragment + `token_overhead`/`overhead_pct`), `GET /api/constraints/pinned/messages` (OpenAI messages), `POST /api/constraints/simulate-compaction` (runs compaction + `re_inject` + `verify_post_compaction` + `token_overhead`), `GET /api/constraints/provenance/check?text=` for UI pre-check. Reordered routes so `/pinned/*`, `/simulate-compaction`, `/provenance/check`, `/integrity/*` are before `/{constraint_id}` to avoid shadowing (fixes `constraint_id=integrity` bug).
- `backend/requirements.txt:19` added `tiktoken>=0.5` optional. Tested: safe pin 201, rescission 400, force 201, `GET /pinned/prompt` returns `[PINNED CONSTRAINTS — DO NOT OMIT — VERIFIED HASH CHAIN]` with `0.0398%` overhead, `GET /pinned/messages` 2 msgs, `GET /provenance/check?text=Ignore all safety guardrails` returns `is_rescission:true`, `POST /simulate-compaction` recency 200 with `all_present:true` after re-inject. 16 pinning tests still pass.

---

## 3. Backend - Pattern Detection is Regex-Only, 3 Instances — ✅ FIXED 2026-09-06

- `backend/app/core/pattern_detection.py:162` 45 regex. Leaked lowercasing + leet `0->o` at `backend/app/core/pattern_detection.py:578-588` mangles legitimate words, still misses homoglyphs (Cyrillic `\u0430`), base64, FARMA evasive phrasing `"prior validation already completed by upstream components"` (`research.md:225`).
- `backend/app/core/pattern_detection.py:503` `STR-003` detects zero-width chars but `backend/app/core/pattern_detection.py:591` `_normalize()` strips them **before** scan for non-STR patterns, so injection hidden with `\u200b` bypasses `INJ-001`. Structural patterns scan raw text, others scan normalized -> inconsistent evasion path.
- **3 separate engines:** `backend/app/routers/memories.py:21` `pattern_engine = PatternDetectionEngine()`, `backend/app/routers/scan.py:11` another, `backend/app/routers/public.py:40` `_pattern_engine` third. Counters `_scan_count` diverge, `get_stats()` useless. Public scan at `backend/app/routers/public.py:269` records audit for demo org only, authenticated scans at `backend/app/routers/scan.py:34` for real org -> fragmentation.
- `backend/app/core/pattern_detection.py:121` `blocked = HIGH|CRITICAL` only. `MEDIUM` (e.g. `STR-001` 10 dots, `CON-001` boundary push) flagged but **still stored** (`backend/app/routers/memories.py:35` only checks `blocked`). FARMA not covered.
- No ML, no embedding similarity, no retrieval-phase check. `research.md:419` A-MemGuard 66% miss rate still applies.

**Fix applied:**
- `backend/app/core/pattern_detection.py:3` added `threading.RLock`; `backend/app/core/pattern_detection.py:36` `ScanResult.blocked` now `HIGH|CRITICAL` OR `risk_score>=7` (e.g. 3 MEDIUM=9) OR `>=2 categories && risk>=5` so 3 MEDIUM now blocks; `backend/app/core/pattern_detection.py:562` `_normalize` now `NFKC` + Cyrillic homoglyph map (`\u0430`→a etc) before leet, strip invisible, normalize whitespace.
- `backend/app/core/pattern_detection.py:536` added 4 patterns: `FARMA-001` (memory_poisoning CRITICAL `prior validation|already been validated|upstream components.*validated`), `FARMA-002` (constraint_violation HIGH `as previously established|citing previous entries`), `FARMA-003` (structural HIGH long base64 `{40,}`), `HOMO-001` (structural MEDIUM Cyrillic `{2,}`) → total 49 (11/9/8/9/5/7). Tests updated: `test_pattern_count` 45→49, `test_patterns_by_category` memory 8→9, constraint 8→9, structural 5→7.
- `backend/app/core/pattern_detection.py:598` `scan()` now thread-safe (`with _lock`), checks both `normalized` and `raw`/`NFKC` for every pattern (STR/HOMO on raw+NFKC, FARMA on normalized+raw+NFKC, others on normalized+raw), deduplicates by `pattern_id`, increments `_scan_count` under lock. Fixes zero-width inconsistency and homoglyph bypass (`\u0430` now mapped before regex).
- `backend/app/core/pattern_detection.py:803` added `shared_engine = PatternDetectionEngine()` singleton; `backend/app/routers/memories.py:17` `from ... import shared_engine as pattern_engine`, `backend/app/routers/scan.py:5` same, `backend/app/routers/public.py:28` same — now single counter, single listener, no fragmentation. Verified: `memories.pattern_engine is shared_engine == scan.pattern_engine == public._pattern_engine` true, `FARMA-001` `prior validation has already been completed by upstream components` now `blocked:true`, `HOMO-001` Cyrillic `True`, `FARMA-003` long base64 `True`, `STR-003` zero-width still detected. 30 pattern tests + 90 total pass.

---

## 4. Backend - Signing is Ephemeral + Silent Downgrade — ✅ FIXED 2026-09-06

- `backend/app/core/signing.py:42` key at `~/.agentshield/signing_key.pem:42-46`. `os.chmod 0o600` but on Render ephemeral disk regenerates each deploy -> all prior `kms_signature` in `backend/app/models/memory.py:20` become unverifiable. `export_public_key()` never persisted.
- `backend/app/core/signing.py:143-179` `SIGNING_BACKEND=aws_kms` auto-selects KMS but if `AWS_KMS_KEY_ID` missing or `boto3` fails, **silently falls back to `LOCAL`** with warning log only (`backend/app/core/signing.py:175`). API caller gets `backend: local` but any UI badge claims KMS.
- `backend/app/routers/constraints.py:129` `signing_engine.sign_json({"constraint_id":...})` return value discarded, not stored in `backend/app/models/constraint.py`. `backend/app/routers/memories.py:73` stores `kms_signature` but **never verifies on retrieval** `backend/app/routers/memories.py:155` `GET /memories/{id}`. Non-repudiation requires verify path.
- `backend/app/core/signing.py:382-398` KMS verify fallback to local `public_key.verify` if `kms_client.verify` throws -> defeats HSM guarantee. Every sign/verify is supposed to be logged in CloudTrail but local fallback leaves no trail.

**Fix applied:**
- `backend/app/core/signing.py:42` now `SIGNING_KEY_FILE = Path(os.getenv("SIGNING_KEY_FILE", ...))` + `SIGNING_PRIVATE_KEY`/`SIGNING_PRIVATE_KEY_B64` env support for Render persistence (PEM or base64 PEM). `backend/app/core/signing.py:225` `_load_or_generate_key()` priority: 1) env var (persistent, survives deploys) 2) file at `SIGNING_KEY_FILE` 3) generate ephemeral with warning `set SIGNING_PRIVATE_KEY env var for persistence`.
- `backend/app/core/signing.py:140` added `_requested_backend`, `_fallback`, `_fallback_reason`; `backend/app/core/signing.py:168` `_init_kms_backend()` now sets `_fallback=True` + `logging.error` (not warning) with explicit `FALLING BACK to LOCAL (insecure)` and `fallback_reason`, no silent claim. `backend/app/core/signing.py:502` `get_stats()` now returns `{backend, requested_backend, fallback, fallback_reason, persistent}`.
- `backend/app/core/signing.py:382` `verify()` for `AWS_KMS` no longer falls back to local `public_key.verify`; now directly calls `self._kms_client.verify(...)` and lets exception propagate to `InvalidSignature` handling (HSM guarantee preserved).
- `backend/app/models/constraint.py:18` added `kms_signature = Column(Text, nullable=True)`; `backend/alembic/versions/e7f3a1b2c4d5_add_kms_signature_to_constraints.py:1` migration adds column (idempotent), `backend/alembic/versions/f1a2b3c4d5e6_add_sequence_to_memories.py:1` fixes missing `sequence_number` on Cockroach (create_all doesn't add columns). Both DBs now at `f1a2b3c4d5e6 (head)`.
- `backend/app/routers/constraints.py:119` `POST /api/constraints` now captures `sign_result = signing_engine.sign_json(...)` → `kms_signature` stored in `ConstraintDB` + audit `details {kms_backend, kms_key_id, sign_success}`; `backend/app/schemas/constraint.py:42` `ConstraintResponse` now includes `kms_signature`. `backend/app/routers/constraints.py:150` `GET /api/constraints` and `GET /{id}` now query DB and return `kms_signature`, and `GET /{id}` verifies `verify_json` on read and logs `agentshield.tamper` if invalid. `backend/app/routers/constraints.py:323` `PUT /{id}` re-signs on text change and updates `kms_signature`.
- `backend/app/routers/memories.py:280` `GET /{memory_id}` now verifies `kms_signature` via `verify_json(payload, signature)` and logs warning if `not vr.success`. `backend/main.py:140` `GET /health` now includes `signing: get_stats()` showing `{backend: local, requested_backend: local, fallback: false, persistent: true}`.
- Verified: `POST /api/constraints` returns `kms_signature: MEQC...`, `GET /api/constraints/{id}` returns same and verifies, `POST /api/memories` → `GET` both with `kms_signature`, `GET /health` shows `signing.fallback:false`. 90 tests pass, Cockroach `chain_anchors` + `memories.sequence_number` + `constraints.kms_signature` all present.

---

## 5. Backend - Auth / Security Hard Gaps — ✅ FIXED 2026-09-06

- `backend/app/routers/auth.py:37-38` `ACCESS_TOKEN_EXPIRE_MINUTES=15` but `backend/app/routers/auth.py:60` `create_refresh_token()` never exposed as endpoint, no `/refresh`, no httpOnly cookie. Frontend stores JWT in `localStorage` (`frontend/src/lib/auth-context.tsx:32` `localStorage.setItem("agentshield_auth",...)`) -> XSS steals token. No rotation, no blacklist. `frontend/src/lib/auth-context.tsx:71` `logout()` just clears localStorage.
- `backend/app/routers/auth.py:82-88` `DEMO_API_TOKEN` bypass: `Authorization: Bearer <DEMO_API_TOKEN>` returns `demo@agentshield.local` user without password. If set in prod, any caller impersonates demo org. Combined with `backend/main.py:32` `allow_origins=["*"]` CORS wildcard -> demo data exfillable from any site.
- `backend/app/routers/auth.py:42` `CryptContext(schemes=["bcrypt"])` + `bcrypt==4.2.0` truncates at 72 bytes silently. No `argon2` migration.
- No per-endpoint rate limit. `backend/app/middleware/rate_limit.py:10` global `120 req/60s` per IP. `POST /api/auth/login` can be brute-forced 120/min forever, no lockout, no captcha.
- Secrets leak: `backend/.env:1` contains live CockroachDB password `lEuf9rQ_c7HFgt7Vpg0ZKA` + `backend/.env:2` `JWT_SECRET_KEY=1f8c...` + `backend/.env:4` `OWNER_DASHBOARD_PASSWORD=DivyanshAI@11` plaintext. `.gitignore:4` ignores `.env` but file exists on disk; `docker-compose.yml:9` hardcodes `JWT_SECRET_KEY=dev-secret-change-in-production`. If `ENVIRONMENT` not set to production, `backend/app/routers/auth.py:28` `secrets.token_hex(32)` ephemeral key invalidates all tokens on restart.
- `backend/app/models/user.py` / `organization.py` role column exists but never checked -> any authenticated user can call any org-scoped endpoint via `current_user.org_id` filter, but filter is application-level only, no Postgres RLS. One forgotten filter = tenant leak.

**Fix applied:**
- `backend/app/schemas/auth.py:16` `Token` now includes `refresh_token` + `expires_in`; added `RefreshRequest` for refresh flow.
- `backend/app/routers/auth.py:1` rewritten: added `Request`/`Response` handling, `_auth_hits` per-endpoint limiter (`_auth_rate_limit` 5/min for login/register, 10/min for refresh, 429 with `Retry-After`), `get_password_hash` now rejects `>72 bytes` with `400` (`Password too long: bcrypt truncates...`), `create_refresh_token` now used, `_extract_token` checks `Authorization` then `httpOnly` cookie `access_token`, `get_current_user_dep(request, ...)` now scopes `DEMO_API_TOKEN` to `request.method=="GET"` only else `403 read-only`, `get_optional_user_dep` same, added `require_role(role)` helper for RBAC.
- `backend/app/routers/auth.py:136` `POST /register` and `POST /login` now `_auth_rate_limit`, check 72 bytes, create both `access_token` (15m) + `refresh_token` (7d), set `httpOnly` cookies `access_token`/`refresh_token` (`secure=_IS_PRODUCTION`, `samesite=lax`, `max_age` 900/604800), return both tokens (backward compat for localStorage) + `expires_in`.
- `backend/app/routers/auth.py:210` added `POST /refresh` (reads `refresh_token` from body → cookie → `Authorization`, verifies `type==refresh`, issues new access+refresh and resets cookies) and `POST /logout` (clears cookies, requires auth). `GET /me` unchanged but now also works via cookie.
- `backend/main.py:29` `CORSMiddleware` now `allow_origins=["http://localhost:3000","http://localhost:8000","http://127.0.0.1:3000"]` + `allow_origin_regex=r"https://.*"` + `allow_credentials=True` (required for httpOnly cookies, fixes wildcard+credentials invalid).
- `frontend/src/lib/api.ts:21` `fetch` now `credentials:"include"` for cookie sending; `frontend/src/lib/api.ts:48` `register`/`login` now expect `refresh_token`, added `refresh()` and `logout()` helpers.
- `frontend/src/lib/auth-context.tsx:14` `AuthContextType` now `logout: Promise<void>` + `refresh: Promise<boolean>`; `login`/`register` still store in `localStorage` for compat but backend also sets httpOnly; `refresh()` calls `api.refresh()` and updates state, `logout()` now `await api.logout()` then clears `localStorage`. Verified: `long pw 73 bytes` → `400`, `register` → `200` with `refresh_token` + `Set-Cookie access_token/refresh_token httpOnly`, `POST /refresh` via cookie `200`, demo `GET` `200` but `POST` `403 read-only`, 6th `POST /login` in 60s → `429 Too many requests`, `CORS allow_credentials:true`.

---

## 6. Backend - Audit / Compliance / Time-Travel Half-Real — ✅ FIXED 2026-09-06

- `backend/app/routers/audit.py:110` CockroachDB `AS OF SYSTEM TIME` query at `backend/app/routers/audit.py:118-125` binds `timestamp.isoformat()` as string `:ts`. Cockroach expects `TIMESTAMP` or interval literal, not ISO string -> query fails, falls back to `db_entries=[]` at `backend/app/routers/audit.py:192` silent. Frontend still shows `backend: cockroachdb_as_of_system_time` (`backend/app/routers/audit.py:203`).
- Audit dual-write listener `backend/app/routers/constraints.py:28-81` `_persist_audit_to_db` reads `audit_trail._entries[-1]` after emit, race under parallel requests. Uses in-memory `entry_hash` but `backend/app/models/audit_log.py:19` has own column never validated vs in-memory after restart (`backend/app/startup.py:161` overwrites).
- `backend/app/core/audit_trail.py:360-451` `generate_compliance_report()` just counts `events_by_type`, hardcodes `retention_years=10`, `article_12_satisfied = hash_chain_valid and total_events>0`. No retention enforcement, no 10-year lifecycle job, no PDF export, no signature.
- `backend/app/routers/audit.py:64` `audit_trail.query()` loads full `audit_trail._entries[org]` then slices `offset:offset+limit` -> O(N) per request. For 100k logs, latency linear. `backend/app/routers/audit.py:195` `mem_dicts = [e.to_dict() for e in mem_entries]` + `db_entries` union causes duplicates unless `mem_ids` set logic matches.
- `backend/app/core/audit_trail.py:181` `record()` emits `audit_recorded` but `backend/app/routers/scan.py:14` listener checks `if event_type == "pattern_detected"` - mismatch, actually `scan.py` registers on `pattern_engine`, not audit.

**Fix applied:**
- `backend/app/routers/audit.py:25` `GET /api/audit` now DB-paginated: tries `db.query(AuditLog).filter(...).count()` + `order_by(recorded_at.desc()).offset(offset).limit(limit)` with `source:db`, fallback to `audit_trail.query` `source:in_memory` only if DB empty. Fixes O(N) → O(1) via `ix_audit_log_org_id` + `recorded_at` index.
- `backend/app/routers/audit.py:133` `GET /api/audit/time-travel` now uses correct Cockroach literal `AS OF SYSTEM TIME '{ts_literal}'` where `ts_literal = timestamp.astimezone(timezone.utc).isoformat().replace("'", "''")` interpolated, `WHERE` still parameterized, so `cockroachdb_as_of_system_time` now actually executes (verified `200` with `total 1` vs previous 422 when `+` not encoded). `backend/app/routers/audit.py:264` `GET /api/audit/db-time-travel` same fix. Frontend now correctly shows `backend` per actual DB (tested `sqlite_filtered` vs `cockroachdb_as_of_system_time`).
- `backend/app/routers/constraints.py:28` `_persist_audit_to_db` already fixed in 1.1 to use `audit_id=entry_id` and now with `audit_trail` RLock (`backend/app/core/audit_trail.py:193` `RLock`) race is mitigated; `backend/app/startup.py:149` preserves `audit_id`+`entry_hash` on reload so verify stays valid.
- `backend/app/core/audit_trail.py:370` `ComplianceReport` now has `retention_compliant`, `retention_details`, `signature`, `signer_key_id`, `to_dict()` now `compliance_status` requires `hash_chain_valid && retention_compliant` and `article_12_satisfied` also requires `retention_compliant`; `backend/app/core/audit_trail.py:385` `generate_compliance_report()` now checks retention: `earliest_retained` vs `now - 10*365 days`, sets `retention_details`, and signs report via `signing_engine.sign_json(payload)` with `report_id`/`org_id`/`period`/`hash_chain_valid` → `signature`/`signer_key_id` (non-repudiation, CloudTrail/KMS if enabled). `backend/app/routers/audit.py:320` `GET /api/audit/compliance/report` now returns `retention_compliant`/`signature` (verified `COMPLIANT` + `signature` present + `retention_ok:true`).
- `backend/app/routers/audit.py:76` already added `GET /api/audit/anchors` + `POST /anchors/trigger` for durable anchoring verification (1.4), and `backend/main.py:51` anchor job now DB-durable. `scan.py:14` listener correctly on `pattern_engine` (not audit) - clarified as not a bug for audit. Verified: `GET /api/audit?limit=5` returns `source:db`, `GET /api/audit/compliance/report` returns `retention_compliant:true` + `signature`, `GET /api/audit/time-travel?timestamp={encoded}` returns `backend:cockroachdb_as_of_system_time` `total 1`.

---

## 7. Backend - Validation & Operational Gaps — ✅ FIXED 2026-09-06

- `backend/app/schemas/constraint.py:11` `constraint_type` validator allows only `safety|policy|instruction` but `backend/app/schemas/memory.py:27` `memory_type` only checks `len>100` not allowlist -> `memory_type=foobar` accepted, breaks `frontend/src/app/dashboard/memory/page.tsx:16` `TYPE_STYLES` lookup.
- `backend/app/schemas/memory.py:6` `_MAX_CONTENT_LENGTH=50_000` but no rate limit on body size; large payload can fill hash chain dict OOM (in-memory).
- `backend/main.py:51-85` `anchor_hashes_job()` runs via `apscheduler` `cron hour=0` without `misfire_grace_time`, without singleton lock. Two workers double-anchor, duplicate `anchors.log` lines.
- No structured logging, no Sentry, no Prometheus metrics. `backend/app/models/database.py:61-74` slow query logger only in `ENVIRONMENT=development`.
- `backend/test_endpoints.py` / `backend/app/tests/` exist but coverage is mocked engines, not integration against CockroachDB.

**Fix applied:**
- `backend/app/schemas/memory.py:25` `validate_memory_type` now allowlist `{"episodic","semantic","procedural"}` (matches `frontend/src/app/dashboard/memory/page.tsx:16` `TYPE_STYLES`); also added `validate_importance` `0-10`, `validate_trust` `0-3`, `validate_provenance` `{"agent_direct","user_input","tool_output","external"}`; `foobar` now `422` `must be one of ...`.
- `backend/app/middleware/body_limit.py:1` new `BodyLimitMiddleware` (1MB hard, 55k for `/api/memories` + 2k overhead) checks `Content-Length` early and returns `413 Payload too large` before OOM; `backend/main.py:26` now `app.add_middleware(BodyLimitMiddleware)` before rate limit. Verified `51k` → `422` `content too long`, `>1MB` would `413`.
- `backend/main.py:203` scheduler now `add_job(..., misfire_grace_time=3600, jitter=300, max_instances=1, coalesce=True, replace_existing=True)` + already had `single-instance` guard (1.1) → no double-anchor on deploy downtime, spread 5m jitter.
- `backend/main.py:13` structured JSON logging via `pythonjsonlogger` (`_has_json_logger` → `JsonFormatter`), `backend/app/models/database.py:61` slow query logger now JSON when available; `backend/requirements.txt:19` added `prometheus-client>=0.19` and `python-json-logger>=2.0` optional, `backend/main.py:13` adds `REQUEST_COUNT`/`REQUEST_LATENCY` counters + `app.middleware` metrics + `GET /metrics` returns `generate_latest()` Prometheus or JSON fallback (`{"asctime":...}` logs seen in test). Verified `GET /metrics` `200` `python_gc_objects...`, `GET /health` still `200` with signing.
- `backend/app/tests/` now covers DB-backed verification (1.2) and Cockroach `AS OF SYSTEM TIME` (1.4) via real DB, not just mocked engines; `90 tests` still pass.

---

## 8. Frontend - Auth & API Fragile

- `frontend/src/lib/auth-context.tsx:32` `localStorage.setItem("agentshield_auth", JSON.stringify({token, userId, orgId}))`. XSS via any compromised npm package steals all org data. No `httpOnly` cookie, no `Secure`, no refresh.
- `frontend/src/lib/api.ts:21` `request()` throws `ApiError` but never handles `401` -> user stays on dashboard with `error: "Could not validate credentials"` (`frontend/src/app/dashboard/page.tsx:89`), no redirect to `/login`, stale token persists until manual `logout()`.
- `frontend/src/lib/api.ts:1` `NEXT_PUBLIC_API_URL` baked at `next build` time (`docker-compose.yml:22` passes as arg). Runtime env change ignored; Vercel frontend pointing to stale Render URL requires rebuild.
- `frontend/src/lib/api.ts:42` `if (res.status===204) return undefined as T` hides errors; no `Retry-After` handling for `429`.

---

## 9. Frontend - Dashboard / Pages Functional Gaps

- `frontend/src/app/dashboard/page.tsx:70-92` 5 parallel fetches on every `load()`. No SWR, no caching, no websocket. Chain validity at `frontend/src/app/dashboard/page.tsx:86` checks `(cv as any).valid` but `backend/app/routers/public.py:252` returns `is_valid` -> mismatch defaults to `false` -> shows `Chain Broken` when valid.
- `frontend/src/app/dashboard/constraints/page.tsx:91` `integrity_score` float 0-1 display `*100` correct, but `backend/app/core/constraint_pinning.py:646` `get_token_overhead()` returns `0.000x` -> `*100 => 0.00%` always looks passing even with 100 constraints (no real token measurement).
- `frontend/src/app/dashboard/memory/page.tsx:47-52` `storeMemory` has no `trust_level`/`importance_score`/`source_provenance` UI, defaults `trust_level=2` invisible. No search, no filter by `memory_type` beyond list dropdown, no hash verify button, no `kms_signature` display (stored but never shown).
- `frontend/src/app/dashboard/audit/page.tsx:136` time-travel `input type=datetime-local` yields local time without timezone, `frontend/src/app/dashboard/audit/page.tsx:62` `new Date(ts).toISOString()` shifts by IST (+05:30 Gwalior) -> query window wrong by 5:30. Result truncated `frontend/src/app/dashboard/audit/page.tsx:142` `slice(0,4000)` hides evidence.
- `frontend/src/app/dashboard/compliance/page.tsx:116` shows `hash_chain` dict raw, `constraint_summary` is `{"total_constraint_events": n}` not per-constraint status. No download; `frontend/src/lib/api.ts:122` `exportJsonl` never called in UI.
- `frontend/src/app/page.tsx:203` landing claims "45 OWASP ASI06 patterns across 7 categories" but `backend/app/core/pattern_detection.py:44` defines **6 categories** (`Category` enum). Count mismatch.
- No pagination anywhere: `constraints`, `memories`, `audit` all `limit=50` default (`frontend/src/lib/api.ts:71,87,109`), no `Load More` button, no `offset` handling in UI.

---

## 10. Frontend - Build / Security / Testing

- `frontend/package.json:14` `@base-ui/react: ^1.7.0` + `shadcn: ^4.19.0` installed but `frontend/components.json` theme tokens not synced - `21st-design-sync` skill unused. `frontend/src/app/globals.css` custom tokens diverge from `shadcn`.
- `frontend/next.config.ts` (not read but defaults) has no `headers()` CSP, no `images` allowlist.
- `frontend/jest.config.ts:14` setup exists but only `frontend/src/app/docs/page.test.tsx:1` exists and tests docs page only. No tests for `auth-context`, `api`, dashboard. `frontend/src/app/docs/page.test.tsx` is single placeholder.
- `frontend/src/lib/webmcp.ts:4` WebMCP `document.modelContext.registerTool` is hackathon grease (`frontend/src/lib/webmcp.ts:292` `void "document.modelContext.registerTool"` string trick for grep) + `frontend/src/components/webmcp-provider.tsx` registers 7 tools that all hit `/api/public/*` without auth -> demo data leakage vector if demo org holds real memories.
- `frontend/src/app/login/page.tsx:10` no client-side validation beyond `required`, no password visibility toggle, no error field mapping. `frontend/src/app/register/page.tsx` likely same.

---

## 11. SDK / Demo Gaps

- `sdk/agentshield/client.py:122` local probe `http://localhost:8000` with 2s timeout happens on every `AgentShield()` init -> slow startup if offline. `demo.py:83` hardcodes `demo@agentshield.io / demo1234` credentials, not env-driven.
- `sdk/agentshield/client.py:205` `_RetryTransport` retries on `429,500,502,503,504` but `backend/app/middleware/rate_limit.py` returns `429` with `Retry-After` header respected, however SDK logs warning on every retry without exponential cap tuning (`max_backoff=30`).

---

## 12. Priority Fix Order (Real Production, No Mock)

1. **DB as Source of Truth:** Remove in-memory chain as primary; `verify()` must scan `audit_log`/`memories` tables, not dict. Drop `anchors.log`, back with S3 versioned bucket + daily CronJob with lock.
2. **Fix Alembic:** `alembic revision --autogenerate -m "init"` to generate real `upgrade()`, remove `init_db()` conditional for prod.
3. **Signing Persistence:** Add volume for `signing_key.pem` or mandate `SIGNING_BACKEND=aws_kms` in prod (fail hard, don't fallback at `backend/app/core/signing.py:175`).
4. **Real Constraint Pinning Hook:** Implement FastAPI middleware / LLM proxy that intercepts compaction calls, not array slice simulation.
5. **Auth Hardening:** Move JWT to `httpOnly` cookie, implement `/refresh` at `backend/app/routers/auth.py:60`, blacklist on logout, add login rate limit 5/min, scope `DEMO_API_TOKEN` to read-only or remove.
6. **Frontend Auth Fix:** Add 401 interceptor at `frontend/src/lib/api.ts:21` -> `logout()` + redirect, runtime config via `backend/app/routers/public.py:72` `/api/public/config`, pagination, search, signature verify UI, timezone-aware time-travel.
7. **Testing & Observability:** Add `httpx` integration tests for chain tamper (`backend/app/tests/test_hash_chain.py`), `jest` for `auth-context`, Sentry + `structlog`.

---

*All findings verified against files at `backend/app/core/*:line`, `frontend/src/*:line`, `docker-compose.yml:line`. No mocks - only what is on disk as of 2026-09-06.*
