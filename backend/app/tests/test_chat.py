"""
Tests for guarded-chat pure helpers (app.core.chat_helpers).

Validates:
- Groq message assembly: system first, bounded history, user last
- History sanitization: role filtering, content truncation, last-N cap
- Refusal text states 0 tokens were sent
- System block falls back to the onboarding note with no pinned rules
"""

from types import SimpleNamespace

from app.core.chat_helpers import (
    HISTORY_CONTENT_LIMIT,
    HISTORY_LIMIT,
    NO_CONSTRAINTS_NOTE,
    SYSTEM_PREAMBLE,
    build_groq_messages,
    build_refusal_text,
    build_system_block,
    sanitize_history,
)


def test_build_groq_messages_order():
    """system → history → user, in that exact order."""
    msgs = build_groq_messages(
        "SYS",
        [{"role": "user", "content": "hi"}, {"role": "assistant", "content": "hello"}],
        "next question",
    )
    assert msgs[0] == {"role": "system", "content": "SYS"}
    assert msgs[1] == {"role": "user", "content": "hi"}
    assert msgs[2] == {"role": "assistant", "content": "hello"}
    assert msgs[-1] == {"role": "user", "content": "next question"}
    print("[PASS] test_build_groq_messages_order")


def test_build_groq_messages_empty_history():
    """Empty history still yields system + user."""
    msgs = build_groq_messages("SYS", [], "only question")
    assert len(msgs) == 2
    assert msgs[0]["role"] == "system"
    assert msgs[1] == {"role": "user", "content": "only question"}
    print("[PASS] test_build_groq_messages_empty_history")


def test_sanitize_history_filters_roles_and_content():
    """Invalid roles and non-string content are dropped; valid turns survive."""
    history = [
        {"role": "system", "content": "leak"},
        {"role": "user", "content": "ok"},
        {"role": "assistant", "content": 12345},
        {"role": "nonsense", "content": "x"},
        {"role": "assistant", "content": "fine"},
    ]
    out = sanitize_history(history)
    assert out == [
        {"role": "user", "content": "ok"},
        {"role": "assistant", "content": "fine"},
    ]
    print("[PASS] test_sanitize_history_filters_roles_and_content")


def test_sanitize_history_caps_content_and_turns():
    """Content is truncated to the limit; only the last N turns are kept."""
    long_content = "x" * (HISTORY_CONTENT_LIMIT + 500)
    out = sanitize_history([{"role": "user", "content": long_content}])
    assert len(out[0]["content"]) == HISTORY_CONTENT_LIMIT

    many = [{"role": "user", "content": f"turn {i}"} for i in range(HISTORY_LIMIT + 5)]
    out = sanitize_history(many)
    assert len(out) == HISTORY_LIMIT
    assert out[-1]["content"] == f"turn {HISTORY_LIMIT + 4}"
    print("[PASS] test_sanitize_history_caps_content_and_turns")


def test_sanitize_history_accepts_objects():
    """Attribute-style turns (e.g. pydantic models) work alongside dicts."""
    obj_turn = SimpleNamespace(role="assistant", content="from object")
    out = sanitize_history([obj_turn, {"role": "user", "content": "from dict"}])
    assert out == [
        {"role": "assistant", "content": "from object"},
        {"role": "user", "content": "from dict"},
    ]
    print("[PASS] test_sanitize_history_accepts_objects")


def test_build_refusal_text_zero_tokens():
    """Refusal must state 0 tokens were sent and carry the risk facts."""
    text = build_refusal_text(3, 9, ["prompt_injection", "jailbreak"])
    assert "0 tokens" in text
    assert "Patterns matched: 3" in text
    assert "risk score: 9" in text
    assert "prompt_injection, jailbreak" in text
    assert "audit trail" in text
    print("[PASS] test_build_refusal_text_zero_tokens")


def test_build_refusal_text_no_categories():
    """Missing categories fall back to a generic label, never crash."""
    text = build_refusal_text(1, 7, [])
    assert "categories: multiple" in text
    print("[PASS] test_build_refusal_text_no_categories")


def test_build_system_block_with_and_without_pins():
    """Pinned prompt is appended after the preamble; empty → onboarding note."""
    with_pins = build_system_block("- [safety] Never delete files")
    assert with_pins.startswith(SYSTEM_PREAMBLE)
    assert "- [safety] Never delete files" in with_pins
    assert NO_CONSTRAINTS_NOTE not in with_pins

    without = build_system_block("")
    assert without.startswith(SYSTEM_PREAMBLE)
    assert NO_CONSTRAINTS_NOTE in without
    print("[PASS] test_build_system_block_with_and_without_pins")
