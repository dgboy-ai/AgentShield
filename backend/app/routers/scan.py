from fastapi import APIRouter, Depends
from app.models.user import User
from app.routers.auth import get_current_user_dep
from app.schemas.scan import ScanRequest, ScanResponse, PatternMatchResponse
from app.core.pattern_detection import PatternDetectionEngine, Severity
from app.core.audit_trail import EventType
from app.routers.constraints import audit_trail

router = APIRouter(prefix="/api/scan", tags=["scan"])

pattern_engine = PatternDetectionEngine()

# Wire audit trail to pattern detection events
pattern_engine.add_listener(lambda event_type, data: audit_trail.record(
    org_id=data.get("org_id", "system"),
    event_type=__import__("app.core.audit_trail", fromlist=["EventType"]).EventType.PATTERN_DETECTED,
    actor="pattern_engine",
    target=None,
    action=event_type,
    details=data,
) if event_type == "pattern_detected" else None)


@router.post("", response_model=ScanResponse)
def scan_text(
    data: ScanRequest,
    current_user: User = Depends(get_current_user_dep),
):
    org_id = str(current_user.org_id)

    result = pattern_engine.scan(data.text)

    # Record audit event
    if not result.is_safe:
        audit_trail.record(
            org_id=org_id,
            event_type=EventType.PATTERN_DETECTED,
            actor=str(current_user.user_id),
            target=None,
            action="scan",
            details={
                "match_count": len(result.matches),
                "risk_score": result.risk_score,
                "max_severity": result.max_severity.value,
                "blocked": result.blocked,
                "categories": result.categories_triggered,
            },
        )

    return ScanResponse(
        text_length=result.text_length,
        match_count=len(result.matches),
        risk_score=result.risk_score,
        max_severity=result.max_severity.value,
        blocked=result.blocked,
        categories_triggered=result.categories_triggered,
        matches=[
            PatternMatchResponse(
                pattern_id=m.pattern_id,
                pattern_name=m.pattern_name,
                category=m.category.value,
                severity=m.severity.value,
                matched_text=m.matched_text,
            )
            for m in result.matches
        ],
        scan_time_ms=result.scan_time_ms,
    )


@router.get("/patterns")
def get_pattern_library():
    """Return the full 42-pattern library."""
    return {
        "patterns": pattern_engine.get_pattern_library(),
        "stats": pattern_engine.get_stats(),
    }
