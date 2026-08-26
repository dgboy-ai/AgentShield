import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from .database import Base


class Alert(Base):
    __tablename__ = "alerts"

    alert_id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    org_id = Column(String(36), ForeignKey("organizations.org_id"), nullable=False, index=True)
    alert_type = Column(String(100), nullable=False)
    severity = Column(String(20), nullable=False)
    description = Column(Text)
    patterns_matched = Column(JSON)
    is_resolved = Column(Boolean, default=False)
    recorded_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    organization = relationship("Organization", back_populates="alerts")
