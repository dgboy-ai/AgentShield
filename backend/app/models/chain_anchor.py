import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Integer
from sqlalchemy.orm import relationship
from .database import Base


class ChainAnchor(Base):
    __tablename__ = "chain_anchors"

    anchor_id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    org_id = Column(String(36), ForeignKey("organizations.org_id"), nullable=False, index=True)
    chain_type = Column(String(50), nullable=False)  # audit | hash_chain | combined
    chain_head_hash = Column(String(64), nullable=False)
    chain_length = Column(Integer, nullable=False)
    anchor_target = Column(String(50), nullable=False)  # db | file | s3 | webhook | local
    # Optional external proof: S3 key, webhook response, file path
    external_ref = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)

    organization = relationship("Organization")
