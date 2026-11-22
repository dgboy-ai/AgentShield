"""Live chat: Groq agent behind the AgentShield scan gate + pinned system prompt.

Flow per turn (stateless):
  1. pattern scan  — blocked turns NEVER reach Groq (0 tokens)
  2. pinned prompt — org constraints injected as a verified system block
  3. Groq call     — plain httpx against the OpenAI-compatible REST API
  4. audit         — every turn recorded (CHAT_TURN), blocked turns also
                     record PATTERN_DETECTED with the real org_id

The pinning/audit singletons live in app.routers.constraints — import them
from there (same pattern as scan.py / public.py) or pins will not be visible.
"""

from __future__ import annotations

import os
import time
from typing import Any, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.audit_trail import EventType
from app.core.chat_helpers import (
    build_groq_messages,
    build_refusal_text,
    build_system_block,
)
from app.core.constraint_pinning import ConstraintStatus
from app.core.pattern_detection import shared_engine
from app.models.user import User
from app.routers.auth import get_current_user_dep
from app.routers.constraints import audit_trail, pinning_engine
from app.schemas.chat import (
    ChatRequest,
    ChatResponse,
    ChatTurn,
    LlmInfo,
    PinnedInfo,
    ShieldInfo,
    ShieldMatch,
)

router = APIRouter(prefix="/api/chat", tags=["chat"])


# ---------------------------------------------------------------------------
# Pure helpers live in app.core.chat_helpers (unit-tested without a network)
# ---------------------------------------------------------------------------

def _shield_info(result: Any) -> ShieldInfo:
    return ShieldInfo(
        blocked=bool(result.blocked),
        risk_score=int(result.risk_score),
        match_count=len(result.matches),
        max_severity=result.max_severity.value,
        categories_triggered=list(result.categories_triggered),
        matches=[
            ShieldMatch(
                pattern_id=m.pattern_id,
                pattern_name=m.pattern_name,
                category=m.category.value,
                severity=m.severity.value,
                matched_text=m.matched_text,
            )
            for m in result.matches
        ],
        scan_time_ms=float(result.scan_time_ms),
    )


def _build_system_block(org_id: str) -> tuple[str, PinnedInfo]:
    active = pinning_engine.list_constraints(org_id, status=ConstraintStatus.ACTIVE)
    pinned_prompt = pinning_engine.build_pinned_system_prompt(org_id)
    block = build_system_block(pinned_prompt)
    info = PinnedInfo(count=len(active), token_overhead=pinning_engine.get_token_overhead(org_id))
    return block, info


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.post("", response_model=ChatResponse)
def chat(
    data: ChatRequest,
    current_user: User = Depends(get_current_user_dep),
):
    org_id = str(current_user.org_id)
    actor = str(current_user.user_id)
    message = data.message

    # --- 1) Scan gate: blocked turns never reach Groq -----------------------
    result = shared_engine.scan(message)

    system_block, pinned = _build_system_block(org_id)

    if result.blocked:
        audit_trail.record(
            org_id=org_id,
            event_type=EventType.PATTERN_DETECTED,
            actor=actor,
            target=None,
            action="chat_gate",
            details={
                "match_count": len(result.matches),
                "risk_score": result.risk_score,
                "max_severity": result.max_severity.value,
                "blocked": True,
                "categories": result.categories_triggered,
                "source": "chat",
            },
        )
        audit_trail.record(
            org_id=org_id,
            event_type=EventType.CHAT_TURN,
            actor=actor,
            target=None,
            action="block",
            details={
                "blocked": True,
                "risk_score": result.risk_score,
                "match_count": len(result.matches),
                "scan_time_ms": round(result.scan_time_ms, 3),
                "llm_called": False,
            },
        )
        return ChatResponse(
            reply=build_refusal_text(
                len(result.matches), result.risk_score, result.categories_triggered
            ),
            shield=_shield_info(result),
            llm=None,
            pinned=pinned,
        )

    # --- 2) Groq call under the pinned system block -------------------------
    api_key = os.getenv("GROQ_API_KEY", "").strip()
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "GROQ_API_KEY is not configured on the backend. "
                "Add GROQ_API_KEY (and optionally GROQ_MODEL) to backend/.env — "
                "get a key at https://console.groq.com/keys"
            ),
        )
    model = os.getenv("GROQ_MODEL", "").strip() or "openai/gpt-oss-120b"
    base_url = os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1").rstrip("/")

    messages = build_groq_messages(system_block, data.history, message)
    payload = {
        "model": model,
        "messages": messages,
        "temperature": 0.3,
    }

    t0 = time.perf_counter()
    try:
        resp = httpx.post(
            f"{base_url}/chat/completions",
            json=payload,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            timeout=httpx.Timeout(30.0, connect=10.0),
        )
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Groq unreachable: {type(exc).__name__}: {str(exc)[:200]}",
        )
    latency_ms = (time.perf_counter() - t0) * 1000

    if resp.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Groq API error {resp.status_code}: {resp.text[:300]}",
        )
    try:
        body = resp.json()
        reply = (body["choices"][0]["message"].get("content") or "").strip()
        usage = body.get("usage") or {}
    except (ValueError, KeyError, IndexError) as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Unexpected Groq response shape: {type(exc).__name__}",
        )
    if not reply:
        reply = "(empty reply from model)"

    llm = LlmInfo(
        model=model,
        latency_ms=round(latency_ms, 1),
        prompt_tokens=usage.get("prompt_tokens"),
        completion_tokens=usage.get("completion_tokens"),
    )

    # --- 3) Audit the successful turn ---------------------------------------
    audit_trail.record(
        org_id=org_id,
        event_type=EventType.CHAT_TURN,
        actor=actor,
        target=None,
        action="chat",
        details={
            "blocked": False,
            "risk_score": result.risk_score,
            "match_count": len(result.matches),
            "scan_time_ms": round(result.scan_time_ms, 3),
            "llm_called": True,
            "model": model,
            "llm_latency_ms": llm.latency_ms,
            "pinned_constraints": pinned.count,
        },
    )

    return ChatResponse(
        reply=reply,
        shield=_shield_info(result),
        llm=llm,
        pinned=pinned,
    )
