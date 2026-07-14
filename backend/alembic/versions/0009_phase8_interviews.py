"""
Phase 8 Database Migration
Adds: interviews and interview_messages tables.
Applies RLS on both tables.
"""
from typing import Sequence, Union
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision: str = "0009_phase8_interviews"
down_revision: Union[str, None] = "0008_phase7_challenges"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _apply_rls(conn, table: str) -> None:
    conn.execute(sa.text(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY"))
    conn.execute(sa.text(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY"))
    conn.execute(sa.text(f"""
        CREATE POLICY tenant_isolation ON {table}
        USING (
            tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
            OR current_setting('app.bypass_rls', true) = 'true'
        )
    """))


def upgrade() -> None:
    # 1. interviews table
    op.create_table(
        "interviews",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("application_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("status", sa.String(50), nullable=False, server_default="SCHEDULED"),
        sa.Column("overall_score", sa.Float(), nullable=True),
        sa.Column("evaluation_report", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["application_id"], ["applications.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_interviews_application_id", "interviews", ["application_id"])

    # 2. interview_messages table
    op.create_table(
        "interview_messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("interview_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("sender", sa.String(50), nullable=False),
        sa.Column("message_text", sa.Text(), nullable=False),
        sa.Column("audio_url", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["interview_id"], ["interviews.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_interview_messages_interview_id", "interview_messages", ["interview_id"])

    # Apply RLS
    conn = op.get_bind()
    _apply_rls(conn, "interviews")
    _apply_rls(conn, "interview_messages")


def downgrade() -> None:
    op.drop_table("interview_messages")
    op.drop_table("interviews")
