import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from .database import Base


class Organization(Base):
    __tablename__ = "organizations"

    org_id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    org_name = Column(String(255), nullable=False)
    plan = Column(String(50), default="free")
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    users = relationship("User", back_populates="organization")
    constraints = relationship("Constraint", back_populates="organization")
    memories = relationship("Memory", back_populates="organization")
    audit_logs = relationship("AuditLog", back_populates="organization")
    alerts = relationship("Alert", back_populates="organization")
