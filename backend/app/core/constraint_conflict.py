"""
Constraint Conflict Detector
=============================

Detects when proposed memory content conflicts with an org's pinned
constraints — the "constraint drift" half of context poisoning (OWASP ASI06).

Two detection paths:

Path A — override attempt:
    The text carries an override marker ("ignore previous instructions",
    "disregard the above rules", ...) AND shares at least one meaningful
    keyword with an active constraint. The marker alone is generic noise;
    sharing a keyword ties the override to a specific pinned rule.

Path B — restatement / shadowing:
    The text restates >= 75% of a constraint's meaningful keywords (and the
    constraint has at least 3 keywords, so tiny rules cannot false-positive).
    A compacted context can then carry a near-copy that shadows the pin.

find_conflicts() is pure (no I/O): the memories router supplies active
constraints from the DB, tests construct plain objects.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Iterable, Sequence

# Path A markers: each must be tied to a constraint by >=1 shared keyword.
_OVERRIDE_MARKERS: tuple[tuple[str, re.Pattern[str]], ...] = (
    (
        "ignore_previous",
        re.compile(
            r"\bignore\s+(?:all\s+)?(?:the\s+)?(?:previous|prior|above|earlier)\s+"
            r"(?:instructions?|rules?|constraints?|prompts?|directives?|guidelines?)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "disregard_rule",
        re.compile(
            r"\bdisregard\s+(?:the\s+)?(?:above|previous|prior|all)\s+"
            r"(?:instructions?|rules?|constraints?|guidelines?|prompts?)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "override_constraint",
        re.compile(
            r"\boverride\s+(?:the\s+)?(?:safety\s+|security\s+)?"
            r"(?:rules?|constraints?|instructions?|policies|guidelines?)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "forget_previous",
        re.compile(
            r"\bforget\s+(?:all\s+)?(?:previous|prior|above)\s+"
            r"(?:instructions?|rules?|constraints?)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "rules_no_longer_apply",
        re.compile(
            r"\b(?:rules?|constraints?|instructions?|guidelines?)\s+"
            r"(?:no\s+longer|do\s+not|don't)\s+(?:apply|bind)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "do_not_follow",
        re.compile(
            r"\bdo\s+(?:not|n't)\s+follow\s+(?:the\s+)?"
            r"(?:rules?|constraints?|instructions?|policy|guidelines?)\b",
            re.IGNORECASE,
        ),
    ),
)

# Restatement threshold (Path B) and the minimum keyword count a constraint
# needs before Path B may fire (guards two-word rules like "Be honest").
_RESTATEMENT_RATIO = 0.75
_MIN_KEYWORDS_FOR_RESTATEMENT = 3

_STOPWORDS = frozenset(
    """
    the a an and or but if then else for of to in on at by with from as is
    are was were be been being it its this that these those you your we our
    they their he she his her not no do does did can could should would
    will shall may might must have has had any all some more most other into
    over under about than too very just also than such each every both few
    many much own same so too s t don now
    """.split()
)

_TOKEN_RE = re.compile(r"[a-z0-9']+")


def _keywords(text: str) -> list[str]:
    """Meaningful, de-duplicated content words (order preserved)."""
    seen: set[str] = set()
    out: list[str] = []
    for word in _TOKEN_RE.findall(text.lower()):
        word = word.strip("'")
        if len(word) < 3 or word in _STOPWORDS or word in seen:
            continue
        seen.add(word)
        out.append(word)
    return out


def _constraint_fields(constraint: Any) -> tuple[str, str]:
    """Accept DB ORM objects (constraint_text), SDK/dict shapes (text)."""
    if isinstance(constraint, dict):
        cid = constraint.get("constraint_id", "")
        text = constraint.get("constraint_text") or constraint.get("text") or ""
    else:
        cid = getattr(constraint, "constraint_id", "") or ""
        text = (
            getattr(constraint, "constraint_text", None)
            or getattr(constraint, "text", None)
            or ""
        )
    return str(cid), str(text)


@dataclass(frozen=True)
class ConstraintConflict:
    """One conflict between proposed text and one pinned constraint."""

    constraint_id: str
    constraint_text: str
    path: str  # "override" | "restatement"
    matched_keywords: tuple[str, ...]
    marker: str | None = None  # Path A marker name; None on Path B
    overlap_ratio: float = 0.0

    def to_dict(self) -> dict:
        return {
            "constraint_id": self.constraint_id,
            "constraint_text": self.constraint_text,
            "path": self.path,
            "matched_keywords": list(self.matched_keywords),
            "marker": self.marker,
            "overlap_ratio": self.overlap_ratio,
        }


@dataclass(frozen=True)
class ConflictResult:
    """Outcome of find_conflicts()."""

    conflicts: tuple[ConstraintConflict, ...] = field(default_factory=tuple)

    @property
    def detected(self) -> bool:
        return bool(self.conflicts)

    @property
    def constraint_ids(self) -> list[str]:
        return sorted({c.constraint_id for c in self.conflicts})

    def to_dict(self) -> dict:
        return {
            "detected": self.detected,
            "conflict_count": len(self.conflicts),
            "conflicts": [c.to_dict() for c in self.conflicts],
        }


def find_conflicts(
    active_constraints: Sequence[Any] | Iterable[Any],
    text: str,
) -> ConflictResult:
    """Check proposed text against active pinned constraints.

    Args:
        active_constraints: Active constraints (ORM objects, dicts, or any
            objects exposing constraint_id + constraint_text/text).
        text: Proposed memory content (user-controlled).

    Returns:
        ConflictResult with every matched conflict; empty when clean.
    """
    if not text or not text.strip():
        return ConflictResult()

    constraints = [_constraint_fields(c) for c in active_constraints]
    constraints = [(cid, ctext) for cid, ctext in constraints if ctext.strip()]
    if not constraints:
        return ConflictResult()

    text_lower = text.lower()
    text_words = set(_TOKEN_RE.findall(text_lower))

    # Pre-scan markers once (same for every constraint).
    markers = [
        (name, pattern.search(text))
        for name, pattern in _OVERRIDE_MARKERS
        if pattern.search(text)
    ]

    found: list[ConstraintConflict] = []
    seen: set[tuple[str, str]] = set()

    for cid, ctext in constraints:
        kws = _keywords(ctext)
        if not kws:
            continue
        kw_set = set(kws)
        matched = tuple(k for k in kws if k in text_words)

        # Path A: override marker + at least one shared keyword.
        for marker_name, marker_match in markers:
            if matched and (cid, "override") not in seen:
                seen.add((cid, "override"))
                found.append(
                    ConstraintConflict(
                        constraint_id=cid,
                        constraint_text=ctext,
                        path="override",
                        matched_keywords=matched,
                        marker=marker_name,
                        overlap_ratio=round(len(matched) / len(kws), 2),
                    )
                )
                break  # one override record per constraint is enough

        # Path B: >=75% keyword restatement (guard tiny constraints).
        if (
            len(kws) >= _MIN_KEYWORDS_FOR_RESTATEMENT
            and (cid, "restatement") not in seen
        ):
            ratio = len(matched) / len(kws)
            if ratio >= _RESTATEMENT_RATIO:
                seen.add((cid, "restatement"))
                found.append(
                    ConstraintConflict(
                        constraint_id=cid,
                        constraint_text=ctext,
                        path="restatement",
                        matched_keywords=matched,
                        marker=None,
                        overlap_ratio=round(ratio, 2),
                    )
                )

    return ConflictResult(conflicts=tuple(found))
