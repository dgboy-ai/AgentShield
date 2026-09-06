"""initial schema - creates all AgentShield tables (production-ready)

Revision ID: e6608869d062
Revises: 
Create Date: 2026-08-24 22:38:46.298171

Fix for 1.3: previously empty (pass) so production CockroachDB had zero tables
because database.py:init_db() skips in production. Now creates all 6 tables
with correct columns, FKs, indexes, and sequence_number for hash-chain replay.
Works on SQLite (dev), PostgreSQL and CockroachDB (prod) via SQLAlchemy types.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e6608869d062'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # organizations (no FK dependencies)
    op.create_table(
        "organizations",
        sa.Column("org_id", sa.String(length=36), primary_key=True),
        sa.Column("org_name", sa.String(length=255), nullable=False),
        sa.Column("plan", sa.String(length=50), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )
    # users
    op.create_table(
        "users",
        sa.Column("user_id", sa.String(length=36), primary_key=True),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column("role", sa.String(length=50), nullable=True),
        sa.Column("org_id", sa.String(length=36), sa.ForeignKey("organizations.org_id"), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    # memories (includes sequence_number for DB-backed hash verification - 1.2)
    op.create_table(
        "memories",
        sa.Column("memory_id", sa.String(length=36), primary_key=True),
        sa.Column("org_id", sa.String(length=36), sa.ForeignKey("organizations.org_id"), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("memory_type", sa.String(length=100), nullable=False),
        sa.Column("importance_score", sa.Float(), nullable=True),
        sa.Column("trust_level", sa.Integer(), nullable=True),
        sa.Column("source_provenance", sa.String(length=50), nullable=True),
        sa.Column("previous_hash", sa.String(length=64), nullable=True),
        sa.Column("entry_hash", sa.String(length=64), nullable=False),
        sa.Column("sequence_number", sa.Integer(), nullable=True),
        sa.Column("kms_signature", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_memories_org_id", "memories", ["org_id"], unique=False)
    # constraints
    op.create_table(
        "constraints",
        sa.Column("constraint_id", sa.String(length=36), primary_key=True),
        sa.Column("org_id", sa.String(length=36), sa.ForeignKey("organizations.org_id"), nullable=False),
        sa.Column("constraint_text", sa.Text(), nullable=False),
        sa.Column("constraint_type", sa.String(length=100), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=True),
        sa.Column("previous_hash", sa.String(length=64), nullable=True),
        sa.Column("entry_hash", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_constraints_org_id", "constraints", ["org_id"], unique=False)
    # audit_log
    op.create_table(
        "audit_log",
        sa.Column("audit_id", sa.String(length=36), primary_key=True),
        sa.Column("org_id", sa.String(length=36), sa.ForeignKey("organizations.org_id"), nullable=False),
        sa.Column("event_type", sa.String(length=100), nullable=False),
        sa.Column("actor", sa.String(length=255), nullable=True),
        sa.Column("target", sa.String(length=255), nullable=True),
        sa.Column("action", sa.String(length=100), nullable=False),
        sa.Column("details", sa.JSON(), nullable=True),
        sa.Column("previous_hash", sa.String(length=64), nullable=True),
        sa.Column("entry_hash", sa.String(length=64), nullable=False),
        sa.Column("sequence_number", sa.Integer(), nullable=True),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_audit_log_org_id", "audit_log", ["org_id"], unique=False)
    # alerts
    op.create_table(
        "alerts",
        sa.Column("alert_id", sa.String(length=36), primary_key=True),
        sa.Column("org_id", sa.String(length=36), sa.ForeignKey("organizations.org_id"), nullable=False),
        sa.Column("alert_type", sa.String(length=100), nullable=False),
        sa.Column("severity", sa.String(length=20), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("patterns_matched", sa.JSON(), nullable=True),
        sa.Column("is_resolved", sa.Boolean(), nullable=True),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_alerts_org_id", "alerts", ["org_id"], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("ix_alerts_org_id", table_name="alerts")
    op.drop_table("alerts")
    op.drop_index("ix_audit_log_org_id", table_name="audit_log")
    op.drop_table("audit_log")
    op.drop_index("ix_constraints_org_id", table_name="constraints")
    op.drop_table("constraints")
    op.drop_index("ix_memories_org_id", table_name="memories")
    op.drop_table("memories")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
    op.drop_table("organizations")
