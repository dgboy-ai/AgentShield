from pydantic import BaseModel, Field
from typing import Optional


class ScanRequest(BaseModel):
    text: str = Field(min_length=1, max_length=20000)


class PatternMatchResponse(BaseModel):
    pattern_id: str
    pattern_name: str
    category: str
    severity: str
    matched_text: str


class ScanResponse(BaseModel):
    text_length: int
    match_count: int
    risk_score: int
    max_severity: str
    blocked: bool
    categories_triggered: list[str]
    matches: list[PatternMatchResponse]
    scan_time_ms: float
