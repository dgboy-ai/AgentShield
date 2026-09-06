"""add kms_signature to constraints for non-repudiation (4)

Revision ID: e7f3a1b2c4d5
Revises: c9b1a8d7e6f5
Create Date: 2026-09-06

Fix for 4: signing_engine.sign_json return was discarded for constraints.
Now store kms_signature in constraints table like memories, and verify on read.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'e7f3a1b2c4d5'
down_revision: Union[str, Sequence[str], None] = 'c9b1a8d7e6f5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("constraints", sa.Column("kms_signature", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("constraints", "kms_signature")
