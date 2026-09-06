import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Float, Integer
from sqlalchemy.orm import relationship
from .database import Base


class Memory(Base):
    __tablename__ = "memories"

    memory_id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    org_id = Column(String(36), ForeignKey("organizations.org_id"), nullable=False, index=True)
    content = Column(Text, nullable=False)
    memory_type = Column(String(100), nullable=False)
    importance_score = Column(Float, default=5.0)
    trust_level = Column(Integer, default=2)
    source_provenance = Column(String(50), default="agent_direct")
    previous_hash = Column(String(64))
    entry_hash = Column(String(64), nullable=False)
    sequence_number = Column(Integer)  # hash-chain sequence, for DB-backed verification and deterministic replay
    kms_signature = Column(Text)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    organization = relationship("Organization", back_populates="memories")
