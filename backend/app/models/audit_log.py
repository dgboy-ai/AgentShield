import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, ForeignKey, Text, JSON, Integer
from sqlalchemy.orm import relationship
from .database import Base


class AuditLog(Base):
    __tablename__ = "audit_log"

    audit_id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    org_id = Column(String(36), ForeignKey("organizations.org_id"), nullable=False, index=True)
    event_type = Column(String(100), nullable=False)
    actor = Column(String(255))
    target = Column(String(255))
    action = Column(String(100), nullable=False)
    details = Column(JSON)
    previous_hash = Column(String(64))
    entry_hash = Column(String(64), nullable=False)
    sequence_number = Column(Integer)
    recorded_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    organization = relationship("Organization", back_populates="audit_logs")
