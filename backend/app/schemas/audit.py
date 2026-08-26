from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class AuditEntryResponse(BaseModel):
    entry_id: str
    org_id: str
    event_type: str
    actor: Optional[str]
    target: Optional[str]
    action: str
    details: Optional[dict]
    previous_hash: Optional[str]
    entry_hash: str
    recorded_at: datetime

    class Config:
        from_attributes = True


class AuditQueryParams(BaseModel):
    event_type: Optional[str] = None
    actor: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    offset: int = 0
    limit: int = 100


class ComplianceReportResponse(BaseModel):
    report_id: str
    org_id: str
    period: dict
    total_events: int
    events_by_type: dict
    hash_chain: dict
    constraint_summary: dict
    alert_summary: dict
    retention_years: int
    compliance_status: str
    article_12_satisfied: bool
    generated_at: datetime
