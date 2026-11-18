from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Integer
from .database import Base


class HashChainEntry(Base):
    """Persisted hash-chain entry (currently used for constraint entries).

    Memory entries are persisted in the memories table with the same chain
    fields; constraint entries previously lived only in memory, which made the
    chain impossible to reconstruct exactly after a restart. Persisting every
    non-memory chain entry here keeps previous_hash/entry_hash/sequence/created_at
    intact so startup replay is byte-for-byte deterministic.
    """

    __tablename__ = "hash_chain_entries"

    entry_id = Column(String(36), primary_key=True)
    org_id = Column(String(36), ForeignKey("organizations.org_id"), nullable=False, index=True)
    entry_type = Column(String(50), nullable=False, index=True)
    payload_json = Column(Text, nullable=False)
    previous_hash = Column(String(64), nullable=False)
    entry_hash = Column(String(64), nullable=False, index=True)
    sequence_number = Column(Integer, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
