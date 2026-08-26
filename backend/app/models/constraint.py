import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from .database import Base


class Constraint(Base):
    __tablename__ = "constraints"

    constraint_id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    org_id = Column(String(36), ForeignKey("organizations.org_id"), nullable=False, index=True)
    constraint_text = Column(Text, nullable=False)
    constraint_type = Column(String(100), nullable=False)
    is_active = Column(Boolean, default=True)
    previous_hash = Column(String(64))
    entry_hash = Column(String(64), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    organization = relationship("Organization", back_populates="constraints")
