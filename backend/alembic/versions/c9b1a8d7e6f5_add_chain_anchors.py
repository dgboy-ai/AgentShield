"""add chain_anchors for durable external anchoring (1.4)

Revision ID: c9b1a8d7e6f5
Revises: e6608869d062
Create Date: 2026-09-06

Fix for 1.4: anchors.log was ephemeral file only. This migration adds
chain_anchors table for DB-durable anchoring (survives restarts, multi-worker)
with anchor_target for S3/webhook/file extensibility.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'c9b1a8d7e6f5'
down_revision: Union[str, Sequence[str], None] = 'e6608869d062'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "chain_anchors",
        sa.Column("anchor_id", sa.String(length=36), primary_key=True),
        sa.Column("org_id", sa.String(length=36), sa.ForeignKey("organizations.org_id"), nullable=False),
        sa.Column("chain_type", sa.String(length=50), nullable=False),
        sa.Column("chain_head_hash", sa.String(length=64), nullable=False),
        sa.Column("chain_length", sa.Integer(), nullable=False),
        sa.Column("anchor_target", sa.String(length=50), nullable=False),
        sa.Column("external_ref", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_chain_anchors_org_id", "chain_anchors", ["org_id"], unique=False)
    op.create_index("ix_chain_anchors_created_at", "chain_anchors", ["created_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_chain_anchors_created_at", table_name="chain_anchors")
    op.drop_index("ix_chain_anchors_org_id", table_name="chain_anchors")
    op.drop_table("chain_anchors")
