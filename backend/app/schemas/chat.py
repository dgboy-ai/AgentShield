from typing import Literal, Optional

from pydantic import BaseModel, Field


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=0, max_length=8000)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=8000)
    history: list[ChatTurn] = Field(default_factory=list, max_length=20)


class ShieldMatch(BaseModel):
    pattern_id: str
    pattern_name: str
    category: str
    severity: str
    matched_text: str


class ShieldInfo(BaseModel):
    blocked: bool
    risk_score: int
    match_count: int
    max_severity: str
    categories_triggered: list[str]
    matches: list[ShieldMatch]
    scan_time_ms: float


class LlmInfo(BaseModel):
    model: str
    latency_ms: float
    prompt_tokens: Optional[int] = None
    completion_tokens: Optional[int] = None


class PinnedInfo(BaseModel):
    count: int
    token_overhead: float


class ChatResponse(BaseModel):
    reply: str
    shield: ShieldInfo
    llm: Optional[LlmInfo] = None
    pinned: PinnedInfo
