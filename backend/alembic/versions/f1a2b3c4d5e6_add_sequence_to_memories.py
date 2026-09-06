"""add sequence_number to memories if missing (1.2 fix for cockroach)

Revision ID: f1a2b3c4d5e6
Revises: e7f3a1b2c4d5
Create Date: 2026-09-06

Fix: memories table on Cockroach was created before sequence_number was added,
and create_all doesn't add columns to existing tables. This migration adds it.
For SQLite dev where column already exists via create_all, it no-ops.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'f1a2b3c4d5e6'
down_revision: Union[str, Sequence[str], None] = 'e7f3a1b2c4d5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Check if column already exists (dev SQLite already has it via create_all)
    from sqlalchemy import inspect
    bind = op.get_bind()
    inspector = inspect(bind)
    try:
        cols = [c["name"] for c in inspector.get_columns("memories")]
    except Exception:
        cols = []
    if "sequence_number" not in cols:
        op.add_column("memories", sa.Column("sequence_number", sa.Integer(), nullable=True))


def downgrade() -> None:
    try:
        op.drop_column("memories", "sequence_number")
    except Exception:
        pass
